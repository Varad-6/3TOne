// src/components/ExportButton.jsx
import React, { useState } from "react";
import { Button } from "./ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import api from "../services/api"; // ← Use your custom api instance

const ExportButton = ({ endpoint = "all", label = "Export Data" }) => {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      // Your api instance automatically adds the Bearer token
      const response = await api.get(`/export/${endpoint}`, {
        responseType: "blob",
        skipCache: true, // ← Skip cache for downloads
      });

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers["content-disposition"];
      const filename = contentDisposition
        ? contentDisposition.match(/filename="(.+)"/)?.[1]
        : `3TOne_Report_${Date.now()}.xlsx`;

      // Create download link
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Downloaded successfully!");
    } catch (error) {
      console.error("download failed:", error);

      if (error.response?.status === 403) {
        toast.error("🚫 Access denied. Admin privileges required.");
      } else if (error.response?.status === 401) {
        toast.error("🔒 Session expired. Please login again.");
      } else {
        toast.error("❌ Failed to export data. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleExport} disabled={loading} className="gap-2">
      <Download className="h-4 w-4" />
      {loading ? "Loading..." : label}
    </Button>
  );
};

export default ExportButton;

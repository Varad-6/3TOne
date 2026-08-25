// src/components/admin/AdminReports.jsx

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import timesheetReportService from "../../services/timesheetReportService";
import { ReportFilterSection } from "./reports/ReportFilterSection";
import { ReportSummaryCards } from "./reports/ReportSummaryCards";
import { ReportTable } from "./reports/ReportTable";
import { useAuth } from "../../hooks/useAuth";

const INITIAL_FILTERS = {
  employeeIds: [], // multi-select — array of UUIDs
  projectIds: [], // multi-select — array of UUIDs
  ticketIds: [], // multi-select — array of UUIDs
  clientIds: [], // multi-select — array of UUIDs
  fromDate: "",
  toDate: "",
  status: "",
};

const INITIAL_PAGINATION = {
  page: 1,
  pageSize: 25,
  sortBy: "entry_date",
  sortDir: "desc",
};

export function AdminReports() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  // ── State ────────────────────────────────────────────────────
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [pagination, setPagination] = useState(INITIAL_PAGINATION);
  const [filterOptions, setFilterOptions] = useState({
    employees: [],
    projects: [],
    tickets: [],
    managers: [],
    statuses: [],
    clients: [],
    departments: [],
  });

  const [reportData, setReportData] = useState([]);
  const [reportPagination, setReportPagination] = useState(null);
  const [reportSummary, setReportSummary] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportMode, setExportMode] = useState("item"); // "item" | "header" | "employee-billable"

  // ── Header-mode table data ───────────────────────────────────
  const [headerReportData, setHeaderReportData] = useState([]);
  const [loadingHeader, setLoadingHeader] = useState(false);

  // ── Load filter options once on mount ───────────────────────
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // ── Re-fetch when pagination changes ────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchReport();
  }, [pagination]);

  // ── Re-fetch header data when exportMode switches to "header" or "employee-billable" ──
  useEffect(() => {
    if (exportMode === "header") {
      fetchHeaderReport();
    } else if (exportMode === "employee-billable") {
      fetchEmployeeBillableReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportMode]);

  const fetchFilterOptions = async () => {
    try {
      setLoadingOptions(true);
      const data = await timesheetReportService.getFilterOptions();
      setFilterOptions(data);
    } catch (error) {
      console.error("Failed to fetch filter options:", error);
      toast.error("Failed to load filter options");
    } finally {
      setLoadingOptions(false);
    }
  };

  const fetchReport = useCallback(async () => {
    try {
      setLoadingReport(true);
      const activeFilters = buildActiveFilters(filters);
      const data = await timesheetReportService.getReport({
        ...activeFilters,
        ...pagination,
      });
      setReportData(data.data || []);
      setReportPagination(data.pagination || null);
      setReportSummary(data.summary || null);
    } catch (error) {
      console.error("Failed to fetch report:", error);
      toast.error(error?.response?.data?.error || "Failed to fetch report");
    } finally {
      setLoadingReport(false);
    }
  }, [filters, pagination]);

  const fetchHeaderReport = useCallback(async () => {
    try {
      setLoadingHeader(true);
      const activeFilters = buildActiveFilters(filters);
      const data = await timesheetReportService.getHeaderReport(activeFilters);
      setHeaderReportData(data.data || []);
    } catch (error) {
      console.error("Failed to fetch header report:", error);
      toast.error(
        error?.response?.data?.error || "Failed to fetch header report",
      );
    } finally {
      setLoadingHeader(false);
    }
  }, [filters]);

  const fetchEmployeeBillableReport = useCallback(async () => {
    try {
      setLoadingHeader(true);
      const activeFilters = buildActiveFilters(filters);
      const data =
        await timesheetReportService.getEmployeeBillableReport(activeFilters);
      setHeaderReportData(data.data || []);
    } catch (error) {
      console.error("Failed to fetch employee billable report:", error);
      toast.error(
        error?.response?.data?.error ||
          "Failed to fetch employee billable report",
      );
    } finally {
      setLoadingHeader(false);
    }
  }, [filters]);

  // Convert filter state → URL params.
  // Strips empty strings/nulls. Arrays joined as comma-separated UUIDs.
  function buildActiveFilters(f) {
    const result = {};
    for (const [key, val] of Object.entries(f)) {
      if (val === "" || val === null || val === undefined) continue;
      if (Array.isArray(val)) {
        if (val.length === 0) continue;
        result[key] = val.join(",");
      } else {
        result[key] = val;
      }
    }
    return result;
  }

  const handleApplyFilters = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchReport();
    if (exportMode === "header") {
      fetchHeaderReport();
    } else if (exportMode === "employee-billable") {
      fetchEmployeeBillableReport();
    }
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setPagination(INITIAL_PAGINATION);
  };

  const handleSort = (column) => {
    setPagination((prev) => ({
      ...prev,
      sortBy: column,
      sortDir:
        prev.sortBy === column && prev.sortDir === "desc" ? "asc" : "desc",
      page: 1,
    }));
  };

  const handlePageChange = (newPage) =>
    setPagination((prev) => ({ ...prev, page: newPage }));
  const handlePageSizeChange = (newSize) =>
    setPagination((prev) => ({ ...prev, pageSize: newSize, page: 1 }));

  // ── Export ALL records (server-side, respects active filters + sort) ──────
  // Called by "Export All" button in ReportTable when there are more records
  // than the current page. Calls /timesheet-report/export with active filters.
  const handleExportAll = async () => {
    try {
      setExporting(true);
      const api = (await import("../../services/api")).default;
      const activeFilters = buildActiveFilters(filters);
      const params = {
        ...activeFilters,
        sortBy: pagination.sortBy,
        sortDir: pagination.sortDir,
        exportMode, // "item" | "header" | "employee-billable"
      };
      const response = await api.get("/timesheet-report/export", {
        params,
        responseType: "blob",
      });
      const cd = response.headers["content-disposition"] || "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const filename =
        match?.[1] ||
        `TimesheetReport_${new Date().toISOString().split("T")[0]}.xlsx`;
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${filename}`);
    } catch (err) {
      console.error("Export all failed:", err);
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* ── Page Header ───────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Timesheet Reports</h1>
          <p className="text-muted-foreground">
            Filter and explore all timesheet data
          </p>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────── */}
      <ReportFilterSection
        filters={filters}
        setFilters={setFilters}
        filterOptions={filterOptions}
        loadingOptions={loadingOptions}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        isAdmin={isAdmin}
        exportMode={exportMode}
        onExportModeChange={setExportMode}
      />

      {/* ── Summary KPI Cards ─────────────────────────────── */}
      {reportSummary && (
        <ReportSummaryCards summary={reportSummary} loading={loadingReport} />
      )}

      {/* ── Detailed Report ───────────────────────────────── */}
      <ReportTable
        data={reportData}
        pagination={reportPagination}
        currentPagination={pagination}
        loading={loadingReport}
        onSort={handleSort}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        onExportAll={handleExportAll}
        exporting={exporting}
        exportMode={exportMode}
        headerData={headerReportData}
        loadingHeader={loadingHeader}
      />
    </div>
  );
}

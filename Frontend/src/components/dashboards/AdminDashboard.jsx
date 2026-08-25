// src/components/dashboards/AdminDashboard.jsx

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Users, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import employeeService from "../../services/employeeService";
import timesheetService from "../../services/timesheetService";
import projectService from "../../services/projectService";
import { toast } from "sonner";
import ExportButton from "../ExportButton"; // ← Add this import

const AdminDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeProjects: 0,
    pendingTimesheets: 0,
    approvedTimesheets: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentTimesheets, setRecentTimesheets] = useState([]);

  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState("");

  useEffect(() => {
    // Rate limit and retry event listeners
    const handleRateLimit = (event) => {
      const { retryAfter, url } = event.detail;
      setRetrying(true);
      setRetryMessage(`Rate limited on ${url}. Retrying in ${retryAfter}s...`);
    };

    const handleRetry = () => {
      setRetrying(false);
      setRetryMessage("");
    };

    window.addEventListener("api-rate-limit", handleRateLimit);
    window.addEventListener("api-retry", handleRetry);

    // Initial data fetch
    fetchDashboardData();

    // Cleanup
    return () => {
      window.removeEventListener("api-rate-limit", handleRateLimit);
      window.removeEventListener("api-retry", handleRetry);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Use correct status names from timesheet_status lookup
      const [employeesRes, projectsRes, timesheetsRes, approvedRes] =
        await Promise.allSettled([
          employeeService.getAllEmployees(),
          projectService.getAllProjects(),
          timesheetService.getTimesheets({ status: "Submitted" }),
          timesheetService.getTimesheets({ status: "Manager_Approved" }),
        ]);

      const getData = (result) =>
        result.status === "fulfilled" ? result.value : null;

      const employeesData = getData(employeesRes);
      const projectsData = getData(projectsRes);
      const timesheetsData = getData(timesheetsRes);
      const approvedData = getData(approvedRes);

      console.log("📊 Dashboard data:", {
        employeesData,
        projectsData,
        timesheetsData,
        approvedData,
      });

      // projectService.getAllProjects returns status as status name
      const activeProjects =
        projectsData?.projects?.filter(
          (project) => project.status === "In Progress"
        ) || [];

      setStats({
        totalEmployees:
          employeesData?.count || employeesData?.employees?.length || 0,
        activeProjects: activeProjects.length,
        pendingTimesheets:
          timesheetsData?.count || timesheetsData?.timesheets?.length || 0,
        approvedTimesheets:
          approvedData?.count || approvedData?.timesheets?.length || 0,
      });

      if (timesheetsData?.timesheets) {
        setRecentTimesheets(timesheetsData.timesheets.slice(0, 5));
      }

      const failedRequests = [
        { name: "Employees", result: employeesRes },
        { name: "Projects", result: projectsRes },
        { name: "Pending Timesheets", result: timesheetsRes },
        { name: "Approved Timesheets", result: approvedRes },
      ].filter((req) => req.result.status === "rejected");

      if (failedRequests.length > 0) {
        console.error(
          "Some dashboard data failed to load:",
          failedRequests.map((r) => `${r.name}: ${r.result.reason}`)
        );
        toast.error("Some dashboard data could not be loaded");
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user?.name}!</p>
          {retrying && (
            <div className="mt-2 text-sm text-yellow-600 bg-yellow-50 px-3 py-2 rounded-md flex items-center">
              <div className="mr-2 h-4 w-4 rounded-full border-2 border-yellow-600 border-t-transparent animate-spin"></div>
              {retryMessage}
            </div>
          )}
        </div>

        {/* ← Export Button Added Here */}
        <ExportButton endpoint="all" label="Download Reports" />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Employees
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEmployees}</div>
            <p className="text-xs text-muted-foreground">
              Active users in system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Projects
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeProjects}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Timesheets
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingTimesheets}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Approved This Month
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approvedTimesheets}</div>
            <p className="text-xs text-muted-foreground">
              Successfully approved
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;

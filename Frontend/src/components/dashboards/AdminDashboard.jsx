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
import ExportButton from "../ExportButton";
import { FadeInStagger, FadeInItem, FadeIn } from "../ui/fade-in";
import { NumberTicker } from "../ui/number-ticker";

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
      <FadeIn className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Syncing with backend...</p>
        </div>
      </FadeIn>
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

      {/* Modern Bento-Box Stats */}
      <FadeInStagger staggerDelay={0.1} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Employees */}
        <FadeInItem>
        <Card className="relative overflow-hidden group border-none shadow-soft hover:shadow-soft-lg transition-all duration-300 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-background">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 translate-x-[-100%] group-hover:translate-x-[100%] pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
              Total Employees
            </CardTitle>
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
              <Users className="h-4 w-4 text-indigo-700 dark:text-indigo-400" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-foreground">
              <NumberTicker value={stats.totalEmployees} />
            </div>
            <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-1 font-medium">
              Active users in system
            </p>
          </CardContent>
        </Card>
        </FadeInItem>

        {/* Card 2: Active Projects */}
        <FadeInItem>
        <Card className="relative overflow-hidden group border-none shadow-soft hover:shadow-soft-lg transition-all duration-300 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              Active Projects
            </CardTitle>
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
              <FileText className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-foreground">
              <NumberTicker value={stats.activeProjects} />
            </div>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1 font-medium">
              Currently running
            </p>
          </CardContent>
        </Card>
        </FadeInItem>

        {/* Card 3: Pending Timesheets */}
        <FadeInItem>
        <Card className="relative overflow-hidden group border-none shadow-soft hover:shadow-soft-lg transition-all duration-300 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              Pending Timesheets
            </CardTitle>
            <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-foreground">
              <NumberTicker value={stats.pendingTimesheets} />
            </div>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1 font-medium">
              Awaiting approval
            </p>
          </CardContent>
        </Card>
        </FadeInItem>

        {/* Card 4: Approved This Month */}
        <FadeInItem>
        <Card className="relative overflow-hidden group border-none shadow-soft hover:shadow-soft-lg transition-all duration-300 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              Approved Timesheets
            </CardTitle>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <CheckCircle className="h-4 w-4 text-blue-700 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-foreground">
              <NumberTicker value={stats.approvedTimesheets} />
            </div>
            <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1 font-medium">
              Successfully processed
            </p>
          </CardContent>
        </Card>
        </FadeInItem>
      </FadeInStagger>
    </div>
  );
};

export default AdminDashboard;

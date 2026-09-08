import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import dashboardService from "../../services/dashboardService";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export function EmployeeDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    weeklyHours: 0,
    pendingTimesheets: 0,
    approvedTimesheets: 0,
    rejectedTimesheets: 0,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await dashboardService.getEmployeeDashboard();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const weeklyProgress = (stats.weeklyHours / 40) * 100;

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
  const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl font-bold tracking-tight">Employee Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track your timesheet submissions and work hours
        </p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Weekly Hours */}
        <motion.div variants={item}>
          <Card className="border-none shadow-sm bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-zinc-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-blue-700 dark:text-blue-300 text-sm font-semibold">Weekly Hours</CardTitle>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg"><Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" /></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.weeklyHours} hrs</div>
              <p className="text-xs text-muted-foreground">
                {weeklyProgress.toFixed(0)}% of 40 hours target
              </p>
              <div className="mt-2 h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(weeklyProgress, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pending Timesheets */}
        <motion.div variants={item}>
          <Card className="border-none shadow-sm bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-zinc-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-amber-700 dark:text-amber-300 text-sm font-semibold">
                Pending Approval
              </CardTitle>
              <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg"><AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" /></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingTimesheets}</div>
              <p className="text-xs text-muted-foreground">
                Waiting for approval
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Approved Timesheets */}
        <motion.div variants={item}>
          <Card className="border-none shadow-sm bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-zinc-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-emerald-700 dark:text-emerald-300 text-sm font-semibold">
                Approved (This Month)
              </CardTitle>
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg"><CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approvedTimesheets}</div>
              <p className="text-xs text-muted-foreground">
                Timesheets approved
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Rejected Timesheets */}
        <motion.div variants={item}>
          <Card className="border-none shadow-sm bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-zinc-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-red-700 dark:text-red-300 text-sm font-semibold">
                Rejected (This Month)
              </CardTitle>
              <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg"><XCircle className="h-4 w-4 text-red-600 dark:text-red-400" /></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.rejectedTimesheets}
              </div>
              <p className="text-xs text-muted-foreground">Need attention</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common timesheet tasks</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Link
            to="/employee/timesheet"
            className="flex items-center gap-4 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:bg-primary/5 hover:border-primary/20 transition-all duration-200 group"
          >
            <Clock className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
            <div>
              <h3 className="font-semibold text-sm">Log Hours</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add timesheet entries for this week
              </p>
            </div>
          </Link>

          <Link
            to="/employee/history"
            className="flex items-center gap-4 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:bg-primary/5 hover:border-primary/20 transition-all duration-200 group"
          >
            <CheckCircle className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
            <div>
              <h3 className="font-semibold text-sm">View History</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                See all submitted timesheets
              </p>
            </div>
          </Link>
        </CardContent>
      </Card>

      {/* Status Summary */}
      {stats.weeklyHours < 40 && (
        <Card className="border-yellow-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Action Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              You have logged {stats.weeklyHours} hours this week. You need{" "}
              {(40 - stats.weeklyHours).toFixed(1)} more hours to reach the
              weekly target.
            </p>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

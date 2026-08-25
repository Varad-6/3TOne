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
      console.log("Dashboard data:", data);
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
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const weeklyProgress = (stats.weeklyHours / 40) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Employee Dashboard</h1>
        <p className="text-muted-foreground">
          Track your timesheet submissions and work hours
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Weekly Hours */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
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

        {/* Pending Timesheets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Approval
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingTimesheets}</div>
            <p className="text-xs text-muted-foreground">
              Waiting for approval
            </p>
          </CardContent>
        </Card>

        {/* Approved Timesheets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Approved (This Month)
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approvedTimesheets}</div>
            <p className="text-xs text-muted-foreground">
              Timesheets approved
            </p>
          </CardContent>
        </Card>

        {/* Rejected Timesheets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Rejected (This Month)
            </CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.rejectedTimesheets}
            </div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
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
            className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent transition-colors"
          >
            <Clock className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-semibold">Log Hours</h3>
              <p className="text-sm text-muted-foreground">
                Add timesheet entries for this week
              </p>
            </div>
          </Link>

          <Link
            to="/employee/history"
            className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent transition-colors"
          >
            <CheckCircle className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-semibold">View History</h3>
              <p className="text-sm text-muted-foreground">
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
    </div>
  );
}

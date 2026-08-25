import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import timesheetService from "../../services/timesheetService";
import { format } from "date-fns";
import { minutesToHHMM, hhmmToMinutes } from "../../utils/timeUtils";

export const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    teamMembers: 0,
    pendingApprovals: 0,
    approvedThisWeek: 0,
    teamHoursThisWeek: 0,
  });

  const [pendingTimesheets, setPendingTimesheets] = useState([]);
  const [teamProgress, setTeamProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);

        const [
          teamMembersCount,
          pendingApprovalsCount,
          approvedCount,
          teamHoursCount,
          pendingListRaw,
          submissionProgressList,
        ] = await Promise.all([
          timesheetService.getTeamMembersCount(),
          timesheetService.getPendingApprovalsCount(),
          timesheetService.getApprovedThisWeekCount(),
          timesheetService.getTeamHoursThisWeek(),
          timesheetService.getPendingApprovals(),
          timesheetService.getTeamSubmissionProgress(),
        ]);

        setStats({
          teamMembers: teamMembersCount,
          pendingApprovals: pendingApprovalsCount,
          approvedThisWeek: approvedCount,
          teamHoursThisWeek: teamHoursCount,
        });

        const formattedPending = pendingListRaw.map((item) => ({
          id: `${item.employee_id}_${item.week_start_date}`,
          employee_id: item.employee_id,
          employee_name: item.employee_name,
          week_start: item.week_start_date,
          week_end: item.week_end_date,
          total_hours: minutesToHHMM(item.total_hours),
          entry_count: item.entry_count,
          designation: item.designation || "Team Member",
        }));

        setPendingTimesheets(formattedPending);
        setTeamProgress(submissionProgressList);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const statsArray = [
    {
      label: "Team Members",
      value: stats.teamMembers,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      label: "Pending Approvals",
      value: stats.pendingApprovals,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      label: "Approved This Week",
      value: stats.approvedThisWeek,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      label: "Team Hours This Week",
      value: minutesToHHMM(stats.teamHoursThisWeek),
      icon: Clock,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ];

  // Approve weekly timesheet
  // const handleApprove = async (item) => {
  //   setActionLoading(item.id);
  //   try {
  //     await timesheetService.approveWeek(
  //       item.employee_id,
  //       item.week_start,
  //       item.week_end,
  //       "Quick Approved from Dashboard",
  //     );

  //     toast.success(`Approved timesheet for ${item.employee_name}`);

  //     setPendingTimesheets((prev) => prev.filter((t) => t.id !== item.id));

  //     setStats((prev) => ({
  //       ...prev,
  //       pendingApprovals: Math.max(0, prev.pendingApprovals - 1),
  //       approvedThisWeek: prev.approvedThisWeek + 1,
  //     }));
  //   } catch (error) {
  //     console.error("Approve error:", error);
  //     toast.error("Failed to approve timesheet");
  //   } finally {
  //     setActionLoading(null);
  //   }
  // };

  const formatDateRange = (start, end) => {
    return `${format(new Date(start), "MMM d")} - ${format(
      new Date(end),
      "MMM d",
    )}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Manager Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor your team's timesheet submissions and progress
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsArray.map((stat) => (
          <Card
            key={stat.label}
            className="flex flex-col justify-between hover:shadow-md transition-shadow"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <div className={`p-2 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Approvals - Takes up 2 columns */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>Timesheets awaiting review</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/manager/approvals")}
            >
              View All <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingTimesheets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-100" />
                <p>All caught up! No pending approvals.</p>
              </div>
            ) : (
              pendingTimesheets.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                      {item.employee_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        {item.employee_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.designation}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDateRange(item.week_start, item.week_end)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <span className="block font-bold text-sm">
                        {item.total_hours} hrs
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.entry_count} entries
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/manager/approvals")}
                      >
                        Details
                      </Button>
                      {/* <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleApprove(item)}
                        disabled={actionLoading === item.id}
                      > */}
                      {/* {actionLoading === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Approve"
                        )}
                      </Button> */}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Team Submission Status - Takes up 1 column */}
        <Card>
          <CardHeader>
            <CardTitle>Submission Progress</CardTitle>
            <CardDescription>Monthly completion rates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {teamProgress.length === 0 ? (
              <p className="text-muted-foreground text-center py-4 text-sm">
                No data available
              </p>
            ) : (
              teamProgress.map((member) => (
                <div key={member.name}>
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span>{member.name}</span>
                    <span className="text-muted-foreground">
                      {member.submitted}/{member.total} weeks
                    </span>
                  </div>
                  <Progress value={member.percentage} className="h-2" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerts & Reminders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start space-x-3 p-3 bg-orange-50 rounded-md border border-orange-100">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <p className="font-medium text-sm text-orange-900">
                  {stats.pendingApprovals} Pending Approvals
                </p>
                <p className="text-xs text-orange-700 mt-0.5">
                  Approve by Friday to ensure timely payroll processing.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-md border border-blue-100">
              <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-sm text-blue-900">
                  Reporting Period Open
                </p>
                <p className="text-xs text-blue-700 mt-0.5">
                  Current week ends on {format(new Date(), "EEEE")}.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ManagerDashboard;

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Eye,
  Search,
  Loader2,
  XCircle,
  CheckCircle2,
  User,
  AlertTriangle,
} from "lucide-react";
import { Button } from "../ui/button";
import { toast } from "sonner";
import api from "../../services/api";

import { TimesheetDetailsDialog } from "../ui/TimesheetDetailsDialog";
import { minutesToHHMM } from "../../utils/timeUtils";

// ─────────────────────────────────────────────
// Status badge helper
//
// overall_status values produced by the backend:
//   "Submitted"         – all entries still awaiting any approval
//   "Partially_Approved"– at least one entry is approved, others may be pending/rejected
//   "Partially_Rejected"– at least one entry is rejected, none are approved
//   "Approved"          – all entries approved (Manager or Admin)
//   "Rejected"          – all entries rejected (Manager or Admin)
// ─────────────────────────────────────────────
function getStatusBadge(overall) {
  switch (overall) {
    case "Approved":
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-200 rounded-full">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      );

    case "Partially_Approved":
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 rounded-full">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Partially Approved
        </Badge>
      );

    case "Partially_Rejected":
      return (
        <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200 rounded-full">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Partially Rejected
        </Badge>
      );

    case "Rejected":
      return (
        <Badge className="bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200 rounded-full">
          <XCircle className="h-3 w-3 mr-1" />
          Rejected
        </Badge>
      );

    case "Submitted":
    default:
      return (
        <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 rounded-full">
          <User className="h-3 w-3 mr-1" />
          Submitted
        </Badge>
      );
  }
}

export function TimesheetHistory() {
  const [timesheets, setTimesheets] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTimesheets();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const fetchTimesheets = async () => {
    try {
      setLoading(true);
      const response = await api.get("/timesheet-entries/history");
      const data = response.data.timesheets || [];

      const formattedTimesheets = data.map((ts) => {
        // The backend now returns overall_status as a single computed string.
        // We fall back gracefully if it's missing (old API compat).
        const overallStatus =
          ts.overall_status ||
          (Array.isArray(ts.statuses)
            ? deriveOverallFromArray(ts.statuses)
            : ts.statuses || "Submitted");

        return {
          // Stable ID
          timesheet_id:
            ts.timesheet_id || `${ts.week_start_date}_${ts.week_end_date}`,

          // Period
          period: `${formatDate(ts.week_start_date)} to ${formatDate(ts.week_end_date)}`,
          week_start_date: ts.week_start_date,
          week_end_date: ts.week_end_date,

          // Time (MINUTES — backend truth)
          total_hours: Number(ts.total_hours ?? 0),
          entry_count: Number(ts.entry_count) || 0,

          // Computed overall status
          status: overallStatus,

          submitted_at: ts.submitted_at,

          // Manager approval meta
          manager_approved_at: ts.manager_approved_at,
          manager_approved_by_name: ts.manager_approved_by_name,
          manager_rejected_at: ts.manager_rejected_at,
          manager_rejected_by_name: ts.manager_rejected_by_name,
          manager_rejection_reason: ts.manager_rejection_reason,

          // Admin approval meta
          admin_approved_at: ts.admin_approved_at,
          admin_approved_by_name: ts.admin_approved_by_name,
          admin_rejected_at: ts.admin_rejected_at,
          admin_rejected_by_name: ts.admin_rejected_by_name,
          admin_rejection_reason: ts.admin_rejection_reason,

          // Meta
          projects: ts.projects || "N/A",
          activities: ts.activities || "N/A",
          employeeName: ts.employee_name || "Me",

          // Per-entry details (minutes-based)
          entries: ts.entries || [],
        };
      });

      setTimesheets(formattedTimesheets);
    } catch (error) {
      console.error("Failed to fetch timesheets:", error);
      toast.error("Failed to load timesheet history");
    } finally {
      setLoading(false);
    }
  };

  // Backward-compat helper: derive display status from old string_agg array
  function deriveOverallFromArray(statusArray) {
    const approved = statusArray.filter((s) =>
      ["Manager_Approved", "Admin_Approved"].includes(s),
    ).length;
    const rejected = statusArray.filter((s) =>
      ["Manager_Rejected", "Admin_Rejected"].includes(s),
    ).length;
    const total = statusArray.length;

    if (total === 0) return "Submitted";
    if (approved === total) return "Approved";
    if (rejected === total) return "Rejected";
    if (approved > 0) return "Partially_Approved";
    if (rejected > 0) return "Partially_Rejected";
    return "Submitted";
  }

  // ── Filter helpers ────────────────────────────────────────────────────────

  // Map dropdown filter value → which overall_status values to show
  const STATUS_FILTER_MAP = {
    all: null, // show everything
    Submitted: ["Submitted"],
    Partially_Approved: ["Partially_Approved"],
    Partially_Rejected: ["Partially_Rejected"],
    Manager_Approved: ["Approved"], // for backward compat label
    Admin_Approved: ["Approved"],
    Approved: ["Approved"],
    Manager_Rejected: ["Rejected"],
    Admin_Rejected: ["Rejected"],
    Rejected: ["Rejected"],
  };

  const filteredTimesheets = timesheets.filter((ts) => {
    const allowedStatuses = STATUS_FILTER_MAP[statusFilter];
    const matchesStatus =
      !allowedStatuses || allowedStatuses.includes(ts.status);

    const matchesSearch =
      ts.period.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ts.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ts.projects &&
        ts.projects.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Timesheet History
        </h1>
        <p className="text-muted-foreground">
          View and manage your past timesheet submissions
        </p>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="relative w-full sm:w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search timesheets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Submitted">Submitted</SelectItem>
                <SelectItem value="Partially_Approved">
                  Partially Approved
                </SelectItem>
                <SelectItem value="Partially_Rejected">
                  Partially Rejected
                </SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Timesheet Records</CardTitle>
          <CardDescription>
            Showing {filteredTimesheets.length} of {timesheets.length}{" "}
            timesheets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Total Hours</TableHead>
                <TableHead>Entries</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTimesheets.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No timesheets found
                  </TableCell>
                </TableRow>
              ) : (
                filteredTimesheets.map((ts) => (
                  <TableRow key={ts.timesheet_id}>
                    <TableCell className="font-medium">{ts.period}</TableCell>
                    <TableCell>{minutesToHHMM(ts.total_hours ?? 0)}</TableCell>
                    <TableCell>{ts.entry_count}</TableCell>
                    <TableCell>{getStatusBadge(ts.status)}</TableCell>
                    <TableCell>
                      {ts.submitted_at ? formatDate(ts.submitted_at) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <TimesheetDetailsDialog
                        timesheet={ts}
                        trigger={
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4 text-blue-600 hover:text-blue-700" />
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default TimesheetHistory;

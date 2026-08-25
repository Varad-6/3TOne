import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Filter,
  Loader2,
  Search,
  XCircle,
  User,
  Eye,
  X,
  AlertTriangle,
} from "lucide-react";
import timesheetService from "../../services/timesheetService";
import { format, isValid } from "date-fns";
import { TimesheetDetailsDialog } from "../ui/TimesheetDetailsDialog";

const PAGE_SIZE = 10;

// ─────────────────────────────────────────────
// Derived helpers
// ─────────────────────────────────────────────

/**
 * Render the correct badge for an overall_status string.
 * overall_status values produced by the backend:
 *   "Submitted" | "Partially_Approved" | "Partially_Rejected" |
 *   "Approved"  | "Rejected"
 * (individual entry status strings like "Manager_Approved" are only shown
 *  inside the entry drill-down, not at the week-summary row level)
 */
function getOverallStatusBadge(overall) {
  switch (overall) {
    case "Approved":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200 rounded-full">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      );
    case "Rejected":
      return (
        <Badge className="bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200 rounded-full">
          <XCircle className="h-3 w-3 mr-1" />
          Rejected
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
    case "Submitted":
    default:
      return (
        <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 rounded-full">
          <User className="h-3 w-3 mr-1" />
          Pending Review
        </Badge>
      );
  }
}

/**
 * Badge for individual entry-level status (shown in drill-down / details).
 */
function getEntryStatusBadge(entryStatus) {
  const map = {
    Submitted: (
      <Badge className="bg-blue-100 text-blue-700 border-blue-200 rounded-full text-xs">
        Pending
      </Badge>
    ),
    Manager_Approved: (
      <Badge className="bg-green-100 text-green-700 border-green-200 rounded-full text-xs">
        <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
        Mgr Approved
      </Badge>
    ),
    Manager_Rejected: (
      <Badge className="bg-rose-100 text-rose-700 border-rose-200 rounded-full text-xs">
        <XCircle className="h-2.5 w-2.5 mr-0.5" />
        Mgr Rejected
      </Badge>
    ),
    Admin_Approved: (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 rounded-full text-xs">
        <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
        Admin Approved
      </Badge>
    ),
    Admin_Rejected: (
      <Badge className="bg-red-100 text-red-700 border-red-200 rounded-full text-xs">
        <XCircle className="h-2.5 w-2.5 mr-0.5" />
        Admin Rejected
      </Badge>
    ),
  };
  return (
    map[entryStatus] ?? (
      <Badge variant="outline" className="text-xs">
        {entryStatus}
      </Badge>
    )
  );
}

export function AdminTimesheetApproval() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState(undefined);
  const [endDate, setEndDate] = useState(undefined);
  const [page, setPage] = useState(1);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    mode: null,
    timesheetId: null,
    timesheetData: null,
    comment: "",
  });
  const [selectedTimesheet, setSelectedTimesheet] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department, statusFilter, startDate, endDate]);

  const safeFormatDate = (dateInput) => {
    if (!dateInput) return "";
    const date = new Date(dateInput);
    return isValid(date) ? format(date, "dd-MM-yyyy") : "Invalid Date";
  };

  const formatMinutesToHHMM = (minutes) => {
    if (!minutes || minutes === 0) return "00:00";
    const total = Number(minutes);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const handleViewDetails = (row) => {
    setSelectedTimesheet({
      timesheet_id: row.entry_id,
      period: `${safeFormatDate(row.week_start_date)} to ${safeFormatDate(row.week_end_date)}`,
      week_start_date: row.week_start_date,
      week_end_date: row.week_end_date,
      totalHours: row.hours_logged,
      billableHours: row.total_billable_hours || 0,
      nonBillableHours: row.total_non_billable_hours || 0,
      entry_count: row.entry_count,
      status: row.overall_status,
      submitted_at: row.submitted_at,
      projects: row.projects,
      activities: row.activities,
      employeeName: row.employee_name,
      manager_approved_at: row.manager_approved_at,
      manager_approved_by_name: row.manager_approved_by_name,
      manager_rejected_at: row.manager_rejected_at,
      manager_rejected_by_name: row.manager_rejected_by_name,
      manager_rejection_reason: row.manager_rejection_reason,
      entries: row.entries || [],
    });
    setDetailsDialogOpen(true);
  };

  async function fetchData() {
    try {
      setLoading(true);
      // Always fetch all non-Draft data; server-side filtering is by overall_status
      const data = await timesheetService.getPendingApprovals(
        statusFilter === "history" ? "history" : statusFilter,
      );

      const formattedData = data.map((item) => {
        const dateStr =
          item.week_start_date instanceof Date
            ? item.week_start_date.toISOString().split("T")[0]
            : String(item.week_start_date).split("T")[0];

        return {
          entry_id: `${item.employee_id}_${dateStr}`,
          employee_id: item.employee_id,
          employee_code: item.employee_code,
          employee_name: item.employee_name,
          department: item.department || "N/A",
          designation: item.designation || "N/A",
          week_start_date: item.week_start_date,
          week_end_date: item.week_end_date,
          hours_logged: Number(item.total_hours) || 0,
          total_billable_hours: Number(item.total_billable_hours) || 0,
          total_non_billable_hours: Number(item.total_non_billable_hours) || 0,
          entry_count: parseInt(item.entry_count) || 0,
          // Use the computed overall_status for row-level display
          overall_status: item.overall_status || "Submitted",
          // has_actionable_entries: true when there are Submitted/Manager_Rejected
          // entries admin can still approve or reject
          has_actionable_entries: !!item.has_actionable_entries,
          submitted_at: item.submitted_at,
          projects: item.projects || "N/A",
          activities: item.activities || "N/A",
          manager_approved_at: item.manager_approved_at,
          manager_approved_by_name: item.manager_approved_by_name,
          manager_rejected_at: item.manager_rejected_at,
          manager_rejected_by_name: item.manager_rejected_by_name,
          manager_rejection_reason: item.manager_rejection_reason,
          entries: item.entries || [],
        };
      });

      setRows(formattedData);
      setPage(1);
    } catch (e) {
      console.error("Failed to load timesheets:", e);
      toast.error("Failed to load timesheets");
    } finally {
      setLoading(false);
    }
  }

  // ── Client-side filter (name / department / date) ─────────────────────────
  const filtered = useMemo(() => {
    let res = rows;

    if (query) {
      const q = query.toLowerCase();
      res = res.filter(
        (r) =>
          r.employee_name.toLowerCase().includes(q) ||
          r.employee_id.toLowerCase().includes(q) ||
          r.employee_code?.toLowerCase().includes(q),
      );
    }

    if (department !== "all") {
      res = res.filter((r) => r.department === department);
    }

    if (startDate) {
      res = res.filter((r) => new Date(r.week_start_date) >= startDate);
    }

    if (endDate) {
      res = res.filter((r) => new Date(r.week_end_date) <= endDate);
    }

    return res;
  }, [rows, query, department, startDate, endDate]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // ── Dialog helpers ────────────────────────────────────────────────────────

  const openApproveConfirm = (entryId) => {
    const ts = rows.find((r) => r.entry_id === entryId);
    setConfirmDialog({
      open: true,
      mode: "APPROVE_SINGLE",
      timesheetId: entryId,
      timesheetData: ts,
      comment: "",
    });
  };

  const openRejectDialog = (entryId) => {
    const ts = rows.find((r) => r.entry_id === entryId);
    setConfirmDialog({
      open: true,
      mode: "REJECT_SINGLE",
      timesheetId: entryId,
      timesheetData: ts,
      comment: "",
    });
  };

  const closeConfirmDialog = () =>
    setConfirmDialog({
      open: false,
      mode: null,
      timesheetId: null,
      timesheetData: null,
      comment: "",
    });

  const handleApprove = async () => {
    const { timesheetId, timesheetData, comment } = confirmDialog;
    try {
      await timesheetService.approveWeek(
        timesheetData.employee_id,
        timesheetData.week_start_date,
        timesheetData.week_end_date,
        comment,
      );
      // Refresh so updated statuses are visible
      void fetchData();
      toast.success("Timesheet approved successfully");
      closeConfirmDialog();
    } catch {
      toast.error("Failed to approve timesheet");
    }
  };

  const handleReject = async () => {
    const { timesheetId, timesheetData, comment } = confirmDialog;
    if (!comment?.trim()) {
      toast.error("A rejection reason is required");
      return;
    }
    try {
      await timesheetService.rejectWeek(
        timesheetData.employee_id,
        timesheetData.week_start_date,
        timesheetData.week_end_date,
        comment,
      );
      void fetchData();
      toast.success("Timesheet rejected");
      closeConfirmDialog();
    } catch {
      toast.error("Failed to reject timesheet");
    }
  };

  // A row is "history-like" (no pending action) when admin has no remaining
  // actionable entries.  NOTE: we still render approve/reject buttons if
  // has_actionable_entries is true, even when some entries are already
  // Manager_Approved — the backend will skip those protected entries.
  const isHistoryView =
    statusFilter === "history" ||
    statusFilter === "Admin_Approved" ||
    statusFilter === "Admin_Rejected";

  const hasActiveFilters =
    query || department !== "all" || startDate || endDate;

  const clearFilters = () => {
    setQuery("");
    setDepartment("all");
    setStartDate(undefined);
    setEndDate(undefined);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employee..."
              className="pl-9 h-9"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Department */}
          <Select
            value={department}
            onValueChange={(v) => {
              setDepartment(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              <SelectItem value="SALES & MARKETING">Sales & Marketing</SelectItem>
              <SelectItem value="HR">HR</SelectItem>
              <SelectItem value="FINANCE">Finance</SelectItem>
              <SelectItem value="DELIVERY">Delivery</SelectItem>
              <SelectItem value="ADMINISTRATION">Administration</SelectItem>
              <SelectItem value="IT-SUPPORT">IT-Support</SelectItem>
              <SelectItem value="MANAGEMENT">Management</SelectItem>
              <SelectItem value="PRESALES">Presales</SelectItem>
            </SelectContent>
          </Select>

          {/* Status — values match overall_status strings + special "history" */}
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pending</SelectItem>
              <SelectItem value="Submitted">Submitted</SelectItem>
              <SelectItem value="Partially_Approved">
                Partially Approved
              </SelectItem>
              <SelectItem value="Partially_Rejected">
                Partially Rejected
              </SelectItem>
              <SelectItem value="Manager_Approved">Manager Approved</SelectItem>
              <SelectItem value="Manager_Rejected">Manager Rejected</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
              <SelectItem value="Admin_Approved">Admin Approved</SelectItem>
              <SelectItem value="Admin_Rejected">Admin Rejected</SelectItem>
            </SelectContent>
          </Select>

          {/* Date range */}
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 w-full justify-start text-xs"
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {startDate ? format(startDate, "dd MMM") : "Start"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(d) => {
                    setStartDate(d || undefined);
                    setPage(1);
                  }}
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 w-full justify-start text-xs"
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {endDate ? format(endDate, "dd MMM") : "End"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(d) => {
                    setEndDate(d || undefined);
                    setPage(1);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* ── Results count ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "timesheet" : "timesheets"}{" "}
          found
        </p>
        {pageCount > 1 && (
          <p className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </p>
        )}
      </div>

      {/* ── Main table ─────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Employee</TableHead>
                  <TableHead className="font-semibold">Department</TableHead>
                  <TableHead className="font-semibold">Week</TableHead>
                  <TableHead className="text-center font-semibold">
                    Total
                  </TableHead>
                  <TableHead className="text-center font-semibold">
                    Billable
                  </TableHead>
                  <TableHead className="text-center font-semibold">
                    Non-Bill
                  </TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-center font-semibold">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center">
                      <Loader2 className="h-6 w-6 animate-spin inline-block text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-12 text-center text-muted-foreground"
                    >
                      No timesheets found
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((r) => (
                    <TableRow key={r.entry_id} className="hover:bg-muted/30">
                      {/* Employee */}
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            {r.employee_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {r.employee_code} • {r.designation}
                          </p>
                        </div>
                      </TableCell>

                      {/* Department */}
                      <TableCell className="text-sm">{r.department}</TableCell>

                      {/* Week */}
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">
                            {safeFormatDate(r.week_start_date)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            to {safeFormatDate(r.week_end_date)}
                          </p>
                        </div>
                      </TableCell>

                      {/* Hours */}
                      <TableCell className="text-center font-semibold text-sm">
                        {formatMinutesToHHMM(r.hours_logged)}
                      </TableCell>
                      <TableCell className="text-center text-green-600 font-semibold text-sm">
                        {formatMinutesToHHMM(r.total_billable_hours || 0)}
                      </TableCell>
                      <TableCell className="text-center text-orange-600 font-semibold text-sm">
                        {formatMinutesToHHMM(r.total_non_billable_hours || 0)}
                      </TableCell>

                      {/* Overall status badge */}
                      <TableCell>
                        {getOverallStatusBadge(r.overall_status)}
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          {/* View details — always available */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(r)}
                            className="h-8 w-8 p-0"
                            title="View details"
                          >
                            <Eye className="h-4 w-4 text-blue-600" />
                          </Button>

                          {/* Approve / Reject — only when there are actionable entries
                              AND we are not in a pure history view.
                              Admin may still act even when some entries are
                              Manager_Approved; the backend skips protected entries. */}
                          {!isHistoryView && r.has_actionable_entries && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openApproveConfirm(r.entry_id)}
                                className="h-8 w-8 p-0"
                                title="Approve remaining entries"
                              >
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openRejectDialog(r.entry_id)}
                                className="h-8 w-8 p-0"
                                title="Reject remaining entries"
                              >
                                <XCircle className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-2 p-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Approve confirmation ────────────────────────────────────────────── */}
      <AlertDialog
        open={confirmDialog.open && confirmDialog.mode === "APPROVE_SINGLE"}
        onOpenChange={(open) => !open && closeConfirmDialog()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Timesheet?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.timesheetData && (
                <div className="space-y-3 pt-2">
                  <p>
                    Approving entries for{" "}
                    <span className="font-semibold text-foreground">
                      {confirmDialog.timesheetData.employee_name}
                    </span>
                  </p>
                  <div className="bg-muted/50 rounded-md p-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Week:</span>
                      <span className="font-medium text-foreground">
                        {safeFormatDate(
                          confirmDialog.timesheetData.week_start_date,
                        )}{" "}
                        to{" "}
                        {safeFormatDate(
                          confirmDialog.timesheetData.week_end_date,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Hours:</span>
                      <span className="font-semibold text-foreground">
                        {formatMinutesToHHMM(
                          confirmDialog.timesheetData.hours_logged,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Billable:</span>
                      <span className="font-semibold text-green-600">
                        {formatMinutesToHHMM(
                          confirmDialog.timesheetData.total_billable_hours || 0,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Non-Billable:</span>
                      <span className="font-semibold text-orange-600">
                        {formatMinutesToHHMM(
                          confirmDialog.timesheetData
                            .total_non_billable_hours || 0,
                        )}
                      </span>
                    </div>
                  </div>
                  {/* Inform admin that Manager_Approved entries are protected */}
                  {confirmDialog.timesheetData.overall_status ===
                    "Partially_Approved" && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded p-2">
                      ⚠️ This timesheet has some Manager-Approved entries. Those
                      will remain unchanged — only pending/rejected entries will
                      be approved.
                    </p>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Reject dialog ──────────────────────────────────────────────────── */}
      <Dialog
        open={confirmDialog.open && confirmDialog.mode === "REJECT_SINGLE"}
        onOpenChange={(open) => !open && closeConfirmDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Timesheet</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {confirmDialog.timesheetData && (
              <div className="bg-muted/50 rounded-md p-3 text-sm">
                <p className="font-semibold">
                  {confirmDialog.timesheetData.employee_name}
                </p>
                <p className="text-muted-foreground text-xs">
                  {safeFormatDate(confirmDialog.timesheetData.week_start_date)}{" "}
                  to {safeFormatDate(confirmDialog.timesheetData.week_end_date)}
                </p>
                {confirmDialog.timesheetData.overall_status ===
                  "Partially_Approved" && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded p-2 mt-2">
                    ⚠️ Manager-Approved entries will NOT be rejected — only
                    pending or manager-rejected entries will be updated.
                  </p>
                )}
              </div>
            )}
            <div>
              <Label className="text-sm font-medium">
                Rejection Reason <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder="Please provide a clear reason for rejection..."
                value={confirmDialog.comment}
                onChange={(e) =>
                  setConfirmDialog((p) => ({ ...p, comment: e.target.value }))
                }
                rows={4}
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeConfirmDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              className="bg-red-600 hover:bg-red-700"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Details dialog ─────────────────────────────────────────────────── */}
      <TimesheetDetailsDialog
        timesheet={selectedTimesheet}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />
    </div>
  );
}

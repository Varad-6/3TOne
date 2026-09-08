import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
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
  DialogDescription,
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
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Loader2,
  Search,
  XCircle,
  AlertTriangle,
  User,
} from "lucide-react";
import timesheetService from "../../services/timesheetService";
import { format, isValid } from "date-fns";
import { TimesheetDetailsDialog } from "../ui/TimesheetDetailsDialog";

const PAGE_SIZE = 10;

// ─────────────────────────────────────────────
// Badge helpers
// ─────────────────────────────────────────────

/**
 * Badge for the OVERALL week status shown in the summary row.
 * Managers always see "Submitted" rows (their own slice of the week).
 * This badge shows what state those entries are currently in.
 */
function getWeekStatusBadge(overall) {
  switch (overall) {
    case "Approved":
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200 rounded-full">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      );
    case "Rejected":
      return (
        <Badge className="bg-rose-100 text-rose-700 border-rose-200 rounded-full">
          <XCircle className="h-3 w-3 mr-1" />
          Rejected
        </Badge>
      );
    case "Partially_Approved":
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 rounded-full">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Partially Approved
        </Badge>
      );
    case "Partially_Rejected":
      return (
        <Badge className="bg-orange-100 text-orange-700 border-orange-200 rounded-full">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Partially Rejected
        </Badge>
      );
    case "Submitted":
    default:
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 rounded-full">
          <User className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
  }
}

export function TimesheetApproval() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  // Filters
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState("Submitted");
  const [startDate, setStartDate] = useState(undefined);
  const [endDate, setEndDate] = useState(undefined);

  // Pagination
  const [page, setPage] = useState(1);

  // Dialogs
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
  }, [department, status, startDate, endDate]);

  function safeFormatDate(dateInput) {
    if (!dateInput) return "";
    const date = new Date(dateInput);
    return isValid(date) ? format(date, "dd-MM-yyyy") : "Invalid Date";
  }

  function formatHoursDisplay(minutes) {
    if (!minutes || minutes === 0) return "00:00";
    const total = Math.round(minutes);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function handleViewDetails(row) {
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
      entries: row.entries || [],
    });
    setDetailsDialogOpen(true);
  }

  async function fetchData() {
    try {
      setLoading(true);
      // Manager always fetches "Submitted" entries assigned to them.
      // The status dropdown here is for their own history toggle.
      const data = await timesheetService.getPendingApprovals(status);

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
          // overall_status: computed server-side from individual entry statuses
          overall_status: item.overall_status || "Submitted",
          submitted_at: item.submitted_at,
          projects: item.projects || "N/A",
          activities: item.activities || "N/A",
          entries: item.entries || [],
        };
      });

      setRows(formattedData);
      setPage(1);
      setConfirmDialog({
        open: false,
        mode: null,
        timesheetId: null,
        timesheetData: null,
        comment: "",
      });
    } catch (e) {
      console.error("Failed to load timesheets:", e);
      toast.error("Failed to load timesheets");
    } finally {
      setLoading(false);
    }
  }

  // ── Client-side filtering ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let res = rows.slice();

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

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // ── Dialog handlers ───────────────────────────────────────────────────────

  function openApproveConfirm(timesheetId) {
    const ts = rows.find((r) => r.entry_id === timesheetId);
    setConfirmDialog({
      open: true,
      mode: "APPROVE_SINGLE",
      timesheetId,
      timesheetData: ts,
      comment: "",
    });
  }

  function openRejectDialog(timesheetId) {
    const ts = rows.find((r) => r.entry_id === timesheetId);
    setConfirmDialog({
      open: true,
      mode: "REJECT_SINGLE",
      timesheetId,
      timesheetData: ts,
      comment: "",
    });
  }

  function closeConfirmDialog() {
    setConfirmDialog({
      open: false,
      mode: null,
      timesheetId: null,
      timesheetData: null,
      comment: "",
    });
  }

  async function handleApprove() {
    const { timesheetData, timesheetId, comment } = confirmDialog;
    try {
      await timesheetService.approveWeek(
        timesheetData.employee_id,
        timesheetData.week_start_date,
        timesheetData.week_end_date,
        comment,
      );
      // Refresh list so the approved row disappears from manager's queue
      void fetchData();
      toast.success(`Timesheet approved for ${timesheetData.employee_name}`);
      closeConfirmDialog();
    } catch {
      toast.error("Failed to approve timesheet");
    }
  }

  async function handleReject() {
    const { timesheetData, timesheetId, comment } = confirmDialog;
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
      toast.success(`Timesheet rejected for ${timesheetData.employee_name}`);
      closeConfirmDialog();
    } catch {
      toast.error("Failed to reject timesheet");
    }
  }

  const isHistoryView =
    status !== "Submitted" &&
    (status === "all" ||
      status.includes("Approved") ||
      status.includes("Rejected"));

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <motion.div variants={item}>
      <Card className="border-none shadow-soft bg-white dark:bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Filter className="h-5 w-5" />
            Pending Approvals
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
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
              <SelectItem value="Engineering">Engineering</SelectItem>
              <SelectItem value="Sales">Sales</SelectItem>
              <SelectItem value="Marketing">Marketing</SelectItem>
              <SelectItem value="HR">HR</SelectItem>
              <SelectItem value="Finance">Finance</SelectItem>
              <SelectItem value="Quality Assurance">
                Quality Assurance
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Submitted">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
              <SelectItem value="Partially_Approved">
                Partially Approved
              </SelectItem>
              <SelectItem value="Partially_Rejected">
                Partially Rejected
              </SelectItem>
              <SelectItem value="Manager_Approved">Manager Approved</SelectItem>
              <SelectItem value="Manager_Rejected">Manager Rejected</SelectItem>
              <SelectItem value="Admin_Approved">Admin Approved</SelectItem>
              <SelectItem value="Admin_Rejected">Admin Rejected</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>

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
      </motion.div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <motion.div variants={item}>
      <Card className="border-none shadow-soft bg-white dark:bg-card">
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
                  <TableHead className="text-right font-semibold">
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
                      className="py-8 text-center text-muted-foreground"
                    >
                      {status === "Submitted"
                        ? "No timesheets awaiting your approval"
                        : "No timesheets found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((r) => (
                    <React.Fragment key={r.entry_id}>
                      <TableRow className="hover:bg-muted/30">
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

                        <TableCell className="text-sm">
                          {r.department}
                        </TableCell>

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
                        <TableCell className="text-center font-medium tabular-nums">
                          {formatHoursDisplay(r.hours_logged)}
                        </TableCell>
                        <TableCell className="text-center font-medium text-green-600 tabular-nums">
                          {formatHoursDisplay(r.total_billable_hours || 0)}
                        </TableCell>
                        <TableCell className="text-center font-medium text-orange-600 tabular-nums">
                          {formatHoursDisplay(r.total_non_billable_hours || 0)}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {getWeekStatusBadge(r.overall_status)}
                        </TableCell>

                        {/* Actions */}
                        <TableCell>
                          {isHistoryView ? (
                            <div className="flex justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewDetails(r)}
                                title="View details"
                              >
                                <Eye className="h-4 w-4 text-blue-600" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewDetails(r)}
                                title="View details"
                              >
                                <Eye className="h-5 w-5 text-blue-600" />
                              </Button>
                              {/* Manager can approve/reject only when entries are Submitted */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openApproveConfirm(r.entry_id)}
                                disabled={r.overall_status !== "Submitted"}
                                title={
                                  r.overall_status !== "Submitted"
                                    ? "No pending entries to approve"
                                    : "Approve"
                                }
                              >
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openRejectDialog(r.entry_id)}
                                disabled={r.overall_status !== "Submitted"}
                                title={
                                  r.overall_status !== "Submitted"
                                    ? "No pending entries to reject"
                                    : "Reject"
                                }
                              >
                                <XCircle className="h-5 w-5 text-red-600" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
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
                <ChevronLeft className="h-4 w-4" />
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
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Approve confirmation ────────────────────────────────────────────── */}
      <AlertDialog
        open={confirmDialog.open && confirmDialog.mode === "APPROVE_SINGLE"}
        onOpenChange={(open) => {
          if (!open) closeConfirmDialog();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Timesheet?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.timesheetData && (
                <>
                  You are about to approve the timesheet for{" "}
                  <strong>{confirmDialog.timesheetData.employee_name}</strong>{" "}
                  for the week of{" "}
                  <strong>
                    {safeFormatDate(
                      confirmDialog.timesheetData.week_start_date,
                    )}
                  </strong>{" "}
                  to{" "}
                  <strong>
                    {safeFormatDate(confirmDialog.timesheetData.week_end_date)}
                  </strong>
                  .
                  <div className="mt-3 space-y-1 text-sm">
                    <p>
                      <strong>Total Hours:</strong>{" "}
                      {formatHoursDisplay(
                        confirmDialog.timesheetData.hours_logged,
                      )}
                    </p>
                    <p>
                      <strong>Billable:</strong>{" "}
                      {formatHoursDisplay(
                        confirmDialog.timesheetData.total_billable_hours || 0,
                      )}
                    </p>
                    <p>
                      <strong>Non-Billable:</strong>{" "}
                      {formatHoursDisplay(
                        confirmDialog.timesheetData.total_non_billable_hours ||
                          0,
                      )}
                    </p>
                  </div>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove}>
              Yes, Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Reject dialog ──────────────────────────────────────────────────── */}
      <Dialog
        open={confirmDialog.open && confirmDialog.mode === "REJECT_SINGLE"}
        onOpenChange={(open) => {
          if (!open) closeConfirmDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Timesheet</DialogTitle>
            <DialogDescription>
              {confirmDialog.timesheetData && (
                <>
                  Rejecting timesheet for{" "}
                  <strong>{confirmDialog.timesheetData.employee_name}</strong>{" "}
                  for the week of{" "}
                  <strong>
                    {safeFormatDate(
                      confirmDialog.timesheetData.week_start_date,
                    )}
                  </strong>{" "}
                  to{" "}
                  <strong>
                    {safeFormatDate(confirmDialog.timesheetData.week_end_date)}
                  </strong>
                  .
                  <br />
                  <br />
                  Please provide a reason for rejection.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="my-4">
            <Label>
              Rejection Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder="Enter reason for rejection (required)..."
              value={confirmDialog.comment}
              onChange={(e) =>
                setConfirmDialog((p) => ({ ...p, comment: e.target.value }))
              }
              rows={4}
              className="mt-2"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeConfirmDialog}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject}>
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
      </motion.div>
    </motion.div>
  );
}

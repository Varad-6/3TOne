import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  ChevronRight,
  Calendar as CalendarIcon,
  Briefcase,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  X,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { minutesToHHMM } from "@/utils/timeUtils";

// ─────────────────────────────────────────────
// Per-entry status badge
// Handles both individual DB status strings and computed overall statuses.
// ─────────────────────────────────────────────
function EntryStatusBadge({ status }) {
  if (!status) return null;

  const configs = {
    Draft: {
      label: "Draft",
      className: "bg-gray-100 text-gray-600 border-gray-200",
      icon: Clock,
    },
    Submitted: {
      label: "Submitted",
      className: "bg-blue-100 text-blue-700 border-blue-200",
      icon: Clock,
    },
    Manager_Approved: {
      label: "Mgr Approved",
      className: "bg-green-100 text-green-700 border-green-200",
      icon: CheckCircle,
    },
    Manager_Rejected: {
      label: "Mgr Rejected",
      className: "bg-rose-100 text-rose-700 border-rose-200",
      icon: XCircle,
    },
    Admin_Approved: {
      label: "Admin Approved",
      className: "bg-emerald-100 text-emerald-700 border-emerald-200",
      icon: CheckCircle,
    },
    Admin_Rejected: {
      label: "Admin Rejected",
      className: "bg-red-100 text-red-700 border-red-200",
      icon: XCircle,
    },
    // Computed overall statuses (shown at week level, may appear on entries too)
    Approved: {
      label: "Approved",
      className: "bg-emerald-100 text-emerald-700 border-emerald-200",
      icon: CheckCircle,
    },
    Rejected: {
      label: "Rejected",
      className: "bg-rose-100 text-rose-700 border-rose-200",
      icon: XCircle,
    },
    Partially_Approved: {
      label: "Partial ✓",
      className: "bg-amber-100 text-amber-700 border-amber-200",
      icon: AlertCircle,
    },
    Partially_Rejected: {
      label: "Partial ✗",
      className: "bg-orange-100 text-orange-700 border-orange-200",
      icon: AlertCircle,
    },
  };

  const cfg = configs[status] ?? {
    label: status.replace(/_/g, " "),
    className: "bg-gray-100 text-gray-600 border-gray-200",
    icon: Clock,
  };

  const Icon = cfg.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap w-fit",
        cfg.className,
      )}
    >
      <Icon className="h-2.5 w-2.5 shrink-0" />
      {cfg.label}
    </Badge>
  );
}

// ─────────────────────────────────────────────
// Overall week-level status badge (header)
// ─────────────────────────────────────────────
function StatusBadge({ status }) {
  if (!status) return null;

  const configs = {
    Approved: {
      className:
        "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200 rounded-full",
      icon: CheckCircle,
      label: "Approved",
    },
    Rejected: {
      className:
        "bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200 rounded-full",
      icon: XCircle,
      label: "Rejected",
    },
    Partially_Approved: {
      className:
        "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 rounded-full",
      icon: AlertCircle,
      label: "Partially Approved",
    },
    Partially_Rejected: {
      className:
        "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200 rounded-full",
      icon: AlertCircle,
      label: "Partially Rejected",
    },
    Submitted: {
      className:
        "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 rounded-full",
      icon: AlertCircle,
      label: "Pending",
    },
    Pending: {
      className:
        "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 rounded-full",
      icon: AlertCircle,
      label: "Pending",
    },
    // Legacy raw DB status strings (in case old data flows through)
    Manager_Approved: {
      className:
        "bg-green-100 text-green-700 border-green-200 hover:bg-green-200 rounded-full",
      icon: CheckCircle,
      label: "Manager Approved",
    },
    Admin_Approved: {
      className:
        "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200 rounded-full",
      icon: CheckCircle,
      label: "Admin Approved",
    },
    Manager_Rejected: {
      className:
        "bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200 rounded-full",
      icon: XCircle,
      label: "Manager Rejected",
    },
    Admin_Rejected: {
      className:
        "bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200 rounded-full",
      icon: XCircle,
      label: "Admin Rejected",
    },
  };

  // Exact match first, then partial match for any legacy comma-joined strings
  const cfg =
    configs[status] ??
    configs[Object.keys(configs).find((k) => status.includes(k))] ??
    configs["Submitted"];

  const Icon = cfg.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "capitalize px-3 py-1 flex items-center gap-1.5 text-xs font-semibold shadow-none",
        cfg.className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </Badge>
  );
}

// ─────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────
function StatCard({ label, value, sub, className, bg }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-2 rounded-lg border border-border/50 bg-card shadow-sm",
        bg,
      )}
    >
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
        {label}
      </span>
      <div className="flex items-baseline gap-0.5">
        <span className={cn("text-lg font-bold", className)}>{value}</span>
        {sub && (
          <span className="text-[10px] text-muted-foreground">{sub}</span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Daily group (collapsible row of entries)
// ─────────────────────────────────────────────
function DailyGroup({ dateKey, entries }) {
  const [isOpen, setIsOpen] = useState(false);
  const dateObj = parseISO(dateKey);

  const dailyStats = useMemo(() => {
    let totalHours = 0,
      totalBillable = 0,
      totalNonBillable = 0;
    entries.forEach((e) => {
      totalHours += Number(e.hours || e.total_hours || 0);
      totalBillable += Number(e.billable_hours || 0);
      totalNonBillable += Number(e.non_billable_hours || 0);
    });
    return { totalHours, totalBillable, totalNonBillable };
  }, [entries]);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="border border-border/60 bg-card rounded-xl shadow-sm overflow-hidden group transition-all hover:shadow-md"
    >
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-3 px-4 cursor-pointer hover:bg-accent/40 transition-colors select-none">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground transition-all group-hover:bg-primary/10 group-hover:text-primary",
                isOpen && "bg-primary/10 text-primary",
              )}
            >
              <ChevronRight
                className={cn(
                  "h-5 w-5 transition-transform duration-200",
                  isOpen && "rotate-90",
                )}
              />
            </div>

            <div>
              <h4 className="font-semibold text-base text-foreground">
                {format(dateObj, "EEEE, MMM d")}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {entries.length} {entries.length === 1 ? "Entry" : "Entries"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground hidden sm:flex items-center gap-1.5 bg-muted/30 px-2.5 py-1.5 rounded-md">
              <span className="text-emerald-600 font-medium">
                {minutesToHHMM(dailyStats.totalBillable)}
              </span>
              <span className="text-muted-foreground/30">/</span>
              <span className="text-orange-600 font-medium">
                {minutesToHHMM(dailyStats.totalNonBillable)}
              </span>
            </div>
            <Badge variant="secondary" className="text-lg font-bold px-3 py-1">
              {minutesToHHMM(dailyStats.totalHours)}hrs
            </Badge>
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <Separator className="opacity-50" />
        <div className="bg-muted/5">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border/50">
                {/* ── NEW: Status column ── */}
                <TableHead className="pl-4 w-[130px] h-9 text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
                  Status
                </TableHead>

                <TableHead className="pl-4 h-9 text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
                  Project
                </TableHead>
                <TableHead className="h-9 text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
                  Ticket
                </TableHead>
                <TableHead className="h-9 text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
                  Task
                </TableHead>
                <TableHead className="h-9 text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
                  CRM Code
                </TableHead>
                <TableHead className="w-[90px] h-9 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
                  Billable
                </TableHead>
                <TableHead className="w-[90px] h-9 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
                  Non-Bill
                </TableHead>
                <TableHead className="text-right w-[90px] h-9 pr-6 text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {entries.map((entry, index) => {
                const isOwnEntry = entry.isOwn !== false;

                return (
                  <TableRow
                    key={index}
                    className={cn(
                      "hover:bg-muted/20 border-b border-border/40 last:border-0",
                      !isOwnEntry &&
                        "bg-gray-50 opacity-60 dark:bg-gray-900/20",
                    )}
                  >
                    {/* ── Status column ── */}
                    <TableCell className="pl-4 py-3 align-top">
                      <EntryStatusBadge
                        status={
                          // entryStatus is set by the updated getPendingApprovals /
                          // getTimesheetHistory backend queries.
                          // Fall back to the parent timesheet status if per-entry
                          // status is unavailable (old API compat).
                          entry.entryStatus || entry.status || null
                        }
                      />
                      {/* Show rejection reason tooltip if rejected */}
                      {entry.rejectionReason && (
                        <p
                          className="text-[10px] text-rose-600 mt-1 max-w-[120px] truncate"
                          title={entry.rejectionReason}
                        >
                          {entry.rejectionReason}
                        </p>
                      )}
                    </TableCell>

                    {/* Project */}
                    <TableCell className="pl-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-primary/60 shrink-0" />
                        <span className="font-semibold text-base text-foreground">
                          {entry.projectName || "-"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Ticket */}
                    <TableCell className="py-3 align-top text-sm font-medium text-muted-foreground">
                      {entry.ticketName || "-"}
                    </TableCell>

                    {/* Task */}
                    <TableCell className="py-3 align-top text-sm font-medium text-muted-foreground">
                      {entry.taskName || "-"}
                    </TableCell>

                    {/* CRM Code */}
                    <TableCell className="py-3 align-top">
                      {entry.ticket_number ? (
                        <Badge
                          variant="outline"
                          className="text-xs px-2 py-0.5 h-6 text-blue-600 border-blue-200 bg-blue-50/50 rounded-sm font-mono"
                        >
                          {entry.ticket_number}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Billable */}
                    <TableCell className="text-center py-3 align-top text-sm font-semibold text-emerald-600">
                      {Number(
                        entry.billable_hours || entry.billableHours || 0,
                      ) > 0
                        ? minutesToHHMM(
                            Number(
                              entry.billable_hours || entry.billableHours * 60,
                            ),
                          )
                        : "-"}
                    </TableCell>

                    {/* Non-Billable */}
                    <TableCell className="text-center py-3 align-top text-sm font-semibold text-orange-600">
                      {Number(
                        entry.non_billable_hours || entry.nonBillableHours || 0,
                      ) > 0
                        ? minutesToHHMM(
                            Number(
                              entry.non_billable_hours ||
                                entry.nonBillableHours * 60,
                            ),
                          )
                        : "-"}
                    </TableCell>

                    {/* Total */}
                    <TableCell className="text-right pr-6 py-3 align-top text-base font-bold text-foreground">
                      {minutesToHHMM(
                        Number(entry.hours || entry.total_hours || 0),
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Notes section */}
          {entries.some((e) => e.description) && (
            <div className="px-4 py-3 bg-blue-50/30 dark:bg-blue-900/10 border-t border-border/30">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Notes:
              </p>
              {entries
                .filter((e) => e.description)
                .map((entry, idx) => (
                  <p
                    key={idx}
                    className="text-sm text-blue-800 dark:text-blue-200 mb-1 pl-2 border-l-2 border-blue-200"
                  >
                    • {entry.description}
                  </p>
                ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─────────────────────────────────────────────
// Main dialog
// ─────────────────────────────────────────────
export function TimesheetDetailsDialog({
  timesheet,
  trigger,
  open,
  onOpenChange,
}) {
  if (!timesheet) return null;
  const entries = timesheet.entries ?? timesheet.timesheet_entries ?? [];

  const dailyGroups = useMemo(() => {
    if (!entries || entries.length === 0) return [];
    const grouped = {};
    entries.forEach((entry) => {
      const dateKey = entry.date;
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(entry);
    });
    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
  }, [entries]);

  const stats = useMemo(() => {
    if (!entries || entries.length === 0) {
      return {
        totalBillable: 0,
        totalNonBillable: 0,
        totalHours: 0,
        uniqueProjects: 0,
        uniqueTickets: 0,
      };
    }
    const uniqueProjects = new Set();
    const uniqueTickets = new Set();
    let totalBillable = 0;
    let totalNonBillable = 0;

    entries.forEach((entry) => {
      if (entry.projectName) uniqueProjects.add(entry.projectName);
      if (entry.ticketName) uniqueTickets.add(entry.ticketName);
      totalBillable += Number(entry.billable_hours || 0);
      totalNonBillable += Number(entry.non_billable_hours || 0);
    });

    return {
      totalBillable,
      totalNonBillable,
      totalHours: totalBillable + totalNonBillable,
      uniqueProjects: uniqueProjects.size,
      uniqueTickets: uniqueTickets.size,
    };
  }, [entries]);

  const hasEntries = entries.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0 sm:h-[85vh] overflow-hidden border-none shadow-2xl bg-background">
        <DialogDescription className="sr-only">
          Detailed view of timesheet for {timesheet.employeeName} covering the
          period {timesheet.period}.
        </DialogDescription>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="relative flex flex-col border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-20">
          <DialogHeader className="px-8 py-5 pb-3">
            {/* Close button */}
            <div className="absolute right-4 top-4 z-50">
              <button
                type="button"
                onClick={() => onOpenChange?.(false)}
                className="p-2 rounded-full bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Close</span>
              </button>
            </div>

            <div className="flex items-start justify-between mr-8">
              <div className="space-y-1">
                <DialogTitle className="text-2xl font-bold text-foreground flex items-center gap-3">
                  <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                    <User className="h-5 w-5" />
                  </div>
                  {timesheet.employeeName}
                </DialogTitle>

                <div className="text-sm text-muted-foreground space-y-1 pl-1">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-3.5 w-3.5 opacity-70" />
                    <span>{timesheet.period}</span>
                  </div>
                  {timesheet.submitted_at && (
                    <div className="flex items-center gap-2 text-xs">
                      <CheckCircle className="h-3 w-3 text-green-600 opacity-70" />
                      <span>
                        Submitted:{" "}
                        {format(
                          parseISO(timesheet.submitted_at),
                          "MMM dd, yyyy 'at' h:mm a",
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={timesheet.status} />
                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-muted-foreground font-medium">
                    Total
                  </span>
                  <span className="text-2xl font-bold text-foreground">
                    {minutesToHHMM(
                      timesheet.totalHours ?? timesheet.total_hours ?? 0,
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground">Hrs</span>
                </div>
              </div>
            </div>

            {/* Summary stat cards */}
            {hasEntries && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 pt-0">
                <StatCard
                  label="Total Hours"
                  value={minutesToHHMM(stats.totalHours)}
                  sub="hrs"
                />
                <StatCard
                  label="Billable"
                  value={minutesToHHMM(stats.totalBillable)}
                  sub="hrs"
                  className="text-emerald-600"
                  bg="bg-emerald-50 dark:bg-emerald-900/10"
                />
                <StatCard
                  label="Non-Billable"
                  value={minutesToHHMM(stats.totalNonBillable)}
                  sub="hrs"
                  className="text-orange-600"
                  bg="bg-orange-50 dark:bg-orange-900/10"
                />
                <StatCard
                  label="Projects"
                  value={stats.uniqueProjects}
                  sub="active"
                />
                <StatCard
                  label="Tickets"
                  value={stats.uniqueTickets}
                  sub="logged"
                />
              </div>
            )}
          </DialogHeader>
        </div>

        {/* ── Scrollable entry list ──────────────────────────────────────────── */}
        <ScrollArea className="flex-1 h-full bg-muted/5">
          <div className="p-6 space-y-3 max-w-4xl mx-auto">
            {!hasEntries ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground opacity-50">
                <AlertCircle className="h-10 w-10 mb-2" />
                <p>No entries found.</p>
              </div>
            ) : (
              dailyGroups.map(([date, dayEntries]) => (
                <DailyGroup key={date} dateKey={date} entries={dayEntries} />
              ))
            )}
            <div className="h-8" />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

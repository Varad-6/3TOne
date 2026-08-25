// src/components/admin/reports/ReportTable.jsx

import React from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Loader2,
  FileX,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * DB stores hours as INTEGER minutes.
 * Returns decimal for threshold comparisons only (e.g. > 8h).
 */
function minsToHours(minutes) {
  const m = parseFloat(minutes) || 0;
  return m / 60;
}

/**
 * Format INTEGER MINUTES → "H:MM"  (e.g. 90 → "1:30", 48 → "0:48").
 * Used for ALL time display in table cells and footers.
 * Minutes never exceed 59.
 */
function fmtHours(minutes) {
  const m = Math.round(parseFloat(minutes) || 0);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}:${String(mm).padStart(2, "0")}`;
}

/**
 * Format DECIMAL HOURS (already ÷60 from server) → "H:MM".
 * Used for employee-billable table where the server sends decimal values.
 * e.g. 1.5 → "1:30",  0.8 → "0:48"
 */
// function decimalToHHMM(decimalHours) {
//   const totalMins = Math.round((parseFloat(decimalHours) || 0) * 60);
//   const h = Math.floor(totalMins / 60);
//   const m = totalMins % 60;
//   return `${h}:${String(m).padStart(2, "0")}`;
// }

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  Draft: "text-muted-foreground border-border",
  Submitted:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300",
  Manager_Approved:
    "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300",
  Manager_Rejected:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300",
  Admin_Approved:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300",
  Admin_Rejected:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300",
  Partially_Approved:
    "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300",
};

function StatusBadge({ status }) {
  const cls = STATUS_CONFIG[status] || STATUS_CONFIG.Draft;
  const display = status?.replace(/_/g, " ") || "—";
  return (
    <Badge
      variant="outline"
      className={`text-xs font-medium whitespace-nowrap ${cls}`}
    >
      {display}
    </Badge>
  );
}

// ── Sort icon ─────────────────────────────────────────────────────────────────
function SortIcon({ column, currentSort, sortDir }) {
  if (currentSort !== column)
    return (
      <ChevronsUpDown className="h-3 w-3 ml-1 text-muted-foreground/40 inline" />
    );
  return sortDir === "asc" ? (
    <ChevronUp className="h-3 w-3 ml-1 text-primary inline" />
  ) : (
    <ChevronDown className="h-3 w-3 ml-1 text-primary inline" />
  );
}

// ── Date formatter ────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Export to Excel ──────────────────────────────────────────────────────────
/**
 * Client-side Excel export using SheetJS.
 *
 * exportMode = "item"   → one row per timesheet entry (existing format)
 * exportMode = "header" → one aggregated row per client/project/ticket
 *                          columns: Client Name | Client Status | Project Name |
 *                          Project Status | Ticket | Ticket Status | Ticket Number |
 *                          Ticket Description | Total Approved Hours |
 *                          Actual Billable Hours | Non-Billable Hours
 *
 * Hours are stored as INTEGER MINUTES — divided by 60 here.
 */
function exportToExcel(data, pagination, exportMode = "item") {
  const fmtD = (val) => {
    if (!val) return "";
    const d = new Date(
      typeof val === "string" && val.length === 10 ? val + "T00:00:00" : val,
    );
    return isNaN(d.getTime())
      ? String(val)
      : d.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  };
  const toHrs = (mins) =>
    mins != null ? Math.round((parseFloat(mins) / 60) * 100) / 100 : 0;

  const dateStr = new Date().toISOString().split("T")[0];

  // ═══════════════════════════════════════════════════════════
  // HEADER MODE — aggregated summary per client/project/ticket
  // ═══════════════════════════════════════════════════════════
  if (exportMode === "header") {
    // Group by client + project + ticket
    const groups = new Map();
    data.forEach((r) => {
      const client = r.client_name || "(No Client)";
      const project = r.project_name || "(No Project)";
      const ticket = r.ticket_name || r.ticket_number || "(No Ticket)";
      const key = `${client}|||${project}|||${ticket}`;
      if (!groups.has(key)) {
        groups.set(key, {
          client_name: client,
          // client_status: not available in timesheet entry rows — default to "Active"
          client_status: "Active",
          project_name: project,
          project_status: r.project_status || "",
          ticket_name: ticket,
          ticket_status: r.ticket_status || (r.status || "").replace(/_/g, " "),
          ticket_number: r.ticket_number || r.ticket_code || "",
          ticket_description: r.description || "",
          approved_mins: 0,
          billable_mins: 0,
          non_billable_mins: 0,
          // track approved status entries
          _entries: [],
        });
      }
      const g = groups.get(key);
      g._entries.push(r);
      // Total Approved Hours = sum of total_hours where status is *_Approved
      const isApproved = (r.status || "").includes("Approved");
      if (isApproved) g.approved_mins += parseFloat(r.total_hours) || 0;
      g.billable_mins += parseFloat(r.billable_hours) || 0;
      g.non_billable_mins += parseFloat(r.non_billable_hours) || 0;
    });

    const rows = [...groups.values()].map((g) => ({
      "Client Name": g.client_name,
      "Client Status": g.client_status,
      "Project Name": g.project_name,
      "Project Status": g.project_status,
      Ticket: g.ticket_name,
      "Ticket Status": g.ticket_status,
      "Ticket Number": g.ticket_number,
      "Ticket Description": g.ticket_description,
      "Total Approved Hours": toHrs(g.approved_mins),
      "Actual Billable Hours": toHrs(g.billable_mins),
      "Non-Billable Hours": toHrs(g.non_billable_mins),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 26 }, // Client Name
      { wch: 14 }, // Client Status
      { wch: 28 }, // Project Name
      { wch: 16 }, // Project Status
      { wch: 30 }, // Ticket
      { wch: 18 }, // Ticket Status
      { wch: 16 }, // Ticket Number
      { wch: 40 }, // Ticket Description
      { wch: 20 }, // Total Approved Hours
      { wch: 22 }, // Actual Billable Hours
      { wch: 20 }, // Non-Billable Hours
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Header Report");
    XLSX.writeFile(wb, `TimesheetReport_Header_${dateStr}.xlsx`);
    return;
  }

  // ═══════════════════════════════════════════════════════════
  // EMPLOYEE-BILLABLE MODE — one row per (employee × client)
  // data here = headerData (the employee-billable rows from server)
  // Fields: employee_code, employee_name, designation, department,
  //         client_name, billable_hours, non_billable_hours,
  //         self_study_hours, working_days
  // Hours are already decimal (server divides by 60) → convert to H:MM.
  // ═══════════════════════════════════════════════════════════
  if (exportMode === "employee-billable") {
    // decimal hours → "H:MM" string for the spreadsheet
    const decToHHMM = (dec) => {
      const totalMins = Math.round((parseFloat(dec) || 0) * 60);
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      return `${h}:${String(m).padStart(2, "0")}`;
    };

    const ebRows = data.map((r) => ({
      "Employee Code": r.employee_code || "",
      "Employee Name": r.employee_name || "",
      Designation: r.designation || "",
      Department: r.department || "",
      "Client Name": r.client_name || "(No Client)",
      "Billable Hours": decToHHMM(r.billable_hours),
      "Non-Billable Hours": decToHHMM(r.non_billable_hours),
      "Self Study Hours": decToHHMM(r.self_study_hours),
      "Official Off Hours": decToHHMM(r.official_off_hours),
      "Working Days": parseInt(r.working_days, 10) || 0,
    }));

    const ebWs = XLSX.utils.json_to_sheet(ebRows);
    ebWs["!cols"] = [
      { wch: 16 }, // Employee Code
      { wch: 26 }, // Employee Name
      { wch: 22 }, // Designation
      { wch: 20 }, // Department
      { wch: 28 }, // Client Name
      { wch: 16 }, // Billable Hours
      { wch: 18 }, // Non-Billable Hours
      { wch: 16 }, // Self Study Hours
      { wch: 18 }, // Official Off Hours
      { wch: 13 }, // Working Days
    ];
    const ebWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(ebWb, ebWs, "Employee Billable");
    XLSX.writeFile(ebWb, `EmployeeBillable_${dateStr}.xlsx`);
    return;
  }

  // ═══════════════════════════════════════════════════════════
  // ITEM MODE — one row per timesheet entry (existing format)
  // ═══════════════════════════════════════════════════════════
  // H:MM helper for the spreadsheet (INTEGER MINUTES → "H:MM" string)
  const minsToHHMM = (mins) => {
    const m = Math.round(parseFloat(mins) || 0);
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}:${String(mm).padStart(2, "0")}`;
  };

  const rows = data.map((row) => ({
    Date: fmtD(row.entry_date),
    Employee:
      `${row.employee_first_name || ""} ${row.employee_last_name || ""}`.trim(),
    "Employee Code": row.employee_code || "",
    Department: row.employee_department || "",
    Client: row.client_name || "",
    Project: row.project_name || "",
    "Project Code": row.project_code || "",
    Ticket: row.ticket_name || row.ticket_number || "",
    "Ticket Code": row.ticket_code || "",
    Task: row.task_name || "",
    Hours: minsToHHMM(row.total_hours),
    "Billable Hrs": minsToHHMM(row.billable_hours),
    "Non-Bill Hrs": minsToHHMM(row.non_billable_hours),
    Status: (row.status || "").replace(/_/g, " "),
    Description: row.description || "",
    Manager: row.manager_first_name
      ? `${row.manager_first_name} ${row.manager_last_name || ""}`.trim()
      : "",
    Submitted: fmtD(row.submitted_at),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 14 },
    { wch: 22 },
    { wch: 14 },
    { wch: 16 },
    { wch: 20 },
    { wch: 26 },
    { wch: 14 },
    { wch: 26 },
    { wch: 14 },
    { wch: 18 },
    { wch: 9 },
    { wch: 12 },
    { wch: 12 },
    { wch: 20 },
    { wch: 40 },
    { wch: 22 },
    { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Timesheet Report");
  const pageNote = pagination
    ? `_${pagination.totalCount}records`
    : `_${data.length}records`;
  XLSX.writeFile(wb, `TimesheetReport_${dateStr}${pageNote}.xlsx`);
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZES = [10, 25, 50, 100];

const SORTABLE_COLS = [
  { key: "entry_date", label: "Date" },
  { key: "employee", label: "Employee" },
  { key: "project", label: "Project" },
  { key: "ticket", label: "Ticket" },
  { key: "hours", label: "Hours" },
  { key: "status", label: "Status" },
  { key: "submitted_at", label: "Submitted" },
];

// ── Main component ────────────────────────────────────────────────────────────
export function ReportTable({
  data = [],
  pagination,
  currentPagination,
  loading,
  onSort,
  onPageChange,
  onPageSizeChange,
  onExportAll, // optional: callback to trigger full-dataset server export
  exporting = false, // optional: true while server export is in progress
  exportMode = "item", // "item" | "header" | "employee" — controls export format
  headerData = [], // aggregated ticket rows for header mode
  loadingHeader = false, // true while header preview is loading
  isManager = false, // true when the logged-in user has the MANAGER role
}) {
  const { sortBy, sortDir, pageSize } = currentPagination;

  // ── Manager-role filtering ────────────────────────────────────────────────
  // These rules apply ONLY when isManager === true.
  //
  //  • exportMode "item"            → exclude rows where client_name OR
  //                                   project_name is "AIS_Internal_Billing_Ticket"
  //  • exportMode "header"          → exclude rows where client_name is
  //                                   "Abhiyanta India Solutions"
  //  • exportMode "employee-billable" → the backend already scopes to the
  //                                   manager's projects/tickets (managerId is
  //                                   sent by the service layer); additionally
  //                                   exclude "Abhiyanta India Solutions" client
  //                                   rows from the preview table and from the
  //                                   client-side export helper.

  const INTERNAL_BILLING_NAME = "AIS_Internal_Billing_Ticket";
  const AIS_CLIENT_NAME = "Abhiyanta India Solutions";

  /** item-mode data: strip internal-billing rows for managers */
  const effectiveData = React.useMemo(() => {
    if (!isManager || exportMode !== "item") return data;
    return data.filter(
      (r) =>
        r.client_name !== INTERNAL_BILLING_NAME &&
        r.project_name !== INTERNAL_BILLING_NAME,
    );
  }, [data, isManager, exportMode]);

  /**
   * header/employee-billable-mode data: strip "Abhiyanta India Solutions"
   * client rows for managers.
   */
  const effectiveHeaderData = React.useMemo(() => {
    if (!isManager) return headerData;
    if (exportMode === "header" || exportMode === "employee-billable") {
      return headerData.filter((r) => r.client_name !== AIS_CLIENT_NAME);
    }
    return headerData;
  }, [headerData, isManager, exportMode]);

  // Group rows by date for day-wise display
  const groupedByDate = React.useMemo(() => {
    const map = new Map();
    effectiveData.forEach((row) => {
      const dateKey = row.entry_date
        ? new Date(row.entry_date).toISOString().split("T")[0]
        : "unknown";
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey).push(row);
    });
    return map;
  }, [effectiveData]);

  // Grand total in hours (DB values are minutes)
  const grandTotalMins = effectiveData.reduce(
    (s, r) => s + (parseFloat(r.total_hours) || 0),
    0,
  );

  // ── Header-mode: group rows by client for visual hierarchy ──────────────
  // Use client_id as the key (unique UUID). Fall back to client_name only
  // when client_id is absent (e.g. "(No Client)" rows from the server).
  const groupedByClient = React.useMemo(() => {
    const map = new Map();
    effectiveHeaderData.forEach((row) => {
      const key = row.client_id || row.client_name || "(No Client)";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return map;
  }, [effectiveHeaderData]);

  // ── Header-mode totals ────────────────────────────────────────────────────
  const headerTotals = React.useMemo(() => {
    return effectiveHeaderData.reduce(
      (acc, r) => ({
        approved: acc.approved + (parseInt(r.approved_hours_mins, 10) || 0),
        billable: acc.billable + (parseInt(r.billable_hours_mins, 10) || 0),
        nonBillable:
          acc.nonBillable + (parseInt(r.non_billable_hours_mins, 10) || 0),
      }),
      { approved: 0, billable: 0, nonBillable: 0 },
    );
  }, [effectiveHeaderData]);

  // ── Employee-billable mode: group rows by employee ────────────────────────
  const groupedByEmployee = React.useMemo(() => {
    const map = new Map();
    effectiveHeaderData.forEach((row) => {
      const key = row.employee_id || row.employee_code || row.employee_name;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return map;
  }, [effectiveHeaderData]);

  // ── Employee-billable totals ──────────────────────────────────────────────
  const employeeBillableTotals = React.useMemo(() => {
    return effectiveHeaderData.reduce(
      (acc, r) => ({
        billable: acc.billable + (parseFloat(r.billable_hours) || 0),
        nonBillable: acc.nonBillable + (parseFloat(r.non_billable_hours) || 0),
        selfStudy: acc.selfStudy + (parseFloat(r.self_study_hours) || 0),
        officialOff: acc.officialOff + (parseFloat(r.official_off_hours) || 0), // ← add
      }),
      { billable: 0, nonBillable: 0, selfStudy: 0, officialOff: 0 },
    );
  }, [effectiveHeaderData]);

  // ── Empty state ───────────────────────────────────────────────────────────
  // In header/employee-billable mode show the preview table even if DTE is empty.
  // Only show the "no records" message when both data sets are empty.
  if (
    !loading &&
    !loadingHeader &&
    effectiveData.length === 0 &&
    ((exportMode !== "header" && exportMode !== "employee-billable") ||
      effectiveHeaderData.length === 0)
  ) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20 gap-3">
          <FileX className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground font-medium">
            No timesheet records found
          </p>
          {exportMode === "header" ? (
            <>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                No timesheet entries match your filters, but you can still
                download the Header Report — it includes all tickets from the
                ticket master table.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
                onClick={onExportAll}
                disabled={exporting}
              >
                {exporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                {exporting ? "Exporting..." : "Download Header Report"}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {/* Try adjusting your filters to see data */}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // HEADER MODE — one aggregated row per ticket (mirrors the xlsx export)
  // Columns: Client | Project | Ticket | Ticket Status | Ticket Number |
  //          Ticket Description | Approved Hrs | Billable Hrs | Non-Billable Hrs
  // ════════════════════════════════════════════════════════════════════════════
  if (exportMode === "header") {
    return (
      <Card>
        {/* ── Header bar ─────────────────────────────────────────── */}
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base text-muted-foreground font-medium">
              {loadingHeader
                ? "Loading..."
                : `${effectiveHeaderData.length} ticket${effectiveHeaderData.length !== 1 ? "s" : ""}`}
            </CardTitle>
            <div className="flex items-center gap-2">
              {!loadingHeader && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
                  onClick={onExportAll}
                  disabled={exporting}
                  title="Export header report (ticket master data)"
                >
                  {exporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {exporting ? "Exporting..." : "Download Report"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loadingHeader ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                      Client
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                      Client Status
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                      Project
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                      Project Status
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                      Ticket
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                      Ticket Status
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                      Ticket Number
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide">
                      Ticket Description
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap text-right">
                      Approved Hrs
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap text-right">
                      Billable Hrs
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap text-right">
                      Non-Billable Hrs
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {[...groupedByClient.entries()].map(
                    ([clientKey, clientRows]) =>
                      clientRows.map((row, i) => (
                        <TableRow
                          key={`${row.ticket_code || row.ticket_name}-${i}`}
                          className="hover:bg-accent/40 transition-colors"
                        >
                          {/* Client — rowSpan on first row of each client group */}
                          {i === 0 ? (
                            <TableCell
                              rowSpan={clientRows.length}
                              className="align-top border-r border-border/40 min-w-[140px] font-medium text-sm"
                            >
                              {row.client_name || "—"}
                            </TableCell>
                          ) : null}

                          {/* Client Status */}
                          {i === 0 ? (
                            <TableCell
                              rowSpan={clientRows.length}
                              className="align-top border-r border-border/40 whitespace-nowrap"
                            >
                              <Badge
                                variant="outline"
                                className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300"
                              >
                                Active
                              </Badge>
                            </TableCell>
                          ) : null}

                          {/* Project */}
                          <TableCell className="min-w-[140px] text-sm border-r border-border/40">
                            {row.project_name || "—"}
                          </TableCell>

                          {/* Project Status */}
                          <TableCell className="whitespace-nowrap border-r border-border/40">
                            {row.project_status ? (
                              <Badge variant="outline" className="text-xs">
                                {row.project_status}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                —
                              </span>
                            )}
                          </TableCell>

                          {/* Ticket name */}
                          <TableCell className="min-w-[150px] text-sm font-medium border-r border-border/40">
                            {row.ticket_name || "—"}
                          </TableCell>

                          {/* Ticket Status */}
                          <TableCell className="whitespace-nowrap border-r border-border/40">
                            {row.ticket_status ? (
                              <StatusBadge
                                status={row.ticket_status.replace(/ /g, "_")}
                              />
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                —
                              </span>
                            )}
                          </TableCell>

                          {/* Ticket Number (zoho_crm_code) */}
                          <TableCell className="whitespace-nowrap border-r border-border/40">
                            {row.ticket_code ? (
                              <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                                {row.ticket_code}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                —
                              </span>
                            )}
                          </TableCell>

                          {/* Ticket Description */}
                          <TableCell className="max-w-[220px] border-r border-border/40">
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {row.ticket_description || "—"}
                            </p>
                          </TableCell>

                          {/* Total Approved Hours */}
                          <TableCell className="text-right whitespace-nowrap border-r border-border/40">
                            <span className="font-semibold text-sm text-foreground">
                              {fmtHours(row.approved_hours_mins)}
                            </span>
                          </TableCell>

                          {/* Actual Billable Hours */}
                          <TableCell className="text-right whitespace-nowrap border-r border-border/40">
                            <span className="text-sm text-green-700 dark:text-green-400 font-medium">
                              {fmtHours(row.billable_hours_mins)}
                            </span>
                          </TableCell>

                          {/* Non-Billable Hours */}
                          <TableCell className="text-right whitespace-nowrap border-r border-border/40">
                            <span className="text-sm text-muted-foreground">
                              {fmtHours(row.non_billable_hours_mins)}
                            </span>
                          </TableCell>
                        </TableRow>
                      )),
                  )}
                </TableBody>

                {/* ── Grand total footer ───────────────────────────────── */}
                {effectiveHeaderData.length > 0 && (
                  <tfoot>
                    <tr className="bg-muted/50 border-t-2 border-border">
                      <td
                        className="px-4 py-3 text-sm font-semibold"
                        colSpan={8}
                      >
                        Total ({effectiveHeaderData.length} tickets)
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-primary text-right whitespace-nowrap">
                        {fmtHours(headerTotals.approved)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-green-700 dark:text-green-400 text-right whitespace-nowrap">
                        {fmtHours(headerTotals.billable)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-muted-foreground text-right whitespace-nowrap">
                        {fmtHours(headerTotals.nonBillable)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EMPLOYEE-BILLABLE MODE
  // One row per (employee × client): Billable Hrs | Non-Billable Hrs |
  // Self Study Hrs | Working Days. Employees are visually grouped.
  // ════════════════════════════════════════════════════════════════════════════
  if (exportMode === "employee-billable") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base text-muted-foreground font-medium">
              {loadingHeader
                ? "Loading..."
                : `${effectiveHeaderData.length} row${effectiveHeaderData.length !== 1 ? "s" : ""} · ${[...groupedByEmployee.keys()].length} employee${[...groupedByEmployee.keys()].length !== 1 ? "s" : ""}`}
            </CardTitle>
            <div className="flex items-center gap-2">
              {onExportAll && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
                  onClick={onExportAll}
                  disabled={exporting}
                  title="Download Employee Billable report (server-rendered, styled XLSX)"
                >
                  {exporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {exporting ? "Exporting..." : "Download Report"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loadingHeader ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                      Employee
                    </TableHead>
                    {/* <TableHead className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                      Designation
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                      Department
                    </TableHead> */}
                    <TableHead className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                      Client
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap text-right">
                      Billable Hrs
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap text-right">
                      Non-Billable Hrs
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap text-right">
                      Self Study Hrs
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap text-right">
                      Official Off Hrs
                    </TableHead>
                    {/* <TableHead className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap text-right">
                      Working Days
                    </TableHead> */}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {[...groupedByEmployee.entries()].map(
                    ([empKey, empRows], groupIdx) => {
                      // Per-employee subtotals
                      const empTotals = empRows.reduce(
                        (acc, r) => ({
                          billable:
                            acc.billable + (parseFloat(r.billable_hours) || 0),
                          nonBillable:
                            acc.nonBillable +
                            (parseFloat(r.non_billable_hours) || 0),
                          selfStudy:
                            acc.selfStudy +
                            (parseFloat(r.self_study_hours) || 0),
                          officialOff:
                            acc.officialOff +
                            (parseFloat(r.official_off_hours) || 0),
                          workingDays: Math.max(
                            acc.workingDays,
                            parseInt(r.working_days, 10) || 0,
                          ),
                        }),
                        {
                          billable: 0,
                          nonBillable: 0,
                          selfStudy: 0,
                          officialOff: 0,
                          workingDays: 0,
                        },
                      );
                      const rowBg =
                        groupIdx % 2 === 0
                          ? "bg-white dark:bg-zinc-950"
                          : "bg-slate-50/60 dark:bg-zinc-900/60";

                      return (
                        <React.Fragment key={empKey}>
                          {empRows.map((row, i) => (
                            <TableRow
                              key={`${empKey}-${row.client_id || row.client_name}-${i}`}
                              className={`hover:bg-accent/40 transition-colors ${rowBg}`}
                            >
                              {/* Employee — rowSpan on first row of each group */}
                              {i === 0 ? (
                                <TableCell
                                  rowSpan={empRows.length}
                                  className="align-top border-r border-border/40 min-w-[160px]"
                                >
                                  <div className="font-medium text-sm">
                                    {row.employee_name}
                                  </div>
                                  <div className="text-xs text-muted-foreground font-mono mt-0.5">
                                    {row.employee_code}
                                  </div>
                                </TableCell>
                              ) : null}

                              {/* Designation — rowSpan
                              {i === 0 ? (
                                <TableCell
                                  rowSpan={empRows.length}
                                  className="align-top border-r border-border/40 text-sm  whitespace-nowrap"
                                >
                                  {row.designation || "—"}
                                </TableCell>
                              ) : null}

                              {/* Department — rowSpan */}
                              {/* {i === 0 ? (
                                <TableCell
                                  rowSpan={empRows.length}
                                  className="align-top border-r border-border/40 text-sm text-muted-foreground whitespace-nowrap"
                                >
                                  {row.department || "—"}
                                </TableCell>
                              ) : null} */}

                              {/* Client */}
                              <TableCell className="text-sm min-w-[140px] border-r border-border/40">
                                {row.client_name || "(No Client)"}
                              </TableCell>

                              {/* Billable Hours */}
                              <TableCell className="text-right whitespace-nowrap border-r border-border/40">
                                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                                  {(
                                    parseFloat(row.billable_hours) || 0
                                  ).toFixed(1)}
                                  h
                                </span>
                              </TableCell>

                              {/* Non-Billable Hours */}
                              <TableCell className="text-right whitespace-nowrap border-r border-border/40">
                                <span className="text-sm font-medium text-red-700">
                                  {(
                                    parseFloat(row.non_billable_hours) || 0
                                  ).toFixed(1)}
                                  h
                                </span>
                              </TableCell>

                              {/* Self Study Hours */}
                              <TableCell className="text-right whitespace-nowrap border-r border-border/40">
                                {parseFloat(row.self_study_hours) > 0 ? (
                                  <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                                    {parseFloat(row.self_study_hours).toFixed(
                                      1,
                                    )}
                                    h
                                  </span>
                                ) : (
                                  <span className="text-sm text-muted-foreground/40">
                                    —
                                  </span>
                                )}
                              </TableCell>
                              {/* Official Off Days */}
                              <TableCell className="text-right whitespace-nowrap border-r border-border/40">
                                {parseFloat(row.official_off_hours) > 0 ? (
                                  <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                                    {parseFloat(row.official_off_hours).toFixed(
                                      1,
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-sm text-muted-foreground/40">
                                    —
                                  </span>
                                )}
                              </TableCell>
                              {/* Working Days */}
                              {/*<TableCell className="text-right whitespace-nowrap text-sm text-muted-foreground border-r border-border/40">
                                {row.working_days ?? "—"}
                              </TableCell>*/}
                            </TableRow>
                          ))}

                          {/* Per-employee subtotal row — only when 2+ clients */}
                          {/* {empRows.length > 1 && (
                            <TableRow className="bg-blue-50/60 dark:bg-blue-950/20 border-t border-blue-200/60 dark:border-blue-800/40">
                              <TableCell
                                colSpan={3}
                                className="py-2 px-4 text-xs font-semibold text-blue-700 dark:text-blue-300"
                              >
                                {empRows[0].employee_name} — {empRows.length}{" "}
                                clients
                              </TableCell>
                              <TableCell className="py-2 px-4 text-xs font-semibold text-blue-700 dark:text-blue-300 text-right whitespace-nowrap">
                                Subtotal
                              </TableCell>
                              <TableCell className="py-2 px-4 text-xs font-bold text-green-700 dark:text-green-400 text-right whitespace-nowrap">
                                {decimalToHHMM(empTotals.billable)}
                              </TableCell>
                              <TableCell className="py-2 px-4 text-xs font-bold text-muted-foreground text-right whitespace-nowrap">
                                {decimalToHHMM(empTotals.nonBillable)}
                              </TableCell>
                              <TableCell className="py-2 px-4 text-xs font-bold text-amber-600 dark:text-amber-400 text-right whitespace-nowrap">
                                {empTotals.selfStudy > 0
                                  ? decimalToHHMM(empTotals.selfStudy)
                                  : "—"}
                              </TableCell>
                              <TableCell className="py-2 px-4 text-xs font-bold text-muted-foreground text-right whitespace-nowrap border-r border-border/40">
                                {empTotals.workingDays}
                              </TableCell>
                            </TableRow>
                          )} */}
                        </React.Fragment>
                      );
                    },
                  )}
                </TableBody>

                {/* ── Grand total footer ───────────────────────────────── */}
                {/* {headerData.length > 0 && (
                  <tfoot>
                    <tr className="bg-muted/50 border-t-2 border-border">
                      <td
                        className="px-4 py-3 text-sm font-semibold"
                        colSpan={4}
                      >
                        Total ({[...groupedByEmployee.keys()].length} employees
                        · {headerData.length} rows)
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-green-700 dark:text-green-400 text-right whitespace-nowrap">
                        {decimalToHHMM(employeeBillableTotals.billable)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-muted-foreground text-right whitespace-nowrap">
                        {decimalToHHMM(employeeBillableTotals.nonBillable)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-amber-600 dark:text-amber-400 text-right whitespace-nowrap">
                        {employeeBillableTotals.selfStudy > 0
                          ? decimalToHHMM(employeeBillableTotals.selfStudy)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-muted-foreground text-right whitespace-nowrap border-r border-border/40">
                        —
                      </td>
                    </tr>
                  </tfoot>
                )} */}
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ITEM MODE — existing per-entry table (unchanged below)
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <Card>
      {/* ── Header bar: record count + rows-per-page ──────────────────── */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base text-muted-foreground font-medium">
            {loading
              ? "Loading..."
              : `${pagination?.totalCount ?? effectiveData.length} records`}
          </CardTitle>

          <div className="flex items-center gap-2 flex-wrap">
            {/* ── Single download button — logic determines source ── */}
            {/* Header mode:          always server (ticket_master data)  */}
            {/* Item mode, multi-page: server export (all records)        */}
            {/* Item mode, one page:  client-side SheetJS export         */}
            {!loading &&
              (effectiveData.length > 0 || exportMode === "header") &&
              (() => {
                if (exportMode === "header") {
                  return (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
                      onClick={onExportAll}
                      disabled={exporting}
                      title="Export header report (ticket master data)"
                    >
                      {exporting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      {exporting ? "Exporting..." : "Download Report"}
                    </Button>
                  );
                }
                if (
                  pagination &&
                  pagination.totalCount > effectiveData.length
                ) {
                  return (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
                      onClick={onExportAll}
                      disabled={exporting}
                      title={`Export all ${pagination.totalCount} records`}
                    >
                      {exporting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      {exporting
                        ? "Exporting..."
                        : `Download Report (${pagination.totalCount})`}
                    </Button>
                  );
                }
                return effectiveData.length > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
                    onClick={() =>
                      exportToExcel(effectiveData, pagination, exportMode)
                    }
                    title="Export current page to Excel"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Report
                  </Button>
                ) : null;
              })()}

            {/* ── Rows per page ───────────────────────────────── */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Rows per page:
              </span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => onPageSizeChange(Number(v))}
              >
                <SelectTrigger className="h-8 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                {/* ── Column headers ──────────────────────────────────── */}
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    {SORTABLE_COLS.map((col) => (
                      <TableHead
                        key={col.key}
                        onClick={() => onSort(col.key)}
                        className="cursor-pointer select-none whitespace-nowrap text-xs font-semibold uppercase tracking-wide hover:text-primary transition-colors"
                      >
                        {col.label}
                        <SortIcon
                          column={col.key}
                          currentSort={sortBy}
                          sortDir={sortDir}
                        />
                      </TableHead>
                    ))}
                    <TableHead className="text-xs font-semibold uppercase tracking-wide">
                      Description
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide">
                      Manager
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide">
                      Task
                    </TableHead>
                  </TableRow>
                </TableHeader>

                {/* ── Data rows ───────────────────────────────────────── */}
                <TableBody>
                  {[...groupedByDate.entries()].map(([dateKey, rows]) => {
                    // Day subtotal in hours (DB is minutes)
                    const dayTotalMins = rows.reduce(
                      (s, r) => s + (parseFloat(r.total_hours) || 0),
                      0,
                    );
                    const dayTotalHrs = minsToHours(dayTotalMins);
                    const isOvertime = dayTotalHrs > 8;

                    return (
                      <React.Fragment key={dateKey}>
                        {rows.map((row, i) => (
                          <TableRow
                            key={row.entry_id}
                            className="hover:bg-accent/40 transition-colors"
                          >
                            {/* ── Date cell — only on first row of each day group ── */}
                            {i === 0 ? (
                              <TableCell
                                rowSpan={rows.length}
                                className="align-top border-r border-border/40 min-w-[120px]"
                              >
                                <div className="font-medium text-sm text-foreground">
                                  {formatDate(row.entry_date)}
                                </div>
                                {/* Day total badge
                                <span
                                  className={`inline-block mt-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                                    isOvertime
                                      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300"
                                      : "bg-secondary text-secondary-foreground border-border"
                                  }`}
                                >
                                  {dayTotalHrs.toFixed(1)}h
                                </span> */}
                              </TableCell>
                            ) : null}

                            {/* ── Employee ─────────────────────────────────────── */}
                            <TableCell className="min-w-[130px] border-r border-border/40">
                              <div className="font-medium text-sm">
                                {row.employee_first_name}{" "}
                                {row.employee_last_name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {row.employee_code}
                              </div>
                            </TableCell>

                            {/* ── Project ──────────────────────────────────────── */}
                            <TableCell className="min-w-[140px] border-r border-border/40">
                              <div className="text-sm font-medium line-clamp-1">
                                {row.project_name || "—"}
                              </div>
                              {row.project_code && (
                                <div className="text-xs text-muted-foreground">
                                  {row.project_code}
                                </div>
                              )}
                            </TableCell>

                            {/* ── Ticket ───────────────────────────────────────── */}
                            <TableCell className="min-w-[200px] border-r border-border/40">
                              <div className="text-sm break-words line-clamp-3">
                                {row.ticket_name || row.ticket_number || "—"}
                              </div>
                              {row.ticket_code && (
                                <div className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded w-fit mt-0.5">
                                  {row.ticket_code}
                                </div>
                              )}
                            </TableCell>

                            {/* ── Hours (DB stores minutes → divide by 60) ──────── */}
                            <TableCell className="whitespace-nowrap border-r border-border/40">
                              <span
                                className={`font-semibold text-sm ${
                                  minsToHours(row.total_hours) > 8
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-foreground"
                                }`}
                              >
                                {fmtHours(row.total_hours)}
                              </span>
                              {/* {row.billable_hours > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  {fmtHours(row.billable_hours)} billable
                                </div>
                              )} */}
                            </TableCell>

                            {/* ── Status ───────────────────────────────────────── */}
                            <TableCell className="border-r border-border/40">
                              <StatusBadge status={row.status} />
                            </TableCell>

                            {/* ── Submitted at ─────────────────────────────────── */}
                            <TableCell className="text-sm whitespace-nowrap border-r border-border/40">
                              {row.submitted_at
                                ? new Date(row.submitted_at).toLocaleDateString(
                                    "en-GB",
                                    {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    },
                                  )
                                : "—"}
                            </TableCell>

                            {/* ── Description ──────────────────────────────────── */}
                            <TableCell className="min-w-[150px] border-r border-border/40">
                              <p className="text-sm line-clamp-2">
                                {row.description || "—"}
                              </p>
                            </TableCell>

                            {/* ── Manager ──────────────────────────────────────── */}
                            <TableCell className="text-sm whitespace-nowrap border-r border-border/40">
                              {row.manager_first_name
                                ? `${row.manager_first_name} ${row.manager_last_name}`
                                : "—"}
                            </TableCell>

                            {/* ── Task ─────────────────────────────────────────── */}
                            <TableCell className="text-sm border-r border-border/40">
                              {row.task_name || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </TableBody>

                {/* ── Grand total footer ───────────────────────────────── */}
                {effectiveData.length > 0 && (
                  <tfoot>
                    <tr className="bg-muted/50 border-t-2 border-border">
                      <td
                        className="px-4 py-3 text-sm font-semibold"
                        colSpan={4}
                      >
                        Page Total
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-primary">
                        {fmtHours(grandTotalMins)}
                      </td>
                      <td
                        colSpan={5}
                        className="px-4 py-3 text-xs text-muted-foreground"
                      >
                        {effectiveData.length} entries on this page
                      </td>
                    </tr>
                  </tfoot>
                )}
              </Table>
            </div>

            {/* ── Pagination ───────────────────────────────────────────── */}
            {pagination && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages} ·{" "}
                  {(pagination.page - 1) * pagination.pageSize + 1}–
                  {Math.min(
                    pagination.page * pagination.pageSize,
                    pagination.totalCount,
                  )}{" "}
                  of {pagination.totalCount} records
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onPageChange(1)}
                    disabled={!pagination.hasPrevPage}
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onPageChange(pagination.page - 1)}
                    disabled={!pagination.hasPrevPage}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>

                  {Array.from(
                    { length: Math.min(5, pagination.totalPages) },
                    (_, i) => {
                      const start = Math.max(
                        1,
                        Math.min(
                          pagination.page - 2,
                          pagination.totalPages - 4,
                        ),
                      );
                      return start + i;
                    },
                  )
                    .filter((p) => p <= pagination.totalPages)
                    .map((p) => (
                      <Button
                        key={p}
                        variant={p === pagination.page ? "default" : "outline"}
                        size="icon"
                        className="h-7 w-7 text-xs"
                        onClick={() => onPageChange(p)}
                      >
                        {p}
                      </Button>
                    ))}

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onPageChange(pagination.page + 1)}
                    disabled={!pagination.hasNextPage}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onPageChange(pagination.totalPages)}
                    disabled={!pagination.hasNextPage}
                  >
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// export default router;

import express from "express";
import {
  getTimesheetReport,
  getGroupedTimesheetReport,
  getEmployeeSummaryReport,
  getProjectSummaryReport,
  getTicketSummaryReport,
  getReportFilterOptions,
  getHeaderPreviewReport, // header-mode table preview
  getEmployeeBillableReport, // employee-billable preview [NEW]
  exportTimesheetReport, // export endpoint
} from "../controllers/timesheetReportController.js";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// All report routes require authentication
router.use(authenticateToken);

// ============================================================
// SPECIFIC ROUTES FIRST (consistent with employeeRoutes.js pattern)
// Always register specific paths before the root "/" route.
// ============================================================

/**
 * GET /api/timesheet-report/filter-options
 *
 * Returns all dropdown data in a single request:
 *   employees   — ALL employees (active + inactive)
 *   projects    — ALL projects (active + inactive)
 *   tickets     — ALL tickets (active + inactive)  ← NEW
 *   managers    — ADMIN + MANAGER role employees only
 *   clients     — active clients
 *   statuses    — all timesheet_status values
 *   departments — all departments
 *
 * Access: ADMIN, MANAGER
 */
router.get(
  "/filter-options",
  authorizeRoles(["ADMIN", "MANAGER"]),
  getReportFilterOptions,
);

/**
 * GET /api/timesheet-report/grouped
 *
 * Returns entries grouped by date with per-day subtotals.
 * Used by the day-wise / calendar view in the frontend.
 *
 * Query params (all optional):
 *   employeeId, projectId, ticketId, clientId, departmentId,
 *   fromDate, toDate, status, managerId
 *
 * Access: ADMIN, MANAGER
 */
router.get(
  "/grouped",
  authorizeRoles(["ADMIN", "MANAGER"]),
  getGroupedTimesheetReport,
);

/**
 * GET /api/timesheet-report/employee-summary
 *
 * Per-employee rollup: total hours, working days, billable hours,
 * projects, tickets, avg/day, status breakdown.
 * Includes ALL active employees even those with zero entries.
 *
 * Query params (all optional):
 *   fromDate, toDate, departmentId, projectId, managerId, employeeId
 *
 * Access: ADMIN, MANAGER
 */
router.get(
  "/employee-summary",
  authorizeRoles(["ADMIN", "MANAGER"]),
  getEmployeeSummaryReport,
);

/**
 * GET /api/timesheet-report/project-summary
 *
 * Per-project rollup: total hours, employees, tickets, working days,
 * billable hours, status breakdown.
 * Includes ALL active projects even those with zero entries.
 *
 * Query params (all optional):
 *   fromDate, toDate, clientId, projectId, status
 *
 * Access: ADMIN only
 */
router.get(
  "/project-summary",
  authorizeRoles(["ADMIN", "MANAGER"]),
  getProjectSummaryReport,
);

/**
 * GET /api/timesheet-report/ticket-summary       ← NEW
 *
 * Per-ticket rollup: logged hours vs estimated/approved,
 * utilisation %, employee count, entry count, status breakdown.
 * Includes ALL active tickets even those with zero entries.
 *
 * Query params (all optional):
 *   fromDate, toDate, projectId, clientId, employeeId, status
 *
 * Access: ADMIN, MANAGER
 */
router.get(
  "/ticket-summary",
  authorizeRoles(["ADMIN", "MANAGER"]),
  getTicketSummaryReport,
);

/**
 * GET /api/timesheet-report/header-preview
 *
 * Returns the same aggregated ticket-level data that the Header xlsx export
 * produces, but as JSON — drives the ReportTable in header export mode.
 *
 * One row per ticket (from ticket_master), with billable/non-billable hours
 * aggregated from matching daily_timesheet_entries via a LEFT JOIN.
 * Hours returned as INTEGER MINUTES (divide by 60 in the frontend).
 *
 * Query params (all optional): same filter set as GET /
 *
 * Access: ADMIN, MANAGER
 */
router.get(
  "/header-preview",
  authorizeRoles(["ADMIN", "MANAGER"]),
  getHeaderPreviewReport,
);

/**
 * GET /api/timesheet-report/employee-billable       ← NEW
 *
 * Per-employee × per-client rollup:
 *   Billable Hours, Non-Billable Hours, Self Study Hours, Working Days.
 * One row per (employee, client) pair.
 * Self Study hours = entries where task_master.task ILIKE 'Self Study'.
 * Hours returned as decimal (already ÷60).
 *
 * Query params (all optional): same filter set as GET /
 * Response: { data: [...], total: N }
 *
 * Access: ADMIN, MANAGER
 */
router.get(
  "/employee-billable",
  authorizeRoles(["ADMIN", "MANAGER"]),
  getEmployeeBillableReport,
);

/**
 * GET /api/timesheet-report/export
 *
 * Downloads ALL matching rows as an Excel file.
 * Applies identical filter + manager-scope logic as GET /.
 *
 * Query params: same as GET / plus:
 *   exportMode   "item" (default) | "header" | "employee-billable"
 *     item              → one row per timesheet entry (full detail)
 *     header            → one aggregated row per client/project/ticket with
 *                         approved hours, billable hours, non-billable hours
 *     employee-billable → one row per (employee × client) with
 *                         billable, non-billable, and self-study hours
 *
 * Access: ADMIN, MANAGER
 */
router.get(
  "/export",
  authorizeRoles(["ADMIN", "MANAGER"]),
  exportTimesheetReport,
);

// ============================================================
// GENERAL ROUTES LAST
// ============================================================

/**
 * GET /api/timesheet-report
 *
 * Main paginated timesheet report with full filtering.
 * Runs data + count + summary KPI queries in parallel.
 *
 * Query params (all optional):
 *   employeeId   UUID | employee_code
 *   projectId    UUID | zoho_crm_code
 *   ticketId     UUID | zoho_crm_code | partial name
 *   clientId     UUID                                 ← NEW
 *   departmentId integer                              ← NEW
 *   fromDate     YYYY-MM-DD
 *   toDate       YYYY-MM-DD
 *   status       timesheet_status name (e.g. "Submitted")
 *   managerId    UUID | employee_code
 *   page         integer, default 1
 *   pageSize     integer, default 25, max 100
 *   sortBy       entry_date|hours|status|employee|project|ticket|submitted_at
 *   sortDir      asc|desc
 *
 * Access: ADMIN, MANAGER
 */
router.get("/", authorizeRoles(["ADMIN", "MANAGER"]), getTimesheetReport);

export default router;

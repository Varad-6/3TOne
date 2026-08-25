import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import {
  authorize,
  validateSelfOrAdmin,
  validateTimesheetOwnership,
  validateApprovalAuthority,
} from "../middleware/roleAuthMiddleware.js";

// ===============================================
// CONTROLLER IMPORTS
// ===============================================

// Entry-related functions
import {
  createEntry,
  getEntriesByDateRange,
  updateEntry,
  deleteEntry,
  submitWeek,
  getTimesheetHistory,
  getWeekStatus,
  // ✅ NEW: Recalculation functions
  recalculateAssignmentEntries,
  recalculateTicketEntries,
  getAffectedEntriesPreview,
} from "../controllers/timesheet/entryController.js";

// Approval-related functions
import {
  approveRejectWeek,
  getPendingApprovals,
  getAllPendingApprovals,
} from "../controllers/timesheet/approvalController.js";

// Lookup/Project functions
import {
  getAssignedProjectsForTimesheet,
  getAssignedTicketsForTimesheet,
  getEmployeeAssignedTickets,
  getAllDepartments,
} from "../controllers/timesheet/lookupController.js";

const router = express.Router();

// ============================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================
router.use(authenticateToken);

// ===============================================
// LOOKUP ROUTES (Project & Ticket Selection)
// ===============================================

/**
 * GET /projects
 * Get assigned projects filtered by user role
 *
 * Role-based behavior:
 * - ADMIN: All active projects
 * - MANAGER: Projects assigned via project_manager_assignment
 * - EMPLOYEE: Projects where they have active ticket_assignments
 */
router.get(
  "/projects",
  authorize("ADMIN", "MANAGER", "EMPLOYEE"),
  getAssignedProjectsForTimesheet
);

/**
 * GET /projects/:projectId/tickets
 * Get assigned tickets for a selected project (role-based)
 * ✅ UPDATED: Now includes assigned_hours from ticket_assignments
 *
 * Role-based behavior:
 * - ADMIN: All tickets in project
 * - MANAGER: Tickets in ticket_manager_scope + assigned_hours
 * - EMPLOYEE: Tickets in ticket_assignments + assigned_hours
 *
 * Response includes:
 * - ticket_id, ticket_name, zoho_crm_code
 * - assigned_hours (from ticket_assignments for EMPLOYEE/MANAGER)
 */
router.get(
  "/projects/:projectId/tickets",
  authorize("ADMIN", "MANAGER", "EMPLOYEE"),
  getAssignedTicketsForTimesheet
);

/**
 * GET /my-tickets
 * Get detailed list of all assigned tickets
 * ✅ UPDATED: Includes assigned_hours per ticket
 * Used for "My Tickets" view with budget/used hours
 *
 * Returns:
 * - MANAGER: Tickets from ticket_manager_scope + assigned_hours
 * - EMPLOYEE: Tickets from ticket_assignments + assigned_hours
 */
router.get(
  "/my-tickets",
  authorize("ADMIN", "MANAGER", "EMPLOYEE"),
  getEmployeeAssignedTickets
);

/**
 * GET /departments
 * Get all departments (from department_master enum)
 * Used for dropdown selections
 */
router.get(
  "/departments",
  authorize("ADMIN", "MANAGER", "EMPLOYEE"),
  getAllDepartments
);

// ===============================================
// TIMESHEET ENTRY CRUD OPERATIONS
// ===============================================

/**
 * GET /by-date-range
 * Get timesheet entries for logged-in user by date range
 * ✅ UPDATED: Now includes assigned_hours per entry
 * Query params: startDate, endDate
 *
 * Security: Users can only see their own entries
 *
 * Response includes:
 * - entry_id, project_id, ticket_id, task_id
 * - total_hours (hours_logged)
 * - billable_hours, non_billable_hours
 * - assigned_hours (from ticket_assignments JOIN)
 * - project_name, ticket_name, task_name
 * - status, entry_date, description
 */
router.get(
  "/by-date-range",
  authorize("MANAGER", "EMPLOYEE"),
  getEntriesByDateRange
);

/**
 * GET /week-status
 * Check if user can submit/edit entries for a specific week
 * Query params: weekStart, weekEnd
 *
 * Returns: { canSubmit, status, statuses }
 */
router.get("/week-status", authorize("MANAGER", "EMPLOYEE"), getWeekStatus);

/**
 * POST /
 * Create new timesheet entry
 * ✅ UPDATED: Response includes assigned_hours and auto-calculates billable/non-billable
 *
 * Body: {
 *   projectId, ticketId, taskId,
 *   entryDate, hoursLogged,
 *   description, ticketNumber, billable
 * }
 *
 * Security:
 * - User must be assigned to the ticket
 * - Entry date must be within allowed policy
 * - Daily limit: 8 hours max
 *
 * Billable Calculation:
 * - Automatically splits hours into billable/non-billable
 * - Based on remaining budget in assignment
 * - Excludes approved entries from recalculation
 *
 * Response:
 * - entry: Entry object with billable_hours, non_billable_hours
 * - isMerge: boolean (true if merged with existing)
 */
router.post("/", authorize("MANAGER", "EMPLOYEE"), createEntry);

/**
 * PUT /:id
 * Update existing timesheet entry
 * ✅ UPDATED: Recalculates billable/non-billable hours on update
 *
 * Security:
 * - User must own the entry
 * - Entry must be in Draft or Rejected status
 * - Cannot edit submitted/approved entries
 *
 * Billable Recalculation:
 * - Recalculates billable budget based on current assignment
 * - Excludes approved entries from budget calculation
 *
 * Response:
 * - entry: Updated entry with recalculated billable_hours
 */
router.put(
  "/:id",
  authorize("MANAGER", "EMPLOYEE"),
  validateTimesheetOwnership, // Ensures ownership + editable status
  updateEntry
);

/**
 * DELETE /:id
 * Delete timesheet entry (hard delete)
 *
 * Security:
 * - User must own the entry
 * - Entry must be in Draft or Rejected status
 * - Cannot delete submitted/approved entries
 */
router.delete(
  "/:id",
  authorize("MANAGER", "EMPLOYEE"),
  validateTimesheetOwnership,
  deleteEntry
);

// ===============================================
// TIMESHEET SUBMISSION
// ===============================================

/**
 * POST /submit-week
 * Submit entire week for approval
 *
 * Body: { weekStart, weekEnd }
 *
 * Changes eligible entries in week:
 * - Draft → Submitted (for EMPLOYEE)
 * - Draft → Pending_Admin (for MANAGER)
 * - Manager_Rejected/Admin_Rejected → Submitted/Pending_Admin
 *
 * Validation:
 * - Only Draft and Rejected entries are submitted
 * - Approved entries remain unchanged
 *
 * Response:
 * - count: Number of entries submitted
 * - status: New status name
 */
router.post("/submit-week", authorize("MANAGER", "EMPLOYEE"), submitWeek);

// ===============================================
// TIMESHEET HISTORY
// ===============================================

/**
 * GET /history
 * Get aggregated timesheet history grouped by week
 * ✅ UPDATED: Includes billable and non-billable hours breakdown
 *
 * Returns weekly summaries with:
 * - total_hours (sum of hours_logged)
 * - total_billable_hours (sum of billable_hours)
 * - total_non_billable_hours (sum of non_billable_hours)
 * - status, entry_count, projects, tickets
 * - submitted_at, approved_at, rejected_at
 *
 * Excludes Draft entries (only shows submitted history)
 *
 * Security: Users can only see their own history
 */
router.get("/history", authorize("MANAGER", "EMPLOYEE"), getTimesheetHistory);

// ===============================================
// APPROVAL ROUTES (Manager & Admin Only)
// ===============================================

/**
 * GET /pending-approvals
 * Get pending timesheet approvals
 * ✅ UPDATED: Includes billable/non-billable breakdown
 *
 * Query params: status (optional, e.g., "Submitted", "Pending_Admin")
 *
 * Role-based behavior:
 * - MANAGER: Entries from their project team members only
 * - ADMIN: All pending entries organization-wide
 *
 * Response per week:
 * - employee_id, employee_name, department, designation
 * - week_start_date, week_end_date
 * - total_hours (sum of hours_logged)
 * - total_billable_hours (sum of billable_hours)
 * - total_non_billable_hours (sum of non_billable_hours)
 * - entry_count, status, submitted_at
 * - projects, tickets (comma-separated)
 * - manager_name
 *
 * Frontend displays:
 * - Billable: total_billable_hours
 * - Non-Billable: total_non_billable_hours
 */
router.get(
  "/pending-approvals",
  authorize("MANAGER", "ADMIN"),
  getPendingApprovals
);

/**
 * GET /admin/pending-approvals
 * Admin-only: Get ALL pending approvals across organization
 * ✅ UPDATED: Includes billable/non-billable breakdown
 *
 * Security: Admin only
 *
 * Same response format as /pending-approvals but without manager filtering
 */
router.get(
  "/admin/pending-approvals",
  authorize("ADMIN"),
  getAllPendingApprovals
);

/**
 * POST /approve-reject-week
 * Approve or reject a week's timesheet
 *
 * Body: {
 *   employeeId,
 *   weekStart, (YYYY-MM-DD format)
 *   weekEnd, (YYYY-MM-DD format)
 *   action: 'approve' | 'reject',
 *   rejectionReason (required for reject)
 * }
 *
 * Security:
 * - MANAGER: Can approve entries from their project team members only
 * - ADMIN: Can approve any entries
 *
 * Status transitions:
 * - MANAGER approve: Submitted → Manager_Approved (becomes Pending_Admin)
 * - MANAGER reject: Submitted → Manager_Rejected
 * - ADMIN approve: Pending_Admin/Manager_Approved → Admin_Approved
 * - ADMIN reject: Pending_Admin/Manager_Approved → Admin_Rejected
 *
 * Important:
 * - Approved entries are LOCKED (cannot be edited or recalculated)
 * - Rejected entries return to editable state
 */
router.post(
  "/approve-reject-week",
  authorize("MANAGER", "ADMIN"),
  validateApprovalAuthority, // Validates manager owns the employee
  approveRejectWeek
);

// ===============================================
// ✅ NEW: RECALCULATION ROUTES (Manager & Admin Only)
// ===============================================

/**
 * POST /recalculate-assignment
 * Manually recalculate billable/non-billable hours for an assignment
 * ✅ Only affects Draft and Submitted entries
 * ✅ Approved entries remain unchanged (locked)
 *
 * Body: {
 *   assignmentId: UUID (ticket_assignments_id or ticket_manager_scope.id)
 *   assignmentType: 'employee' | 'manager'
 * }
 *
 * Use Case:
 * - After manager/admin updates assignment billable_hours
 * - Manual trigger if auto-recalculation failed
 * - Audit/verify billable calculations
 *
 * Security: MANAGER and ADMIN only
 *
 * Process:
 * 1. Gets new budget from assignment table
 * 2. Finds all Draft/Submitted entries for assignment
 * 3. Recalculates billable/non-billable in chronological order
 * 4. Updates entries in database
 * 5. Returns count of updated entries
 *
 * Response:
 * {
 *   message: "Entries recalculated successfully",
 *   entriesUpdated: 5,
 *   assignmentId: "uuid",
 *   assignmentType: "employee",
 *   before: {
 *     totalEntries: 5,
 *     totalHours: 35,
 *     currentBillable: 25,
 *     currentNonBillable: 10
 *   },
 *   after: {
 *     totalEntries: 5,
 *     totalHours: 35,
 *     currentBillable: 30,
 *     currentNonBillable: 5
 *   }
 * }
 */
router.post(
  "/recalculate-assignment",
  authorize("ADMIN", "MANAGER"),
  recalculateAssignmentEntries
);

/**
 * POST /recalculate-ticket/:ticketId
 * Recalculate ALL entries for a ticket (all employee + manager assignments)
 * ✅ Only affects Draft and Submitted entries
 * ✅ Approved entries remain unchanged (locked)
 *
 * Params:
 * - ticketId: UUID of the ticket
 *
 * Use Case:
 * - Ticket billable hours changed
 * - Multiple assignments updated
 * - Bulk recalculation needed
 *
 * Security: MANAGER and ADMIN only
 *
 * Process:
 * 1. Finds all active assignments (employee + manager) for ticket
 * 2. Recalculates each assignment's entries
 * 3. Returns summary of all updates
 *
 * Response:
 * {
 *   message: "All ticket entries recalculated successfully",
 *   totalEntriesUpdated: 12,
 *   employeeAssignments: 3,
 *   managerAssignments: 1,
 *   details: [
 *     {
 *       assignmentId: "uuid",
 *       assignmentType: "employee",
 *       entriesUpdated: 5
 *     },
 *     ...
 *   ]
 * }
 */
router.post(
  "/recalculate-ticket/:ticketId",
  authorize("ADMIN", "MANAGER"),
  recalculateTicketEntries
);

/**
 * GET /affected-entries-preview
 * Preview how many entries will be affected by recalculation
 * ✅ Does NOT modify any data - read-only preview
 *
 * Query Params:
 * - assignmentId: UUID (required)
 * - assignmentType: 'employee' | 'manager' (required)
 *
 * Use Case:
 * - Before manual recalculation
 * - Show user impact before confirming
 * - Audit/reporting
 *
 * Security: MANAGER and ADMIN only
 *
 * Response:
 * {
 *   message: "Affected entries summary",
 *   totalEntries: 5,
 *   totalHours: 35,
 *   currentBillable: 30,
 *   currentNonBillable: 5,
 *   willBeRecalculated: true
 * }
 */
router.get(
  "/affected-entries-preview",
  authorize("ADMIN", "MANAGER"),
  getAffectedEntriesPreview
);

// ===============================================
// ✅ OPTIONAL: BILLABLE HOURS ANALYTICS
// ===============================================

/**
 * GET /analytics/billable-summary
 * Get billable vs non-billable hours summary
 * (Optional enhancement for dashboard)
 *
 * Query params: startDate, endDate (optional)
 *
 * Response:
 * - totalHours, billableHours, nonBillableHours
 * - billablePercentage
 * - breakdown by project/department
 */
// router.get(
//   "/analytics/billable-summary",
//   authorize("ADMIN", "MANAGER"),
//   getBillableSummary
// );

export default router;

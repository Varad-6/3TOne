import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import {
  authorize,
  validateSelfOrAdmin,
  validateManagerProjectAccess,
  validateAssignmentAuthority,
} from "../middleware/roleAuthMiddleware.js";
import {
  getManagerProjectsWithTickets,
  assignEmployeesToTicket,
  getManagerEmployees,
  getTicketAssignments,
  removeTicketAssignment,
  getManagerAssignmentsForTicket,
  removeManagerScope,
  updateManagerScope, // ✅ NEW IMPORT
  updateEmployeeAssignmentByManager, // ✅ NEW: Manager updating employee assignment
} from "../controllers/managerTicketAssignmentController.js";

const router = express.Router();

// ============================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================
router.use(authenticateToken);

// ============================================
// MANAGER TICKET ASSIGNMENT ROUTES
// ============================================

/**
 * ✅ GET /ticket/:ticketId/managers
 * Get manager assignments for a specific ticket from ticket_manager_scope
 *
 * Returns:
 * - List of managers assigned to this ticket
 * - Their billable hours, start/end dates
 *
 * Security: Admin and Manager can access
 *
 * MUST BE BEFORE /:managerId routes to avoid route conflict
 */
router.get(
  "/ticket/:ticketId/managers",
  authorize("ADMIN", "MANAGER"),
  getManagerAssignmentsForTicket
);

/**
 * ✅ NEW: PATCH /scope/:scopeId
 * Update billable hours on an existing active manager scope assignment
 *
 * Used when:
 * - Manager wants to adjust their own hours without creating new history record
 * - Admin wants to adjust manager hours
 *
 * Behavior:
 * - Updates SAME record (does not create new history)
 * - Validates budget constraints
 * - Only works on active assignments
 *
 * Security:
 * - Manager can only update their own scope
 * - Admin can update any manager scope
 *
 * Body:
 * {
 *   "billableHours": 15.5
 * }
 *
 * MUST BE BEFORE /:managerId routes to avoid route conflict
 */
router.patch(
  "/scope/:scopeId",
  authorize("ADMIN", "MANAGER"),
  updateManagerScope
);

/**
 * ✅ DELETE /scope/:scopeId
 * Remove manager from ticket_manager_scope (soft delete)
 *
 * Used by Manager to unassign themselves or Admin to unassign any manager
 *
 * Behavior:
 * - Sets is_active = FALSE
 * - Sets assign_end_date = CURRENT_DATE
 * - Preserves record for history
 *
 * Security: Admin and Manager can access
 *
 * MUST BE BEFORE /:managerId routes to avoid route conflict
 */
router.delete(
  "/scope/:scopeId",
  authorize("ADMIN", "MANAGER"),
  removeManagerScope
);

/**
 * GET /:managerId/projects-with-tickets
 * Fetch all projects assigned to manager with their tickets
 *
 * Returns:
 * - Projects assigned to this manager
 * - Tickets within those projects (excluding tickets already in manager's scope)
 *
 * Security: Manager can only see their own data (unless Admin)
 */
router.get(
  "/:managerId/projects-with-tickets",
  authorize("MANAGER", "ADMIN"),
  validateSelfOrAdmin, // Manager can only see their own projects
  getManagerProjectsWithTickets
);

/**
 * GET /:managerId/employees
 * Get list of all active employees + the manager themselves for assignment
 *
 * Returns:
 * - All active employees
 * - The requesting manager (for self-assignment)
 *
 * Security: Manager can only see their own list (unless Admin)
 */
router.get(
  "/:managerId/employees",
  authorize("MANAGER", "ADMIN"),
  getManagerEmployees
);

/**
 * POST /assign
 * Assign ticket to employees or self-assign to manager scope
 *
 * Behavior:
 * - If target is EMPLOYEE → writes to ticket_assignments
 * - If target is MANAGER → writes to ticket_manager_scope (self-assign only)
 * - Always creates NEW record (INSERT only)
 * - Prevents duplicate active assignments
 * - Returns error if user already has active assignment
 *
 * Security: Validates manager owns the project + has assignment authority
 */
router.post(
  "/assign",
  authorize("MANAGER", "ADMIN"),
  validateAssignmentAuthority, // Validates manager owns the project
  assignEmployeesToTicket
);

/**
 * GET /ticket/:ticketId/assignments
 * Get all current EMPLOYEE assignments for a specific ticket
 *
 * Returns:
 * - List of employees assigned to this ticket (from ticket_assignments)
 * - Does NOT include manager assignments (use /ticket/:ticketId/managers for that)
 *
 * Security: Manager must have access to the ticket's project
 */
router.get(
  "/ticket/:ticketId/assignments",
  authorize("MANAGER", "ADMIN"),
  getTicketAssignments
);

/**
 * DELETE /assignments/:assignmentId
 * Remove/deactivate an EMPLOYEE ticket assignment (soft delete)
 *
 * Used to unassign employees from tickets
 *
 * Behavior:
 * - Sets is_active = FALSE
 * - Sets assign_end_date = CURRENT_DATE
 * - Preserves record for history
 *
 * Security: Manager must own the project (validated in controller)
 */
router.delete(
  "/assignments/:assignmentId",
  authorize("MANAGER", "ADMIN"),
  removeTicketAssignment
);

router.patch(
  "/assignments/:assignmentId",
  authorize("MANAGER"),
  updateEmployeeAssignmentByManager
);

export default router;

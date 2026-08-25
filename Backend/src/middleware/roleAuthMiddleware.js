import pool from "../config/database.js";

/**
 * ============================================
 * ROLE-BASED AUTHORIZATION MIDDLEWARE
 * ============================================
 * Provides security layers for TimeTrakPro application
 * Based on schema: employees, project_manager_assignment,
 * ticket_assignments, ticket_manager_scope, daily_timesheet_entries
 */

/**
 * ============================================
 * HELPER FUNCTIONS
 * ============================================
 */

/**
 * Extract and normalize date to YYYY-MM-DD format
 * Accepts: ISO strings, YYYY-MM-DD strings, Date objects
 */
function extractDateString(dateInput) {
  if (!dateInput) return null;

  // Already in YYYY-MM-DD format
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }

  // ISO string with time (e.g., "2025-12-08T00:00:00.000Z")
  if (typeof dateInput === "string" && dateInput.includes("T")) {
    return dateInput.split("T")[0];
  }

  // Try to parse as date
  try {
    const date = new Date(dateInput);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  } catch (e) {
    console.error("Date parsing error:", e);
  }

  return null;
}

/**
 * ============================================
 * AUTHORIZATION MIDDLEWARE
 * ============================================
 */

/**
 * Basic Role Authorization
 * Checks if authenticated user has one of the required roles
 * @param {...string} allowedRoles - Roles allowed to access route (ADMIN, MANAGER, EMPLOYEE)
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // Check if user is authenticated (set by authMiddleware)
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Please log in to access this resource",
      });
    }

    // Check if user's role is in allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Access denied",
        message: "You do not have permission to access this resource",
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
    }

    // User is authorized, proceed to next middleware/controller
    next();
  };
};

/**
 * Self or Admin Access Validation
 * Ensures non-admin users can only access their own data
 * Admins can access any user's data
 */
export const validateSelfOrAdmin = (req, res, next) => {
  try {
    const requestedUserId =
      req.params.userId ||
      req.params.employeeId ||
      req.params.managerId ||
      req.body.employeeId;

    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;

    // Admin can access any user's data
    if (currentUserRole === "ADMIN") {
      return next();
    }

    // Check if user is requesting their own data
    if (!requestedUserId || requestedUserId !== currentUserId) {
      return res.status(403).json({
        error: "Access denied",
        message: "You can only access your own data",
      });
    }

    next();
  } catch (error) {
    console.error("Self-or-admin validation error:", error);
    return res.status(500).json({
      error: "Authorization check failed",
      details: error.message,
    });
  }
};

/**
 * Manager Project Access Validation
 * Ensures manager is assigned to the project via project_manager_assignment
 * NOTE: project_manager_assignment has NO is_active column in schema
 */
export const validateManagerProjectAccess = async (req, res, next) => {
  try {
    const managerId = req.user.id;
    const managerRole = req.user.role;
    const projectId = req.params.projectId || req.body.projectId;

    // Admin can access any project
    if (managerRole === "ADMIN") {
      return next();
    }

    if (!projectId) {
      return res.status(400).json({
        error: "Project ID required",
        message: "Project ID must be provided in request",
      });
    }

    // Check if manager is assigned to this project
    const result = await pool.query(
      `SELECT 1 
       FROM project_manager_assignment 
       WHERE manager_id = $1 AND project_id = $2`,
      [managerId, projectId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        error: "Access denied",
        message: "You are not assigned to this project",
      });
    }

    next();
  } catch (error) {
    console.error("Manager project validation error:", error);
    return res.status(500).json({
      error: "Authorization check failed",
      details: error.message,
    });
  }
};

/**
 * Manager Ticket Access Validation
 * Ensures manager is assigned to the project that owns the ticket
 */
export const validateManagerTicketAccess = async (req, res, next) => {
  try {
    const managerId = req.user.id;
    const managerRole = req.user.role;
    const ticketId = req.params.ticketId || req.body.ticketId;

    // Admin can access any ticket
    if (managerRole === "ADMIN") {
      return next();
    }

    if (!ticketId) {
      return res.status(400).json({
        error: "Ticket ID required",
        message: "Ticket ID must be provided in request",
      });
    }

    // Check if manager is assigned to the project that owns this ticket
    const result = await pool.query(
      `SELECT 1 
       FROM ticket_master t
       JOIN project_manager_assignment pma ON t.project_id = pma.project_id
       WHERE t.ticket_id = $1 
         AND pma.manager_id = $2
         AND t.is_active = TRUE`,
      [ticketId, managerId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        error: "Access denied",
        message: "You are not authorized to access this ticket",
      });
    }

    next();
  } catch (error) {
    console.error("Manager ticket validation error:", error);
    return res.status(500).json({
      error: "Authorization check failed",
      details: error.message,
    });
  }
};

/**
 * Employee Ticket Assignment Validation
 * Ensures employee is assigned to the ticket via ticket_assignments
 */
export const validateEmployeeTicketAccess = async (req, res, next) => {
  try {
    const employeeId = req.user.id;
    const employeeRole = req.user.role;
    const ticketId = req.params.ticketId || req.body.ticketId;

    // Admin and Manager can access any ticket
    if (["ADMIN", "MANAGER"].includes(employeeRole)) {
      return next();
    }

    if (!ticketId) {
      return res.status(400).json({
        error: "Ticket ID required",
        message: "Ticket ID must be provided in request",
      });
    }

    // Check if employee is assigned to this ticket
    const result = await pool.query(
      `SELECT 1 
       FROM ticket_assignments 
       WHERE employee_id = $1 
         AND ticket_id = $2 
         AND is_active = TRUE`,
      [employeeId, ticketId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        error: "Access denied",
        message: "You are not assigned to this ticket",
      });
    }

    next();
  } catch (error) {
    console.error("Employee ticket validation error:", error);
    return res.status(500).json({
      error: "Authorization check failed",
      details: error.message,
    });
  }
};

/**
 * Timesheet Entry Ownership Validation
 * Ensures user can only modify their own timesheet entries
 * Prevents editing submitted/approved entries
 */
export const validateTimesheetOwnership = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // ✅ FIX: Check for 'id' parameter (used in routes) as well as 'entryId'
    const entryId = req.params.id || req.params.entryId || req.body.entryId;

    console.log("🔐 validateTimesheetOwnership:", {
      userId,
      userRole,
      entryId,
      params: req.params,
      body: req.body,
    });

    if (!entryId) {
      console.log("❌ Entry ID not found in params or body");
      return res.status(400).json({
        error: "Entry ID required",
        message: "Entry ID must be provided in request",
      });
    }

    // Admin can modify any entry (for corrections)
    if (userRole === "ADMIN") {
      console.log("✅ Admin bypass - ownership validation skipped");
      return next();
    }

    // Check if entry exists and belongs to user
    const result = await pool.query(
      `SELECT employee_id, status 
       FROM daily_timesheet_entries 
       WHERE entry_id = $1`,
      [entryId]
    );

    if (result.rows.length === 0) {
      console.log("❌ Entry not found:", entryId);
      return res.status(404).json({
        error: "Entry not found",
        message: "Timesheet entry does not exist",
      });
    }

    const entry = result.rows[0];

    // Check ownership
    if (entry.employee_id !== userId) {
      console.log("❌ Ownership mismatch:", {
        entryOwner: entry.employee_id,
        requestingUser: userId,
      });
      return res.status(403).json({
        error: "Access denied",
        message: "You can only modify your own timesheet entries",
      });
    }

    // Check if entry is in editable state
    // ✅ IMPORTANT: Allow editing of Manager_Rejected entries
    const nonEditableStatuses = [
      "Submitted",
      "Pending_Admin",
      "Manager_Approved",
      "Admin_Approved",
      // Note: Manager_Rejected and Admin_Rejected ARE editable (so user can fix and resubmit)
    ];

    if (nonEditableStatuses.includes(entry.status)) {
      console.log("❌ Entry not editable:", entry.status);
      return res.status(403).json({
        error: "Cannot modify entry",
        message: `Entries with status '${entry.status}' cannot be modified`,
        currentStatus: entry.status,
      });
    }

    console.log("✅ Ownership validation passed");
    next();
  } catch (error) {
    console.error("❌ Timesheet ownership validation error:", error);
    return res.status(500).json({
      error: "Authorization check failed",
      details: error.message,
    });
  }
};

/**
 * ✅ UPDATED: Timesheet Approval Authorization (Week-based)
 * Ensures only authorized managers can approve entries from their team
 * Admins can approve any entries
 *
 * This middleware validates:
 * - Required fields (employeeId, weekStart, weekEnd, action)
 * - Date formats (normalizes to YYYY-MM-DD)
 * - Manager authorization for the specific week/employee
 */
export const validateApprovalAuthority = async (req, res, next) => {
  try {
    const { id: userId, role: userRole } = req.user;
    let { employeeId, weekStart, weekEnd, action } = req.body;

    // ✅ Normalize dates to YYYY-MM-DD format
    weekStart = extractDateString(weekStart);
    weekEnd = extractDateString(weekEnd);

    // Update req.body with normalized dates for downstream use
    req.body.weekStart = weekStart;
    req.body.weekEnd = weekEnd;

    console.log("🔐 validateApprovalAuthority:", {
      userId,
      userRole,
      employeeId,
      weekStart,
      weekEnd,
      action,
    });

    // ✅ Validate required fields
    if (!employeeId || !weekStart || !weekEnd || !action) {
      console.log("❌ Missing required fields");
      return res.status(400).json({
        error: "Missing required fields",
        required: ["employeeId", "weekStart", "weekEnd", "action"],
        received: { employeeId, weekStart, weekEnd, action },
      });
    }

    // ✅ Validate action
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        error: "Invalid action",
        message: "Action must be 'approve' or 'reject'",
      });
    }

    // ✅ Prevent self-approval
    if (userId === employeeId) {
      return res.status(403).json({
        error: "Access denied",
        message: "You cannot approve your own timesheets",
      });
    }

    // ✅ Admin can approve any entry
    if (userRole === "ADMIN") {
      console.log("✅ Admin authorization granted");
      return next();
    }

    // ✅ Manager can only approve entries from their assigned employees
    if (userRole === "MANAGER") {
      const checkQuery = `
        SELECT COUNT(*) as count
        FROM daily_timesheet_entries
        WHERE employee_id = $1
          AND week_start_date = $2
          AND week_end_date = $3
          AND manager_id = $4
      `;

      const result = await pool.query(checkQuery, [
        employeeId,
        weekStart,
        weekEnd,
        userId,
      ]);

      const entryCount = parseInt(result.rows[0].count);

      if (entryCount === 0) {
        console.log("❌ Manager not authorized:", {
          employeeId,
          weekStart,
          weekEnd,
          managerId: userId,
        });
        return res.status(403).json({
          error: "Access denied",
          message:
            "You are not authorized to approve this timesheet. Either the week doesn't exist or you're not the assigned manager.",
        });
      }

      console.log(
        `✅ Manager authorization granted (${entryCount} entries found)`
      );
      return next();
    }

    // ❌ Other roles cannot approve
    return res.status(403).json({
      error: "Access denied",
      message: "You do not have approval authority",
    });
  } catch (error) {
    console.error("❌ validateApprovalAuthority error:", error);
    return res.status(500).json({
      error: "Authorization validation failed",
      details: error.message,
    });
  }
};

/**
 * Validate Assignment Authority
 * Ensures only authorized users can create ticket assignments
 *
 * ASSIGNMENT RULES:
 * ==================
 * ADMIN can assign tickets to:
 *   1. Managers - Only those assigned to the project (project_manager_assignment)
 *                → Detailed validation happens in controller
 *   2. Employees - Any active employee (no project restriction)
 *                → Detailed validation happens in controller
 *
 * MANAGER can assign tickets to:
 *   1. Employees - Only in their assigned projects
 *                → Project ownership validated here
 *
 * This middleware provides basic authorization checks.
 * Detailed business logic (e.g., manager-project relationship for admin assignments)
 * is handled in the controller layer for better separation of concerns.
 */
export const validateAssignmentAuthority = async (req, res, next) => {
  try {
    const assignerId = req.user.id;
    const assignerRole = req.user.role;
    const { projectId, ticketId, employeeId } = req.body;

    if (!projectId || !ticketId) {
      return res.status(400).json({
        error: "Project ID and Ticket ID required",
      });
    }

    // ✅ ADMIN: Has broad assignment authority
    // Controller will validate:
    // - If target is MANAGER → must be in project_manager_assignment
    // - If target is EMPLOYEE → no project restriction (any active employee)
    if (assignerRole === "ADMIN") {
      return next();
    }

    // ✅ MANAGER: Can only assign tickets from their assigned projects
    if (assignerRole === "MANAGER") {
      const result = await pool.query(
        `SELECT 1
         FROM project_manager_assignment
         WHERE manager_id = $1 AND project_id = $2`,
        [assignerId, projectId]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only assign tickets from your assigned projects",
        });
      }

      return next();
    }

    // ❌ EMPLOYEES cannot assign tickets
    return res.status(403).json({
      error: "Access denied",
      message: "You do not have assignment authority",
    });
  } catch (error) {
    console.error("Assignment authority validation error:", error);
    return res.status(500).json({
      error: "Authorization check failed",
      details: error.message,
    });
  }
};

// Export all middleware functions
export default {
  authorize,
  validateSelfOrAdmin,
  validateManagerProjectAccess,
  validateManagerTicketAccess,
  validateEmployeeTicketAccess,
  validateTimesheetOwnership,
  validateApprovalAuthority,
  validateAssignmentAuthority,
};

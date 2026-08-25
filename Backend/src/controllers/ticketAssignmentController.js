import pool from "../config/database.js";
import { recalculateAssignmentEntries } from "../utils/recalculationHelper.js";
import {
  toMinutes,
  minutesToHHMM,
  minutesToReadable,
} from "../utils/timeUtils.js";
import { triggerEmployeeTicketAssigned, triggerManagerTicketAssigned } from "./emailController.js";

//------------------------------------------------------------------
// Get Assignees for a specific Project
// - Returns all active EMPLOYEEs
// - Returns only MANAGERs who are assigned to that project via project_manager_assignment
//
// Used by both Admin and Manager for project-specific assignment
//------------------------------------------------------------------
export const getAssigneesForProject = async (req, res) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }

    const query = `
      SELECT DISTINCT
        e.employee_id,
        e.first_name,
        e.last_name,
        e.email,
        e.role AS role_id,
        ur.name AS role_name,
        e.designation,
        e.department AS department_id,
        d.name AS department_name
      FROM employees e
      JOIN user_roles ur ON ur.id = e.role
      LEFT JOIN departments d ON d.id = e.department
      WHERE e.is_active = TRUE
        AND ur.name IN ('EMPLOYEE', 'MANAGER')
      ORDER BY 
        CASE WHEN ur.name = 'MANAGER' THEN 0 ELSE 1 END,
        e.first_name ASC, 
        e.last_name ASC
    `;

    const result = await pool.query(query);

    // ✅ Explicitly map the response to ensure role is a string
    const employees = result.rows.map((emp) => ({
      employee_id: emp.employee_id,
      first_name: emp.first_name,
      last_name: emp.last_name,
      email: emp.email,
      designation: emp.designation,
      role: emp.role_name, // ✅ Use role_name (string)
      roleId: emp.role_id, // Keep numeric ID if needed
      department: emp.department_name, // ✅ Use department_name (string)
      departmentId: emp.department_id, // Keep numeric ID if needed
    }));

    return res.json({ employees });
  } catch (error) {
    console.error("getAssigneesForProject error:", error);
    return res.status(500).json({ error: "Failed to fetch assignees" });
  }
};

//------------------------------------------------------------------
// ✅ FIXED: Get Assignees for Admin (Project-Aware)
// Returns:
// - All active employees
// - Only managers assigned to the specified project
//
// Query Parameters:
// - projectId (required): Filter managers by this project
//
// This replaces the old behavior of returning ALL managers
//------------------------------------------------------------------
export const getAllAssigneesForAdmin = async (req, res) => {
  try {
    const { projectId } = req.query;

    // ✅ Still require projectId for consistency, but don't use it to filter users
    if (!projectId) {
      return res.status(400).json({
        error: "projectId is required",
        message: "Please provide projectId for ticket assignment context",
      });
    }

    // ✅ UPDATED: Fetch ALL active employees and managers
    const query = `
      SELECT * FROM (
        SELECT DISTINCT
          e.employee_id,
          e.employee_code,
          e.first_name,
          e.last_name,
          e.first_name || ' ' || e.last_name AS employee_name,
          e.email,
          d.name AS department,
          e.designation,
          ur.name AS role,
          CASE 
            WHEN ur.name = 'MANAGER' THEN 0 
            ELSE 1 
          END AS role_priority
        FROM employees e
        JOIN user_roles ur ON ur.id = e.role
        LEFT JOIN departments d ON d.id = e.department
        WHERE e.is_active = TRUE
          AND ur.name IN ('EMPLOYEE', 'MANAGER')
      ) AS assignees
      ORDER BY role_priority, first_name, last_name
    `;

    const result = await pool.query(query);

    // Remove role_priority from response
    const employees = result.rows.map(({ role_priority, ...emp }) => emp);

    res.json({
      employees,
      count: employees.length,
    });
  } catch (error) {
    console.error("Get all assignees error:", error);
    res.status(500).json({
      error: "Failed to fetch assignees",
      details: error.message,
    });
  }
};

//------------------------------------------------------------------
// Get Assignments for a specific Ticket
// Used to populate the "Current Assignments" list in UI
// ✅ NOTE: This only returns EMPLOYEE assignments from ticket_assignments
// For MANAGER assignments, use getManagerAssignmentsForTicket
//------------------------------------------------------------------
export const getAssignmentsByTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const query = `
      SELECT
        ta.ticket_assignments_id AS assignment_id,
        ta.ticket_id,
        ta.employee_id,
        e.first_name,
        e.last_name,
        e.email,
        e.designation,
        e.role AS role_id,
        ur.name AS role_name,
        e.department AS department_id,
        d.name AS department_name,
        ta.billable_hours AS assigned_hours,
        ta.assign_start_date,
        ta.assign_end_date,
        ta.is_active,
        -- ✅ Add used hours calculation
        COALESCE((
          SELECT SUM(dte.total_hours)
          FROM daily_timesheet_entries dte
          WHERE dte.ticket_assign_id = ta.ticket_assignments_id
        ), 0) AS used_hours
      FROM ticket_assignments ta
      JOIN employees e ON ta.employee_id = e.employee_id
      JOIN user_roles ur ON ur.id = e.role
      LEFT JOIN departments d ON d.id = e.department
      WHERE ta.ticket_id = $1 AND ta.is_active = TRUE
      ORDER BY e.first_name ASC
    `;

    const result = await pool.query(query, [ticketId]);

    const ticketSummary = await pool.query(
      `SELECT
         t.ticket_name,
         t.billable_hours AS total_ticket_hours,
         COALESCE(SUM(ta.billable_hours), 0) AS total_assigned_hours
       FROM ticket_master t
       LEFT JOIN ticket_assignments ta ON t.ticket_id = ta.ticket_id AND ta.is_active = TRUE
       WHERE t.ticket_id = $1
       GROUP BY t.ticket_id, t.ticket_name, t.billable_hours`,
      [ticketId],
    );

    if (ticketSummary.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // ✅ Explicitly map assignments
    const assignments = result.rows.map((assign) => ({
      assignment_id: assign.assignment_id,
      ticket_id: assign.ticket_id,
      employee_id: assign.employee_id,
      first_name: assign.first_name,
      last_name: assign.last_name,
      email: assign.email,
      designation: assign.designation,
      role: assign.role_name, // ✅ Use role_name
      department: assign.department_name, // ✅ Use department_name
      // ✅ Keep minutes as the source of truth
      assigned_hours: parseFloat(assign.assigned_hours), // minutes from DB
      assigned_hours_hhmm: minutesToHHMM(assign.assigned_hours), // formatted for UI
      assigned_hours_readable: minutesToReadable(assign.assigned_hours), // readable format
      used_hours: parseFloat(assign.used_hours), // minutes from DB
      used_hours_hhmm: minutesToHHMM(assign.used_hours), // formatted for UI
      assign_start_date: assign.assign_start_date,
      assign_end_date: assign.assign_end_date,
      is_active: assign.is_active,
    }));

    res.json({
      assignments,
      ticketSummary: ticketSummary.rows[0],
    });
  } catch (error) {
    console.error("Get assignments error:", error);
    res.status(500).json({ error: "Failed to fetch assignments" });
  }
};

//------------------------------------------------------------------
// ✅ Get Manager Assignments for a Ticket
// Returns managers assigned to this ticket via ticket_manager_scope
// Used by frontend to show BOTH employee and manager assignments
//------------------------------------------------------------------
export const getManagerAssignmentsForTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const query = `
      SELECT
        tms.id,
        tms.ticket_id,
        tms.manager_id,
        e.first_name,
        e.last_name,
        e.first_name || ' ' || e.last_name AS manager_name,
        e.email,
        e.designation,
        d.name AS department,
        tms.billable_hours,
        tms.assign_start_date,
        tms.assign_end_date,
        tms.is_active,
        -- ✅ Add used hours calculation
        COALESCE((
          SELECT SUM(dte.total_hours)
          FROM daily_timesheet_entries dte
          WHERE dte.ticket_manager_assign_id = tms.id
        ), 0) AS used_hours
      FROM ticket_manager_scope tms
      JOIN employees e ON tms.manager_id = e.employee_id
      LEFT JOIN departments d ON d.id = e.department
      WHERE tms.ticket_id = $1
        AND tms.is_active = TRUE
      ORDER BY tms.assign_start_date DESC
    `;

    const result = await pool.query(query, [ticketId]);

    // ✅ Format the response
    const managers = result.rows.map((mgr) => ({
      ...mgr,
      billable_hours: parseFloat(mgr.billable_hours), // minutes from DB
      billable_hours_hhmm: minutesToHHMM(mgr.billable_hours), // formatted for UI
      billable_hours_readable: minutesToReadable(mgr.billable_hours), // readable format
      used_hours: parseFloat(mgr.used_hours), // minutes from DB
      used_hours_hhmm: minutesToHHMM(mgr.used_hours), // formatted for UI
    }));

    res.json({
      managers,
      count: managers.length,
    });
  } catch (error) {
    console.error("Get manager assignments error:", error);
    res.status(500).json({
      error: "Failed to fetch manager assignments",
      details: error.message,
    });
  }
};

//------------------------------------------------------------------
// Assign Ticket to Assignee (Employee or Manager)
// Rule:
// - Assign to EMPLOYEE → ticket_assignments
// - Assign to MANAGER → ticket_manager_scope (admin or self-assign)
// ✅ UPDATED: Always INSERT new records, never UPDATE (maintains history)
//------------------------------------------------------------------
export const assignTicketToEmployee = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const loggedInUser = req.user?.id;

    const {
      ticketId,
      employeeId, // employee OR manager
      projectId,
      clientId,
      billableHours,
      assignedBy,
      startDate,
      endDate,
    } = req.body;

    const finalAssignedBy = loggedInUser || assignedBy;

    // ===================================================
    // 1. BASIC VALIDATION
    // ===================================================
    if (!ticketId || !employeeId || !projectId) {
      throw new Error("Ticket, Employee, and Project IDs are required.");
    }

    // ===================================================
    // 2. FETCH TICKET + PROJECT
    // ===================================================
    const ticketCheck = await client.query(
      `SELECT 
         t.billable_hours,
         t.project_id,
         p.is_active AS project_active,
         p.client_id
       FROM ticket_master t
       JOIN project_master p ON t.project_id = p.project_id
       WHERE t.ticket_id = $1
         AND t.is_active = TRUE`,
      [ticketId],
    );

    if (ticketCheck.rows.length === 0) {
      throw new Error("Ticket not found or inactive.");
    }

    const ticketData = ticketCheck.rows[0];
	      const totalTicketMinutes = Number(ticketData.billable_hours || 0);
    const dbClientId = clientId || ticketData.client_id;

    if (!ticketData.project_active) {
      throw new Error(
        "Cannot assign ticket because the parent project is inactive.",
      );
    }

    if (ticketData.project_id !== projectId) {
      throw new Error("Project ID mismatch for this ticket.");
    }

    // ===================================================
    // 3. RESOLVE TARGET ROLE
    // ===================================================
    const roleResult = await client.query(
      `SELECT ur.name AS role_name
       FROM employees e
       JOIN user_roles ur ON ur.id = e.role
       WHERE e.employee_id = $1
         AND e.is_active = TRUE`,
      [employeeId],
    );

    if (roleResult.rows.length === 0) {
      throw new Error("Target employee not found or inactive.");
    }

    const targetRole = roleResult.rows[0].role_name; // EMPLOYEE | MANAGER

    // ===================================================
    // 4. CONVERT BILLABLE HOURS → MINUTES
    // ===================================================
    const minutesToAssign = toMinutes(billableHours);

    if (minutesToAssign === null || minutesToAssign <= 0) {
      throw new Error(
        "Billable hours must be a valid time value greater than 0.",
      );
    }

    // ===================================================
    // 5. TICKET BUDGET VALIDATION (EMPLOYEE + MANAGER)
    // ===================================================
    const assignedQuery = await client.query(
      `SELECT 
         COALESCE(SUM(ta.billable_hours), 0) +
         COALESCE(SUM(tms.billable_hours), 0) AS total_assigned
       FROM ticket_master t
       LEFT JOIN ticket_assignments ta 
         ON t.ticket_id = ta.ticket_id
         AND ta.is_active = TRUE
         AND ta.employee_id != $2
       LEFT JOIN ticket_manager_scope tms
         ON t.ticket_id = tms.ticket_id
         AND tms.is_active = TRUE
         AND tms.manager_id != $2
       WHERE t.ticket_id = $1`,
      [ticketId, employeeId],
    );

    const currentlyAssignedMinutes = Number(
      assignedQuery.rows[0]?.total_assigned || 0
    );

    const remainingMinutes = totalTicketMinutes - currentlyAssignedMinutes;

    if (minutesToAssign > remainingMinutes) {
      throw new Error(
        `Cannot assign ${minutesToHHMM(minutesToAssign)}. ` +
          `Ticket budget: ${minutesToHHMM(totalTicketMinutes)}, ` +
          `Already assigned: ${minutesToHHMM(currentlyAssignedMinutes)}. ` +
          `Remaining: ${minutesToHHMM(remainingMinutes)}.`,
      );
    }

    // ===================================================
    // 6A. ASSIGN TO MANAGER → ticket_manager_scope
    // ===================================================
    if (targetRole === "MANAGER") {
      const existingScope = await client.query(
        `SELECT id
         FROM ticket_manager_scope
         WHERE ticket_id = $1
           AND manager_id = $2
           AND is_active = TRUE`,
        [ticketId, employeeId],
      );

      if (existingScope.rows.length > 0) {
        throw new Error(
          "This manager is already actively assigned to this ticket.",
        );
      }

      const insertResult = await client.query(
        `INSERT INTO ticket_manager_scope
           (ticket_id, manager_id, project_id, client_id,
            assigned_by, assign_start_date, assign_end_date,
            billable_hours, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)
         RETURNING *`,
        [
          ticketId,
          employeeId,
          projectId,
          dbClientId,
          finalAssignedBy,
          startDate || new Date(),
          endDate || null,
          minutesToAssign,
        ],
      );

      await client.query("COMMIT");
/*🔥*/  await triggerManagerTicketAssigned({ ticketManagerScopeId: insertResult.rows[0].id });

      return res.json({
        message: "Ticket assigned to manager successfully",
        scope: {
          ...insertResult.rows[0],
          billable_hours_hhmm: minutesToHHMM(
            insertResult.rows[0].billable_hours,
          ),
          billable_hours_readable: minutesToReadable(
            insertResult.rows[0].billable_hours,
          ),
        },
      });
    }

    // ===================================================
    // 6B. ASSIGN TO EMPLOYEE → ticket_assignments
    // ===================================================
    const existingAssignment = await client.query(
      `SELECT ticket_assignments_id
       FROM ticket_assignments
       WHERE ticket_id = $1
         AND employee_id = $2
         AND is_active = TRUE`,
      [ticketId, employeeId],
    );

    if (existingAssignment.rows.length > 0) {
      throw new Error(
        "This employee is already actively assigned to this ticket.",
      );
    }

    const result = await client.query(
      `INSERT INTO ticket_assignments
         (ticket_id, employee_id, project_id, client_id,
          assigned_by, billable_hours,
          assign_start_date, assign_end_date, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)
       RETURNING *`,
      [
        ticketId,
        employeeId,
        projectId,
        dbClientId,
        finalAssignedBy,
        minutesToAssign,
        startDate || new Date(),
        endDate || null,
      ],
    );

    await client.query("COMMIT");
/*🔥*/    await triggerEmployeeTicketAssigned({ ticketAssignmentId: result.rows[0].ticket_assignments_id });

    res.json({
      message: "Ticket assigned successfully",
      assignment: {
        ...result.rows[0],
        billable_hours_hhmm: minutesToHHMM(result.rows[0].billable_hours),
        billable_hours_readable: minutesToReadable(
          result.rows[0].billable_hours,
        ),
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Ticket assignment error:", error);

    const status =
      error.message.includes("Cannot assign") ||
      error.message.includes("required") ||
      error.message.includes("not found") ||
      error.message.includes("already actively assigned") ||
      error.message.includes("Billable hours")
        ? 400
        : 500;

    res.status(status).json({ error: error.message });
  } finally {
    client.release();
  }
};

//------------------------------------------------------------------
// ✅ Update Employee Assignment Hours
// Used to modify billable hours on an existing active assignment
// Does NOT create new history record - updates the same record
// ✅ AUTO-RECALCULATES Draft/Submitted timesheet entries when hours change
//------------------------------------------------------------------
export const updateTicketAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { billableHours, assignEndDate } = req.body;

    console.log("📝 Update Assignment Request:", {
      assignmentId,
      billableHours,
      assignEndDate,
    });

    // ✅ Convert UI input → minutes
    const newBillableMinutes = toMinutes(billableHours);
    if (newBillableMinutes === null || newBillableMinutes <= 0) {
      return res.status(400).json({
        error: "Valid billable time required (greater than 0)",
      });
    }

    // Fetch assignment
    const checkQuery = await pool.query(
      `SELECT ta.*, t.billable_hours AS ticket_minutes
       FROM ticket_assignments ta
       JOIN ticket_master t ON ta.ticket_id = t.ticket_id
       WHERE ta.ticket_assignments_id = $1 AND ta.is_active = TRUE`,
      [assignmentId],
    );

    if (checkQuery.rows.length === 0) {
      return res.status(404).json({ error: "Active assignment not found" });
    }

    const assignment = checkQuery.rows[0];
    const oldBillableMinutes = Number(assignment.billable_hours || 0);
    const ticketLimitMinutes = Number(assignment.ticket_minutes || 0);

    // Budget check
    const othersHoursQuery = await pool.query(
      `SELECT 
        COALESCE(SUM(ta.billable_hours), 0) AS employee_minutes,
        COALESCE(SUM(tms.billable_hours), 0) AS manager_minutes
       FROM ticket_master t
       LEFT JOIN ticket_assignments ta 
         ON t.ticket_id = ta.ticket_id 
         AND ta.is_active = TRUE 
         AND ta.ticket_assignments_id != $1
       LEFT JOIN ticket_manager_scope tms 
         ON t.ticket_id = tms.ticket_id 
         AND tms.is_active = TRUE
       WHERE t.ticket_id = $2`,
      [assignmentId, assignment.ticket_id],
    );

    const employeeMinutes = Number(
      othersHoursQuery.rows[0].employee_minutes || 0,
    );
    const managerMinutes = Number(
      othersHoursQuery.rows[0].manager_minutes || 0,
    );

    const newTotalMinutes =
      employeeMinutes + managerMinutes + newBillableMinutes;

    if (newTotalMinutes > ticketLimitMinutes) {
      return res.status(400).json({
        error: "Cannot update. Ticket time limit exceeded",
        details: {
          requested: minutesToHHMM(newBillableMinutes),
          remaining: minutesToHHMM(
            Math.max(ticketLimitMinutes - employeeMinutes - managerMinutes, 0),
          ),
          ticketLimit: minutesToHHMM(ticketLimitMinutes),
        },
      });
    }

    // Update
    const updateQuery = assignEndDate
      ? `UPDATE ticket_assignments
         SET billable_hours = $1,
             assign_end_date = $2,
             updated_at = NOW()
         WHERE ticket_assignments_id = $3
         RETURNING *`
      : `UPDATE ticket_assignments
         SET billable_hours = $1,
             updated_at = NOW()
         WHERE ticket_assignments_id = $2
         RETURNING *`;

    const updateParams = assignEndDate
      ? [newBillableMinutes, assignEndDate, assignmentId]
      : [newBillableMinutes, assignmentId];

    const result = await pool.query(updateQuery, updateParams);

    // Auto recalculation
    let entriesRecalculated = 0;
    let recalculationError = false;

    if (oldBillableMinutes !== newBillableMinutes) {
      try {
        entriesRecalculated = await recalculateAssignmentEntries(
          assignmentId,
          "employee",
        );
      } catch (err) {
        recalculationError = true;
      }
    }

    res.json({
      message: "Assignment time updated successfully",
      assignment: {
        ...result.rows[0],
        billable_hours_hhmm: minutesToHHMM(result.rows[0].billable_hours),
        billable_hours_readable: minutesToReadable(
          result.rows[0].billable_hours,
        ),
        entriesRecalculated,
        recalculationError,
      },
    });
  } catch (error) {
    console.error("❌ Update assignment error:", error);
    res.status(500).json({
      error: "Failed to update assignment",
      details: error.message,
    });
  }
};

//------------------------------------------------------------------
// Remove/Unassign Employee from Ticket (Soft Delete)
// ✅ This handles EMPLOYEE assignments from ticket_assignments
//------------------------------------------------------------------
export const unassignEmployee = async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const result = await pool.query(
      `UPDATE ticket_assignments
       SET is_active = FALSE, 
           assign_end_date = CURRENT_DATE,
           updated_at = NOW()
       WHERE ticket_assignments_id = $1
       RETURNING *`,
      [assignmentId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    res.json({
      message: "Employee unassigned successfully",
      assignment: result.rows[0],
    });
  } catch (error) {
    console.error("Unassign error:", error);
    res.status(500).json({ error: "Failed to unassign employee" });
  }
};

//------------------------------------------------------------------
// ✅ Remove/Unassign Manager from Ticket Scope (Soft Delete)
// This handles MANAGER assignments from ticket_manager_scope
//------------------------------------------------------------------
export const removeManagerScope = async (req, res) => {
  try {
    const { scopeId } = req.params;

    const result = await pool.query(
      `UPDATE ticket_manager_scope
       SET is_active = FALSE, 
           assign_end_date = CURRENT_DATE,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [scopeId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Manager scope assignment not found",
      });
    }

    res.json({
      message: "Manager unassigned from ticket successfully",
      scope: result.rows[0],
    });
  } catch (error) {
    console.error("Remove manager scope error:", error);
    res.status(500).json({
      error: "Failed to remove manager scope",
      details: error.message,
    });
  }
};

export const updateManagerScopeHours = async (req, res) => {
  try {
    const { scopeId } = req.params;
    const { billableHours } = req.body;

    // ✅ Convert user input (HH:MM / decimal hours) → minutes
    const newBillableMinutes = toMinutes(billableHours);
    if (!newBillableMinutes || newBillableMinutes <= 0) {
      return res.status(400).json({
        error: "Valid billable hours required",
      });
    }

    // Fetch active scope + ticket budget (already in minutes)
    const scopeCheck = await pool.query(
      `SELECT 
         tms.*, 
         t.billable_hours AS ticket_minutes
       FROM ticket_manager_scope tms
       JOIN ticket_master t ON t.ticket_id = tms.ticket_id
       WHERE tms.id = $1 
         AND tms.is_active = TRUE`,
      [scopeId],
    );

    if (scopeCheck.rows.length === 0) {
      return res.status(404).json({
        error: "Active manager assignment not found",
      });
    }

    const scope = scopeCheck.rows[0];

    // Budget check (ALL values in minutes)
    const hoursCheck = await pool.query(
      `SELECT 
        COALESCE(SUM(ta.billable_hours), 0) AS employee_minutes,
        COALESCE(SUM(tms.billable_hours), 0) AS manager_minutes
       FROM ticket_master t
       LEFT JOIN ticket_assignments ta 
         ON t.ticket_id = ta.ticket_id AND ta.is_active = TRUE
       LEFT JOIN ticket_manager_scope tms 
         ON t.ticket_id = tms.ticket_id 
         AND tms.is_active = TRUE
         AND tms.id != $1
       WHERE t.ticket_id = $2`,
      [scopeId, scope.ticket_id],
    );

    const employeeMinutes = Number(
      hoursCheck.rows[0]?.employee_minutes || 0,
    );
    const managerMinutes = Number(
      hoursCheck.rows[0]?.manager_minutes || 0,
    );

    const newTotalMinutes =
      employeeMinutes + managerMinutes + Number(newBillableMinutes);

    const ticketLimitMinutes = Number(scope.ticket_minutes || 0);

    if (newTotalMinutes > ticketLimitMinutes) {
      return res.status(400).json({
        error: "Cannot update. Total hours would exceed ticket limit",
        details: {
          employeeHours: minutesToHHMM(employeeMinutes),
          managerHours: minutesToHHMM(managerMinutes),
          requestedHours: minutesToHHMM(newBillableMinutes),
          newTotal: minutesToHHMM(newTotalMinutes),
          ticketLimit: minutesToHHMM(ticketLimitMinutes),
          exceededBy: minutesToHHMM(newTotalMinutes - ticketLimitMinutes),
        },
      });
    }

    // Update scope (store minutes)
    const result = await pool.query(
      `UPDATE ticket_manager_scope
       SET billable_hours = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [newBillableMinutes, scopeId],
    );

    res.json({
      message: "Manager hours updated successfully",
      scope: {
        ...result.rows[0],
        billable_hours_hhmm: minutesToHHMM(result.rows[0].billable_hours),
        billable_hours_readable: minutesToReadable(
          result.rows[0].billable_hours,
        ),
      },
    });
  } catch (error) {
    console.error("Update manager scope error:", error);
    res.status(500).json({
      error: "Failed to update manager hours",
      details: error.message,
    });
  }
};

//------------------------------------------------------------------
// Export all functions
//------------------------------------------------------------------
export default {
  getAssigneesForProject,
  getAllAssigneesForAdmin,
  getAssignmentsByTicket,
  getManagerAssignmentsForTicket,
  assignTicketToEmployee,
  updateTicketAssignment,
  unassignEmployee,
  removeManagerScope,
  updateManagerScopeHours,
};

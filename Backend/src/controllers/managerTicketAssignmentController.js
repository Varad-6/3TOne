import pool from "../config/database.js";
import { recalculateAssignmentEntries } from "../utils/recalculationHelper.js";
import {
  toMinutes,
  minutesToReadable,
  minutesToHHMM,
} from "../utils/timeUtils.js";

// ===============================================
// ✅ FIXED: MANAGER: Get Projects & Tickets Available for Assignment
// Managers now see ONLY their assigned projects (via project_manager_assignment)
// NOT all projects where they have tickets
// ===============================================
export const getManagerProjectsWithTickets = async (req, res) => {
  try {
    const { managerId } = req.params;
    const requestingUserId = req.user?.id;
    const requestingUserRole = req.user?.role;

    // Manager can only see own projects, admin can see any
    if (requestingUserRole !== "ADMIN" && requestingUserId !== managerId) {
      return res.status(403).json({
        error: "Access denied",
        message: "You can only access your own assignments",
      });
    }

    // ✅ FIXED: Only get projects from project_manager_assignment
    // This ensures managers only see projects they're formally assigned to
    const result = await pool.query(
      `SELECT 
         p.project_id,
         p.project_name,
         p.zoho_crm_code,
         c.client_id,
         c.client_name,
         t.ticket_id,
         t.ticket_name,
         t.zoho_crm_code AS ticket_code,
         t.description,
         t.billable_hours,
         ts.name AS status,
         t.start_date,
         t.end_date
       FROM project_manager_assignment pma
       JOIN project_master p ON pma.project_id = p.project_id
       LEFT JOIN client_master c ON p.client_id = c.client_id
       LEFT JOIN ticket_master t 
         ON p.project_id = t.project_id 
        AND t.is_active = TRUE
       LEFT JOIN ticket_status ts ON ts.id = t.status
       WHERE pma.manager_id = $1
         AND p.is_active = TRUE
       ORDER BY p.project_name, t.ticket_name`,
      [managerId],
    );

    const projectMap = {};

    result.rows.forEach((row) => {
      const projectId = row.project_id;

      if (!projectMap[projectId]) {
        projectMap[projectId] = {
          project_id: projectId,
          project_name: row.project_name,
          zoho_crm_code: row.zoho_crm_code,
          client_id: row.client_id,
          client_name: row.client_name,
          tickets: [],
        };
      }

      if (row.ticket_id) {
        projectMap[projectId].tickets.push({
          ticket_id: row.ticket_id,
          ticket_name: row.ticket_name,
          ticket_code: row.ticket_code,
          description: row.description,
          billable_hours: minutesToHHMM(row.billable_hours),
          status: row.status,
          start_date: row.start_date,
          end_date: row.end_date,
        });
      }
    });

    const projects = Object.values(projectMap);

    res.status(200).json({
      projects,
      totalProjects: projects.length,
      totalTickets: result.rows.filter((r) => r.ticket_id).length,
    });
  } catch (error) {
    console.error("Get manager projects error:", error);
    res.status(500).json({
      error: "Failed to fetch manager projects",
      details: error.message,
    });
  }
};

// ===============================================
// ✅ FIXED: MANAGER: Assign Employees/Managers to Ticket
// Rule:
// - EMPLOYEE target  -> ticket_assignments
// - MANAGER target   -> ticket_manager_scope (can be any manager, not just self)
// ✅ UPDATED: Always INSERT new records, never UPDATE (maintains history)
// ✅ CROSS-MANAGER ASSIGNMENT NOW ENABLED
// ===============================================
export const assignEmployeesToTicket = async (req, res) => {
  try {
    const {
      ticketId,
      employeeIds,
      projectId,
      clientId,
      assignedBy,
      billableHours,
    } = req.body;

    console.log("📥 Assignment Request:", {
      ticketId,
      employeeIds,
      projectId,
      clientId,
      assignedBy,
      billableHours,
    });

    if (!ticketId || !Array.isArray(employeeIds) || !projectId || !assignedBy) {
      return res.status(400).json({
        error:
          "ticketId, employeeIds (array), projectId, and assignedBy are required",
      });
    }

    if (employeeIds.length === 0) {
      return res.status(400).json({
        error: "Please select at least one employee",
      });
    }

    // ✅ 1. Get ticket info + total budget
    const ticketCheck = await pool.query(
      `SELECT 
         t.ticket_id,
         t.ticket_name,
         t.billable_hours as total_budget,
         t.project_id,
         p.is_active as project_active
       FROM ticket_master t
       JOIN project_master p ON t.project_id = p.project_id
       WHERE t.ticket_id = $1 AND t.is_active = TRUE`,
      [ticketId],
    );

    if (ticketCheck.rows.length === 0) {
      return res.status(400).json({ error: "Ticket not found or inactive" });
    }

    const ticketData = ticketCheck.rows[0];
    const totalTicketBudget = Number(ticketData.total_budget || 0);

    if (!ticketData.project_active) {
      return res.status(400).json({
        error: "Cannot assign ticket because the parent Project is inactive.",
      });
    }

    // ✅ 2. Calculate CURRENT total hours (employees + managers)
    const totalHoursQuery = await pool.query(
      `SELECT
      COALESCE((
        SELECT SUM(billable_hours)
        FROM ticket_assignments
        WHERE ticket_id = $1 AND is_active = TRUE
      ), 0) AS employee_hours,

      COALESCE((
        SELECT SUM(billable_hours)
        FROM ticket_manager_scope
        WHERE ticket_id = $1 AND is_active = TRUE
      ), 0) AS manager_hours
  `,
      [ticketId],
    );

    const employeeHours = Number(totalHoursQuery.rows[0]?.employee_hours || 0);
    const managerHours = Number(totalHoursQuery.rows[0]?.manager_hours || 0);
    const currentlyUsedHours = employeeHours + managerHours;
    const remainingMinutes = Number(totalTicketBudget) - currentlyUsedHours;

    console.log("💰 Budget Check:", {
      totalBudget: totalTicketBudget,
      employeeHours,
      managerHours,
      currentlyUsedHours,
      remainingMinutes,
    });

    // ✅ 3. Verify manager is assigned to this project
    const managerAuthCheck = await pool.query(
      `SELECT 1
       FROM project_manager_assignment pa
       JOIN ticket_master t ON t.project_id = pa.project_id
       WHERE pa.project_id = $1
         AND t.ticket_id = $2
         AND pa.manager_id = $3
         AND t.is_active = TRUE`,
      [projectId, ticketId, assignedBy],
    );

    console.log("🔐 Manager Auth Check:", {
      projectId,
      assignedBy,
      authorized: managerAuthCheck.rows.length > 0,
    });

    if (managerAuthCheck.rows.length === 0) {
      return res.status(403).json({
        error:
          "You are not authorized to assign this ticket. You are not assigned to this project.",
      });
    }

    const assignments = [];
    const failures = [];

    for (const targetUserId of employeeIds) {
      try {
        console.log(`👤 Processing user: ${targetUserId}`);

        // Validate billable hours
        const minutesToAssign = billableHours;

        if (!minutesToAssign || minutesToAssign <= 0) {
          failures.push({
            employeeId: targetUserId,
            reason: "Billable time must be greater than 0",
          });
          continue;
        }

        // ✅ 3. CHECK BUDGET BEFORE ASSIGNMENT
        if (minutesToAssign > remainingMinutes) {
          failures.push({
            employeeId: targetUserId,
            reason:
              `Cannot assign ${minutesToHHMM(minutesToAssign)}. ` +
              `Ticket budget: ${minutesToHHMM(totalTicketBudget)}, ` +
              `Already assigned: ${minutesToHHMM(currentlyUsedHours)} ` +
              `(${minutesToHHMM(employeeHours)} employee + ${minutesToHHMM(managerHours)} manager). ` +
              `${remainingMinutes >= 0 ? "Remaining: " + minutesToHHMM(remainingMinutes) : "Budget exceeded by: " + minutesToHHMM(Math.abs(remainingMinutes))}.`,
          });
          continue;
        }

        // ✅ 4. Resolve user role
        const roleResult = await pool.query(
          `SELECT
             e.employee_id,
             ur.name AS role,
             e.first_name || ' ' || e.last_name AS name
           FROM employees e
           JOIN user_roles ur ON ur.id = e.role
           WHERE e.employee_id = $1 AND e.is_active = TRUE`,
          [targetUserId],
        );
        console.log(` User check result:`, roleResult.rows);

        if (roleResult.rows.length === 0) {
          console.log(` ❌ User not found or inactive`);
          failures.push({
            employeeId: targetUserId,
            reason: "User not found or is inactive",
          });
          continue;
        }

        const targetRole = roleResult.rows[0].role;
        console.log(` 🎯 Target role: ${targetRole}`);

        // ===============================================
        // CASE A: Target is MANAGER
        // ✅ FIXED: Removed project assignment check
        // Now ANY manager can be assigned to a ticket
        // ===============================================
        if (targetRole === "MANAGER") {
          console.log(` 👔 Manager detected - can assign any manager`);

          const existingScope = await pool.query(
            `SELECT id
             FROM ticket_manager_scope
            WHERE ticket_id = $1 AND manager_id = $2 AND is_active = TRUE`,
            [ticketId, targetUserId],
          );

          if (existingScope.rows.length > 0) {
            console.log(` ❌ Manager already has active assignment`);
            failures.push({
              employeeId: targetUserId,
              reason: "Manager is already actively assigned to this ticket.",
            });
            continue;
          }

          await pool.query(
            `INSERT INTO ticket_manager_scope
            (ticket_id, manager_id, project_id, client_id, assigned_by, assign_start_date, billable_hours, is_active)
             VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, TRUE)`,
            [
              ticketId,
              targetUserId,
              projectId,
              clientId,
              assignedBy,
              minutesToAssign,
            ],
          );

          console.log(` ✅ Manager assigned to ticket scope`);
          assignments.push({
            employee_id: targetUserId,
            role: "MANAGER",
            status: "Assigned to scope",
          });
          continue;
        }

        // ===============================================
        // CASE B: Target is EMPLOYEE
        // ===============================================
        console.log(` 👨‍💼 Employee detected - assigning to ticket`);

        const existing = await pool.query(
          `SELECT ticket_assignments_id
           FROM ticket_assignments
           WHERE ticket_id = $1 AND employee_id = $2 AND is_active = TRUE`,
          [ticketId, targetUserId],
        );

        if (existing.rows.length > 0) {
          console.log(` ❌ Employee already has active assignment`);
          failures.push({
            employeeId: targetUserId,
            reason: "Employee is already actively assigned to this ticket.",
          });
          continue;
        }

        console.log(` ➕ Creating new assignment`);
        const result = await pool.query(
          `INSERT INTO ticket_assignments
             (ticket_id, employee_id, project_id, client_id, assigned_by, assign_start_date, billable_hours, is_active)
           VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, TRUE)
           RETURNING *`,
          [
            ticketId,
            targetUserId,
            projectId,
            clientId,
            assignedBy,
            minutesToAssign,
          ],
        );

        if (result.rows.length > 0) {
          console.log(` ✅ Assignment successful`);
          assignments.push(result.rows[0]);
        } else {
          console.log(` ❌ Database operation returned no rows`);
          failures.push({
            employeeId: targetUserId,
            reason: "Database operation failed",
          });
        }
      } catch (err) {
        console.error(` ❌ Error processing user ${targetUserId}:`, err);
        failures.push({
          employeeId: targetUserId,
          reason: err.message,
        });
      }
    }

    console.log("📊 Final Results:", {
      successCount: assignments.length,
      failureCount: failures.length,
      failures,
    });

    if (assignments.length === 0) {
      return res.status(400).json({
        error: "Budget exceeded. Failed to assign ticket.",
        failures,
      });
    }

    res.status(200).json({
      message: `Successfully assigned ${assignments.length} user(s), ${failures.length} failed`,
      assignments,
      failures,
    });
  } catch (error) {
    console.error("Assignment error:", error);
    res.status(500).json({
      error: "Failed to assign employees",
      details: error.message,
    });
  }
};

// ===============================================
// ✅ UPDATED: MANAGER: Get Employees for Assignment
// NOW INCLUDES: All Employees + ALL Managers (not just self)
// ===============================================
export const getManagerEmployees = async (req, res) => {
  try {
    const { managerId } = req.params;
    const requestingUserId = req.user?.id;
    const requestingUserRole = req.user?.role;

    if (requestingUserRole !== "ADMIN" && requestingUserId !== managerId) {
      return res.status(403).json({
        error: "Access denied",
        message: "You can only access your own employee list",
      });
    }

    // ✅ UPDATED: Include ALL employees AND ALL managers
    const result = await pool.query(
      `SELECT
        e.employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.first_name || ' ' || e.last_name AS employee_name,
        e.email,
        d.name AS department,
        e.designation,
        ur.name AS role
      FROM employees e
      JOIN user_roles ur ON ur.id = e.role
      LEFT JOIN departments d ON d.id = e.department
      WHERE e.is_active = TRUE
      AND ur.name IN ('EMPLOYEE', 'MANAGER')
      ORDER BY 
        CASE WHEN ur.name = 'MANAGER' THEN 0 ELSE 1 END,
        e.first_name, 
        e.last_name`,
    );

    res.status(200).json({
      employees: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Get employees error:", error);
    res.status(500).json({
      error: "Failed to fetch employees",
      details: error.message,
    });
  }
};

// ===============================================
// MANAGER: Get Ticket Assignments (employees only)
// Returns EMPLOYEE assignments from ticket_assignments table
// ✅ INCLUDES: used_hours calculation
// ===============================================
export const getTicketAssignments = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const query = `
      SELECT 
        ta.ticket_assignments_id AS id,
        ta.employee_id,
        e.employee_code,
        e.first_name || ' ' || e.last_name AS employee_name,
        e.email,
        d.name AS department,
        ta.assign_start_date AS assign_date,
        ta.billable_hours AS total_allocated_hours,
        ta.is_active,
        -- ✅ Add used hours calculation
        COALESCE((
          SELECT SUM(dte.total_hours)
          FROM daily_timesheet_entries dte
          WHERE dte.ticket_assign_id = ta.ticket_assignments_id
        ), 0) AS used_hours
      FROM ticket_assignments ta
      JOIN employees e ON ta.employee_id = e.employee_id
      LEFT JOIN departments d ON d.id = e.department
      WHERE ta.ticket_id = $1
      ORDER BY ta.assign_start_date DESC
    `;

    const result = await pool.query(query, [ticketId]);

    // ✅ Format the response - return BOTH raw minutes and formatted HH:MM
    const assignments = result.rows.map((assign) => ({
      ...assign,
      billable_hours: minutesToHHMM(assign.total_allocated_hours), // Raw minutes for frontend state
      total_allocated_hours_display: minutesToHHMM(
        assign.total_allocated_hours,
      ),
      used_hours_display: minutesToHHMM(assign.used_hours),
      assignment_id: assign.id, // Include ID for updates
    }));

    res.json({
      assignments,
      count: assignments.length,
    });
  } catch (error) {
    console.error("Get ticket assignments error:", error);
    res.status(500).json({
      error: "Failed to fetch ticket assignments",
      details: error.message,
    });
  }
};

// ===============================================
// MANAGER: Remove Assignment (soft delete)
// ===============================================
export const removeTicketAssignment = async (req, res) => {
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
      return res.status(404).json({
        error: "Assignment not found",
      });
    }

    res.json({
      message: "Assignment removed successfully",
      assignment: result.rows[0],
    });
  } catch (error) {
    console.error("Remove assignment error:", error);
    res.status(500).json({
      error: "Failed to remove assignment",
      details: error.message,
    });
  }
};

// ===============================================
// ✅ Get Manager Assignments for a Ticket
// Returns managers assigned to this ticket via ticket_manager_scope
// ===============================================
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

    // ✅ Format the response - return BOTH raw minutes and formatted HH:MM
    const managers = result.rows.map((mgr) => ({
      ...mgr,
      billable_hours: mgr.billable_hours, // Keep raw minutes
      billable_hours_display: minutesToHHMM(mgr.billable_hours),
      used_hours: mgr.used_hours,
      used_hours_display: minutesToHHMM(mgr.used_hours),
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

// ===============================================
// Remove Manager from Ticket Scope (Soft Delete)
// Removes manager assignment from ticket_manager_scope
// Used by Manager to unassign themselves
// ===============================================
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

// ===============================================
// ✅ UPDATED: Update Manager Scope Hours
// Updates billable hours on an existing active manager scope assignment
// Used when manager wants to adjust hours without creating new history record
// ✅ AUTO-RECALCULATES Draft/Submitted timesheet entries when hours change
// ===============================================
export const updateManagerScope = async (req, res) => {
  try {
    const { scopeId } = req.params;
    const { billableHours, assignEndDate } = req.body;
    const requestingUserId = req.user?.id;
    const requestingUserRole = req.user?.role;

    console.log("📝 Update Manager Scope Request:", {
      scopeId,
      billableHours,
      assignEndDate,
      requestingUserId,
      requestingUserRole,
    });

    const newBillableMinutes = Number(billableHours);
    // Validation
    if (!newBillableMinutes || newBillableMinutes <= 0) {
      return res.status(400).json({
        error: "Valid billable minutes required (greater than 0)",
      });
    }

    // Check if scope exists and is active
    const checkQuery = await pool.query(
      `SELECT tms.*, t.billable_hours as ticket_hours
       FROM ticket_manager_scope tms
       JOIN ticket_master t ON tms.ticket_id = t.ticket_id
       WHERE tms.id = $1 AND tms.is_active = TRUE`,
      [scopeId],
    );

    if (checkQuery.rows.length === 0) {
      return res.status(404).json({
        error: "Active manager scope assignment not found",
      });
    }

    const scope = checkQuery.rows[0];
    const oldBillableMinutes = Number(scope.billable_hours);

    // // Authorization check
    // if (requestingUserRole === "MANAGER") {
    //   // Manager can only update their own scope
    //   if (scope.manager_id !== requestingUserId) {
    //     return res.status(403).json({
    //       error: "You can only update your own assignments",
    //     });
    //   }
    // }
    // Admin can update any scope (no additional check needed)

    // Validate total hours don't exceed ticket budget
    const othersHoursQuery = await pool.query(
      `SELECT 
  (
    SELECT COALESCE(SUM(ta.billable_hours), 0)
    FROM ticket_assignments ta
    WHERE ta.ticket_id = $2
      AND ta.is_active = TRUE
  ) AS employee_hours,

  (
    SELECT COALESCE(SUM(tms.billable_hours), 0)
    FROM ticket_manager_scope tms
    WHERE tms.ticket_id = $2
      AND tms.is_active = TRUE
      AND tms.id != $1
  ) AS manager_hours`,
      [scopeId, scope.ticket_id],
    );

    const employeeHours = Number(othersHoursQuery.rows[0]?.employee_hours || 0);
    const otherManagerHours = Number(
      othersHoursQuery.rows[0]?.manager_hours || 0,
    );
    const newTotal =
      employeeHours + otherManagerHours + Number(newBillableMinutes);
    const ticketLimit = Number(scope.ticket_hours || 0);

    console.log("💰 Budget Check:", {
      employeeHours,
      otherManagerHours,
      newManagerHours: newBillableMinutes,
      newTotal,
      ticketLimit,
    });

    if (newTotal > ticketLimit) {
      return res.status(400).json({
        error: `Cannot update. Total hours (${minutesToHHMM(
          newTotal.toFixed(1),
        )}) would exceed ticket limit (${minutesToHHMM(ticketLimit.toFixed(1))})`,
        details: {
          employeeHours,
          otherManagerHours,
          requestedHours: newBillableMinutes,
          ticketLimit,
        },
      });
    }

    // Update the manager scope
    const updateQuery = assignEndDate
      ? `UPDATE ticket_manager_scope
         SET billable_hours = $1,
             assign_end_date = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`
      : `UPDATE ticket_manager_scope
         SET billable_hours = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`;

    const updateParams = assignEndDate
      ? [newBillableMinutes, assignEndDate, scopeId]
      : [newBillableMinutes, scopeId];

    const result = await pool.query(updateQuery, updateParams);

    console.log("✅ Manager scope updated successfully");

    // ✅ AUTO-RECALCULATION: Check if billable_hours changed
    let entriesRecalculated = 0;
    let recalculationError = false;

    if (oldBillableMinutes !== newBillableMinutes) {
      console.log(
        `📊 Manager billable minutes changed from ${oldBillableMinutes} to ${newBillableMinutes} - triggering recalculation`,
      );

      try {
        entriesRecalculated = await recalculateAssignmentEntries(
          scopeId,
          "manager",
        );
        console.log(
          `✅ Auto-recalculated ${entriesRecalculated} Draft/Submitted entries`,
        );
      } catch (recalcError) {
        console.error("⚠️ Auto-recalculation failed:", recalcError);
        recalculationError = true;
        // Don't fail the main update, just log the error
      }
    }

    res.json({
      message: "Manager assignment hours updated successfully",
      scope: {
        ...result.rows[0],
        entriesRecalculated,
        recalculationError,
      },
    });
  } catch (error) {
    console.error("❌ Update manager scope error:", error);
    res.status(500).json({
      error: "Failed to update manager scope",
      details: error.message,
    });
  }
};

// ===============================================
//updateEmployeeAssignmentByManager
// Updates billable hours on an existing active employee assignment
// ✅ AUTO-RECALCULATES Draft/Submitted timesheet entries when hours change
// ===============================================
export const updateEmployeeAssignmentByManager = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { billableHours } = req.body;

    const managerId = req.user?.id;

    if (!managerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Convert to minutes
    const newBillableMinutes = billableHours;

    if (!newBillableMinutes || newBillableMinutes <= 0) {
      return res.status(400).json({
        error: "Valid billable time required",
      });
    }

    // 1️⃣ Get assignment + project
    const assignmentCheck = await pool.query(
      `
      SELECT 
        ta.*,
        t.billable_hours AS ticket_minutes,
        t.project_id
      FROM ticket_assignments ta
      JOIN ticket_master t ON ta.ticket_id = t.ticket_id
      WHERE ta.ticket_assignments_id = $1
        AND ta.is_active = TRUE
      `,
      [assignmentId],
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({
        error: "Active assignment not found",
      });
    }

    const assignment = assignmentCheck.rows[0];

    // 2️⃣ Verify manager is assigned to project
    const authCheck = await pool.query(
      `
      SELECT 1
      FROM project_manager_assignment
      WHERE project_id = $1
        AND manager_id = $2
      `,
      [assignment.project_id, managerId],
    );

    if (authCheck.rows.length === 0) {
      return res.status(403).json({
        error: "You are not authorized to update this assignment",
      });
    }

    // 3️⃣ Budget check
    const hoursCheck = await pool.query(
      `
  SELECT
    (
      SELECT COALESCE(SUM(billable_hours), 0)
      FROM ticket_assignments
      WHERE ticket_id = $2
        AND is_active = TRUE
        AND ticket_assignments_id != $1
    ) AS employee_minutes,

    (
      SELECT COALESCE(SUM(billable_hours), 0)
      FROM ticket_manager_scope
      WHERE ticket_id = $2
        AND is_active = TRUE
    ) AS manager_minutes
  `,
      [assignmentId, assignment.ticket_id],
    );

    const employeeMinutes = Number(hoursCheck.rows[0]?.employee_minutes || 0);
    const managerMinutes = Number(hoursCheck.rows[0]?.manager_minutes || 0);

    const newTotal =
      employeeMinutes + managerMinutes + Number(newBillableMinutes);

    const ticketLimit = Number(assignment.ticket_minutes || 0);

    if (newTotal > ticketLimit) {
      return res.status(400).json({
        error: "Ticket budget exceeded",
        details: {
          requested: minutesToHHMM(newBillableMinutes),
          remaining: minutesToHHMM(
            ticketLimit - employeeMinutes - managerMinutes,
          ),
        },
      });
    }

    // 4️⃣ Update
    const result = await pool.query(
      `
      UPDATE ticket_assignments
      SET billable_hours = $1,
          updated_at = NOW()
      WHERE ticket_assignments_id = $2
      RETURNING *
      `,
      [newBillableMinutes, assignmentId],
    );

    // 5️⃣ Recalculate timesheets
    let recalculated = 0;

    try {
      recalculated = await recalculateAssignmentEntries(
        assignmentId,
        "employee",
      );
    } catch (err) {
      console.error("Recalc failed:", err);
    }

    res.json({
      message: "Employee assignment updated successfully",
      assignment: {
        ...result.rows[0],
        billable_hours_hhmm: minutesToHHMM(result.rows[0].billable_hours),
        entriesRecalculated: recalculated,
      },
    });
  } catch (error) {
    console.error("Manager update assignment error:", error);

    res.status(500).json({
      error: "Failed to update assignment",
      details: error.message,
    });
  }
};

// ===============================================
// Export all functions
// ===============================================
export default {
  getManagerProjectsWithTickets,
  assignEmployeesToTicket,
  getManagerEmployees,
  getTicketAssignments,
  removeTicketAssignment,
  getManagerAssignmentsForTicket,
  removeManagerScope,
  updateManagerScope,
  updateEmployeeAssignmentByManager,
};

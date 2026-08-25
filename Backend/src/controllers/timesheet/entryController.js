import pool from "../../config/database.js";
import {
  minutesToHHMM,
  toMinutes,
  formatEntryTimes,
} from "../../utils/timeUtils.js";
// Frontend already converts HH.MM to decimal hours, so we just use Number()
import {
  recalculateAssignmentEntries as recalculateHelper,
  recalculateTicketEntries as recalculateTicketHelper,
  getAffectedEntriesSummary,
} from "../../utils/recalculationHelper.js";
import { triggerTimesheetSubmitted } from "../emailController.js";

// ====================================
// Helpers for timesheet_status lookup
// ====================================

// Single status name -> id
async function getTimesheetStatusId(statusName) {
  const result = await pool.query(
    "SELECT id FROM timesheet_status WHERE name = $1",
    [statusName],
  );
  if (result.rows.length === 0) {
    throw new Error(`Timesheet status "${statusName}" not found`);
  }
  return result.rows[0].id;
}

// Multiple status names -> [ids]
async function getTimesheetStatusIds(statusNames) {
  if (!statusNames || statusNames.length === 0) return [];
  const result = await pool.query(
    "SELECT id, name FROM timesheet_status WHERE name = ANY($1)",
    [statusNames],
  );
  const map = new Map(result.rows.map((r) => [r.name, r.id]));
  return statusNames.map((name) => {
    const id = map.get(name);
    if (id === undefined) {
      throw new Error(`Timesheet status "${name}" not found`);
    }
    return id;
  });
}

// ===============================
// CREATE Entry (With Manager Support)
// ===============================
export const createEntry = async (req, res) => {
  try {
    const employeeId = req.user?.id;
    const userRole = req.user?.role;

    if (!employeeId) {
      return res
        .status(401)
        .json({ error: "Auth failed. Please log in again." });
    }

    const {
      projectId,
      ticketId,
      entryDate,
      ticketNumber,
      hoursLogged,
      description,
      billable = true,
      taskId,
    } = req.body;

    // ✅ FIXED: Convert to minutes (supports HH:MM, decimal, or minutes)
    const minutesToAdd = Number(hoursLogged);

    if (!minutesToAdd || minutesToAdd <= 0 || isNaN(minutesToAdd)) {
      return res.status(400).json({ error: "Invalid time value" });
    }

    // ===================================================
    // VALIDATE: Block Future Date Entries
    // ===================================================
    const entryDateObj = new Date(entryDate);

    // ===================================================
    // 🚫 Block entry if week already submitted
    // ===================================================

    const weekCheck = await pool.query(
      `SELECT 1
   FROM daily_timesheet_entries d
   JOIN timesheet_status ts ON ts.id = d.status
   WHERE d.employee_id = $1
     AND d.week_start_date = DATE_TRUNC('week', $2::date)
     AND ts.name = 'Submitted'
   LIMIT 1`,
      [employeeId, entryDate],
    );

    if (weekCheck.rows.length > 0) {
      return res.status(400).json({
        error:
          "Timesheet already submitted for this week. Cannot add entries unless rejected.",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    entryDateObj.setHours(0, 0, 0, 0);

    if (entryDateObj.getTime() > today.getTime()) {
      return res.status(400).json({
        error: "Future date entries are not allowed",
      });
    }

    // 1. Basic Validation
    if (
      !projectId ||
      !ticketId ||
      !entryDate ||
      !minutesToAdd ||
      !taskId ||
      !description
    ) {
      return res.status(400).json({
        error:
          "Project, ticket, task, date, hours, and description are required",
      });
    }

    // 2. Validate Ticket Number vs Zoho Code in DB
    const ticketCheck = await pool.query(
      `SELECT zoho_crm_code FROM ticket_master WHERE ticket_id = $1`,
      [ticketId],
    );

    if (ticketCheck.rows.length === 0) {
      return res.status(404).json({ error: "Selected ticket does not exist" });
    }

    const requiredCode = ticketCheck.rows[0].zoho_crm_code;
    if (
      ticketNumber &&
      requiredCode &&
      ticketNumber.trim().toUpperCase() !== requiredCode.trim().toUpperCase()
    ) {
      return res.status(400).json({
        error: `Invalid Ticket Number. Expected: ${requiredCode}`,
      });
    }

    // ✅ FIXED: Use minutes-based limits
    const MAX_ENTRY_MINUTES = 24 * 60; // 1440 minutes = 24 hours
    const MAX_DAILY_MINUTES = 24 * 60; // 1440 minutes = 24 hours

    if (minutesToAdd > MAX_ENTRY_MINUTES) {
      return res.status(400).json({
        error: `Maximum ${minutesToHHMM(MAX_ENTRY_MINUTES)} allowed per entry`,
      });
    }

    // ===================================================
    // ✅ 3. ROLE-BASED ASSIGNMENT FETCHING
    // ===================================================
    let assignmentId = null;
    let assignmentType = null; // 'employee' or 'manager'
    let maxBillableMinutes = 0;
    let managerId = null;
    let clientId = null;

    // Fetch Project/Client Info
    const projectData = await pool.query(
      `SELECT client_id FROM project_master WHERE project_id = $1`,
      [projectId],
    );
    clientId = projectData.rows[0]?.client_id || null;

    if (userRole === "MANAGER") {
      // --- MANAGER: Fetch from ticket_manager_scope ---
      const managerScopeData = await pool.query(
        `SELECT id, billable_hours, assigned_by, manager_id
         FROM ticket_manager_scope
         WHERE manager_id = $1
           AND ticket_id = $2
           AND project_id = $3
           AND is_active = TRUE
         LIMIT 1`,
        [employeeId, ticketId, projectId],
      );

      if (managerScopeData.rows.length === 0) {
        return res.status(403).json({
          error: "You are not assigned to this ticket as a manager.",
        });
      }

      assignmentId = managerScopeData.rows[0].id;
      assignmentType = "manager";
      maxBillableMinutes = Number(managerScopeData.rows[0].billable_hours || 0);

      // ✅ FIXED: Determine manager_id based on who assigned the ticket
      const assignedBy = managerScopeData.rows[0].assigned_by;

      if (assignedBy) {
        // Check if assigner is a MANAGER (cross-manager assignment)
        const assignerRoleCheck = await pool.query(
          `SELECT ur.name as role_name
           FROM employees e
           JOIN user_roles ur ON ur.id = e.role
           WHERE e.employee_id = $1`,
          [assignedBy],
        );

        const assignerRole = assignerRoleCheck.rows[0]?.role_name;

        if (assignerRole === "MANAGER") {
          // Cross-manager assignment
          managerId = assignedBy;
          console.log(`🔄 Cross-manager assignment detected:`, {
            assignee: employeeId,
            assigner: assignedBy,
            manager_id: managerId,
          });
        } else if (assignerRole === "ADMIN") {
          // Admin assigned ticket to Manager
          managerId = assignedBy;
          console.log(`✅ Admin assigned ticket to Manager:`, {
            assignee: employeeId,
            admin: assignedBy,
            manager_id: managerId,
          });
        } else {
          // Unknown role - set to NULL (Admin will approve)
          managerId = null;
          console.log(`⚠️ Unknown assigner role - Admin will approve`);
        }
      } else {
        // No assigned_by (self-assignment) - set to NULL
        managerId = null;
        console.log(`✅ Self-assignment - Admin will approve`);
      }

      console.log(
        `✅ Manager assignment found: ticket_manager_scope.id = ${assignmentId}, billable_hours = ${maxBillableMinutes}m, manager_id = ${managerId}`,
      );
    } else if (userRole === "ADMIN") {
      // --- ADMIN: Can log time without assignment ---
      assignmentType = "admin";
    } else {
      // --- EMPLOYEE: Fetch from ticket_assignments ---
      const assignData = await pool.query(
        `SELECT ticket_assignments_id, billable_hours
         FROM ticket_assignments
         WHERE employee_id = $1
           AND ticket_id = $2
           AND project_id = $3
           AND is_active = TRUE
         LIMIT 1`,
        [employeeId, ticketId, projectId],
      );

      if (assignData.rows.length === 0) {
        return res.status(403).json({
          error: "You are not assigned to this ticket.",
        });
      }

      assignmentId = assignData.rows[0].ticket_assignments_id;
      assignmentType = "employee";
      maxBillableMinutes = Number(assignData.rows[0].billable_hours || 0);

      // Employee's manager from project
      const managerData = await pool.query(
        `SELECT assigned_by
         FROM ticket_assignments
         WHERE ticket_assignments_id = $1
         LIMIT 1`,
        [assignmentId],
      );
      managerId = managerData.rows[0]?.assigned_by || null;

      // If assigned_by is NULL, fallback to project manager
      if (!managerId) {
        const projectManagerData = await pool.query(
          `SELECT manager_id
           FROM project_manager_assignment
           WHERE project_id = $1
           LIMIT 1`,
          [projectId],
        );
        managerId = projectManagerData.rows[0]?.manager_id || null;
      }

      console.log(
        `✅ Employee assignment found: ticket_assignments_id = ${assignmentId}, billable_hours = ${maxBillableMinutes}m`,
      );
    }

    // ===================================================
    // ✅ 4. CHECK FOR EXISTING ENTRY (MERGE LOGIC)
    // ===================================================
    let existingEntryQuery;
    let existingEntryParams;

    if (assignmentType === "manager") {
      existingEntryQuery = `
        SELECT * FROM daily_timesheet_entries
        WHERE employee_id = $1
          AND entry_date = $2
          AND project_id = $3
          AND ticket_id = $4
          AND task_id = $5
          AND ticket_manager_assign_id = $6
      `;
      existingEntryParams = [
        employeeId,
        entryDate,
        projectId,
        ticketId,
        taskId,
        assignmentId,
      ];
    } else if (assignmentType === "employee") {
      existingEntryQuery = `
        SELECT * FROM daily_timesheet_entries
        WHERE employee_id = $1
          AND entry_date = $2
          AND project_id = $3
          AND ticket_id = $4
          AND task_id = $5
          AND ticket_assign_id = $6
      `;
      existingEntryParams = [
        employeeId,
        entryDate,
        projectId,
        ticketId,
        taskId,
        assignmentId,
      ];
    } else {
      // Admin or no assignment
      existingEntryQuery = `
        SELECT * FROM daily_timesheet_entries
        WHERE employee_id = $1
          AND entry_date = $2
          AND project_id = $3
          AND ticket_id = $4
          AND task_id = $5
      `;
      existingEntryParams = [
        employeeId,
        entryDate,
        projectId,
        ticketId,
        taskId,
      ];
    }

    const existingEntryCheck = await pool.query(
      existingEntryQuery,
      existingEntryParams,
    );

    // ✅ FIXED: Calculate daily total in minutes
    let dailySumQuery;
    let dailySumParams;

    if (existingEntryCheck.rows.length > 0) {
      const existingEntryId = existingEntryCheck.rows[0].entry_id;
      dailySumQuery = `
        SELECT COALESCE(SUM(total_hours), 0) as logged_minutes
        FROM daily_timesheet_entries
        WHERE employee_id = $1 AND entry_date = $2 AND entry_id != $3
      `;
      dailySumParams = [employeeId, entryDate, existingEntryId];
    } else {
      dailySumQuery = `
        SELECT COALESCE(SUM(total_hours), 0) as logged_minutes
        FROM daily_timesheet_entries
        WHERE employee_id = $1 AND entry_date = $2
      `;
      dailySumParams = [employeeId, entryDate];
    }

    const dailySumCheck = await pool.query(dailySumQuery, dailySumParams);
    const existingDailyMinutes = Number(
      dailySumCheck.rows[0].logged_minutes || 0,
    );

    if (existingDailyMinutes + minutesToAdd > MAX_DAILY_MINUTES) {
      return res.status(400).json({
        error: `Daily limit exceeded. You have ${minutesToHHMM(existingDailyMinutes)} logged today. Maximum ${minutesToHHMM(MAX_DAILY_MINUTES)} allowed per day.`,
      });
    }

    // ===================================================
    // ✅ 5. CALCULATE BILLABLE HOURS (IN MINUTES)
    // ===================================================
    let finalBillable = 0;
    let finalNonBillable = 0;

    if (billable && assignmentId) {
      const usedQuery =
        assignmentType === "manager"
          ? `SELECT COALESCE(SUM(d.billable_hours), 0) as used
             FROM daily_timesheet_entries d
             JOIN timesheet_status ts ON ts.id = d.status
             WHERE d.ticket_manager_assign_id = $1
               AND ts.name IN ('Draft', 'Submitted', 'Manager_Approved', 'Admin_Approved', 'Partially_Approved')`
          : `SELECT COALESCE(SUM(d.billable_hours), 0) as used
             FROM daily_timesheet_entries d
             JOIN timesheet_status ts ON ts.id = d.status
             WHERE d.ticket_assign_id = $1
               AND ts.name IN ('Draft', 'Submitted', 'Manager_Approved', 'Admin_Approved', 'Partially_Approved')`;

      const usedData = await pool.query(usedQuery, [assignmentId]);
      const usedBillableMinutes = Number(usedData.rows[0].used || 0);
      const remainingMinutes = Math.max(
        0,
        maxBillableMinutes - usedBillableMinutes,
      );

      console.log(`📊 Billable calculation (CREATE):`, {
        maxBillableMinutes: `${maxBillableMinutes}m (${minutesToHHMM(maxBillableMinutes)})`,
        usedBillableMinutes: `${usedBillableMinutes}m (${minutesToHHMM(usedBillableMinutes)})`,
        remainingMinutes: `${remainingMinutes}m (${minutesToHHMM(remainingMinutes)})`,
        minutesToAdd: `${minutesToAdd}m (${minutesToHHMM(minutesToAdd)})`,
      });

      if (remainingMinutes >= minutesToAdd) {
        finalBillable = minutesToAdd;
      } else {
        finalBillable = remainingMinutes;
        finalNonBillable = minutesToAdd - remainingMinutes;
      }

      console.log(
        `✅ Billable split: ${finalBillable}m (${minutesToHHMM(finalBillable)}) billable, ${finalNonBillable}m (${minutesToHHMM(finalNonBillable)}) non-billable`,
      );
    } else if (billable) {
      finalBillable = minutesToAdd;
    } else {
      finalNonBillable = minutesToAdd;
    }

    // ===================================================
    // ✅ 6. IF EXISTING ENTRY: UPDATE IT (MERGE)
    // ===================================================
    if (existingEntryCheck.rows.length > 0) {
      const existing = existingEntryCheck.rows[0];
      console.log("🔄 Existing entry found, merging...");

      // ✅ FIXED: All in minutes (integers)
      const newTotalMinutes = Number(existing.total_hours) + minutesToAdd;

      // Merge descriptions
      let newDescription = existing.description || "";
      if (description && !newDescription.includes(description)) {
        newDescription = newDescription
          ? `${newDescription} | ${description}`
          : description;
      }

      // ✅ Recalculate billable for merged entry
      let mergedBillable = 0;
      let mergedNonBillable = 0;

      if (billable && assignmentId) {
        const usedQuery =
          assignmentType === "manager"
            ? `SELECT COALESCE(SUM(d.billable_hours), 0) as used
               FROM daily_timesheet_entries d
               JOIN timesheet_status ts ON ts.id = d.status
               WHERE d.ticket_manager_assign_id = $1
                 AND d.entry_id != $2
                 AND ts.name IN ('Draft', 'Submitted', 'Manager_Approved', 'Admin_Approved', 'Partially_Approved')`
            : `SELECT COALESCE(SUM(d.billable_hours), 0) as used
               FROM daily_timesheet_entries d
               JOIN timesheet_status ts ON ts.id = d.status
               WHERE d.ticket_assign_id = $1
                 AND d.entry_id != $2
                 AND ts.name IN ('Draft', 'Submitted', 'Manager_Approved', 'Admin_Approved', 'Partially_Approved')`;

        const usedData = await pool.query(usedQuery, [
          assignmentId,
          existing.entry_id,
        ]);
        const usedBillableMinutes = Number(usedData.rows[0].used || 0);
        const remainingMinutes = Math.max(
          0,
          maxBillableMinutes - usedBillableMinutes,
        );

        if (remainingMinutes >= newTotalMinutes) {
          mergedBillable = newTotalMinutes;
        } else {
          mergedBillable = remainingMinutes;
          mergedNonBillable = newTotalMinutes - remainingMinutes;
        }

        console.log(
          `🔄 Merge billable split: ${mergedBillable}m (${minutesToHHMM(mergedBillable)}) billable, ${mergedNonBillable}m (${minutesToHHMM(mergedNonBillable)}) non-billable`,
        );
      } else if (billable) {
        mergedBillable = newTotalMinutes;
      } else {
        mergedNonBillable = newTotalMinutes;
      }

      const updateResult = await pool.query(
        `UPDATE daily_timesheet_entries
         SET total_hours = $1,
             billable_hours = $2,
             non_billable_hours = $3,
             description = $4,
             updated_at = NOW()
         WHERE entry_id = $5
         RETURNING *`,
        [
          newTotalMinutes,
          mergedBillable,
          mergedNonBillable,
          newDescription,
          existing.entry_id,
        ],
      );

      const updatedEntry = updateResult.rows[0];

      // ✅ Add formatted times for frontend
      const formattedEntry = formatEntryTimes(updatedEntry);

      console.log("✅ Entry merged successfully:", updatedEntry.entry_id);

      return res.status(200).json({
        message: "Entry updated - hours added to existing entry",
        entry: formattedEntry,
        isMerge: true,
      });
    }

    // ===================================================
    // ✅ 7. CREATE NEW ENTRY
    // ===================================================
    console.log("➕ No existing entry found, creating new entry...");

    const weekCalc = await pool.query(
      `SELECT
         DATE_TRUNC('week', $1::date)::date AS week_start,
         (DATE_TRUNC('week', $1::date) + INTERVAL '6 days')::date AS week_end`,
      [entryDate],
    );

    const { week_start, week_end } = weekCalc.rows[0];
    const draftStatusId = await getTimesheetStatusId("Draft");

    // ✅ Dynamic INSERT based on assignment type
    let insertQuery;
    let insertParams;

    if (assignmentType === "manager") {
      insertQuery = `
        INSERT INTO daily_timesheet_entries (
          employee_id, project_id, ticket_id, ticket_manager_assign_id,
          manager_id, client_id, task_id, entry_date,
          week_start_date, week_end_date, total_hours,
          billable_hours, non_billable_hours,
          ticket_number, description, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`;

      insertParams = [
        employeeId,
        projectId,
        ticketId,
        assignmentId,
        managerId,
        clientId,
        taskId,
        entryDate,
        week_start,
        week_end,
        minutesToAdd,
        finalBillable,
        finalNonBillable,
        ticketNumber || null,
        description,
        draftStatusId,
      ];
    } else if (assignmentType === "employee") {
      insertQuery = `
        INSERT INTO daily_timesheet_entries (
          employee_id, project_id, ticket_id, ticket_assign_id,
          manager_id, client_id, task_id, entry_date,
          week_start_date, week_end_date, total_hours,
          billable_hours, non_billable_hours,
          ticket_number, description, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`;

      insertParams = [
        employeeId,
        projectId,
        ticketId,
        assignmentId,
        managerId,
        clientId,
        taskId,
        entryDate,
        week_start,
        week_end,
        minutesToAdd,
        finalBillable,
        finalNonBillable,
        ticketNumber || null,
        description,
        draftStatusId,
      ];
    } else {
      insertQuery = `
        INSERT INTO daily_timesheet_entries (
          employee_id, project_id, ticket_id,
          manager_id, client_id, task_id, entry_date,
          week_start_date, week_end_date, total_hours,
          billable_hours, non_billable_hours,
          ticket_number, description, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`;

      insertParams = [
        employeeId,
        projectId,
        ticketId,
        managerId,
        clientId,
        taskId,
        entryDate,
        week_start,
        week_end,
        minutesToAdd,
        finalBillable,
        finalNonBillable,
        ticketNumber || null,
        description,
        draftStatusId,
      ];
    }

    const result = await pool.query(insertQuery, insertParams);
    const entry = result.rows[0];

    // ✅ Add formatted times for frontend
    const formattedEntry = formatEntryTimes(entry);
    formattedEntry.status = "Draft";

    console.log(
      `✅ New entry created successfully: ${entry.entry_id} (${assignmentType || "no_assignment"})`,
    );

    res.status(201).json({
      message: "Entry created successfully",
      entry: formattedEntry,
      isMerge: false,
    });
  } catch (error) {
    console.error("❌ Create entry error:", error);
    if (error.code === "23503") {
      return res.status(400).json({
        error: "Constraint Violation: Invalid Project or Ticket ID",
      });
    }
    res.status(500).json({ error: "Failed to save entry" });
  }
};

// ===============================
// ✅ FIXED: UPDATE ENTRY - Recalculate billable hours correctly
// ===============================
export const updateEntry = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { id } = req.params;

    const {
      hoursLogged,
      description,
      ticketNumber,
      projectId,
      ticketId,
      taskId,
    } = req.body;

    /* ---------------------------------------------------
       1. Validate entry ownership & status
    --------------------------------------------------- */
    const { rows } = await pool.query(
      `SELECT entry_date,
              status,
              ticket_assign_id,
              ticket_manager_assign_id
       FROM daily_timesheet_entries
       WHERE entry_id = $1 AND employee_id = $2`,
      [id, employeeId],
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Entry not found" });
    }

    const entry = rows[0];

    if (!description?.trim()) {
      return res.status(400).json({ error: "Description is required" });
    }

    const allowedStatuses = await getTimesheetStatusIds([
      "Draft",
      "Manager_Rejected",
      "Admin_Rejected",
    ]);

    if (!allowedStatuses.includes(entry.status)) {
      return res.status(400).json({
        error: "Only Draft or Rejected entries can be edited",
      });
    }

    /* ---------------------------------------------------
       2. Convert & validate minutes
    --------------------------------------------------- */
    const totalMinutes = hoursLogged !== undefined ? Number(hoursLogged) : null;

    const MAX_ENTRY_MINUTES = 24 * 60;
    const MAX_DAILY_MINUTES = 24 * 60;

    if (totalMinutes !== null) {
      if (isNaN(totalMinutes) || totalMinutes <= 0) {
        return res.status(400).json({ error: "Invalid time value" });
      }

      if (totalMinutes > MAX_ENTRY_MINUTES) {
        return res.status(400).json({
          error: `Maximum ${minutesToHHMM(MAX_ENTRY_MINUTES)} per entry`,
        });
      }

      const dailySum = await pool.query(
        `SELECT COALESCE(SUM(total_hours), 0) AS used_minutes
         FROM daily_timesheet_entries
         WHERE employee_id = $1
           AND entry_date = $2
           AND entry_id != $3`,
        [employeeId, entry.entry_date, id],
      );

      const usedMinutes = Number(dailySum.rows[0].used_minutes);

      if (usedMinutes + totalMinutes > MAX_DAILY_MINUTES) {
        return res.status(400).json({
          error: `Daily limit exceeded (${minutesToHHMM(
            usedMinutes,
          )} + ${minutesToHHMM(totalMinutes)})`,
        });
      }
    }

    /* ---------------------------------------------------
       3. Calculate billable / non-billable (minutes)
    --------------------------------------------------- */
    let billableMinutes = null;
    let nonBillableMinutes = null;

    if (totalMinutes !== null) {
      const assignmentId =
        entry.ticket_assign_id || entry.ticket_manager_assign_id;

      const assignmentType = entry.ticket_assign_id ? "employee" : "manager";

      if (assignmentId) {
        const budgetQuery =
          assignmentType === "manager"
            ? `SELECT billable_hours FROM ticket_manager_scope WHERE id = $1`
            : `SELECT billable_hours FROM ticket_assignments WHERE ticket_assignments_id = $1`;

        const budgetRes = await pool.query(budgetQuery, [assignmentId]);
        const maxBillable = Number(budgetRes.rows[0]?.billable_hours || 0);

        const usedQuery =
          assignmentType === "manager"
            ? `SELECT COALESCE(SUM(d.billable_hours),0) AS used
               FROM daily_timesheet_entries d
               JOIN timesheet_status ts ON ts.id = d.status
               WHERE d.ticket_manager_assign_id = $1
                 AND d.entry_id != $2
                 AND ts.name IN ('Draft','Submitted','Manager_Approved','Admin_Approved','Partially_Approved')`
            : `SELECT COALESCE(SUM(d.billable_hours),0) AS used
               FROM daily_timesheet_entries d
               JOIN timesheet_status ts ON ts.id = d.status
               WHERE d.ticket_assign_id = $1
                 AND d.entry_id != $2
                 AND ts.name IN ('Draft','Submitted','Manager_Approved','Admin_Approved','Partially_Approved')`;

        const usedRes = await pool.query(usedQuery, [assignmentId, id]);
        const usedBillable = Number(usedRes.rows[0].used);

        const remaining = Math.max(0, maxBillable - usedBillable);

        billableMinutes = Math.min(totalMinutes, remaining);
        nonBillableMinutes = totalMinutes - billableMinutes;
      } else {
        billableMinutes = totalMinutes;
        nonBillableMinutes = 0;
      }
    }

    /* ---------------------------------------------------
       4. Build update query
    --------------------------------------------------- */
    const updates = [];
    const values = [];
    let idx = 1;

    if (totalMinutes !== null) {
      updates.push(`total_hours = $${idx++}`);
      values.push(totalMinutes);

      updates.push(`billable_hours = $${idx++}`);
      values.push(billableMinutes);

      updates.push(`non_billable_hours = $${idx++}`);
      values.push(nonBillableMinutes);
    }

    updates.push(`description = $${idx++}`);
    values.push(description.trim());

    if (ticketNumber !== undefined) {
      updates.push(`ticket_number = $${idx++}`);
      values.push(ticketNumber);
    }

    if (projectId !== undefined) {
      updates.push(`project_id = $${idx++}`);
      values.push(projectId);
    }

    if (ticketId !== undefined) {
      updates.push(`ticket_id = $${idx++}`);
      values.push(ticketId);
    }

    if (taskId !== undefined) {
      updates.push(`task_id = $${idx++}`);
      values.push(taskId);
    }

    updates.push(`updated_at = NOW()`);

    values.push(id, employeeId);

    const updateQuery = `
      UPDATE daily_timesheet_entries
      SET ${updates.join(", ")}
      WHERE entry_id = $${idx++} AND employee_id = $${idx++}
      RETURNING *
    `;

    const updated = await pool.query(updateQuery, values);

    return res.json({
      message: "Entry updated",
      entry: formatEntryTimes(updated.rows[0]),
    });
  } catch (err) {
    console.error("❌ Update Entry Error:", err);
    return res.status(500).json({ error: "Failed to update entry" });
  }
};

// ===============================
// ✅ FIXED: SUBMIT WEEK - Recalculate rejected entries
// ===============================
export const submitWeek = async (req, res) => {
  const client = await pool.connect();

  try {
    const employeeId = req.user?.id;
    const { weekStart, weekEnd } = req.body;

    if (!employeeId || !weekStart || !weekEnd) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    await client.query("BEGIN");

    // --------------------------------------------------
    // 1️⃣ Resolve Status IDs
    // --------------------------------------------------

    const newStatusName = "Submitted";
    const newStatusId = await getTimesheetStatusId(newStatusName);

    const editableStatusNames = ["Draft", "Manager_Rejected", "Admin_Rejected"];
    const editableStatusIds = await getTimesheetStatusIds(editableStatusNames);

    const rejectedStatusNames = ["Manager_Rejected", "Admin_Rejected"];
    const rejectedStatusIds = await getTimesheetStatusIds(rejectedStatusNames);

    // --------------------------------------------------
    // 2️⃣ VALIDATION — Mon–Sat mandatory (8–24 hrs), Sunday optional (1–24 hrs)
    // --------------------------------------------------

    const dailyTotals = await client.query(
      `
      SELECT entry_date,
             SUM(total_hours) AS total_minutes
      FROM daily_timesheet_entries
      WHERE employee_id = $1
        AND week_start_date = $2
        AND week_end_date = $3
      GROUP BY entry_date
      ORDER BY entry_date
      `,
      [employeeId, weekStart, weekEnd],
    );

    const MIN_DAILY_MINUTES = 8 * 60; // 480  – applies Mon–Sat only
    const MAX_DAILY_MINUTES = 24 * 60; // 1440 – applies every day

    // weekEnd is always the Sunday of the ISO week (Mon = weekStart, Sun = weekEnd)
    const sundayDateStr = new Date(weekEnd).toISOString().split("T")[0];

    // Build date -> totalMinutes map from whatever was logged
    const loggedDayMap = new Map();
    for (const row of dailyTotals.rows) {
      const dateStr = new Date(row.entry_date).toISOString().split("T")[0];
      loggedDayMap.set(dateStr, Number(row.total_minutes || 0));
    }

    // Validate Mon–Sat (6 mandatory days)
    const weekStartDate = new Date(weekStart);
    for (let i = 0; i < 6; i++) {
      const d = new Date(weekStartDate);
      d.setDate(weekStartDate.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const minutes = loggedDayMap.get(dateStr) ?? 0;

      console.log("Day:", dateStr, "Minutes:", minutes);

      if (minutes < MIN_DAILY_MINUTES || minutes > MAX_DAILY_MINUTES) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error:
            minutes === 0
              ? `No time logged for ${dateStr}. Monday–Saturday entries are mandatory (8–24 hrs each).`
              : `Invalid hours on ${dateStr}. Each weekday must have 8–24 hours.`,
        });
      }
    }

    // Sunday is optional — validate only when the employee actually logged time
    if (loggedDayMap.has(sundayDateStr)) {
      const sundayMinutes = loggedDayMap.get(sundayDateStr);
      console.log("Sunday:", sundayDateStr, "Minutes:", sundayMinutes);
      if (sundayMinutes <= 0 || sundayMinutes > MAX_DAILY_MINUTES) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Invalid hours on Sunday (${sundayDateStr}). Sunday hours must be between 1 minute and 24 hours.`,
        });
      }
    }

    // --------------------------------------------------
    // 3️⃣ Recalculate Rejected Entries
    // --------------------------------------------------

    const rejectedEntries = await client.query(
      `
      SELECT entry_id,
             ticket_assign_id,
             ticket_manager_assign_id,
             total_hours
      FROM daily_timesheet_entries
      WHERE employee_id = $1
        AND week_start_date = $2
        AND week_end_date = $3
        AND status = ANY($4::int[])
      `,
      [employeeId, weekStart, weekEnd, rejectedStatusIds],
    );

    for (const entry of rejectedEntries.rows) {
      const assignmentId =
        entry.ticket_assign_id || entry.ticket_manager_assign_id;

      const assignmentType = entry.ticket_assign_id ? "employee" : "manager";

      if (!assignmentId) continue;

      const assignQuery =
        assignmentType === "manager"
          ? `SELECT billable_hours FROM ticket_manager_scope WHERE id = $1`
          : `SELECT billable_hours FROM ticket_assignments WHERE ticket_assignments_id = $1`;

      const assignData = await client.query(assignQuery, [assignmentId]);

      const maxBillableMinutes = Number(
        assignData.rows[0]?.billable_hours || 0,
      );

      const usedQuery =
        assignmentType === "manager"
          ? `
            SELECT COALESCE(SUM(d.billable_hours),0) AS used
            FROM daily_timesheet_entries d
            JOIN timesheet_status ts ON ts.id = d.status
            WHERE d.ticket_manager_assign_id = $1
              AND d.entry_id != $2
              AND ts.name IN (
                'Draft','Submitted','Manager_Approved',
                'Admin_Approved','Partially_Approved'
              )
          `
          : `
            SELECT COALESCE(SUM(d.billable_hours),0) AS used
            FROM daily_timesheet_entries d
            JOIN timesheet_status ts ON ts.id = d.status
            WHERE d.ticket_assign_id = $1
              AND d.entry_id != $2
              AND ts.name IN (
                'Draft','Submitted','Manager_Approved',
                'Admin_Approved','Partially_Approved'
              )
          `;

      const usedData = await client.query(usedQuery, [
        assignmentId,
        entry.entry_id,
      ]);

      const usedBillableMinutes = Number(usedData.rows[0]?.used || 0);

      const remainingMinutes = Math.max(
        0,
        maxBillableMinutes - usedBillableMinutes,
      );

      const totalMinutes = Number(entry.total_hours || 0);

      const newBillableMinutes = Math.min(totalMinutes, remainingMinutes);
      const newNonBillableMinutes = totalMinutes - newBillableMinutes;

      await client.query(
        `
        UPDATE daily_timesheet_entries
        SET billable_hours = $1,
            non_billable_hours = $2,
            updated_at = NOW()
        WHERE entry_id = $3
        `,
        [newBillableMinutes, newNonBillableMinutes, entry.entry_id],
      );
    }

    // --------------------------------------------------
    // 4️⃣ Determine Correct Approver Logic (per-entry, ticket-aware)
    // --------------------------------------------------

    // Fetch submitter's role name AND module_manager_id in one query
    const submitterData = await client.query(
      `SELECT ur.name AS role_name, e.module_manager_id
       FROM employees e
       JOIN user_roles ur ON ur.id = e.role
       WHERE e.employee_id = $1`,
      [employeeId],
    );

    const submitterRoleName = submitterData.rows[0]?.role_name; // 'EMPLOYEE' | 'MANAGER' | 'ADMIN'
    const moduleManagerId = submitterData.rows[0]?.module_manager_id || null;

    // Internal billing ticket zoho code constant
    const INTERNAL_TICKET_CODE = "AIS_Internal_Billing_Ticket";

    // Fetch all Draft/Rejected entries for this week with full ticket & assignment context
    const entriesToSubmit = await client.query(
      `
      SELECT
        d.entry_id,
        d.project_id,
        d.ticket_id,
        d.ticket_assign_id,
        d.ticket_manager_assign_id,
        tm.zoho_crm_code  AS ticket_code,
        ta.assigned_by    AS emp_assigned_by,
        tms.assigned_by   AS mgr_assigned_by
      FROM daily_timesheet_entries d
      LEFT JOIN ticket_master        tm  ON tm.ticket_id  = d.ticket_id
      LEFT JOIN ticket_assignments   ta  ON ta.ticket_assignments_id = d.ticket_assign_id
      LEFT JOIN ticket_manager_scope tms ON tms.id        = d.ticket_manager_assign_id
      WHERE d.employee_id     = $1
        AND d.week_start_date = $2
        AND d.week_end_date   = $3
        AND d.status = ANY($4::int[])
      `,
      [employeeId, weekStart, weekEnd, editableStatusIds],
    );

    for (const row of entriesToSubmit.rows) {
      const {
        entry_id,
        project_id,
        ticket_code,
        emp_assigned_by,
        mgr_assigned_by,
      } = row;

      let managerToAssign = null; // NULL = Admin approves directly

      // ── RULE 1: Internal Billing Ticket → route to submitter's module manager ──
      if (ticket_code === INTERNAL_TICKET_CODE) {
        if (moduleManagerId && moduleManagerId !== employeeId) {
          managerToAssign = moduleManagerId;
        } else {
          // No module manager or module manager is self → Admin approves
          managerToAssign = null;
        }

        // ── RULE 2: MANAGER submitting their own timesheet ──
      } else if (submitterRoleName === "MANAGER") {
        const assignedBy = mgr_assigned_by || null;

        if (!assignedBy) {
          // No assigner recorded — fall back to project_manager_assignment
          const pmResult = await client.query(
            `SELECT manager_id
             FROM project_manager_assignment
             WHERE project_id = $1
             LIMIT 1`,
            [project_id],
          );
          const projectManagerId = pmResult.rows[0]?.manager_id || null;

          // Self-approval guard: if this manager IS the project manager → Admin
          managerToAssign =
            projectManagerId && projectManagerId !== employeeId
              ? projectManagerId
              : null;
        } else {
          // Verify the assigner's role
          const assignerRoleResult = await client.query(
            `SELECT ur.name AS role_name
             FROM employees e
             JOIN user_roles ur ON ur.id = e.role
             WHERE e.employee_id = $1`,
            [assignedBy],
          );
          const assignerRole = assignerRoleResult.rows[0]?.role_name;

          if (assignerRole === "MANAGER" && assignedBy !== employeeId) {
            // Cross-manager: route to the assigning manager
            managerToAssign = assignedBy;
          } else {
            // Admin assigned, self-assigned, or unknown → Admin approves
            managerToAssign = null;
          }
        }

        // ── RULE 3: EMPLOYEE submitting their own timesheet ──
      } else {
        const assignedBy = emp_assigned_by || null;

        if (assignedBy && assignedBy !== employeeId) {
          // Verify assigner is a MANAGER
          const assignerRoleResult = await client.query(
            `SELECT ur.name AS role_name
             FROM employees e
             JOIN user_roles ur ON ur.id = e.role
             WHERE e.employee_id = $1`,
            [assignedBy],
          );
          const assignerRole = assignerRoleResult.rows[0]?.role_name;

          if (assignerRole === "MANAGER") {
            managerToAssign = assignedBy;
          }
          // else: assigned by Admin or unknown → fall through to project manager
        }

        // Fallback: project_manager_assignment
        if (!managerToAssign) {
          const pmResult = await client.query(
            `SELECT manager_id
             FROM project_manager_assignment
             WHERE project_id = $1
             LIMIT 1`,
            [project_id],
          );
          const projectManagerId = pmResult.rows[0]?.manager_id || null;

          managerToAssign =
            projectManagerId && projectManagerId !== employeeId
              ? projectManagerId
              : null;
        }
      }

      // ── FINAL GUARD: never allow self-approval under any scenario ──
      if (managerToAssign === employeeId) {
        managerToAssign = null;
      }

      await client.query(
        `UPDATE daily_timesheet_entries
         SET manager_id = $1
         WHERE entry_id = $2`,
        [managerToAssign, entry_id],
      );
    }

    // --------------------------------------------------
    // 5️⃣ Final Submit
    // --------------------------------------------------

    const submitResult = await client.query(
      `
      UPDATE daily_timesheet_entries
      SET status           = $1,
          submitted_at     = NOW(),
          rejected_at      = NULL,
          rejected_by      = NULL,
          rejection_reason = NULL,
          updated_at       = NOW()
      WHERE employee_id     = $2
        AND week_start_date = $3
        AND week_end_date   = $4
        AND status = ANY($5::int[])
      RETURNING entry_id
      `,
      [newStatusId, employeeId, weekStart, weekEnd, editableStatusIds],
    );

    await client.query("COMMIT");

    /*🔥*/ triggerTimesheetSubmitted({ employeeId, weekStart, weekEnd }).catch(
      (err) => console.error("📧 [Submit email] silent error:", err.message),
    );

    return res.json({
      message: `Submitted ${submitResult.rowCount} entries.`,
      status: newStatusName,
      count: submitResult.rowCount,
      recalculated: rejectedEntries.rowCount,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Submit week error:", error);

    return res.status(500).json({
      error: "Failed to submit timesheet",
    });
  } finally {
    client.release();
  }
};

// ===============================
// ✅ DELETE ENTRY
// ===============================
export const deleteEntry = async (req, res) => {
  try {
    const employeeId = req.user?.id;
    const { id } = req.params;

    // First, get the entry to check its status
    const entryCheck = await pool.query(
      `SELECT week_start_date, week_end_date, status
       FROM daily_timesheet_entries
       WHERE entry_id = $1 AND employee_id = $2`,
      [id, employeeId],
    );

    if (entryCheck.rows.length === 0) {
      return res.status(404).json({ error: "Entry not found" });
    }

    const entry = entryCheck.rows[0];
    const allowedStatusNames = ["Draft", "Manager_Rejected", "Admin_Rejected"];
    const allowedStatusIds = await getTimesheetStatusIds(allowedStatusNames);

    // ✅ Only Draft/Rejected entries can be deleted (NOT approved)
    if (!allowedStatusIds.includes(entry.status)) {
      return res.status(400).json({
        error:
          "Entry cannot be deleted. Only Draft or Rejected entries can be deleted.",
      });
    }

    const result = await pool.query(
      `DELETE FROM daily_timesheet_entries
       WHERE entry_id = $1 AND employee_id = $2 AND status = ANY($3::int[])
       RETURNING *`,
      [id, employeeId, allowedStatusIds],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error: "Entry cannot be deleted. It may be submitted or approved.",
      });
    }

    console.log(`✅ Entry deleted: ${id}`);
    res.json({ message: "Entry deleted successfully" });
  } catch (error) {
    console.error("❌ Delete error:", error);
    res.status(500).json({ error: "Failed to delete entry" });
  }
};

// ===============================
// GET WEEK STATUS
// ===============================
export const getWeekStatus = async (req, res) => {
  try {
    const employeeId = req.user?.id;
    const { weekStart, weekEnd } = req.query;

    if (!weekStart || !weekEnd)
      return res.status(400).json({ error: "Missing params" });

    const result = await pool.query(
      `SELECT ts.name, COUNT(*) as count
       FROM daily_timesheet_entries d
       JOIN timesheet_status ts ON ts.id = d.status
       WHERE d.employee_id = $1 AND d.week_start_date = $2 AND d.week_end_date = $3
       GROUP BY ts.name`,
      [employeeId, weekStart, weekEnd],
    );

    if (result.rows.length === 0) {
      return res.json({ canSubmit: false, status: "NO_ENTRIES" });
    }

    const statuses = result.rows.map((r) => r.name);
    const hasDraft = statuses.includes("Draft");
    const hasRejected = statuses.some((s) => s.includes("Rejected"));

    res.json({
      canSubmit: hasDraft || hasRejected,
      status: hasRejected ? "Partially Rejected" : statuses[0],
      statuses,
    });
  } catch (error) {
    console.error("Get week status error:", error);
    res.status(500).json({ error: "Failed to get week status" });
  }
};

// ===============================
// GET ENTRIES BY DATE RANGE
// ===============================
export const getEntriesByDateRange = async (req, res) => {
  try {
    const employeeId = req.user?.id;
    const { startDate, endDate } = req.query;

    const result = await pool.query(
      `SELECT
         d.*,
         d.total_hours as hours_logged,
         ts.name as status,
         p.project_name,
         t.ticket_name,
         t.zoho_crm_code,
         c.client_name,
         task.task as task_name,
         rejector.first_name || ' ' || rejector.last_name as rejected_by_name
       FROM daily_timesheet_entries d
       JOIN timesheet_status ts ON ts.id = d.status
       LEFT JOIN project_master p ON d.project_id = p.project_id
       LEFT JOIN ticket_master t ON d.ticket_id = t.ticket_id
       LEFT JOIN client_master c ON d.client_id = c.client_id
       LEFT JOIN task_master task ON d.task_id = task.task_id
       LEFT JOIN employees rejector ON d.rejected_by = rejector.employee_id
       WHERE d.employee_id = $1
         AND d.entry_date >= $2::date
         AND d.entry_date <= $3::date
       ORDER BY d.entry_date ASC, d.created_at ASC`,
      [employeeId, startDate, endDate],
    );

    res.json({ entries: result.rows });
  } catch (error) {
    console.error("❌ Get entries error:", error);
    res.status(500).json({ error: "Failed to fetch entries" });
  }
};

// ===============================
// GET HISTORY
// ===============================
// export const getTimesheetHistory = async (req, res) => {
//   try {
//     const employeeId = req.user?.id;

//     // Weekly summaries (exclude Draft)
//     const weeklySummary = await pool.query(
//       `SELECT
//          d.week_start_date,
//          d.week_end_date,
//          SUM(d.total_hours) as total_hours,
//          SUM(d.billable_hours) as total_billable_hours,
//          SUM(d.non_billable_hours) as total_non_billable_hours,
//          COUNT(*) as entry_count,
//          string_agg(DISTINCT ts.name, ', ') as statuses,
//          MAX(d.submitted_at) as submitted_at,
//          MAX(d.approved_at) as manager_approved_at,
//          MAX(d.rejected_at) as manager_rejected_at,
//          string_agg(DISTINCT p.project_name, ', ') as projects,
//          string_agg(DISTINCT t.ticket_name, ', ') as tickets
//        FROM daily_timesheet_entries d
//        JOIN timesheet_status ts ON ts.id = d.status
//        LEFT JOIN project_master p ON d.project_id = p.project_id
//        LEFT JOIN ticket_master t ON d.ticket_id = t.ticket_id
//        WHERE d.employee_id = $1 AND ts.name <> 'Draft'
//        GROUP BY d.week_start_date, d.week_end_date
//        ORDER BY d.week_start_date DESC`,
//       [employeeId],
//     );

//     const timesheetsWithEntries = await Promise.all(
//       weeklySummary.rows.map(async (week) => {
//         const entriesResult = await pool.query(
//           `SELECT
//              d.entry_id,
//              d.entry_date as date,
//              d.total_hours as hours,
//              d.description,
//              ts.name as status,
//              d.billable_hours,
//              d.non_billable_hours,
//              d.ticket_number,
//              p.project_name as "projectName",
//              t.ticket_name as "ticketName",
//              t.zoho_crm_code,
//              c.client_name as "clientName",
//              d.created_at,
//              d.updated_at
//            FROM daily_timesheet_entries d
//            JOIN timesheet_status ts ON ts.id = d.status
//            LEFT JOIN project_master p ON d.project_id = p.project_id
//            LEFT JOIN ticket_master t ON d.ticket_id = t.ticket_id
//            LEFT JOIN client_master c ON d.client_id = c.client_id
//            WHERE d.employee_id = $1
//              AND d.week_start_date = $2
//              AND d.week_end_date = $3
//              AND ts.name <> 'Draft'
//            ORDER BY d.entry_date ASC, d.created_at ASC`,
//           [employeeId, week.week_start_date, week.week_end_date],
//         );

//         return {
//           ...week,
//           entries: entriesResult.rows,
//         };
//       }),
//     );

//     res.json({ timesheets: timesheetsWithEntries });
//   } catch (error) {
//     console.error("Get history error:", error);
//     res.status(500).json({ error: "Failed to fetch history" });
//   }
// };

export const getTimesheetHistory = async (req, res) => {
  try {
    const employeeId = req.user?.id;

    // ── Weekly summaries ─────────────────────────────────────────────────────
    // Compute the overall display-status from individual entry statuses so the
    // frontend receives a single, meaningful string per week instead of a raw
    // string_agg of mixed DB status names.
    //
    // Overall-status rules (mirrors computeOverallStatus() in approvalController):
    //   All approved  (Mgr or Admin)        → "Approved"
    //   All rejected  (Mgr or Admin)        → "Rejected"
    //   Some approved (regardless of rest)  → "Partially_Approved"
    //   At least one rejected, 0 approved   → "Partially_Rejected"
    //   Otherwise                           → "Submitted"
    const weeklySummary = await pool.query(
      `SELECT
         d.week_start_date,
         d.week_end_date,
         SUM(d.total_hours)          AS total_hours,
         SUM(d.billable_hours)       AS total_billable_hours,
         SUM(d.non_billable_hours)   AS total_non_billable_hours,
         COUNT(*)                    AS entry_count,
         MAX(d.submitted_at)         AS submitted_at,

         -- ── Computed overall status ────────────────────────────────────────
         CASE
           WHEN COUNT(*) FILTER (WHERE ts.name IN ('Manager_Approved','Admin_Approved'))
                = COUNT(*)
             THEN 'Approved'
           WHEN COUNT(*) FILTER (WHERE ts.name IN ('Manager_Rejected','Admin_Rejected'))
                = COUNT(*)
             THEN 'Rejected'
           WHEN COUNT(*) FILTER (WHERE ts.name IN ('Manager_Approved','Admin_Approved'))
                > 0
             THEN 'Partially_Approved'
           WHEN COUNT(*) FILTER (WHERE ts.name IN ('Manager_Rejected','Admin_Rejected'))
                > 0
             THEN 'Partially_Rejected'
           ELSE 'Submitted'
         END                         AS overall_status,

         -- ── Approval meta – latest manager & admin decisions ───────────────
         -- Manager approval info (most recent approval)
         MAX(CASE WHEN ts.name = 'Manager_Approved' THEN d.approved_at  END)
           AS manager_approved_at,
         -- We resolve the actual name in the per-entry query below
         -- Admin approval info
         MAX(CASE WHEN ts.name = 'Admin_Approved'   THEN d.approved_at  END)
           AS admin_approved_at,
         MAX(CASE WHEN ts.name = 'Admin_Rejected'   THEN d.rejected_at  END)
           AS admin_rejected_at,
         MAX(CASE WHEN ts.name IN ('Manager_Rejected','Admin_Rejected')
                  THEN d.rejection_reason END)
           AS latest_rejection_reason,

         STRING_AGG(DISTINCT p.project_name, ', ')  AS projects,
         STRING_AGG(DISTINCT t.ticket_name,  ', ')  AS activities
       FROM daily_timesheet_entries d
       JOIN timesheet_status ts ON ts.id = d.status
       LEFT JOIN project_master p ON d.project_id = p.project_id
       LEFT JOIN ticket_master  t ON d.ticket_id  = t.ticket_id
       WHERE d.employee_id = $1
         AND ts.name <> 'Draft'
       GROUP BY d.week_start_date, d.week_end_date
       ORDER BY d.week_start_date DESC`,
      [employeeId],
    );

    // ── Per-week entries + resolved approver/rejector names ─────────────────
    const timesheetsWithEntries = await Promise.all(
      weeklySummary.rows.map(async (week) => {
        const entriesResult = await pool.query(
          `SELECT
             d.entry_id,
             d.entry_date                                  AS date,
             d.total_hours                                 AS hours,
             d.description,
             ts.name                                       AS status,
             d.billable_hours,
             d.non_billable_hours,
             d.ticket_number,
             p.project_name                                AS "projectName",
             t.ticket_name                                 AS "ticketName",
             t.zoho_crm_code,
             c.client_name                                 AS "clientName",
             -- approval details
             d.approved_at,
             approver.first_name || ' ' || approver.last_name AS approved_by_name,
             d.rejected_at,
             rejector.first_name || ' ' || rejector.last_name AS rejected_by_name,
             d.rejection_reason,
             d.created_at,
             d.updated_at
           FROM daily_timesheet_entries d
           JOIN  timesheet_status ts ON ts.id         = d.status
           LEFT JOIN project_master p ON d.project_id = p.project_id
           LEFT JOIN ticket_master  t ON d.ticket_id  = t.ticket_id
           LEFT JOIN client_master  c ON d.client_id  = c.client_id
           LEFT JOIN employees approver ON d.approved_by = approver.employee_id
           LEFT JOIN employees rejector ON d.rejected_by = rejector.employee_id
           WHERE d.employee_id     = $1
             AND d.week_start_date = $2
             AND d.week_end_date   = $3
             AND ts.name <> 'Draft'
           ORDER BY d.entry_date ASC, d.created_at ASC`,
          [employeeId, week.week_start_date, week.week_end_date],
        );

        // Resolve latest approver/rejector names from entries for history header
        const approvedEntry = entriesResult.rows.find(
          (r) =>
            ["Manager_Approved", "Admin_Approved"].includes(r.status) &&
            r.approved_by_name,
        );
        const rejectedEntry = entriesResult.rows.find(
          (r) =>
            ["Manager_Rejected", "Admin_Rejected"].includes(r.status) &&
            r.rejected_by_name,
        );
        const mgrApprEntry = entriesResult.rows.find(
          (r) => r.status === "Manager_Approved" && r.approved_by_name,
        );
        const adminApprEntry = entriesResult.rows.find(
          (r) => r.status === "Admin_Approved" && r.approved_by_name,
        );
        const mgrRejEntry = entriesResult.rows.find(
          (r) => r.status === "Manager_Rejected" && r.rejected_by_name,
        );
        const adminRejEntry = entriesResult.rows.find(
          (r) => r.status === "Admin_Rejected" && r.rejected_by_name,
        );

        return {
          // Period
          week_start_date: week.week_start_date,
          week_end_date: week.week_end_date,

          // Time totals
          total_hours: Number(week.total_hours ?? 0),
          total_billable_hours: Number(week.total_billable_hours ?? 0),
          total_non_billable_hours: Number(week.total_non_billable_hours ?? 0),
          entry_count: Number(week.entry_count) || 0,

          // Computed overall status (single string for display)
          statuses: week.overall_status, // kept for backward compat
          overall_status: week.overall_status,

          // Submission
          submitted_at: week.submitted_at,

          // Manager approval info
          manager_approved_at: week.manager_approved_at,
          manager_approved_by_name: mgrApprEntry?.approved_by_name || null,
          manager_rejected_at:
            week.manager_rejected_at ?? mgrRejEntry?.rejected_at ?? null,
          manager_rejected_by_name: mgrRejEntry?.rejected_by_name || null,
          manager_rejection_reason: mgrRejEntry?.rejection_reason || null,

          // Admin approval info
          admin_approved_at: week.admin_approved_at,
          admin_approved_by_name: adminApprEntry?.approved_by_name || null,
          admin_rejected_at: week.admin_rejected_at,
          admin_rejected_by_name: adminRejEntry?.rejected_by_name || null,
          admin_rejection_reason: adminRejEntry?.rejection_reason || null,

          // Projects / activities
          projects: week.projects || "N/A",
          activities: week.activities || "N/A",

          // Per-entry details
          entries: entriesResult.rows,
        };
      }),
    );

    res.json({ timesheets: timesheetsWithEntries });
  } catch (error) {
    console.error("Get history error:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
};
// ===============================
// ✅ RECALCULATE ASSIGNMENT ENTRIES
// ===============================
export const recalculateAssignmentEntries = async (req, res) => {
  try {
    const { assignmentId, assignmentType } = req.body;
    const userRole = req.user?.role;

    // Only ADMIN and MANAGER can trigger recalculation
    if (!["ADMIN", "MANAGER"].includes(userRole)) {
      return res.status(403).json({
        error: "Only admins and managers can recalculate entries",
      });
    }

    if (!assignmentId || !assignmentType) {
      return res.status(400).json({
        error: "assignmentId and assignmentType are required",
      });
    }

    if (!["employee", "manager"].includes(assignmentType)) {
      return res.status(400).json({
        error: "assignmentType must be 'employee' or 'manager'",
      });
    }

    console.log(
      `🔄 Manual recalculation requested by ${userRole} for ${assignmentType} assignment: ${assignmentId}`,
    );

    // Get summary before recalculation
    const beforeSummary = await getAffectedEntriesSummary(
      assignmentId,
      assignmentType,
    );

    if (beforeSummary.totalEntries === 0) {
      return res.json({
        message: "No Draft or Submitted entries to recalculate",
        entriesUpdated: 0,
        assignmentId,
        assignmentType,
      });
    }

    // Perform recalculation
    const entriesUpdated = await recalculateHelper(
      assignmentId,
      assignmentType,
    );

    // Get summary after recalculation
    const afterSummary = await getAffectedEntriesSummary(
      assignmentId,
      assignmentType,
    );

    res.json({
      message: "Entries recalculated successfully",
      entriesUpdated,
      assignmentId,
      assignmentType,
      before: beforeSummary,
      after: afterSummary,
    });
  } catch (error) {
    console.error("❌ Recalculation error:", error);
    res.status(500).json({ error: "Failed to recalculate entries" });
  }
};

// ===============================
// ✅ RECALCULATE ALL ENTRIES FOR A TICKET
// ===============================
export const recalculateTicketEntries = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userRole = req.user?.role;

    // Only ADMIN and MANAGER can trigger recalculation
    if (!["ADMIN", "MANAGER"].includes(userRole)) {
      return res.status(403).json({
        error: "Only admins and managers can recalculate entries",
      });
    }

    if (!ticketId) {
      return res.status(400).json({ error: "ticketId is required" });
    }

    console.log(
      `🔄 Manual recalculation requested by ${userRole} for ticket: ${ticketId}`,
    );

    const summary = await recalculateTicketHelper(ticketId);

    if (summary.totalEntriesUpdated === 0) {
      return res.json({
        message: "No Draft or Submitted entries found to recalculate",
        ...summary,
      });
    }

    res.json({
      message: "All ticket entries recalculated successfully",
      ...summary,
    });
  } catch (error) {
    console.error("❌ Recalculation error:", error);
    res.status(500).json({ error: "Failed to recalculate entries" });
  }
};

// ===============================
// ✅ GET AFFECTED ENTRIES PREVIEW
// ===============================
export const getAffectedEntriesPreview = async (req, res) => {
  try {
    const { assignmentId, assignmentType } = req.query;
    const userRole = req.user?.role;

    // Only ADMIN and MANAGER can view this
    if (!["ADMIN", "MANAGER"].includes(userRole)) {
      return res.status(403).json({
        error: "Only admins and managers can view affected entries",
      });
    }

    if (!assignmentId || !assignmentType) {
      return res.status(400).json({
        error: "assignmentId and assignmentType are required",
      });
    }

    const summary = await getAffectedEntriesSummary(
      assignmentId,
      assignmentType,
    );

    res.json({
      message: "Affected entries summary",
      ...summary,
      willBeRecalculated: summary.totalEntries > 0,
    });
  } catch (error) {
    console.error("❌ Get affected entries error:", error);
    res.status(500).json({ error: "Failed to get affected entries" });
  }
};

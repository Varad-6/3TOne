import pool from "../config/database.js";
import { toMinutes, minutesToHHMM } from "../utils/timeUtils.js";

// ====================================
// Helpers
// ====================================

async function getTicketStatusId(input) {
  if (input === undefined || input === null) {
    throw new Error("Ticket status is required");
  }
  if (typeof input === "number" || /^\d+$/.test(String(input))) {
    return Number(input);
  }
  const name = String(input).trim();
  const result = await pool.query(
    "SELECT id FROM ticket_status WHERE name = $1",
    [name],
  );
  if (result.rows.length === 0) {
    throw new Error(`Ticket status "${name}" not found`);
  }
  return result.rows[0].id;
}

/**
 * Check whether adding `newBillableMinutes` to project's tickets would
 * exceed the project's billable_hours budget.
 * excludeTicketId: when updating, exclude the ticket being edited from the sum.
 * Returns { allowed, projectBudget, usedMinutes, remainingMinutes }
 */
async function checkProjectBudget(
  client,
  projectId,
  newBillableMinutes,
  excludeTicketId = null,
) {
  // Get project budget (stored in minutes)
  const projectRes = await client.query(
    "SELECT billable_hours FROM project_master WHERE project_id = $1",
    [projectId],
  );
  if (projectRes.rows.length === 0) throw new Error("Project not found");

  const projectBudget = parseInt(projectRes.rows[0].billable_hours) || 0;

  // If project has no budget set (0), skip enforcement
  if (projectBudget === 0) {
    return {
      allowed: true,
      projectBudget: 0,
      usedMinutes: 0,
      remainingMinutes: 0,
      budgetNotSet: true,
    };
  }

  // Sum existing active tickets' billable_hours for this project
  let sumQuery = `
    SELECT COALESCE(SUM(billable_hours), 0) AS total
    FROM ticket_master
    WHERE project_id = $1 AND is_active = TRUE
  `;
  const params = [projectId];
  if (excludeTicketId) {
    params.push(excludeTicketId);
    sumQuery += ` AND ticket_id != $${params.length}`;
  }

  const sumRes = await client.query(sumQuery, params);
  const usedMinutes = parseInt(sumRes.rows[0].total) || 0;
  const remainingMinutes = projectBudget - usedMinutes;
  const allowed = usedMinutes + newBillableMinutes <= projectBudget;

  return { allowed, projectBudget, usedMinutes, remainingMinutes };
}

// ====================================
// Get all ticket statuses
// ====================================
export const getAllTicketStatuses = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name FROM ticket_status ORDER BY id ASC",
    );
    res.json({ statuses: result.rows, count: result.rows.length });
  } catch (error) {
    console.error("Get ticket statuses error:", error);
    res
      .status(500)
      .json({
        error: "Failed to fetch ticket statuses",
        details: error.message,
      });
  }
};

// ====================================
// Get all tickets (with optional filters)
// ====================================
export const getAllTickets = async (req, res) => {
  try {
    const { projectId, status, isActive } = req.query;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    let query = `
      SELECT
        t.ticket_id,
        t.ticket_name,
        t.zoho_crm_code,
        t.project_id,
        p.project_name,
        c.client_name,
        t.description,
        ts.name AS status,
        t.start_date,
        t.end_date,
        t.estimated_date,
        t.estimated_hours,
        t.approved_hours,
        t.billable_hours,
        t.is_active,
        t.created_at,
        t.updated_at
      FROM ticket_master t
      LEFT JOIN project_master p ON t.project_id = p.project_id
      LEFT JOIN client_master c ON p.client_id = c.client_id
      LEFT JOIN project_manager_assignment pma ON p.project_id = pma.project_id
      LEFT JOIN ticket_status ts ON ts.id = t.status
      WHERE 1=1
    `;

    const params = [];

    if (userRole === "MANAGER") {
      params.push(userId);
      query += ` AND pma.manager_id = $${params.length}`;
      params.push("AIS_Internal_Billing_Ticket");
      query += ` AND t.ticket_name <> $${params.length}`;
    }

    if (isActive && isActive !== "all") {
      params.push(isActive === "true");
      query += ` AND t.is_active = $${params.length}`;
    }

    if (projectId) {
      params.push(projectId);
      query += ` AND t.project_id = $${params.length}`;
    }

    if (status) {
      const statusId = await getTicketStatusId(status);
      params.push(statusId);
      query += ` AND t.status = $${params.length}`;
    }

    query +=
      " GROUP BY t.ticket_id, p.project_name, c.client_name, ts.name ORDER BY t.start_date DESC";

    const result = await pool.query(query, params);
    res.json({ tickets: result.rows, count: result.rows.length });
  } catch (error) {
    console.error("❌ Get tickets error:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch tickets", details: error.message });
  }
};

// ====================================
// Get ticket by ID
// ====================================
export const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
         t.ticket_id, t.ticket_name, t.zoho_crm_code, t.project_id,
         p.project_name, c.client_name, t.description, ts.name AS status,
         t.start_date, t.end_date, t.estimated_date,
         t.estimated_hours, t.approved_hours, t.billable_hours,
         t.is_active, t.created_at, t.updated_at
       FROM ticket_master t
       LEFT JOIN project_master p ON t.project_id = p.project_id
       LEFT JOIN client_master c ON p.client_id = c.client_id
       LEFT JOIN ticket_status ts ON ts.id = t.status
       WHERE t.ticket_id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const employees = await pool.query(
      `SELECT 
         ta.ticket_assignments_id AS assignment_id, ta.employee_id,
         e.first_name || ' ' || e.last_name AS employee_name,
         e.email, ta.assign_start_date, ta.billable_hours
       FROM ticket_assignments ta
       JOIN employees e ON ta.employee_id = e.employee_id
       WHERE ta.ticket_id = $1 AND ta.is_active = TRUE`,
      [id],
    );

    res.json({ ...result.rows[0], assigned_employees: employees.rows });
  } catch (error) {
    console.error("❌ Get ticket error:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch ticket", details: error.message });
  }
};

// ====================================
// Get manager's project tickets
// ====================================
export const getManagerProjectTickets = async (req, res) => {
  try {
    const managerId = req.user?.id;
    const userRole = req.user?.role;

    if (userRole !== "MANAGER") {
      return res
        .status(403)
        .json({
          error: "Access denied",
          message: "Only managers can access this endpoint",
        });
    }

    const result = await pool.query(
      `SELECT 
         t.ticket_id, t.ticket_name, t.description, t.billable_hours,
         ts.name AS status, t.start_date, t.end_date,
         t.project_id, p.project_name, p.project_code,
         c.client_id, c.client_name, t.is_active,
         CASE 
           WHEN EXISTS (
             SELECT 1 FROM ticket_manager_scope 
             WHERE manager_id = $1 AND ticket_id = t.ticket_id
           ) THEN TRUE ELSE FALSE 
         END as is_in_my_scope
       FROM ticket_master t
       JOIN project_master p ON t.project_id = p.project_id
       JOIN project_manager_assignment pma ON p.project_id = pma.project_id
       LEFT JOIN client_master c ON p.client_id = c.client_id
       LEFT JOIN ticket_status ts ON ts.id = t.status
       WHERE pma.manager_id = $1
         AND t.is_active = TRUE
         AND t.ticket_name <> 'AIS_Internal_Billing_Ticket'
       ORDER BY p.project_name, t.ticket_name`,
      [managerId],
    );

    const projectMap = {};
    result.rows.forEach((ticket) => {
      const projectId = ticket.project_id;
      if (!projectMap[projectId]) {
        projectMap[projectId] = {
          project_id: projectId,
          project_name: ticket.project_name,
          project_code: ticket.project_code,
          client_id: ticket.client_id,
          client_name: ticket.client_name,
          tickets: [],
        };
      }
      projectMap[projectId].tickets.push({
        ticket_id: ticket.ticket_id,
        ticket_name: ticket.ticket_name,
        description: ticket.description,
        billable_hours: ticket.billable_hours,
        status: ticket.status,
        start_date: ticket.start_date,
        end_date: ticket.end_date,
        is_in_my_scope: ticket.is_in_my_scope,
        is_active: ticket.is_active,
      });
    });

    res
      .status(200)
      .json({
        projects: Object.values(projectMap),
        totalTickets: result.rows.length,
      });
  } catch (error) {
    console.error("❌ Get manager project tickets error:", error);
    res
      .status(500)
      .json({
        error: "Failed to fetch project tickets",
        details: error.message,
      });
  }
};

// ====================================
// Create ticket
// — enforces project billable_hours budget
// ====================================
export const createTicket = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      ticketName,
      projectId,
      zohoCrmCode,
      description,
      status = "Planned",
      startDate,
      endDate,
      estimatedDate,
      estimatedHours,
      approvedHours,
      billableHours,
      createdBy,
    } = req.body;

    const userRole = req.user?.role;
    const userId = req.user?.id;

    // 1. Basic validation
    if (!ticketName?.trim())
      return res.status(400).json({ error: "Ticket Name is required" });
    if (!projectId)
      return res.status(400).json({ error: "Project is required" });
    if (!zohoCrmCode?.trim())
      return res.status(400).json({ error: "Zoho CRM Code is required" });
    if (!startDate || !endDate || !estimatedDate)
      return res.status(400).json({ error: "All date fields are required" });
    if (
      estimatedHours === undefined ||
      approvedHours === undefined ||
      billableHours === undefined
    )
      return res.status(400).json({ error: "All hour fields are required" });

    // 2. Hours to minutes
    const estMinutes = Number(estimatedHours);
    const appMinutes = Number(approvedHours);
    const billMinutes = Number(billableHours);

    if ([estMinutes, appMinutes, billMinutes].some((m) => m === null || m < 0))
      return res
        .status(400)
        .json({ error: "Hours must be valid positive values" });
    if (appMinutes > estMinutes)
      return res
        .status(400)
        .json({ error: "Approved Minutes cannot exceed Estimated Minutes" });
    if (billMinutes > appMinutes)
      return res
        .status(400)
        .json({ error: "Billable Minutes cannot exceed Approved Minutes" });

    // 3. Date validation
    const start = new Date(startDate);
    const end = new Date(endDate);
    const estimated = new Date(estimatedDate);
    if ([start, end, estimated].some((d) => isNaN(d.getTime())))
      return res.status(400).json({ error: "Invalid date format" });
    if (end < start)
      return res
        .status(400)
        .json({ error: "End Date cannot be before Start Date" });
    if (estimated < start)
      return res
        .status(400)
        .json({ error: "Estimated End Date cannot be before Start Date" });

    await client.query("BEGIN");

    // 4. Manager project security
    if (userRole === "MANAGER") {
      const assignmentCheck = await client.query(
        `SELECT 1 FROM project_manager_assignment WHERE project_id = $1 AND manager_id = $2`,
        [projectId, userId],
      );
      if (assignmentCheck.rows.length === 0)
        throw new Error(
          "Insufficient permissions: Project not assigned to you.",
        );
    }

    // 5. Unique Zoho CRM Code
    const zohoCheck = await client.query(
      `SELECT ticket_id FROM ticket_master WHERE zoho_crm_code = $1 AND is_active = TRUE`,
      [zohoCrmCode.trim()],
    );
    if (zohoCheck.rows.length > 0)
      throw new Error("Zoho CRM Code already exists");

    // ─────────────────────────────────────────────────
    // 6. PROJECT BUDGET CHECK — cumulative billable_hours
    // ─────────────────────────────────────────────────
    const budget = await checkProjectBudget(client, projectId, billMinutes);
    if (!budget.budgetNotSet && !budget.allowed) {
      const remaining = budget.remainingMinutes;
      const remainHH = Math.floor(remaining / 60);
      const remainMM = String(remaining % 60).padStart(2, "0");
      const budgetHH = Math.floor(budget.projectBudget / 60);
      const budgetMM = String(budget.projectBudget % 60).padStart(2, "0");
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: `Billable hours exceed project budget. Project budget: ${budgetHH}:${budgetMM}, Remaining: ${remainHH}:${remainMM}`,
        remainingMinutes: remaining,
        projectBudgetMinutes: budget.projectBudget,
      });
    }

    // 7. Status resolution
    const statusId = await getTicketStatusId(status);
    if (!statusId) throw new Error("Invalid ticket status");

    // 8. Insert ticket
    const result = await client.query(
      `INSERT INTO ticket_master
        (ticket_name, project_id, zoho_crm_code, description, status,
         start_date, end_date, estimated_date,
         estimated_hours, approved_hours, billable_hours,
         created_by, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE)
       RETURNING *`,
      [
        ticketName.trim(),
        projectId,
        zohoCrmCode.trim(),
        description?.trim() || null,
        statusId,
        startDate,
        endDate,
        estimatedDate,
        estMinutes,
        appMinutes,
        billMinutes,
        createdBy || userId,
      ],
    );

    await client.query("COMMIT");

    const newTicket = result.rows[0];
    newTicket.status = status;

    res.status(201).json({
      message: "Ticket created successfully",
      ticket: newTicket,
      budgetInfo: budget.budgetNotSet
        ? null
        : {
            projectBudgetMinutes: budget.projectBudget,
            usedMinutes: budget.usedMinutes + billMinutes,
            remainingMinutes: budget.remainingMinutes - billMinutes,
          },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Create ticket error:", error);
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
};

// ====================================
// Update ticket
// Admin  → direct update + budget check
// Manager → non-hours fields direct; billable_hours change → PENDING approval request
// ====================================
export const updateTicket = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    const {
      ticketName,
      zohoCrmCode,
      description,
      startDate,
      endDate,
      estimatedDate,
      estimatedHours,
      approvedHours,
      billableHours,
      status,
      isActive,
    } = req.body;

    // Fetch current ticket
    const currentResult = await client.query(
      `SELECT t.*, pm.project_id AS proj_id
       FROM ticket_master t
       JOIN project_master pm ON pm.project_id = t.project_id
       WHERE t.ticket_id = $1`,
      [id],
    );
    if (currentResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Ticket not found" });
    }
    const current = currentResult.rows[0];

    // ─────────────────────────────────────────────────────────────
    // MANAGER SECURITY: must be assigned to this ticket's project
    // ─────────────────────────────────────────────────────────────
    if (userRole === "MANAGER") {
      const access = await client.query(
        `SELECT 1 FROM project_manager_assignment
         WHERE project_id = $1 AND manager_id = $2`,
        [current.project_id, userId],
      );
      if (access.rows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(403)
          .json({ error: "Access denied: project not assigned to you" });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // MANAGER ROLE — billable_hours change needs approval
    // ─────────────────────────────────────────────────────────────
    const isBillableHoursChanging =
      billableHours !== undefined &&
      Number(billableHours) !== Number(current.billable_hours);

    if (userRole === "MANAGER" && isBillableHoursChanging) {
      // Check if there is already a PENDING request for this ticket
      const existingPending = await client.query(
        `SELECT ticket_hours_update_history_id
         FROM ticket_hours_update_history
         WHERE ticket_id = $1 AND status = 'PENDING'`,
        [id],
      );
      if (existingPending.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error:
            "A billable hours update request is already pending admin approval for this ticket.",
          pendingRequestId:
            existingPending.rows[0].ticket_hours_update_history_id,
        });
      }

      const newBillMinutes = Number(billableHours);

      // Budget check for the requested hours
      const budget = await checkProjectBudget(
        client,
        current.project_id,
        newBillMinutes,
        id,
      );
      if (!budget.budgetNotSet && !budget.allowed) {
        const remaining = budget.remainingMinutes;
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Requested billable hours exceed project budget. Remaining budget: ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`,
          remainingMinutes: remaining,
          projectBudgetMinutes: budget.projectBudget,
        });
      }

      // Create PENDING request in ticket_hours_update_history
      const hoursReq = await client.query(
        `INSERT INTO ticket_hours_update_history
           (project_id, ticket_id, old_hours, requested_hours, status, requested_by, remarks)
         VALUES ($1, $2, $3, $4, 'PENDING', $5, $6)
         RETURNING *`,
        [
          current.project_id,
          id,
          current.billable_hours,
          newBillMinutes,
          userId,
          JSON.stringify({
            estimatedHours:
              estimatedHours !== undefined
                ? Number(estimatedHours)
                : current.estimated_hours,
            approvedHours:
              approvedHours !== undefined
                ? Number(approvedHours)
                : current.approved_hours,
            requestedBillableHours: newBillMinutes,
          }),
        ],
      );

      // Apply non-billable-hours changes directly (all other fields)
      const updates = [];
      const params = [];

      if (ticketName !== undefined && ticketName.trim()) {
        params.push(ticketName.trim());
        updates.push(`ticket_name = $${params.length}`);
      }
      if (zohoCrmCode !== undefined && zohoCrmCode.trim()) {
        params.push(zohoCrmCode.trim());
        updates.push(`zoho_crm_code = $${params.length}`);
      }
      if (description !== undefined) {
        params.push(description?.trim() || null);
        updates.push(`description = $${params.length}`);
      }
      if (startDate !== undefined) {
        params.push(startDate);
        updates.push(`start_date = $${params.length}`);
      }
      if (endDate !== undefined) {
        params.push(endDate);
        updates.push(`end_date = $${params.length}`);
      }
      if (estimatedDate !== undefined) {
        params.push(estimatedDate);
        updates.push(`estimated_date = $${params.length}`);
      }
      if (estimatedHours !== undefined) {
        params.push(Number(estimatedHours));
        updates.push(`estimated_hours = $${params.length}`);
      }
      if (approvedHours !== undefined) {
        params.push(Number(approvedHours));
        updates.push(`approved_hours = $${params.length}`);
      }
      if (status !== undefined) {
        const statusId = await getTicketStatusId(status);
        params.push(statusId);
        updates.push(`status = $${params.length}`);
      }

      let updatedTicket = null;
      if (updates.length > 0) {
        params.push(id);
        const q = `UPDATE ticket_master SET ${updates.join(", ")}, updated_at = NOW() WHERE ticket_id = $${params.length} RETURNING *`;
        const r = await client.query(q, params);
        updatedTicket = r.rows[0];
      }

      await client.query("COMMIT");

      return res.json({
        message:
          "Ticket updated. Billable hours change has been submitted for admin approval.",
        hoursRequestPending: true,
        hoursRequest: hoursReq.rows[0],
        ticket: updatedTicket || current,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // ADMIN ROLE (or MANAGER with no billable_hours change) — direct update
    // ─────────────────────────────────────────────────────────────
    const updates = [];
    const params = [];

    // Field validations
    if (ticketName !== undefined) {
      if (!ticketName.trim()) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Ticket Name cannot be empty" });
      }
      params.push(ticketName.trim());
      updates.push(`ticket_name = $${params.length}`);
    }
    if (zohoCrmCode !== undefined) {
      if (!zohoCrmCode.trim()) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Zoho CRM Code cannot be empty" });
      }
      params.push(zohoCrmCode.trim());
      updates.push(`zoho_crm_code = $${params.length}`);
    }
    if (description !== undefined) {
      params.push(description?.trim() || null);
      updates.push(`description = $${params.length}`);
    }

    // Date validation
    const finalStart = startDate
      ? new Date(startDate)
      : new Date(current.start_date);
    const finalEnd = endDate ? new Date(endDate) : new Date(current.end_date);
    const finalEstimated = estimatedDate
      ? new Date(estimatedDate)
      : new Date(current.estimated_date);

    if (finalEnd < finalStart) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "End Date cannot be before Start Date" });
    }
    if (finalEstimated < finalStart) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "Estimated End Date cannot be before Start Date" });
    }

    if (startDate !== undefined) {
      params.push(startDate);
      updates.push(`start_date = $${params.length}`);
    }
    if (endDate !== undefined) {
      params.push(endDate);
      updates.push(`end_date = $${params.length}`);
    }
    if (estimatedDate !== undefined) {
      params.push(estimatedDate);
      updates.push(`estimated_date = $${params.length}`);
    }

    // Hours
    const estMinutes =
      estimatedHours !== undefined
        ? Number(estimatedHours)
        : current.estimated_hours;
    const appMinutes =
      approvedHours !== undefined
        ? Number(approvedHours)
        : current.approved_hours;
    const billMinutes =
      billableHours !== undefined
        ? Number(billableHours)
        : current.billable_hours;

    if (
      [estMinutes, appMinutes, billMinutes].some((v) => v === null || v < 0)
    ) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "Hours must be valid time (HH:MM or numeric hours)" });
    }
    if (appMinutes > estMinutes) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "Approved Minutes cannot exceed Estimated Minutes" });
    }
    if (billMinutes > appMinutes) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "Billable Minutes cannot exceed Approved Minutes" });
    }

    // Budget check for admin updating billable_hours
    if (billableHours !== undefined && userRole === "ADMIN") {
      const budget = await checkProjectBudget(
        client,
        current.project_id,
        billMinutes,
        id,
      );
      if (!budget.budgetNotSet && !budget.allowed) {
        const remaining = budget.remainingMinutes;
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Billable hours exceed project budget. Remaining budget: ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`,
          remainingMinutes: remaining,
          projectBudgetMinutes: budget.projectBudget,
        });
      }
    }

    if (estimatedHours !== undefined) {
      params.push(estMinutes);
      updates.push(`estimated_hours = $${params.length}`);
    }
    if (approvedHours !== undefined) {
      params.push(appMinutes);
      updates.push(`approved_hours = $${params.length}`);
    }
    if (billableHours !== undefined) {
      params.push(billMinutes);
      updates.push(`billable_hours = $${params.length}`);
    }

    if (status !== undefined) {
      const statusId = await getTicketStatusId(status);
      params.push(statusId);
      updates.push(`status = $${params.length}`);
    }
    if (isActive !== undefined) {
      params.push(isActive);
      updates.push(`is_active = $${params.length}`);
    }

    if (updates.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "No fields to update" });
    }

    params.push(id);
    const query = `UPDATE ticket_master SET ${updates.join(", ")}, updated_at = NOW() WHERE ticket_id = $${params.length} RETURNING *`;
    const result = await client.query(query, params);
    const updated = result.rows[0];

    await client.query("COMMIT");

    console.log("✅ Ticket updated successfully:", updated.ticket_id);
    res.json({ message: "Ticket updated successfully", ticket: updated });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Update ticket error:", error);
    if (error.code === "23505")
      return res.status(409).json({ error: "Zoho CRM Code already exists" });
    res
      .status(500)
      .json({ error: "Failed to update ticket", details: error.message });
  } finally {
    client.release();
  }
};

// ====================================
// Delete ticket (soft delete)
// ====================================
export const deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE ticket_master SET is_active = FALSE, updated_at = NOW() WHERE ticket_id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Ticket not found" });
    res.json({
      message: "Ticket deactivated successfully",
      ticket: result.rows[0],
    });
  } catch (error) {
    console.error("❌ Delete ticket error:", error);
    res
      .status(500)
      .json({ error: "Failed to delete ticket", details: error.message });
  }
};

// ====================================
// Reactivate ticket
// ====================================
export const reactivateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const existingTicket = await pool.query(
      "SELECT ticket_id, ticket_name, is_active FROM ticket_master WHERE ticket_id = $1",
      [id],
    );
    if (existingTicket.rows.length === 0)
      return res.status(404).json({ error: "Ticket not found" });
    const ticket = existingTicket.rows[0];
    if (ticket.is_active)
      return res
        .status(400)
        .json({ error: "Ticket is already active", ticket });

    const result = await pool.query(
      `UPDATE ticket_master SET is_active = TRUE, updated_at = NOW() WHERE ticket_id = $1
       RETURNING ticket_id, ticket_name, zoho_crm_code, project_id, status, is_active`,
      [id],
    );
    res.json({
      message: "Ticket reactivated successfully",
      ticket: result.rows[0],
    });
  } catch (error) {
    console.error("❌ Reactivate ticket error:", error);
    res
      .status(500)
      .json({ error: "Failed to reactivate ticket", details: error.message });
  }
};

// ====================================
// Export tickets for manager (Excel)
// ====================================
export const getManagerTicketsForExport = async (req, res) => {
  try {
    const managerId = req.user?.id;
    const userRole = req.user?.role;

    if (userRole !== "MANAGER")
      return res.status(403).json({ error: "Access denied" });

    const result = await pool.query(
      `SELECT
         t.ticket_name, t.zoho_crm_code, p.project_name,
         t.estimated_hours, t.approved_hours, t.billable_hours,
         t.description, ts.name AS status,
         t.start_date, t.end_date, t.estimated_date,
         STRING_AGG(
           e.first_name || ' ' || e.last_name || ' : ' ||
           CASE
             WHEN ta.billable_hours % 60 = 0 THEN (ta.billable_hours / 60)::int::text || ' hrs'
             ELSE TRIM(TO_CHAR(ta.billable_hours / 60.0, 'FM999990.9')) || ' hrs'
           END,
           ', ' ORDER BY e.first_name || ' ' || e.last_name
         ) AS assigned_consultants
       FROM ticket_master t
       JOIN project_master p ON t.project_id = p.project_id
       JOIN project_manager_assignment pma ON p.project_id = pma.project_id
       LEFT JOIN ticket_status ts ON ts.id = t.status
       LEFT JOIN ticket_assignments ta ON ta.ticket_id = t.ticket_id AND ta.is_active = TRUE
       LEFT JOIN employees e ON ta.employee_id = e.employee_id
       WHERE pma.manager_id = $1
         AND t.is_active = TRUE
         AND t.ticket_name <> 'AIS_Internal_Billing_Ticket'
       GROUP BY t.ticket_id, t.ticket_name, t.zoho_crm_code, p.project_name,
                t.estimated_hours, t.approved_hours, t.billable_hours,
                t.description, ts.name, t.start_date, t.end_date, t.estimated_date
       ORDER BY p.project_name, t.ticket_name`,
      [managerId],
    );

    res.json({ tickets: result.rows, count: result.rows.length });
  } catch (error) {
    console.error("❌ Export manager tickets error:", error);
    res
      .status(500)
      .json({ error: "Failed to export tickets", details: error.message });
  }
};

// ====================================
// Get tickets by project (scoped for managers)
// ====================================
export const getTicketsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    if (userRole === "MANAGER") {
      const accessCheck = await pool.query(
        `SELECT 1 FROM project_manager_assignment WHERE project_id = $1 AND manager_id = $2`,
        [projectId, userId],
      );
      if (accessCheck.rows.length === 0)
        return res.status(403).json({ error: "Access denied to this project" });
    }

    const result = await pool.query(
      `SELECT 
        t.ticket_id, t.ticket_name, t.zoho_crm_code, t.description,
        ts.name AS status, t.start_date, t.end_date, t.estimated_date,
        t.estimated_hours, t.approved_hours, t.billable_hours, t.is_active
       FROM ticket_master t
       LEFT JOIN ticket_status ts ON ts.id = t.status
       WHERE t.project_id = $1 AND t.is_active = TRUE
       ORDER BY t.start_date DESC`,
      [projectId],
    );

    res.json({ tickets: result.rows, count: result.rows.length });
  } catch (error) {
    console.error("❌ Get project tickets error:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch tickets", details: error.message });
  }
};

// ============================================================
// HOURS APPROVAL FLOW
// ============================================================

/**
 * GET /tickets/hours-requests
 * Admin: get all hours update requests (with optional status filter)
 * Manager: get only their own requests
 */
export const getHoursUpdateRequests = async (req, res) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const { status } = req.query; // PENDING | APPROVED | REJECTED | all

    let query = `
      SELECT
        h.ticket_hours_update_history_id,
        h.ticket_id,
        t.ticket_name,
        t.zoho_crm_code,
        h.project_id,
        p.project_name,
        h.old_hours,
        h.requested_hours,
        h.status,
        h.requested_at,
        h.action_at,
        h.remarks,
        req.first_name || ' ' || req.last_name AS requested_by_name,
        h.requested_by,
        act.first_name || ' ' || act.last_name AS action_by_name
      FROM ticket_hours_update_history h
      JOIN ticket_master t ON t.ticket_id = h.ticket_id
      JOIN project_master p ON p.project_id = h.project_id
      JOIN employees req ON req.employee_id = h.requested_by
      LEFT JOIN employees act ON act.employee_id = h.action_by
      WHERE 1=1
    `;

    const params = [];

    if (userRole === "MANAGER") {
      params.push(userId);
      query += ` AND h.requested_by = $${params.length}`;
    }

    if (status && status !== "all") {
      params.push(status.toUpperCase());
      query += ` AND h.status = $${params.length}`;
    }

    query += " ORDER BY h.requested_at DESC";

    const result = await pool.query(query, params);
    res.json({ requests: result.rows, count: result.rows.length });
  } catch (error) {
    console.error("❌ Get hours update requests error:", error);
    res
      .status(500)
      .json({
        error: "Failed to fetch hours update requests",
        details: error.message,
      });
  }
};

/**
 * PATCH /tickets/hours-requests/:requestId/approve
 * Admin only — approve a pending hours update request.
 * Updates the ticket's billable_hours (and optionally est/appr from remarks JSON).
 */
export const approveHoursRequest = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { requestId } = req.params;
    const adminId = req.user?.id;
    const { remarks } = req.body; // optional admin remarks

    // Fetch the request
    const reqResult = await client.query(
      `SELECT * FROM ticket_hours_update_history WHERE ticket_hours_update_history_id = $1`,
      [requestId],
    );
    if (reqResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Hours update request not found" });
    }

    const hoursReq = reqResult.rows[0];
    if (hoursReq.status !== "PENDING") {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: `Request is already ${hoursReq.status.toLowerCase()}` });
    }

    // Budget check with the requested amount
    const budget = await checkProjectBudget(
      client,
      hoursReq.project_id,
      hoursReq.requested_hours,
      hoursReq.ticket_id,
    );
    if (!budget.budgetNotSet && !budget.allowed) {
      const remaining = budget.remainingMinutes;
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: `Cannot approve: requested hours exceed project budget. Remaining: ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`,
        remainingMinutes: remaining,
      });
    }

    // Parse extra hours from remarks JSON if present
    let estimatedHoursToSet = null;
    let approvedHoursToSet = null;
    try {
      const extra = JSON.parse(hoursReq.remarks || "{}");
      if (extra.estimatedHours !== undefined)
        estimatedHoursToSet = extra.estimatedHours;
      if (extra.approvedHours !== undefined)
        approvedHoursToSet = extra.approvedHours;
    } catch (_) {
      /* ignore parse errors */
    }

    // Build ticket update
    const ticketUpdates = [`billable_hours = $1`, `updated_at = NOW()`];
    const ticketParams = [hoursReq.requested_hours];

    if (estimatedHoursToSet !== null) {
      ticketParams.push(estimatedHoursToSet);
      ticketUpdates.push(`estimated_hours = $${ticketParams.length}`);
    }
    if (approvedHoursToSet !== null) {
      ticketParams.push(approvedHoursToSet);
      ticketUpdates.push(`approved_hours = $${ticketParams.length}`);
    }
    ticketParams.push(hoursReq.ticket_id);

    await client.query(
      `UPDATE ticket_master SET ${ticketUpdates.join(", ")} WHERE ticket_id = $${ticketParams.length}`,
      ticketParams,
    );

    // Update the request record
    await client.query(
      `UPDATE ticket_hours_update_history
       SET status = 'APPROVED', action_by = $1, action_at = NOW(), remarks = COALESCE($2, remarks)
       WHERE ticket_hours_update_history_id = $3`,
      [adminId, remarks || null, requestId],
    );

    await client.query("COMMIT");

    res.json({
      message: "Hours update request approved. Ticket billable hours updated.",
      requestId,
      updatedBillableHours: hoursReq.requested_hours,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Approve hours request error:", error);
    res
      .status(500)
      .json({ error: "Failed to approve request", details: error.message });
  } finally {
    client.release();
  }
};

/**
 * PATCH /tickets/hours-requests/:requestId/reject
 * Admin only — reject a pending hours update request.
 */
export const rejectHoursRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const adminId = req.user?.id;
    const { remarks } = req.body;

    const reqResult = await pool.query(
      `SELECT * FROM ticket_hours_update_history WHERE ticket_hours_update_history_id = $1`,
      [requestId],
    );
    if (reqResult.rows.length === 0)
      return res.status(404).json({ error: "Request not found" });

    const hoursReq = reqResult.rows[0];
    if (hoursReq.status !== "PENDING")
      return res
        .status(400)
        .json({ error: `Request is already ${hoursReq.status.toLowerCase()}` });

    await pool.query(
      `UPDATE ticket_hours_update_history
       SET status = 'REJECTED', action_by = $1, action_at = NOW(), remarks = $2
       WHERE ticket_hours_update_history_id = $3`,
      [adminId, remarks || null, requestId],
    );

    res.json({ message: "Hours update request rejected.", requestId });
  } catch (error) {
    console.error("❌ Reject hours request error:", error);
    res
      .status(500)
      .json({ error: "Failed to reject request", details: error.message });
  }
};

/**
 * GET /tickets/:id/budget-info
 * Returns the project's budget and current ticket usage for a ticket's project.
 * Used by the frontend to show remaining budget in the form.
 */
export const getProjectBudgetInfo = async (req, res) => {
  try {
    const { id } = req.params; // ticket_id OR project_id (passed as ?type=project)
    const { type } = req.query;

    let projectId = id;

    if (type !== "project") {
      // id is a ticket_id — look up its project
      const ticketRes = await pool.query(
        "SELECT project_id FROM ticket_master WHERE ticket_id = $1",
        [id],
      );
      if (ticketRes.rows.length === 0)
        return res.status(404).json({ error: "Ticket not found" });
      projectId = ticketRes.rows[0].project_id;
    }

    const projectRes = await pool.query(
      "SELECT billable_hours FROM project_master WHERE project_id = $1",
      [projectId],
    );
    if (projectRes.rows.length === 0)
      return res.status(404).json({ error: "Project not found" });

    const projectBudget = parseInt(projectRes.rows[0].billable_hours) || 0;

    const sumRes = await pool.query(
      `SELECT COALESCE(SUM(billable_hours), 0) AS total
       FROM ticket_master
       WHERE project_id = $1 AND is_active = TRUE
       ${type !== "project" ? "AND ticket_id != $2" : ""}`,
      type !== "project" ? [projectId, id] : [projectId],
    );
    const usedMinutes = parseInt(sumRes.rows[0].total) || 0;

    res.json({
      projectId,
      projectBudgetMinutes: projectBudget,
      usedMinutes,
      remainingMinutes: Math.max(0, projectBudget - usedMinutes),
      budgetNotSet: projectBudget === 0,
    });
  } catch (error) {
    console.error("❌ Get project budget info error:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch budget info", details: error.message });
  }
};

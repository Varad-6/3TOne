import pool from "../config/database.js";

/**
 * Get all tickets with optional filters
 */
export const getAllTickets = async (req, res) => {
  try {
    const { projectId, status, isActive = "true" } = req.query;
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
        c.client_code,
        t.description,
        t.status,
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
      -- Join for Security Check (Project Assignment)
      LEFT JOIN project_manager_assignment pma ON p.project_id = pma.project_id AND pma.assignment_end_date IS NULL
      WHERE 1=1
    `;

    const params = [];

    // ✅ SECURITY: Manager Restriction (Project Level)
    if (userRole === "MANAGER") {
      params.push(userId);
      query += ` AND pma.manager_id = $${params.length}`;
    }

    // Filter by is_active
    if (isActive !== "all") {
      params.push(isActive === "true");
      query += ` AND t.is_active = $${params.length}`;
    }

    if (projectId) {
      params.push(projectId);
      query += ` AND t.project_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND t.status = $${params.length}`;
    }

    query += " ORDER BY t.created_at DESC";

    const result = await pool.query(query, params);

    res.json({
      tickets: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Get tickets error:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
};

/**
 * Get ticket by ID
 */
export const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT 
        t.ticket_id,
        t.ticket_name,
        t.zoho_crm_code,
        t.project_id,
        p.project_name,
        c.client_name,
        c.client_code,
        t.description,
        t.status,
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
      WHERE t.ticket_id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get ticket error:", error);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
};

/**
 * Get Tickets by Project (Scoped for Managers)
 */
export const getTicketsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    // Base Query
    let query = `
      SELECT 
        t.ticket_id, 
        t.ticket_name,
        t.zoho_crm_code, 
        t.description, 
        t.status, 
        t.start_date, 
        t.end_date, 
        t.estimated_date, 
        t.estimated_hours,
        t.approved_hours,
        t.billable_hours,
        t.is_active 
      FROM ticket_master t
    `;

    // ✅ MANAGER LOGIC: Join with ticket_manager_scope
    if (userRole === "MANAGER") {
      // 1. Project Access Check
      const accessCheck = await pool.query(
        `SELECT 1 FROM project_manager_assignment 
         WHERE project_id = $1 AND manager_id = $2 AND assignment_end_date IS NULL`,
        [projectId, userId]
      );

      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: "Access denied to this project" });
      }

      // 2. Ticket Visibility Check (Scope Table)
      query += `
        JOIN ticket_manager_scope tms ON t.ticket_id = tms.ticket_id 
        WHERE t.project_id = $1 
          AND t.is_active = TRUE 
          AND tms.manager_id = $2 
          AND tms.is_active = TRUE
      `;

      const result = await pool.query(query + " ORDER BY t.start_date DESC", [
        projectId,
        userId,
      ]);

      return res.json({
        tickets: result.rows,
        count: result.rows.length,
      });
    } else {
      // ✅ ADMIN/OTHER LOGIC: Show all tickets for project
      query += ` WHERE t.project_id = $1 AND t.is_active = TRUE`;

      const result = await pool.query(query + " ORDER BY t.start_date DESC", [
        projectId,
      ]);

      return res.json({
        tickets: result.rows,
        count: result.rows.length,
      });
    }
  } catch (error) {
    console.error("Get project tickets error:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
};

/**
 * Create new ticket
 */
export const createTicket = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      ticketName, // Renamed
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
    } = req.body;

    const userRole = req.user?.role;
    const userId = req.user?.id;

    if (!ticketName || !projectId || !zohoCrmCode) {
      return res.status(400).json({
        error: "ticketName, projectId, and zohoCrmCode are required",
      });
    }

    // Verify project exists and is active
    const projectCheck = await pool.query(
      "SELECT project_id FROM project_master WHERE project_id = $1 AND is_active = TRUE",
      [projectId]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: "Project not found or inactive" });
    }

    // Check if Zoho CRM Code exists
    const zohoCheck = await pool.query(
      "SELECT ticket_id FROM ticket_master WHERE zoho_crm_code = $1",
      [zohoCrmCode]
    );
    if (zohoCheck.rows.length > 0) {
      return res.status(409).json({ error: "Zoho CRM Code already exists" });
    }

    // Check if Ticket Name exists (Optional but recommended)
    const nameCheck = await pool.query(
      "SELECT ticket_id FROM ticket_master WHERE project_id = $1 AND ticket_name = $2",
      [projectId, ticketName]
    );
    if (nameCheck.rows.length > 0) {
      return res.status(409).json({
        error: "Ticket name already exists for this project",
      });
    }

    await client.query("BEGIN");

    const result = await client.query(
      `
      INSERT INTO ticket_master 
        (ticket_name, project_id, zoho_crm_code, description, status, start_date, end_date, estimated_date, 
         estimated_hours, approved_hours, billable_hours, created_by, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE)
      RETURNING *
      `,
      [
        ticketName,
        projectId,
        zohoCrmCode,
        description || null,
        status,
        startDate || null,
        endDate || null,
        estimatedDate || null,
        estimatedHours || 0,
        approvedHours || 0,
        billableHours || 0,
        userId,
      ]
    );

    const newTicketId = result.rows[0].ticket_id;

    // ✅ If creator is MANAGER, Auto-assign Scope so they can see it
    if (userRole === "MANAGER") {
      await client.query(
        `INSERT INTO ticket_manager_scope 
         (ticket_id, manager_id, project_id, assigned_by, assigned_date, is_active)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, TRUE)`,
        [newTicketId, userId, projectId, userId]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: "Ticket created successfully",
      ticket: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create ticket error:", error);
    res.status(500).json({ error: "Failed to create ticket" });
  } finally {
    client.release();
  }
};

/**
 * Update ticket
 */
export const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
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

    const updates = [];
    const params = [];

    if (ticketName !== undefined) {
      params.push(ticketName);
      updates.push(`ticket_name = $${params.length}`);
    }
    if (zohoCrmCode !== undefined) {
      params.push(zohoCrmCode);
      updates.push(`zoho_crm_code = $${params.length}`);
    }
    if (description !== undefined) {
      params.push(description);
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
      params.push(estimatedHours);
      updates.push(`estimated_hours = $${params.length}`);
    }
    if (approvedHours !== undefined) {
      params.push(approvedHours);
      updates.push(`approved_hours = $${params.length}`);
    }
    if (billableHours !== undefined) {
      params.push(billableHours);
      updates.push(`billable_hours = $${params.length}`);
    }
    if (status !== undefined) {
      params.push(status);
      updates.push(`status = $${params.length}`);
    }
    if (isActive !== undefined) {
      params.push(!!isActive);
      updates.push(`is_active = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    params.push(id);

    const query = `
      UPDATE ticket_master
      SET ${updates.join(", ")}, updated_at = NOW()
      WHERE ticket_id = $${params.length}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json({
      message: "Ticket updated successfully",
      ticket: result.rows[0],
    });
  } catch (error) {
    console.error("Update ticket error:", error);
    if (error.code === "23505") {
      return res.status(409).json({ error: "Zoho CRM Code already exists" });
    }
    res.status(500).json({ error: "Failed to update ticket" });
  }
};

/**
 * Delete ticket (soft delete)
 */
export const deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if ticket has timesheet entries
    // Note: We renamed timesheet table to daily_timesheet_entries and column activity_id to ticket_id
    const timesheetCheck = await pool.query(
      "SELECT COUNT(*)::int AS count FROM daily_timesheet_entries WHERE ticket_id = $1",
      [id]
    );

    if (timesheetCheck.rows[0].count > 0) {
      return res.status(400).json({
        error: "Cannot delete ticket that has existing timesheet entries",
      });
    }

    // Soft delete
    const result = await pool.query(
      "UPDATE ticket_master SET is_active = FALSE, updated_at = NOW() WHERE ticket_id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json({
      message: "Ticket deactivated successfully",
      ticket: result.rows[0],
    });
  } catch (error) {
    console.error("Delete ticket error:", error);
    res.status(500).json({ error: "Failed to delete ticket" });
  }
};

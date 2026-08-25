import pool from "../config/database.js";

/**
 * Helper: resolve project_status name/id -> id
 */
async function getProjectStatusId(input) {
  if (input === undefined || input === null) return null;

  // If numeric (or numeric string), treat as id
  if (typeof input === "number" || /^\d+$/.test(String(input))) {
    return Number(input);
  }

  const name = String(input).trim();

  const result = await pool.query(
    "SELECT id FROM project_status WHERE name = $1",
    [name],
  );
  if (result.rows.length === 0) {
    throw new Error(`Project status "${name}" not found`);
  }
  return result.rows[0].id;
}

/**
 * Get all projects (with optional filters)
 * Role-based access: Managers only see assigned projects.
 *
 * NOTE: billable_hours is stored and returned as integer minutes.
 *       The frontend converts minutes → HH:MM for display.
 */
export const getAllProjects = async (req, res) => {
  try {
    const { clientId, status, isActive } = req.query;
    const userRole = req.user?.role; // "ADMIN" / "MANAGER"
    const userId = req.user?.id;

    let result;

    // billable_hours returned as raw minutes (no division)
    const selectClause = `
      SELECT 
        p.project_id,
        p.project_name,
        p.zoho_crm_code,
        p.description,
        p.client_id,
        c.client_name,
        p.start_date,
        p.end_date,
        ps.name AS status,
        p.is_active,
        p.spoc_name,
        p.spoc_email,
        p.spoc_phone,
        p.billable_hours,
        m.first_name AS manager_first_name,
        m.last_name  AS manager_last_name,
        m.employee_id AS manager_id
    `;

    const fromClause = `
      FROM project_master p
      LEFT JOIN client_master c ON p.client_id = c.client_id
      LEFT JOIN project_status ps ON ps.id = p.status
      LEFT JOIN project_manager_assignment pma_active 
        ON p.project_id = pma_active.project_id 
        AND pma_active.assignment_end_date IS NULL
      LEFT JOIN employees m ON pma_active.manager_id = m.employee_id
    `;

    // ADMIN: full visibility, filterable
    if (userRole === "ADMIN") {
      let query = `${selectClause} ${fromClause} WHERE 1=1`;
      const params = [];

      if (clientId) {
        params.push(clientId);
        query += ` AND p.client_id = $${params.length}`;
      }
      if (status) {
        const statusId = await getProjectStatusId(status);
        params.push(statusId);
        query += ` AND p.status = $${params.length}`;
      }
      if (isActive !== undefined) {
        params.push(isActive === "true");
        query += ` AND p.is_active = $${params.length}`;
      }

      query += ` ORDER BY p.created_at DESC`;
      result = await pool.query(query, params);
    }
    // MANAGER: only assigned projects
    else if (userRole === "MANAGER") {
      let query = `${selectClause} ${fromClause} 
        JOIN project_manager_assignment pma_filter 
          ON p.project_id = pma_filter.project_id
        WHERE pma_filter.manager_id = $1 
          AND pma_filter.assignment_end_date IS NULL
      `;

      const params = [userId];

      if (clientId) {
        params.push(clientId);
        query += ` AND p.client_id = $${params.length}`;
      }
      if (status) {
        const statusId = await getProjectStatusId(status);
        params.push(statusId);
        query += ` AND p.status = $${params.length}`;
      }
      if (isActive !== undefined) {
        params.push(isActive === "true");
        query += ` AND p.is_active = $${params.length}`;
      }

      query += `
        GROUP BY 
          p.project_id, 
          p.client_id,
          c.client_name, 
          ps.name,
          m.first_name, 
          m.last_name, 
          m.employee_id
        ORDER BY p.created_at DESC
      `;
      result = await pool.query(query, params);
    } else {
      return res
        .status(403)
        .json({ error: "Role not authorized to list projects" });
    }

    res.json({
      projects: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Get projects error:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
};

/**
 * Get project by ID
 */
export const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    // billable_hours returned as raw minutes (no division)
    let query = `
      SELECT 
        p.project_id,
        p.client_id,
        p.project_name,
        p.zoho_crm_code,
        c.client_name,
        c.client_code,
        p.start_date,
        p.end_date,
        ps.name AS status,
        p.description,
        p.spoc_name,
        p.spoc_email,
        p.spoc_phone,
        p.is_active,
        p.billable_hours,
        p.created_at,
        p.updated_at,
        e.first_name AS manager_first_name,
        e.last_name  AS manager_last_name,
        e.employee_id AS manager_id
      FROM project_master p
      LEFT JOIN client_master c ON p.client_id = c.client_id
      LEFT JOIN project_status ps ON ps.id = p.status
      LEFT JOIN project_manager_assignment pma 
        ON p.project_id = pma.project_id 
        AND pma.assignment_end_date IS NULL
      LEFT JOIN employees e ON pma.manager_id = e.employee_id
      WHERE p.project_id = $1
    `;

    const params = [id];

    // Manager can only see own projects
    if (userRole === "MANAGER") {
      params.push(userId);
      query += ` AND pma.manager_id = $${params.length}`;
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Project not found or access denied" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get project error:", error);
    res.status(500).json({ error: "Failed to fetch project" });
  }
};

/**
 * Create new project
 *
 * Expects billableHours as total minutes (integer) from the frontend.
 * Stored directly in the DB column (which holds minutes).
 */
export const createProject = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      clientId,
      projectName,
      zohoCrmCode,
      startDate,
      endDate,
      status = "Planned",
      billableHours, // received as minutes from frontend
      description,
      spocName,
      spocEmail,
      spocPhone,
      managerId,
    } = req.body;

    if (!clientId || !projectName || !zohoCrmCode) {
      throw new Error("clientId, projectName, and zohoCrmCode are required");
    }

    // Verify client
    const clientCheck = await client.query(
      "SELECT client_id FROM client_master WHERE client_id = $1 AND is_active = TRUE",
      [clientId],
    );
    if (clientCheck.rows.length === 0) {
      res.status(404).json({ error: "Client not found or inactive" });
      await client.query("ROLLBACK");
      return;
    }

    // Check unique Zoho CRM code
    const existingCode = await client.query(
      "SELECT project_id FROM project_master WHERE zoho_crm_code = $1",
      [zohoCrmCode],
    );
    if (existingCode.rows.length > 0) {
      res
        .status(409)
        .json({ error: "Project with this Zoho CRM Code already exists" });
      await client.query("ROLLBACK");
      return;
    }

    // Resolve status -> id
    const statusId = await getProjectStatusId(status);

    // Insert project — billableHours is already in minutes
    const projectResult = await client.query(
      `INSERT INTO project_master 
         (client_id, project_name, zoho_crm_code, start_date, end_date, 
          status, description, spoc_name, spoc_email, spoc_phone, is_active, billable_hours)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, $11)
       RETURNING *`,
      [
        clientId,
        projectName,
        zohoCrmCode,
        startDate || null,
        endDate || null,
        statusId,
        description || null,
        spocName || null,
        spocEmail || null,
        spocPhone || null,
        billableHours != null ? parseInt(billableHours, 10) : null,
      ],
    );

    const newProject = projectResult.rows[0];

    // Manager assignment
    if (managerId) {
      const managerCheck = await client.query(
        `SELECT e.employee_id 
         FROM employees e
         JOIN user_roles ur ON ur.id = e.role
         WHERE e.employee_id = $1 
           AND ur.name = 'MANAGER'
           AND e.is_active = TRUE`,
        [managerId],
      );

      if (managerCheck.rows.length === 0) {
        res.status(400).json({
          error: "Invalid Manager ID. User must be an active MANAGER.",
        });
        await client.query("ROLLBACK");
        return;
      }

      await client.query(
        `INSERT INTO project_manager_assignment 
           (project_id, manager_id, assignment_start_date) 
         VALUES ($1, $2, CURRENT_DATE)`,
        [newProject.project_id, managerId],
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: "Project created successfully",
      project: newProject,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create project error:", error);
    if (error.message.includes("required")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to create project" });
  } finally {
    client.release();
  }
};

/**
 * Update project details
 *
 * Expects billableHours as total minutes (integer) from the frontend.
 * Stored directly — no multiplication needed here.
 */
export const updateProject = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const {
      projectName,
      zohoCrmCode,
      startDate,
      endDate,
      status,
      billableHours, // received as minutes from frontend
      description,
      spocName,
      spocEmail,
      spocPhone,
      isActive,
      managerId,
    } = req.body;

    const updates = [];
    const params = [];

    if (projectName !== undefined) {
      params.push(projectName);
      updates.push(`project_name = $${params.length}`);
    }
    if (zohoCrmCode !== undefined) {
      params.push(zohoCrmCode);
      updates.push(`zoho_crm_code = $${params.length}`);
    }
    if (startDate !== undefined) {
      params.push(startDate);
      updates.push(`start_date = $${params.length}`);
    }
    if (endDate !== undefined) {
      params.push(endDate);
      updates.push(`end_date = $${params.length}`);
    }
    if (status !== undefined) {
      const statusId = await getProjectStatusId(status);
      params.push(statusId);
      updates.push(`status = $${params.length}`);
    }
    if (billableHours !== undefined) {
      // Frontend sends total minutes — store as-is (no conversion)
      params.push(billableHours != null ? parseInt(billableHours, 10) : null);
      updates.push(`billable_hours = $${params.length}`);
    }
    if (description !== undefined) {
      params.push(description);
      updates.push(`description = $${params.length}`);
    }
    if (spocName !== undefined) {
      params.push(spocName);
      updates.push(`spoc_name = $${params.length}`);
    }
    if (spocEmail !== undefined) {
      params.push(spocEmail);
      updates.push(`spoc_email = $${params.length}`);
    }
    if (spocPhone !== undefined) {
      params.push(spocPhone);
      updates.push(`spoc_phone = $${params.length}`);
    }
    if (isActive !== undefined) {
      params.push(!!isActive);
      updates.push(`is_active = $${params.length}`);
    }

    let updatedProject = null;

    if (updates.length > 0) {
      params.push(id);
      const query = `
        UPDATE project_master
        SET ${updates.join(", ")}, updated_at = NOW()
        WHERE project_id = $${params.length}
        RETURNING *
      `;
      const result = await client.query(query, params);
      if (result.rows.length === 0) {
        throw new Error("Project not found");
      }
      updatedProject = result.rows[0];
    }

    // Update manager assignment
    if (managerId !== undefined) {
      const currentAssignment = await client.query(
        `SELECT * FROM project_manager_assignment 
         WHERE project_id = $1 AND assignment_end_date IS NULL`,
        [id],
      );

      const currentManagerId =
        currentAssignment.rows.length > 0
          ? currentAssignment.rows[0].manager_id
          : null;

      if (currentManagerId !== managerId) {
        // Close old assignment
        if (currentManagerId) {
          await client.query(
            `UPDATE project_manager_assignment 
             SET assignment_end_date = CURRENT_DATE, updated_at = NOW() 
             WHERE project_manager_assignment_id = $1`,
            [currentAssignment.rows[0].project_manager_assignment_id],
          );
        }

        // Create new assignment
        if (managerId) {
          const managerCheck = await client.query(
            `SELECT e.employee_id 
             FROM employees e
             JOIN user_roles ur ON ur.id = e.role
             WHERE e.employee_id = $1 
               AND ur.name = 'MANAGER'
               AND e.is_active = TRUE`,
            [managerId],
          );
          if (managerCheck.rows.length === 0) {
            res.status(400).json({ error: "Invalid Manager ID" });
            await client.query("ROLLBACK");
            return;
          }

          await client.query(
            `INSERT INTO project_manager_assignment 
               (project_id, manager_id, assignment_start_date) 
             VALUES ($1, $2, CURRENT_DATE)`,
            [id, managerId],
          );
        }
      }
    }

    await client.query("COMMIT");

    if (!updatedProject) {
      const fetchResult = await pool.query(
        "SELECT * FROM project_master WHERE project_id = $1",
        [id],
      );
      updatedProject = fetchResult.rows[0];
    }

    res.json({
      message: "Project updated successfully",
      project: updatedProject,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update project error:", error);
    if (error.code === "23505") {
      return res.status(409).json({ error: "Zoho CRM Code already in use." });
    }
    const statusCode = error.message === "Project not found" ? 404 : 400;
    res
      .status(statusCode)
      .json({ error: error.message || "Failed to update project" });
  } finally {
    client.release();
  }
};

/**
 * Delete project (soft delete)
 */
export const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE project_master SET is_active = FALSE, updated_at = NOW() WHERE project_id = $1 RETURNING *",
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json({
      message: "Project deactivated successfully",
      project: result.rows[0],
    });
  } catch (error) {
    console.error("Delete project error:", error);
    res.status(500).json({ error: "Failed to delete project" });
  }
};

/**
 * Reactivate Project
 * PATCH /api/projects/:id/reactivate
 */
export const reactivateProject = async (req, res) => {
  try {
    const { id } = req.params;

    const existingProject = await pool.query(
      "SELECT project_id, project_name, is_active FROM project_master WHERE project_id = $1",
      [id],
    );

    if (existingProject.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    const project = existingProject.rows[0];

    if (project.is_active) {
      return res.status(400).json({
        error: "Project is already active",
        project: project,
      });
    }

    const result = await pool.query(
      `UPDATE project_master 
       SET is_active = TRUE, updated_at = NOW() 
       WHERE project_id = $1 
       RETURNING 
         project_id,
         project_name,
         zoho_crm_code,
         client_id,
         start_date,
         end_date,
         status,
         billable_hours,
         is_active`,
      [id],
    );

    console.log(`✅ Project reactivated: ${project.project_name} (${id})`);

    res.json({
      message: "Project reactivated successfully",
      project: result.rows[0],
    });
  } catch (error) {
    console.error("Reactivate project error:", error);
    res.status(500).json({
      error: "Failed to reactivate project",
      details: error.message,
    });
  }
};

// Helper to get projects by client
export const getProjectsByClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const result = await pool.query(
      `SELECT 
         p.*, 
         ps.name AS status
       FROM project_master p
       LEFT JOIN project_status ps ON ps.id = p.status
       WHERE p.client_id = $1
       ORDER BY p.start_date DESC`,
      [clientId],
    );
    res.json({ projects: result.rows, count: result.rows.length });
  } catch (error) {
    console.error("Get projects by client error:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
};

/**
 * Get all data required for the project form dropdowns.
 */
export const getProjectFormData = async (req, res) => {
  try {
    const clientsQuery = `
      SELECT client_id, client_name 
      FROM client_master 
      WHERE is_active = TRUE 
      ORDER BY client_name;
    `;
    const clientsResult = await pool.query(clientsQuery);

    const managersQuery = `
      SELECT 
        e.employee_id, 
        e.first_name || ' ' || e.last_name as manager_name 
      FROM employees e
      JOIN user_roles ur ON ur.id = e.role
      WHERE ur.name = 'MANAGER' 
        AND e.is_active = TRUE 
      ORDER BY e.first_name, e.last_name;
    `;
    const managersResult = await pool.query(managersQuery);

    const statusResult = await pool.query(
      "SELECT id, name FROM project_status ORDER BY id",
    );

    res.json({
      clients: clientsResult.rows,
      managers: managersResult.rows,
      statuses: statusResult.rows,
    });
  } catch (error) {
    console.error("Get project form data error:", error);
    res.status(500).json({ error: "Failed to fetch form data" });
  }
};

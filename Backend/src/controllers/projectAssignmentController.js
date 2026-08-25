import pool from "../config/database.js";

// ===============================================
// STEP 1: ADMIN ASSIGNS PROJECT TO MANAGERS
// Uses project_manager_assignment table
// ===============================================
export const assignProjectToManagers = async (req, res) => {
  try {
    const { projectId, managerIds, assignedBy } = req.body;

    if (!projectId || !managerIds || !Array.isArray(managerIds)) {
      return res.status(400).json({
        error: "projectId and managerIds (array) are required",
      });
    }

    // Check project exists and is active
    const projectCheck = await pool.query(
      "SELECT project_id FROM project_master WHERE project_id = $1 AND is_active = TRUE",
      [projectId]
    );
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: "Project not found or inactive" });
    }

    const assignments = [];

    for (const managerId of managerIds) {
      try {
        // Validate manager role (MANAGER or ADMIN)
        const managerCheck = await pool.query(
          `SELECT e.employee_id
           FROM employees e
           JOIN user_roles ur ON ur.id = e.role
           WHERE e.employee_id = $1
             AND ur.name IN ('MANAGER', 'ADMIN')
             AND e.is_active = TRUE`,
          [managerId]
        );

        if (managerCheck.rows.length === 0) {
          console.error(
            `Manager ${managerId} not found or invalid role, skipping`
          );
          continue;
        }

        // Check existing active assignment
        const existing = await pool.query(
          `SELECT project_manager_assignment_id, assignment_start_date
           FROM project_manager_assignment
           WHERE project_id = $1 
             AND manager_id = $2 
             AND assignment_end_date IS NULL`,
          [projectId, managerId]
        );

        if (existing.rows.length === 0) {
          // Create new assignment
          const result = await pool.query(
            `INSERT INTO project_manager_assignment
               (project_id, manager_id, assignment_start_date)
             VALUES ($1, $2, CURRENT_DATE)
             RETURNING *`,
            [projectId, managerId]
          );
          assignments.push(result.rows[0]);
        } else {
          // Already assigned and active; no-op but return it
          assignments.push(existing.rows[0]);
        }
      } catch (err) {
        console.error(`Failed to assign manager ${managerId}:`, err);
      }
    }

    res.status(201).json({
      message: `Project assigned to ${assignments.length} manager(s). Now assign specific tickets.`,
      assignments,
    });
  } catch (error) {
    console.error("assignProjectToManagers error:", error);
    res.status(500).json({ error: "Failed to assign project" });
  }
};

// ===============================================
// STEP 2: ADMIN ASSIGNS TICKETS TO MANAGER (Scope Definition)
// Uses ticket_manager_scope table
// ===============================================
export const assignTicketsToManager = async (req, res) => {
  try {
    const { projectId, managerId, ticketIds, assignedBy } = req.body;

    if (!projectId || !managerId || !ticketIds || !Array.isArray(ticketIds)) {
      return res.status(400).json({
        error: "projectId, managerId, and ticketIds (array) are required",
      });
    }

    // Verify manager is assigned to this project (active assignment)
    const projectAssignmentCheck = await pool.query(
      `SELECT project_manager_assignment_id 
       FROM project_manager_assignment 
       WHERE project_id = $1 
         AND manager_id = $2 
         AND assignment_end_date IS NULL`,
      [projectId, managerId]
    );
    if (projectAssignmentCheck.rows.length === 0) {
      return res.status(400).json({
        error: "Manager must be assigned to the project first (Step 1)",
      });
    }

    const assignments = [];

    for (const ticketId of ticketIds) {
      try {
        // Verify ticket belongs to this project and is active
        const ticketCheck = await pool.query(
          `SELECT ticket_id 
           FROM ticket_master 
           WHERE ticket_id = $1 
             AND project_id = $2 
             AND is_active = TRUE`,
          [ticketId, projectId]
        );
        if (ticketCheck.rows.length === 0) {
          continue;
        }

        // Manual upsert into ticket_manager_scope
        const existing = await pool.query(
          `SELECT id 
           FROM ticket_manager_scope
           WHERE ticket_id = $1 
             AND manager_id = $2 
             AND project_id = $3`,
          [ticketId, managerId, projectId]
        );

        let result;
        if (existing.rows.length > 0) {
          result = await pool.query(
            `UPDATE ticket_manager_scope
             SET is_active = TRUE,
                 assigned_by = COALESCE($1, assigned_by),
                 assigned_date = CURRENT_DATE,
                 updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [assignedBy || null, existing.rows[0].id]
          );
        } else {
          result = await pool.query(
            `INSERT INTO ticket_manager_scope
               (ticket_id, manager_id, project_id, assigned_by, assigned_date, is_active)
             VALUES ($1, $2, $3, $4, CURRENT_DATE, TRUE)
             RETURNING *`,
            [ticketId, managerId, projectId, assignedBy || null]
          );
        }

        assignments.push(result.rows[0]);
      } catch (err) {
        console.error(`Failed to assign ticket ${ticketId}:`, err);
      }
    }

    res.status(201).json({
      message: `${assignments.length} ticket(s) assigned to manager successfully`,
      assignments,
      count: assignments.length,
    });
  } catch (error) {
    console.error("assignTicketsToManager error:", error);
    res.status(500).json({ error: "Failed to assign tickets" });
  }
};

// ===============================================
// ADMIN: GET ALL ASSIGNMENTS FOR A PROJECT
// Based on project_manager_assignment + ticket_manager_scope
// ===============================================
export const getProjectAssignments = async (req, res) => {
  try {
    const { projectId } = req.params;

    const query = `
      SELECT 
        pma.project_manager_assignment_id AS assignment_id,
        pma.manager_id,
        e.employee_id AS manager_employee_id,
        e.first_name || ' ' || e.last_name AS manager_name,
        e.email AS manager_email,
        d.name AS department,
        pma.assignment_start_date AS assignment_date,
        pma.assignment_end_date,
        (pma.assignment_end_date IS NULL) AS is_active,
        NULL::text AS assigned_by_name,
        COUNT(DISTINCT tms.ticket_id) AS assigned_tickets_count
      FROM project_manager_assignment pma
      JOIN employees e ON pma.manager_id = e.employee_id
      LEFT JOIN departments d ON d.id = e.department
      LEFT JOIN ticket_manager_scope tms 
        ON pma.project_id = tms.project_id 
       AND pma.manager_id = tms.manager_id 
       AND tms.is_active = TRUE
      WHERE pma.project_id = $1
      GROUP BY 
        pma.project_manager_assignment_id, 
        pma.manager_id, 
        e.employee_id, 
        e.first_name, 
        e.last_name, 
        e.email, 
        d.name,
        pma.assignment_start_date, 
        pma.assignment_end_date
      ORDER BY pma.assignment_start_date DESC
    `;

    const result = await pool.query(query, [projectId]);

    res.json({
      assignments: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("getProjectAssignments error:", error);
    res.status(500).json({ error: "Failed to fetch project assignments" });
  }
};

// ===============================================
// ADMIN: REMOVE PROJECT ASSIGNMENT BY ASSIGNMENT ID
// (Set assignment_end_date, does NOT touch ticket scope)
// ===============================================
export const removeProjectAssignment = async (req, res) => {
  try {
    const { id } = req.params; // project_manager_assignment_id

    const result = await pool.query(
      `UPDATE project_manager_assignment
       SET assignment_end_date = CURRENT_DATE, updated_at = NOW()
       WHERE project_manager_assignment_id = $1 
         AND assignment_end_date IS NULL
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    res.json({
      message: "Project assignment removed successfully",
      assignment: result.rows[0],
    });
  } catch (error) {
    console.error("removeProjectAssignment error:", error);
    res.status(500).json({ error: "Failed to remove assignment" });
  }
};

// ===============================================
// REMOVE PROJECT MANAGER ASSIGNMENT (CASCADE TICKET SCOPE)
// ===============================================
export const removeProjectManagerAssignment = async (req, res) => {
  try {
    const { projectId, managerId } = req.params;

    // End active project-manager assignment(s)
    const result = await pool.query(
      `UPDATE project_manager_assignment 
       SET assignment_end_date = CURRENT_DATE, updated_at = NOW()
       WHERE project_id = $1 
         AND manager_id = $2
         AND assignment_end_date IS NULL
       RETURNING *`,
      [projectId, managerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    // Deactivate all ticket scopes for this manager on this project
    await pool.query(
      `UPDATE ticket_manager_scope 
       SET is_active = FALSE, updated_at = NOW()
       WHERE project_id = $1 AND manager_id = $2`,
      [projectId, managerId]
    );

    res.json({
      message: "Assignment removed successfully",
      assignment: result.rows[0],
    });
  } catch (error) {
    console.error("Remove assignment error:", error);
    res.status(500).json({ error: "Failed to remove assignment" });
  }
};

// ===============================================
// REMOVE TICKET FROM MANAGER SCOPE
// ===============================================
export const removeTicketFromManager = async (req, res) => {
  try {
    const { ticketId, managerId } = req.params;

    const result = await pool.query(
      `UPDATE ticket_manager_scope
       SET is_active = FALSE, updated_at = NOW()
       WHERE ticket_id = $1 AND manager_id = $2
       RETURNING *`,
      [ticketId, managerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Ticket assignment not found" });
    }

    res.json({
      message: "Ticket removed from manager successfully",
      assignment: result.rows[0],
    });
  } catch (error) {
    console.error("removeTicketFromManager error:", error);
    res.status(500).json({ error: "Failed to remove ticket" });
  }
};

// ===============================================
// GET ALL ASSIGNMENTS WITH TICKETS (For overview)
// ===============================================
export const getAllAssignmentsWithTickets = async (req, res) => {
  try {
    const query = `
      SELECT 
        pma.project_id,
        pma.manager_id,
        p.project_name,
        e.first_name || ' ' || e.last_name AS manager_name,
        pma.assignment_start_date AS assignment_date,
        COUNT(DISTINCT tms.ticket_id) AS assigned_tickets,
        (
          SELECT COUNT(*) 
          FROM ticket_master tm 
          WHERE tm.project_id = pma.project_id 
            AND tm.is_active = TRUE
        ) AS total_tickets
      FROM project_manager_assignment pma
      JOIN project_master p ON pma.project_id = p.project_id
      JOIN employees e ON pma.manager_id = e.employee_id
      LEFT JOIN ticket_manager_scope tms 
        ON pma.project_id = tms.project_id 
       AND pma.manager_id = tms.manager_id 
       AND tms.is_active = TRUE
      WHERE pma.assignment_end_date IS NULL
        AND p.is_active = TRUE
      GROUP BY 
        pma.project_id, 
        pma.manager_id, 
        p.project_name, 
        e.first_name, 
        e.last_name, 
        pma.assignment_start_date
      ORDER BY pma.assignment_start_date DESC
    `;

    const result = await pool.query(query);

    res.json({
      assignments: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("getAllAssignmentsWithTickets error:", error);
    res.status(500).json({ error: "Failed to fetch assignments" });
  }
};

// ===============================================
// Manager helpers
// ===============================================

// Manager: Get assigned projects (summary)
export const getManagerProjects = async (req, res) => {
  try {
    const { managerId } = req.params;
    const managerUuid = managerId;

    const query = `
      SELECT 
        p.project_id,
        p.project_name,
        p.description,
        ps.name AS status,
        p.start_date,
        p.end_date,
        c.client_name,
        c.client_code,
        pma.assignment_start_date AS assignment_date,
        pma.assignment_end_date,
        COUNT(DISTINCT tms.ticket_id) AS assigned_tickets,
        COUNT(DISTINCT tea.employee_id) AS total_assigned_employees
      FROM project_manager_assignment pma
      JOIN project_master p ON pma.project_id = p.project_id
      LEFT JOIN project_status ps ON ps.id = p.status
      LEFT JOIN client_master c ON p.client_id = c.client_id
      LEFT JOIN ticket_manager_scope tms 
        ON p.project_id = tms.project_id 
       AND pma.manager_id = tms.manager_id 
       AND tms.is_active = TRUE
      LEFT JOIN ticket_assignments tea 
        ON tms.ticket_id = tea.ticket_id 
       AND tea.is_active = TRUE
      WHERE pma.manager_id = $1 
        AND pma.assignment_end_date IS NULL
        AND p.is_active = TRUE
      GROUP BY 
        p.project_id, p.project_name, p.description, ps.name, 
        p.start_date, p.end_date, 
        c.client_name, c.client_code, 
        pma.assignment_start_date, pma.assignment_end_date
      ORDER BY pma.assignment_start_date DESC
    `;

    const result = await pool.query(query, [managerUuid]);

    res.json({
      projects: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("getManagerProjects error:", error);
    res.status(500).json({ error: "Failed to fetch manager projects" });
  }
};

// Get projects with assigned tickets for manager
export const getManagerProjectsWithTickets = async (req, res) => {
  try {
    const { managerId } = req.params;
    if (!managerId) {
      return res.status(400).json({ error: "Manager ID is required" });
    }
    const managerUuid = managerId;

    // Projects assigned to this manager
    const projectsResult = await pool.query(
      `SELECT 
         p.project_id,
         p.project_name,
         p.client_id,
         c.client_name,
         c.client_code,
         p.start_date,
         p.end_date,
         ps.name AS status,
         p.description,
         pma.assignment_start_date AS assignment_date,
         p.created_at,
         p.updated_at
       FROM project_master p
       JOIN project_manager_assignment pma ON p.project_id = pma.project_id
       LEFT JOIN client_master c ON p.client_id = c.client_id
       LEFT JOIN project_status ps ON ps.id = p.status
       WHERE pma.manager_id = $1
         AND pma.assignment_end_date IS NULL
         AND p.is_active = TRUE
       ORDER BY p.start_date DESC`,
      [managerUuid]
    );

    const projects = projectsResult.rows;
    if (projects.length === 0) {
      return res.json({
        projects: [],
        count: 0,
        message: "No projects assigned to this manager",
      });
    }
    const projectIds = projects.map((p) => p.project_id);

    // Tickets in manager scope
    const ticketsResult = await pool.query(
      `SELECT DISTINCT 
         t.ticket_id,
         t.project_id,
         t.ticket_name,
         t.zoho_crm_code,
         t.description,
         ts.name AS status,
         t.start_date,
         t.end_date,
         tms.assigned_date,
         tms.id AS scope_id
       FROM ticket_master t
       INNER JOIN ticket_manager_scope tms ON t.ticket_id = tms.ticket_id
       LEFT JOIN ticket_status ts ON ts.id = t.status
       WHERE t.project_id = ANY($1) 
         AND tms.manager_id = $2
         AND t.is_active = TRUE
         AND tms.is_active = TRUE
       ORDER BY t.start_date DESC`,
      [projectIds, managerUuid]
    );

    const ticketsByProject = {};
    ticketsResult.rows.forEach((t) => {
      if (!ticketsByProject[t.project_id]) {
        ticketsByProject[t.project_id] = [];
      }
      ticketsByProject[t.project_id].push(t);
    });

    const projectsWithTickets = projects.map((p) => ({
      ...p,
      tickets: ticketsByProject[p.project_id] || [],
      total_assigned_tickets: (ticketsByProject[p.project_id] || []).length,
    }));

    res.json({
      projects: projectsWithTickets,
      count: projectsWithTickets.length,
    });
  } catch (error) {
    console.error("Get manager projects with tickets error:", error);
    res.status(500).json({ error: "Failed to fetch projects for manager" });
  }
};

// ===============================================
// GET MANAGER'S TICKETS FOR A SPECIFIC PROJECT
// ===============================================
export const getManagerTicketsForProject = async (req, res) => {
  try {
    const { projectId, managerId } = req.params;

    const result = await pool.query(
      `SELECT 
         tms.id AS scope_id,
         tms.ticket_id,
         t.ticket_name,
         t.zoho_crm_code,
         t.description,
         ts.name AS status,
         t.start_date,
         t.end_date,
         tms.assigned_date,
         tms.is_active,
         COUNT(DISTINCT tea.employee_id) as assigned_employees_count
       FROM ticket_manager_scope tms
       JOIN ticket_master t ON tms.ticket_id = t.ticket_id
       LEFT JOIN ticket_status ts ON ts.id = t.status
       LEFT JOIN ticket_assignments tea 
         ON t.ticket_id = tea.ticket_id 
        AND tea.is_active = TRUE
       WHERE tms.project_id = $1 
         AND tms.manager_id = $2
         AND tms.is_active = TRUE
         AND t.is_active = TRUE
       GROUP BY 
         tms.id, tms.ticket_id, 
         t.ticket_name, t.zoho_crm_code, t.description, ts.name,
         t.start_date, t.end_date, tms.assigned_date, tms.is_active
       ORDER BY t.ticket_name ASC`,
      [projectId, managerId]
    );

    res.json({
      tickets: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("getManagerTicketsForProject error:", error);
    res.status(500).json({ error: "Failed to fetch manager tickets" });
  }
};

// ===============================================
// EMPLOYEE: GET ASSIGNED PROJECTS
// ===============================================
export const getEmployeeProjects = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employeeUuid = employeeId;

    const query = `
      SELECT DISTINCT
        p.project_id,
        p.project_name,
        p.description,
        ps.name AS status,
        c.client_name,
        c.client_code,
        COUNT(DISTINCT tea.ticket_id) AS assigned_tickets_count
      FROM ticket_assignments tea
      JOIN ticket_master tm ON tea.ticket_id = tm.ticket_id
      JOIN project_master p ON tea.project_id = p.project_id
      LEFT JOIN project_status ps ON ps.id = p.status
      LEFT JOIN client_master c ON p.client_id = c.client_id
      WHERE tea.employee_id = $1
        AND tea.is_active = TRUE
        AND tm.is_active = TRUE
        AND p.is_active = TRUE
      GROUP BY 
        p.project_id, p.project_name, p.description, ps.name, 
        c.client_name, c.client_code
      ORDER BY p.project_name ASC
    `;
    const result = await pool.query(query, [employeeUuid]);

    res.json({
      projects: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("getEmployeeProjects error:", error);
    res.status(500).json({ error: "Failed to fetch employee projects" });
  }
};

export default {
  assignProjectToManagers,
  assignTicketsToManager,
  getProjectAssignments,
  removeProjectAssignment,
  removeProjectManagerAssignment,
  removeTicketFromManager,
  getAllAssignmentsWithTickets,
  getManagerProjects,
  getManagerProjectsWithTickets,
  getManagerTicketsForProject,
  getEmployeeProjects,
};

import pool from "../config/database.js";
import { v4 as uuidv4 } from "uuid";

// ===============================================
// GET ALL ACTIVE PROJECTS (For selection)
// ===============================================
export const getAllActiveProjects = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         p.project_id, 
         p.project_name, 
         p.description, 
         p.start_date, 
         p.end_date, 
         ps.name AS status
       FROM project_master p
       LEFT JOIN project_status ps ON ps.id = p.status
       WHERE p.is_active = TRUE 
       ORDER BY p.project_name`
    );
    res.json({ projects: result.rows });
  } catch (error) {
    console.error("getAllActiveProjects error:", error);
    res.status(500).json({ error: "Failed to fetch active projects" });
  }
};

// ===============================================
// GET TICKETS FOR A PROJECT (Active only)
// ===============================================
export const getTicketsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await pool.query(
      `SELECT 
         t.ticket_id, 
         t.ticket_name, 
         t.zoho_crm_code, 
         t.description, 
         ts.name AS status, 
         t.start_date, 
         t.end_date 
       FROM ticket_master t
       LEFT JOIN ticket_status ts ON ts.id = t.status
       WHERE t.project_id = $1 AND t.is_active = TRUE 
       ORDER BY t.ticket_name`,
      [projectId]
    );
    res.json({ tickets: result.rows });
  } catch (error) {
    console.error("getTicketsByProject error:", error);
    res.status(500).json({ error: "Failed to fetch tickets for project" });
  }
};

// ===============================================
// ASSIGN PROJECT + TICKETS TO MANAGERS (Define Scope)
// Uses ticket_manager_scope
// ===============================================
export const assignProjectsToManagers = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { projectIds, managerIds, assignedBy } = req.body;

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return res.status(400).json({ error: "projectIds array required" });
    }

    if (!managerIds || !Array.isArray(managerIds) || managerIds.length === 0) {
      return res.status(400).json({ error: "managerIds array required" });
    }

    const assignments = [];

    for (const projectId of projectIds) {
      const projectCheck = await client.query(
        "SELECT project_id FROM project_master WHERE project_id = $1 AND is_active = TRUE",
        [projectId]
      );

      if (projectCheck.rows.length === 0) {
        console.warn(`Project ${projectId} not found or inactive, skipping`);
        continue;
      }

      for (const managerId of managerIds) {
        try {
          // Manager must be MANAGER or ADMIN (via user_roles)
          const managerCheck = await client.query(
            `SELECT e.employee_id 
             FROM employees e
             JOIN user_roles ur ON ur.id = e.role
             WHERE e.employee_id = $1 
               AND ur.name IN ('MANAGER', 'ADMIN')
               AND e.is_active = TRUE`,
            [managerId]
          );

          if (managerCheck.rows.length === 0) {
            console.warn(
              `Manager ${managerId} not found or invalid role, skipping`
            );
            continue;
          }

          // Fetch all active tickets for this project
          const tickets = await client.query(
            `SELECT ticket_id 
             FROM ticket_master 
             WHERE project_id = $1 AND is_active = TRUE`,
            [projectId]
          );

          if (tickets.rows.length === 0) {
            console.warn(`No tickets found for project ${projectId}`);
            continue;
          }

          // Insert/activate scope for each ticket
          for (const ticket of tickets.rows) {
            const ticketId = ticket.ticket_id;

            const existing = await client.query(
              `SELECT id 
               FROM ticket_manager_scope
               WHERE project_id = $1 
                 AND ticket_id = $2 
                 AND manager_id = $3`,
              [projectId, ticketId, managerId]
            );

            if (existing.rows.length > 0) {
              const updated = await client.query(
                `UPDATE ticket_manager_scope
                 SET is_active = TRUE,
                     assigned_by = COALESCE($1, assigned_by),
                     assigned_date = CURRENT_DATE,
                     updated_at = NOW()
                 WHERE id = $2
                 RETURNING *`,
                [assignedBy || null, existing.rows[0].id]
              );
              assignments.push(updated.rows[0]);
            } else {
              const id = uuidv4();
              const inserted = await client.query(
                `INSERT INTO ticket_manager_scope 
                   (id, project_id, ticket_id, manager_id, assigned_by, assigned_date, is_active)
                 VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, TRUE)
                 RETURNING *`,
                [id, projectId, ticketId, managerId, assignedBy || null]
              );
              assignments.push(inserted.rows[0]);
            }
          }

          // NOTE: employee_manager_assignments was dropped in the new schema;
          // reporting hierarchy is not updated here anymore. [file:1]
        } catch (err) {
          console.error(
            `Failed to assign project ${projectId} to manager ${managerId}:`,
            err
          );
        }
      }
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: `Successfully assigned ${assignments.length} tickets (scope) to managers`,
      assignments,
      summary: {
        projectsProcessed: projectIds.length,
        managersProcessed: managerIds.length,
        totalAssignments: assignments.length,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("assignProjectsToManagers error:", error);
    res.status(500).json({
      error: "Failed to assign projects",
      details: error.message,
    });
  } finally {
    client.release();
  }
};

// ===============================================
// ASSIGN SPECIFIC TICKETS TO MANAGER
// ===============================================
export const assignTicketsToManager = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { projectId, managerId, ticketIds, assignedBy } = req.body;

    if (
      !projectId ||
      !managerId ||
      !Array.isArray(ticketIds) ||
      ticketIds.length === 0
    ) {
      return res.status(400).json({
        error: "projectId, managerId, and ticketIds (array) required",
      });
    }

    const projectCheck = await client.query(
      "SELECT project_id FROM project_master WHERE project_id = $1 AND is_active = TRUE",
      [projectId]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: "Project not found or inactive" });
    }

    const managerCheck = await client.query(
      `SELECT e.employee_id 
       FROM employees e
       JOIN user_roles ur ON ur.id = e.role
       WHERE e.employee_id = $1 
         AND ur.name IN ('MANAGER', 'ADMIN')
         AND e.is_active = TRUE`,
      [managerId]
    );

    if (managerCheck.rows.length === 0) {
      return res.status(404).json({ error: "Manager not found or invalid" });
    }

    // Validate tickets belong to project and are active
    const validTickets = await client.query(
      `SELECT ticket_id 
       FROM ticket_master 
       WHERE ticket_id = ANY($1::uuid[]) 
         AND project_id = $2 
         AND is_active = TRUE`,
      [ticketIds, projectId]
    );

    if (validTickets.rows.length === 0) {
      return res
        .status(400)
        .json({ error: "No valid tickets found for this project" });
    }

    const assignments = [];

    for (const ticket of validTickets.rows) {
      const ticketId = ticket.ticket_id;

      const existing = await client.query(
        `SELECT id 
         FROM ticket_manager_scope 
         WHERE project_id = $1 
           AND ticket_id = $2 
           AND manager_id = $3`,
        [projectId, ticketId, managerId]
      );

      if (existing.rows.length > 0) {
        const updated = await client.query(
          `UPDATE ticket_manager_scope 
           SET is_active = TRUE,
               assigned_by = COALESCE($1, assigned_by),
               assigned_date = CURRENT_DATE,
               updated_at = NOW()
           WHERE id = $2
           RETURNING *`,
          [assignedBy || null, existing.rows[0].id]
        );
        assignments.push(updated.rows[0]);
      } else {
        const id = uuidv4();
        const inserted = await client.query(
          `INSERT INTO ticket_manager_scope 
             (id, project_id, ticket_id, manager_id, assigned_by, assigned_date, is_active)
           VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, TRUE)
           RETURNING *`,
          [id, projectId, ticketId, managerId, assignedBy || null]
        );
        assignments.push(inserted.rows[0]);
      }
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: `${assignments.length} ticket(s) assigned to manager successfully`,
      assignments,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("assignTicketsToManager error:", error);
    res.status(500).json({
      error: "Failed to assign tickets",
      details: error.message,
    });
  } finally {
    client.release();
  }
};

// ===============================================
// GET ALL ASSIGNMENTS WITH TICKET COUNTS
// ===============================================
export const getAllAssignmentsWithTickets = async (req, res) => {
  try {
    const { includeInactive } = req.query;

    const query = `
      SELECT 
        tms.project_id,
        tms.manager_id,
        p.project_name,
        c.client_name,
        e.first_name || ' ' || e.last_name as manager_name,
        e.employee_id as manager_emp_id,
        MIN(tms.assigned_date) as assignment_date,
        BOOL_AND(tms.is_active) as is_active,
        COUNT(DISTINCT tms.ticket_id) as assigned_tickets,
        (
          SELECT COUNT(*) 
          FROM ticket_master tm 
          WHERE tm.project_id = tms.project_id 
            AND tm.is_active = TRUE
        ) as total_tickets
      FROM ticket_manager_scope tms
      JOIN project_master p ON tms.project_id = p.project_id
      LEFT JOIN client_master c ON p.client_id = c.client_id
      JOIN employees e ON tms.manager_id = e.employee_id
      ${includeInactive !== "true" ? "WHERE tms.is_active = TRUE" : ""}
      GROUP BY 
        tms.project_id, 
        tms.manager_id,
        p.project_name,
        c.client_name,
        e.first_name,
        e.last_name,
        e.employee_id
      ORDER BY assignment_date DESC, p.project_name, manager_name
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
// SOFT DELETE (UNASSIGN) PROJECT-MANAGER ASSIGNMENT
// ===============================================
export const removeProjectManagerAssignment = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { projectId, managerId } = req.params;

    const result = await client.query(
      `UPDATE ticket_manager_scope 
       SET is_active = FALSE, updated_at = NOW() 
       WHERE project_id = $1 AND manager_id = $2 
       RETURNING *`,
      [projectId, managerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    await client.query("COMMIT");

    res.json({
      message: "Manager unassigned from project successfully (Scope Removed)",
      unassignedCount: result.rows.length,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("removeProjectManagerAssignment error:", error);
    res.status(500).json({ error: "Failed to unassign manager" });
  } finally {
    client.release();
  }
};

// ===============================================
// HARD DELETE PROJECT-MANAGER ASSIGNMENT
// ===============================================
export const deleteProjectManagerAssignment = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { assignmentId } = req.params;

    const [projectId, managerId] = assignmentId.split("-");

    if (!projectId || !managerId) {
      return res.status(400).json({
        error: "Invalid assignmentId format. Expected: projectId-managerId",
      });
    }

    const result = await client.query(
      `DELETE FROM ticket_manager_scope 
       WHERE project_id = $1 AND manager_id = $2 
       RETURNING *`,
      [projectId, managerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    await client.query("COMMIT");

    res.json({
      message: "Assignment deleted permanently",
      deletedCount: result.rows.length,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("deleteProjectManagerAssignment error:", error);
    res.status(500).json({ error: "Failed to delete assignment" });
  } finally {
    client.release();
  }
};

// ===============================================
// GET MANAGER'S ASSIGNED PROJECTS AND TICKETS
// ===============================================
export const getManagerAssignments = async (req, res) => {
  try {
    const { managerId } = req.params;

    const result = await pool.query(
      `SELECT 
         tms.project_id,
         p.project_name,
         p.description as project_description,
         ps.name as project_status,
         c.client_name,
         JSON_AGG(
           JSON_BUILD_OBJECT(
             'ticket_id', tms.ticket_id,
             'ticket_name', tm.ticket_name,
             'zoho_crm_code', tm.zoho_crm_code,
             'status', ts.name,
             'description', tm.description
           ) ORDER BY tm.ticket_name
         ) AS tickets,
         MIN(tms.assigned_date) as assignment_date
       FROM ticket_manager_scope tms
       JOIN project_master p ON tms.project_id = p.project_id
       LEFT JOIN client_master c ON p.client_id = c.client_id
       JOIN ticket_master tm ON tms.ticket_id = tm.ticket_id
       LEFT JOIN project_status ps ON ps.id = p.status
       LEFT JOIN ticket_status ts ON ts.id = tm.status
       WHERE tms.manager_id = $1 
         AND tms.is_active = TRUE
         AND p.is_active = TRUE
         AND tm.is_active = TRUE
       GROUP BY 
         tms.project_id,
         p.project_name,
         p.description,
         ps.name,
         c.client_name
       ORDER BY assignment_date DESC, p.project_name`,
      [managerId]
    );

    res.json({
      assignments: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("getManagerAssignments error:", error);
    res.status(500).json({ error: "Failed to fetch manager assignments" });
  }
};

export default {
  getAllActiveProjects,
  getTicketsByProject,
  assignProjectsToManagers,
  assignTicketsToManager,
  getAllAssignmentsWithTickets,
  removeProjectManagerAssignment,
  deleteProjectManagerAssignment,
  getManagerAssignments,
};

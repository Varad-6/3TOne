import pool from "../../config/database.js";

// ===============================================
// ✅ UPDATED: GET ASSIGNED PROJECTS
// Manager now sees projects from BOTH:
// 1. project_manager_assignment (traditional)
// 2. ticket_manager_scope (new flexible assignments)
// ===============================================
export const getAssignedProjectsForTimesheet = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ error: "User ID required" });
    }

    let query;
    let params = [];

    // MANAGER: projects via project_manager_assignment OR ticket_manager_scope
    // ADMIN:   all active projects
    // EMPLOYEE: projects where they have at least one active ticket_assignments row
    if (userRole === "MANAGER") {
      query = `
        SELECT DISTINCT 
          p.project_id,
          p.project_name,
          p.client_id,
          c.client_name
        FROM project_master p
        LEFT JOIN client_master c ON p.client_id = c.client_id
        WHERE p.is_active = TRUE
          AND p.project_id IN (
            -- Get projects from project_manager_assignment
            SELECT DISTINCT project_id 
            FROM project_manager_assignment 
            WHERE manager_id = $1
            
            UNION
            
            -- Get projects from ticket_manager_scope
            SELECT DISTINCT project_id 
            FROM ticket_manager_scope 
            WHERE manager_id = $1 AND is_active = TRUE
          )
        ORDER BY p.project_name ASC
      `;
      params = [userId];
    } else if (userRole === "ADMIN") {
      query = `
        SELECT DISTINCT 
          p.project_id,
          p.project_name,
          p.client_id,
          c.client_name
        FROM project_master p
        LEFT JOIN client_master c ON p.client_id = c.client_id
        WHERE p.is_active = TRUE
        ORDER BY p.project_name ASC
      `;
      params = [];
    } else {
      // EMPLOYEE
      query = `
        SELECT DISTINCT 
          p.project_id,
          p.project_name,
          p.client_id,
          c.client_name
        FROM project_master p
        JOIN ticket_assignments ta ON p.project_id = ta.project_id
        LEFT JOIN client_master c ON p.client_id = c.client_id
        WHERE ta.employee_id = $1
          AND ta.is_active   = TRUE
          AND p.is_active    = TRUE
        ORDER BY p.project_name ASC
      `;
      params = [userId];
    }

    const result = await pool.query(query, params);

    // -------------------------------------------------
    // APPEND DEFAULT PROJECT: AIS Internal Billing
    // -------------------------------------------------
    const defaultProjectResult = await pool.query(`
  SELECT 
    p.project_id,
    p.project_name,
    p.client_id,
    c.client_name
  FROM project_master p
  LEFT JOIN client_master c ON p.client_id = c.client_id
  WHERE p.zoho_crm_code = 'AIS-INTERNAL-PROJECT'
    AND p.is_active = TRUE
  LIMIT 1
`);

    let projects = result.rows;

    if (
      defaultProjectResult.rows.length > 0 &&
      !projects.some(
        (p) => p.project_id === defaultProjectResult.rows[0].project_id,
      )
    ) {
      projects = [defaultProjectResult.rows[0], ...projects];
    }

    res.json({
      projects,
      count: projects.length,
    });
  } catch (error) {
    console.error("Get projects error:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
};

// ===============================================
// GET ASSIGNED TICKETS (per project, for dropdown)
// ✅ FIXED: Use entryDate instead of CURRENT_DATE for expiration checks
// ===============================================

export const getAssignedTicketsForTimesheet = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { projectId } = req.params;
    const { entryDate } = req.query; // ✅ FIXED: Extract entryDate from query params
    if (!userId || !projectId) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    if (!entryDate) {
      return res.status(400).json({ error: "entryDate is required" });
    }
    // -------------------------------------------------
    // SPECIAL CASE: AIS Internal Billing (GLOBAL TICKET)
    // -------------------------------------------------
    const projectCodeResult = await pool.query(
      `SELECT zoho_crm_code FROM project_master WHERE project_id = $1`,
      [projectId],
    );

    if (
      projectCodeResult.rows.length &&
      projectCodeResult.rows[0].zoho_crm_code === "AIS-INTERNAL-PROJECT"
    ) {
      const defaultTicketResult = await pool.query(
        `
    SELECT
      t.ticket_id,
      t.ticket_name,
      t.description,
      t.status,
      t.zoho_crm_code,
      t.start_date,
      t.end_date
    FROM ticket_master t
    WHERE t.project_id = $1
      AND t.zoho_crm_code = 'AIS_Internal_Billing_Ticket'
      AND t.is_active = TRUE
    `,
        [projectId],
      );

      return res.json({
        tickets: defaultTicketResult.rows,
        count: defaultTicketResult.rows.length,
      });
    }

    let query;
    let params = [projectId];

    // MANAGER: tickets defined in ticket_manager_scope for this manager & project
    // ADMIN:   all active tickets in project
    // EMPLOYEE: tickets in ticket_assignments for this employee & project
    if (userRole === "MANAGER") {
      query = `
        SELECT 
          t.ticket_id,
          t.ticket_name,
          t.description,
          t.status,
          t.zoho_crm_code,
          t.start_date,
          t.end_date
        FROM ticket_master t
        JOIN ticket_manager_scope tms ON t.ticket_id = tms.ticket_id
        WHERE t.project_id   = $1
          AND t.is_active    = TRUE
          AND tms.manager_id = $2
          AND tms.is_active  = TRUE
          AND (
            -- ✅ FIXED: Include tickets within valid date range (start_date <= entryDate <= end_date)
            (
(t.start_date IS NULL OR t.start_date <= $3::DATE)
AND
(t.end_date IS NULL OR t.end_date >= $3::DATE)

            )
            OR
            -- Include tickets outside date range that have existing timesheet entries for this manager
            EXISTS (
              SELECT 1 
              FROM daily_timesheet_entries dte
              WHERE dte.ticket_id = t.ticket_id
                AND dte.employee_id = $2
                AND dte.ticket_manager_assign_id = tms.id
            )
          )
        ORDER BY 
CASE 
  WHEN (t.start_date IS NULL OR t.start_date <= $3::DATE)
   AND (t.end_date IS NULL OR t.end_date >= $3::DATE)
  THEN 0 
  ELSE 1 
END,

          t.ticket_name ASC
      `;
      params = [projectId, userId, entryDate];
    } else if (userRole === "ADMIN") {
      // ADMIN sees all active tickets regardless of end_date (no expiration filter)
      query = `
        SELECT 
          t.ticket_id,
          t.ticket_name,
          t.description,
          t.status,
          t.zoho_crm_code,
          t.start_date,
          t.end_date
        FROM ticket_master t
        WHERE t.project_id = $1
          AND t.is_active  = TRUE
        ORDER BY t.ticket_name ASC
      `;
    } else {
      // EMPLOYEE
      query = `
        SELECT 
          t.ticket_id,
          t.ticket_name,
          t.description,
          t.status,
          t.zoho_crm_code,
          t.start_date,
          t.end_date
        FROM ticket_master t
        JOIN ticket_assignments ta ON t.ticket_id = ta.ticket_id
        WHERE t.project_id   = $1
          AND ta.employee_id = $2
          AND ta.is_active   = TRUE
          AND t.is_active    = TRUE
          AND (
            -- ✅ FIXED: Include tickets within valid date range (start_date <= entryDate <= end_date)
            (
(t.start_date IS NULL OR t.start_date <= $3::DATE)
AND
(t.end_date IS NULL OR t.end_date >= $3::DATE)

            )
            OR
            -- Include tickets outside date range that have existing timesheet entries for this employee
            EXISTS (
              SELECT 1 
              FROM daily_timesheet_entries dte
              WHERE dte.ticket_id = t.ticket_id
                AND dte.employee_id = $2
                AND dte.ticket_assign_id = ta.ticket_assignments_id
            )
          )
        ORDER BY 
CASE 
  WHEN (t.start_date IS NULL OR t.start_date <= $3::DATE)
   AND (t.end_date IS NULL OR t.end_date >= $3::DATE)
  THEN 0 
  ELSE 1 
END,

          t.ticket_name ASC
      `;
      params = [projectId, userId, entryDate];
    }

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
// ===============================================
// GET USER'S DETAILED TICKETS (My Tickets)
// ✅ UPDATED: Show all tickets (active + expired with entries)
// ===============================================
export const getEmployeeAssignedTickets = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let query;
    let params = [userId];

    if (userRole === "MANAGER") {
      // ✅ MANAGER query - uses ticket_manager_assign_id
      query = `
        SELECT 
          tms.id                           AS assignment_id,
          t.is_active                      AS ticket_is_active,
          t.start_date                      AS ticket_start_date,
          t.end_date                       AS ticket_end_date,
          CASE 
            WHEN t.end_date < CURRENT_DATE THEN TRUE 
            ELSE FALSE 
          END                              AS is_expired,
          c.client_name,
          p.project_name,
          p.zoho_crm_code                  AS project_code,
          t.ticket_name,
          t.zoho_crm_code                  AS ticket_code,
          t.description                    AS description,
          tms.assign_start_date            AS assign_start_date,
          tms.assign_end_date              AS assign_end_date,
          COALESCE(tms.billable_hours, 0)  AS budget_minutes,
          COALESCE((
            SELECT SUM(d.total_hours)
            FROM daily_timesheet_entries d
            WHERE d.ticket_manager_assign_id = tms.id
          ), 0) AS used_minutes,
          COALESCE((
            SELECT COUNT(*)
            FROM daily_timesheet_entries d
            WHERE d.ticket_manager_assign_id = tms.id
          ), 0) AS entry_count
        FROM ticket_manager_scope tms
        JOIN ticket_master  t ON tms.ticket_id  = t.ticket_id
        JOIN project_master p ON t.project_id   = p.project_id
        LEFT JOIN client_master c ON p.client_id = c.client_id
        WHERE tms.manager_id = $1
          AND tms.is_active  = TRUE
        ORDER BY 
          t.is_active DESC,
          CASE WHEN t.end_date >= CURRENT_DATE THEN 0 ELSE 1 END,
          c.client_name, 
          p.project_name, 
          t.ticket_name
      `;
    } else {
      // ✅ EMPLOYEE query - uses ticket_assign_id
      query = `
        SELECT 
          ta.ticket_assignments_id           AS assignment_id,
          t.is_active                        AS ticket_is_active,
          t.start_date                        AS ticket_start_date,
          t.end_date                         AS ticket_end_date,
          CASE 
            WHEN t.end_date < CURRENT_DATE THEN TRUE 
            ELSE FALSE 
          END                                AS is_expired,
          c.client_name,
          p.project_name,
          p.zoho_crm_code                    AS project_code,
          t.ticket_name,
          t.zoho_crm_code                    AS ticket_code,
          t.description                      AS description,
          ta.assign_start_date               AS assign_start_date,
          ta.assign_end_date                 AS assign_end_date,
          COALESCE(ta.billable_hours, 0)     AS budget_minutes,
          COALESCE((
            SELECT SUM(d.total_hours)
            FROM daily_timesheet_entries d
            WHERE d.ticket_assign_id = ta.ticket_assignments_id
          ), 0) AS used_minutes,
          COALESCE((
            SELECT COUNT(*)
            FROM daily_timesheet_entries d
            WHERE d.ticket_assign_id = ta.ticket_assignments_id
          ), 0) AS entry_count
        FROM ticket_assignments ta
        JOIN project_master p  ON ta.project_id = p.project_id
        LEFT JOIN client_master c ON p.client_id = c.client_id
        JOIN ticket_master t   ON ta.ticket_id = t.ticket_id
        WHERE ta.employee_id = $1
          AND ta.is_active   = TRUE
          AND p.is_active    = TRUE
        ORDER BY 
          t.is_active DESC,
          CASE WHEN t.end_date >= CURRENT_DATE THEN 0 ELSE 1 END,
          c.client_name, 
          p.project_name, 
          t.ticket_name
      `;
    }

    const result = await pool.query(query, params);
    res.json({ tickets: result.rows });
  } catch (error) {
    console.error("Get assigned tickets error:", error);
    res.status(500).json({ error: "Failed to fetch assigned tickets" });
  }
};

// ===============================================
// GET ALL DEPARTMENTS (Now from departments table)
// ===============================================
export const getAllDepartments = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name FROM departments ORDER BY name ASC`,
    );
    // return array of { id, name } so frontend can use id (preferred)
    res.json({
      departments: result.rows, // [{id:1, name:'DELIVERY'}, ...]
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Get departments error:", error);
    res.status(500).json({ error: "Failed to fetch departments" });
  }
};

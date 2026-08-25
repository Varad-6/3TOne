import pool from "../config/database.js";

// ========================================
// HELPER FUNCTION - Convert Status Name to ID
// ========================================
async function getTimesheetStatusId(statusName) {
  const result = await pool.query(
    "SELECT id FROM timesheet_status WHERE name = $1",
    [statusName]
  );
  if (result.rows.length === 0) {
    throw new Error(`Timesheet status "${statusName}" not found`);
  }
  return result.rows[0].id;
}

// ========================================
// EMPLOYEE DASHBOARD
// ========================================

export const getEmployeeDashboard = async (req, res) => {
  try {
    const employeeId = req.user.id;

    const today = new Date();
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    // Get status IDs
    const submittedId = await getTimesheetStatusId("Submitted");
    const managerApprovedId = await getTimesheetStatusId("Manager_Approved");
    const adminApprovedId = await getTimesheetStatusId("Admin_Approved");
    const managerRejectedId = await getTimesheetStatusId("Manager_Rejected");
    const adminRejectedId = await getTimesheetStatusId("Admin_Rejected");

    // 1. Weekly Hours
    const weekHours = await pool.query(
      `SELECT COALESCE(SUM(total_hours) / 60.0, 0) as total_hours
       FROM daily_timesheet_entries 
       WHERE employee_id = $1 
         AND entry_date >= $2 
         AND entry_date <= $3`,
      [employeeId, weekStartStr, weekEndStr]
    );

    // 2. Pending Count
    const pending = await pool.query(
      `SELECT COUNT(DISTINCT week_start_date) as count 
       FROM daily_timesheet_entries 
       WHERE employee_id = $1 
         AND status = $2`,
      [employeeId, submittedId]
    );

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split("T")[0];

    // 3. Approved Count
    const approved = await pool.query(
      `SELECT COUNT(DISTINCT week_start_date) as count 
       FROM daily_timesheet_entries 
       WHERE employee_id = $1 
         AND status IN ($2, $3) 
         AND entry_date >= $4`,
      [employeeId, managerApprovedId, adminApprovedId, monthStartStr]
    );

    // 4. Rejected Count
    const rejected = await pool.query(
      `SELECT COUNT(DISTINCT week_start_date) as count 
       FROM daily_timesheet_entries 
       WHERE employee_id = $1 
         AND status IN ($2, $3) 
         AND entry_date >= $4`,
      [employeeId, managerRejectedId, adminRejectedId, monthStartStr]
    );

    res.json({
      weeklyHours: parseFloat(weekHours.rows[0].total_hours),
      pendingTimesheets: parseInt(pending.rows[0].count),
      approvedTimesheets: parseInt(approved.rows[0].count),
      rejectedTimesheets: parseInt(rejected.rows[0].count),
    });
  } catch (error) {
    console.error("Get employee dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
};

// ========================================
// MANAGER DASHBOARD
// ========================================

export const getManagerDashboard = async (req, res) => {
  try {
    const managerId = req.user.id;

    const submittedId = await getTimesheetStatusId("Submitted");

    // 1. Team Count (Active Employees in Projects managed by this user)
    const teamCount = await pool.query(
      `SELECT COUNT(DISTINCT employee_id) as count 
       FROM daily_timesheet_entries 
       WHERE manager_id = $1`,
      [managerId]
    );

    // 2. Pending Approvals
    const pending = await pool.query(
      `SELECT COUNT(DISTINCT CONCAT(employee_id, '_', week_start_date)) as count 
       FROM daily_timesheet_entries 
       WHERE manager_id = $1 
         AND status = $2`,
      [managerId, submittedId]
    );

    const today = new Date();
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    // 3. Weekly Hours (Team Total)
    const weekHours = await pool.query(
      `SELECT COALESCE(SUM(total_hours)/60.0, 0) as total_hours 
       FROM daily_timesheet_entries 
       WHERE manager_id = $1 
         AND entry_date >= $2 
         AND entry_date <= $3`,
      [managerId, weekStartStr, weekEndStr]
    );

    res.json({
      teamMembers: parseInt(teamCount.rows[0].count),
      pendingApprovals: parseInt(pending.rows[0].count),
      weeklyHours: parseFloat(weekHours.rows[0].total_hours),
    });
  } catch (error) {
    console.error("Get manager dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
};

// ========================================
// MANAGER - GET TIMESHEETS
// ========================================

export const getPendingTimesheets = async (req, res) => {
  try {
    const { status } = req.query;
    const managerId = req.user?.id;
    const userRole = req.user?.role;

    // Convert status name to ID if provided
    let statusId = null;
    if (status) {
      try {
        // Check if it's already a number
        if (!isNaN(Number(status))) {
          statusId = Number(status);
        } else {
          // It's a string name, convert to ID
          statusId = await getTimesheetStatusId(status);
        }
      } catch (error) {
        console.error("Status conversion error:", error);
        return res.status(400).json({ 
          error: `Invalid status: ${status}` 
        });
      }
    }

    let query;
    let params;

    const baseQuery = `
      SELECT 
        te.entry_id,
        te.employee_id,
        e.first_name || ' ' || e.last_name as employee_name,
        e.department,
        e.designation,
        te.manager_id,
        m.first_name || ' ' || m.last_name as manager_name,
        te.entry_date,
        te.week_start_date,
        te.week_end_date,
        te.project_id,
        p.project_name,
        te.client_id,
        c.client_name,
        te.ticket_id, 
        t.ticket_name,
        t.zoho_crm_code,
        te.total_hours as hours_logged,
        te.description,
        te.status,
        ts.name as status_name,
        te.created_at,
        te.updated_at
      FROM daily_timesheet_entries te
      LEFT JOIN employees e ON te.employee_id = e.employee_id
      LEFT JOIN employees m ON te.manager_id = m.employee_id
      LEFT JOIN project_master p ON te.project_id = p.project_id
      LEFT JOIN client_master c ON te.client_id = c.client_id
      LEFT JOIN ticket_master t ON te.ticket_id = t.ticket_id
      LEFT JOIN timesheet_status ts ON te.status = ts.id
    `;

    if (userRole === "MANAGER") {
      // Default to "Submitted" if no status provided
      const defaultStatusId = statusId || await getTimesheetStatusId("Submitted");
      
      query = `
        ${baseQuery}
        WHERE te.manager_id = $1 
          AND te.status = $2
        ORDER BY te.week_start_date DESC, te.entry_date DESC
      `;
      params = [managerId, defaultStatusId];
    } else if (userRole === "ADMIN") {
      // Default to "Manager_Approved" if no status provided
      const defaultStatusId = statusId || await getTimesheetStatusId("Manager_Approved");
      
      query = `
        ${baseQuery}
        WHERE te.status = $1
        ORDER BY te.week_start_date DESC, te.entry_date DESC
      `;
      params = [defaultStatusId];
    } else {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    const result = await pool.query(query, params);

    res.json({
      timesheets: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Get timesheets error:", error);
    res.status(500).json({
      error: "Failed to fetch timesheets",
      details: error.message,
    });
  }
};

export const getTimesheetEntries = async (req, res) => {
  try {
    const { timesheetId } = req.params;
    const managerId = req.user.id;

    const [employeeId, weekStartDate] = timesheetId.split("_");

    const result = await pool.query(
      `SELECT 
        te.entry_id,
        te.entry_date,
        c.client_name,
        p.project_name,
        t.ticket_name,
        t.zoho_crm_code,
        te.total_hours as hours_logged,
        te.description
      FROM daily_timesheet_entries te
      LEFT JOIN client_master c ON te.client_id = c.client_id
      LEFT JOIN project_master p ON te.project_id = p.project_id
      LEFT JOIN ticket_master t ON te.ticket_id = t.ticket_id
      WHERE te.employee_id = $1 
        AND te.week_start_date = $2 
        AND te.manager_id = $3
      ORDER BY te.entry_date ASC`,
      [employeeId, weekStartDate, managerId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get timesheet entries error:", error);
    res.status(500).json({ error: "Failed to fetch timesheet entries" });
  }
};

// ========================================
// APPROVE/REJECT TIMESHEETS
// ========================================

export const approveTimesheet = async (req, res) => {
  try {
    const { timesheetId } = req.params;
    const managerId = req.user.id;

    const [employeeId, weekStartDate] = timesheetId.split("_");

    const submittedId = await getTimesheetStatusId("Submitted");
    const managerApprovedId = await getTimesheetStatusId("Manager_Approved");

    const check = await pool.query(
      `SELECT entry_id FROM daily_timesheet_entries 
       WHERE employee_id = $1 
         AND week_start_date = $2 
         AND manager_id = $3 
         AND status = $4
       LIMIT 1`,
      [employeeId, weekStartDate, managerId, submittedId]
    );

    if (check.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Timesheet not found or already processed" });
    }

    await pool.query(
      `UPDATE daily_timesheet_entries 
       SET status = $1, 
           updated_at = NOW() 
       WHERE employee_id = $2
       AND week_start_date = $3
       AND manager_id = $4
       AND status = $5`,
      [managerApprovedId, employeeId, weekStartDate, managerId, submittedId]
    );

    res.json({ message: "Timesheet approved successfully" });
  } catch (error) {
    console.error("Approve timesheet error:", error);
    res.status(500).json({ error: "Failed to approve timesheet" });
  }
};

export const rejectTimesheet = async (req, res) => {
  try {
    const { timesheetId } = req.params;
    const managerId = req.user.id;
    const { comment } = req.body;

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const [employeeId, weekStartDate] = timesheetId.split("_");

    const submittedId = await getTimesheetStatusId("Submitted");
    const managerRejectedId = await getTimesheetStatusId("Manager_Rejected");

    const check = await pool.query(
      `SELECT entry_id FROM daily_timesheet_entries 
       WHERE employee_id = $1 
         AND week_start_date = $2 
         AND manager_id = $3 
         AND status = $4
       LIMIT 1`,
      [employeeId, weekStartDate, managerId, submittedId]
    );

    if (check.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Timesheet not found or already processed" });
    }

    await pool.query(
      `UPDATE daily_timesheet_entries 
       SET status = $1, 
           updated_at = NOW() 
       WHERE employee_id = $2
       AND week_start_date = $3
       AND manager_id = $4
       AND status = $5`,
      [managerRejectedId, employeeId, weekStartDate, managerId, submittedId]
    );

    res.json({ message: "Timesheet rejected successfully" });
  } catch (error) {
    console.error("Reject timesheet error:", error);
    res.status(500).json({ error: "Failed to reject timesheet" });
  }
};

// ========================================
// ADMIN DASHBOARD
// ========================================

export const getAdminDashboard = async (req, res) => {
  try {
    const empCount = await pool.query(
      `SELECT COUNT(*) as count FROM employees WHERE is_active = TRUE`
    );

    const projCount = await pool.query(
      `SELECT COUNT(*) as count FROM project_master WHERE is_active = TRUE`
    );

    const submittedId = await getTimesheetStatusId("Submitted");

    const pending = await pool.query(
      `SELECT COUNT(DISTINCT CONCAT(employee_id::text, '_', week_start_date)) as count 
       FROM daily_timesheet_entries 
       WHERE status = $1`,
      [submittedId]
    );

    const monthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    );
    const monthStartStr = monthStart.toISOString().split("T")[0];

    const monthHours = await pool.query(
      `SELECT COALESCE(SUM(total_hours), 0) as total_hours 
       FROM daily_timesheet_entries 
       WHERE entry_date >= $1`,
      [monthStartStr]
    );

    res.json({
      totalEmployees: parseInt(empCount.rows[0].count),
      totalProjects: parseInt(projCount.rows[0].count),
      pendingApprovals: parseInt(pending.rows[0].count),
      monthlyHours: parseFloat(monthHours.rows[0].total_hours),
    });
  } catch (error) {
    console.error("Get admin dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
};

// ========================================
// TIMESHEET HISTORY
// ========================================

export const getTimesheetHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    console.log("Get timesheet history - Status filter:", status);

    let statusId = null;
    
    // Convert status name to ID if provided
    if (status && status !== 'all') {
      try {
        // Check if it's already a number
        if (!isNaN(Number(status))) {
          statusId = Number(status);
        } else {
          // It's a string name, convert to ID
          statusId = await getTimesheetStatusId(status);
        }
        console.log("Converted status to ID:", statusId);
      } catch (error) {
        console.error("Status conversion error:", error);
        return res.status(400).json({ 
          error: `Invalid status: ${status}` 
        });
      }
    }

    let query = `
      SELECT 
        te.*,
        ts.name as status_name,
        e.first_name || ' ' || e.last_name as employee_name
      FROM daily_timesheet_entries te
      JOIN employees e ON te.employee_id = e.employee_id
      JOIN timesheet_status ts ON te.status = ts.id
      WHERE te.employee_id = $1
    `;

    const params = [userId];

    // Add status filter if provided
    if (statusId !== null) {
      query += " AND te.status = $2";
      params.push(statusId);
    }

    query += " ORDER BY te.created_at DESC LIMIT 50";

    const result = await pool.query(query, params);

    res.json({
      timesheets: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Get timesheet history error:", error);
    res.status(500).json({ error: "Failed to fetch timesheet history" });
  }
};

// ========================================
// MANAGER STATS
// ========================================

export const getTeamMembersCount = async (req, res) => {
  try {
    const managerId = req.user.id;

    const result = await pool.query(
      `SELECT COUNT(DISTINCT employee_id) as count 
       FROM daily_timesheet_entries 
       WHERE manager_id = $1`,
      [managerId]
    );

    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error("Get team members count error:", error);
    res.status(500).json({ error: "Failed to fetch team count" });
  }
};

export const getPendingApprovalsCount = async (req, res) => {
  try {
    const managerId = req.user.id;
    const submittedId = await getTimesheetStatusId("Submitted");

    const result = await pool.query(
      `SELECT COUNT(DISTINCT CONCAT(employee_id::text, '_', week_start_date)) as count 
       FROM daily_timesheet_entries 
       WHERE manager_id = $1 
         AND status = $2`,
      [managerId, submittedId]
    );

    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error("Get pending approvals count error:", error);
    res.status(500).json({ error: "Failed to fetch pending count" });
  }
};

export const getApprovedThisWeekCount = async (req, res) => {
  try {
    const managerId = req.user.id;
    const managerApprovedId = await getTimesheetStatusId("Manager_Approved");

    const today = new Date();
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    const result = await pool.query(
      `SELECT COUNT(DISTINCT CONCAT(employee_id::text, '_', week_start_date)) as count 
       FROM daily_timesheet_entries 
       WHERE manager_id = $1 
         AND status = $2
         AND updated_at >= $3
         AND updated_at <= $4`,
      [managerId, managerApprovedId, weekStartStr, weekEndStr + " 23:59:59"]
    );

    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error("Get approved this week count error:", error);
    res.status(500).json({ error: "Failed to fetch approved count" });
  }
};

export const getTeamHoursThisWeek = async (req, res) => {
  try {
    const managerId = req.user.id;

    const today = new Date();
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    const result = await pool.query(
      `SELECT COALESCE(SUM(total_hours), 0) as total_hours 
       FROM daily_timesheet_entries 
       WHERE manager_id = $1 
         AND entry_date >= $2 
         AND entry_date <= $3`,
      [managerId, weekStartStr, weekEndStr]
    );

    res.json({ totalHours: parseFloat(result.rows[0].total_hours) });
  } catch (error) {
    console.error("Get team hours this week error:", error);
    res.status(500).json({ error: "Failed to fetch team hours" });
  }
};

export const getTeamSubmissionProgress = async (req, res) => {
  try {
    const managerId = req.user.id;

    const submittedId = await getTimesheetStatusId("Submitted");
    const managerApprovedId = await getTimesheetStatusId("Manager_Approved");
    const adminApprovedId = await getTimesheetStatusId("Admin_Approved");

    const result = await pool.query(
      `SELECT 
        e.employee_id as id, 
        CONCAT(e.first_name, ' ', e.last_name) as name,
        COALESCE(COUNT(DISTINCT te.week_start_date), 0) as submitted,
        4 as total,
        ROUND((COALESCE(COUNT(DISTINCT te.week_start_date), 0)::numeric / 4) * 100, 0)::integer as percentage
      FROM daily_timesheet_entries te
      JOIN employees e ON te.employee_id = e.employee_id
      WHERE te.manager_id = $1 
        AND te.status IN ($2, $3, $4)
        AND te.week_start_date >= DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY e.employee_id, e.first_name, e.last_name
      ORDER BY e.first_name, e.last_name`,
      [managerId, submittedId, managerApprovedId, adminApprovedId]
    );

    res.json({ progress: result.rows });
  } catch (error) {
    console.error("Get team submission progress error:", error);
    res.status(500).json({ error: "Failed to fetch team progress" });
  }
};
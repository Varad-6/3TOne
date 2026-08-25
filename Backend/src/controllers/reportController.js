import pool from "../config/database.js";

// Admin overview report
export const getAdminOverview = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    // Validation
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "Start date and end date are required" });
    }

    // Total hours by department
    const departmentHours = await pool.query(
      `SELECT
        e.department,
        SUM(te.hours) as total_hours,
        COUNT(DISTINCT e.employee_id) as employee_count,
        AVG(te.hours) as avg_hours
      FROM timesheet_entries te
      JOIN timesheets t ON te.timesheet_id = t.timesheet_id
      JOIN employees e ON t.employee_id = e.employee_id
      WHERE te.entry_date BETWEEN $1 AND $2
      GROUP BY e.department
      ORDER BY total_hours DESC`,
      [startDate, endDate]
    );

    // Total hours by project
    const projectHours = await pool.query(
      `SELECT
        p.project_name,
        c.client_name,
        SUM(te.hours) as total_hours,
        COUNT(DISTINCT t.employee_id) as employee_count
      FROM timesheet_entries te
      JOIN timesheets t ON te.timesheet_id = t.timesheet_id
      LEFT JOIN projects p ON te.project_id = p.project_id
      LEFT JOIN clients c ON te.client_id = c.client_id
      WHERE te.entry_date BETWEEN $1 AND $2
      GROUP BY p.project_name, c.client_name
      ORDER BY total_hours DESC
      LIMIT 10`,
      [startDate, endDate]
    );

    // Monthly trends
    const monthlyTrends = await pool.query(
      `SELECT
        TO_CHAR(te.entry_date, 'YYYY-MM') as month,
        SUM(te.hours) as total_hours,
        COUNT(DISTINCT t.employee_id) as active_employees,
        COUNT(DISTINCT te.timesheet_id) as timesheets_submitted
      FROM timesheet_entries te
      JOIN timesheets t ON te.timesheet_id = t.timesheet_id
      WHERE te.entry_date BETWEEN $1 AND $2
      GROUP BY TO_CHAR(te.entry_date, 'YYYY-MM')
      ORDER BY month ASC`,
      [startDate, endDate]
    );

    // Timesheet status summary
    const statusSummary = await pool.query(
      `SELECT
        status,
        COUNT(*) as count,
        SUM(total_hours) as total_hours
      FROM timesheets
      WHERE week_start_date BETWEEN $1 AND $2
      GROUP BY status`,
      [startDate, endDate]
    );

    // Top performers
    const topPerformers = await pool.query(
      `SELECT
        e.employee_id,
        e.first_name || ' ' || e.last_name as employee_name,
        e.department,
        SUM(te.hours) as total_hours,
        COUNT(DISTINCT t.timesheet_id) as timesheets_count
      FROM timesheet_entries te
      JOIN timesheets t ON te.timesheet_id = t.timesheet_id
      JOIN employees e ON t.employee_id = e.employee_id
      WHERE te.entry_date BETWEEN $1 AND $2
      AND t.status = 'APPROVED'
      GROUP BY e.employee_id, e.first_name, e.last_name, e.department
      ORDER BY total_hours DESC
      LIMIT 10`,
      [startDate, endDate]
    );

    // Activity breakdown
    const activityBreakdown = await pool.query(
      `SELECT
        a.activity_name,
        SUM(te.hours) as total_hours,
        COUNT(DISTINCT t.employee_id) as employee_count
      FROM timesheet_entries te
      JOIN timesheets t ON te.timesheet_id = t.timesheet_id
      LEFT JOIN activities a ON te.activity_id = a.activity_id
      WHERE te.entry_date BETWEEN $1 AND $2
      GROUP BY a.activity_name
      ORDER BY total_hours DESC`,
      [startDate, endDate]
    );

    res.json({
      departmentHours: departmentHours.rows,
      projectHours: projectHours.rows,
      monthlyTrends: monthlyTrends.rows,
      statusSummary: statusSummary.rows,
      topPerformers: topPerformers.rows,
      activityBreakdown: activityBreakdown.rows,
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    res.status(500).json({ error: "Failed to fetch overview data" });
  }
};

// Manager team report
export const getTeamReport = async (req, res) => {
  try {
    const { employeeId } = req.user;
    const { startDate, endDate } = req.query;

    // Validation
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "Start date and end date are required" });
    }

    // Get team members' timesheet data
    const teamData = await pool.query(
      `SELECT
        e.employee_id,
        e.first_name || ' ' || e.last_name as employee_name,
        e.department,
        e.designation,
        COUNT(DISTINCT t.timesheet_id) as total_timesheets,
        SUM(CASE WHEN t.status = 'APPROVED' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN t.status = 'SUBMITTED' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN t.status = 'REJECTED' THEN 1 ELSE 0 END) as rejected_count,
        COALESCE(SUM(te.hours), 0) as total_hours,
        COALESCE(AVG(te.hours), 0) as avg_daily_hours
      FROM employees e
      LEFT JOIN timesheets t ON e.employee_id = t.employee_id
      AND t.week_start_date BETWEEN $2 AND $3
      LEFT JOIN timesheet_entries te ON t.timesheet_id = te.timesheet_id
      WHERE e.reporting_manager_id = $1 AND e.is_active = TRUE
      GROUP BY e.employee_id, e.first_name, e.last_name, e.department, e.designation
      ORDER BY total_hours DESC`,
      [employeeId, startDate, endDate]
    );

    // Project distribution
    const projectDistribution = await pool.query(
      `SELECT
        p.project_name,
        c.client_name,
        SUM(te.hours) as total_hours,
        COUNT(DISTINCT t.employee_id) as team_members
      FROM timesheet_entries te
      JOIN timesheets t ON te.timesheet_id = t.timesheet_id
      LEFT JOIN projects p ON te.project_id = p.project_id
      LEFT JOIN clients c ON te.client_id = c.client_id
      JOIN employees e ON t.employee_id = e.employee_id
      WHERE e.reporting_manager_id = $1
      AND te.entry_date BETWEEN $2 AND $3
      GROUP BY p.project_name, c.client_name
      ORDER BY total_hours DESC`,
      [employeeId, startDate, endDate]
    );

    // Weekly trends
    const weeklyTrends = await pool.query(
      `SELECT
        t.week_start_date,
        t.week_end_date,
        SUM(te.hours) as total_hours,
        COUNT(DISTINCT t.employee_id) as active_members
      FROM timesheets t
      JOIN timesheet_entries te ON t.timesheet_id = te.timesheet_id
      JOIN employees e ON t.employee_id = e.employee_id
      WHERE e.reporting_manager_id = $1
      AND t.week_start_date BETWEEN $2 AND $3
      GROUP BY t.week_start_date, t.week_end_date
      ORDER BY t.week_start_date ASC`,
      [employeeId, startDate, endDate]
    );

    // Pending approvals
    const pendingApprovals = await pool.query(
      `SELECT
        t.timesheet_id,
        e.employee_id,
        e.first_name || ' ' || e.last_name as employee_name,
        t.week_start_date,
        t.week_end_date,
        t.total_hours,
        t.submitted_at
      FROM timesheets t
      JOIN employees e ON t.employee_id = e.employee_id
      WHERE e.reporting_manager_id = $1
      AND t.status = 'SUBMITTED'
      AND t.week_start_date BETWEEN $2 AND $3
      ORDER BY t.submitted_at ASC`,
      [employeeId, startDate, endDate]
    );

    res.json({
      teamData: teamData.rows,
      projectDistribution: projectDistribution.rows,
      weeklyTrends: weeklyTrends.rows,
      pendingApprovals: pendingApprovals.rows,
    });
  } catch (error) {
    console.error("Team report error:", error);
    res.status(500).json({ error: "Failed to fetch team report" });
  }
};

// Employee summary report
export const getEmployeeSummary = async (req, res) => {
  try {
    const { employeeId } = req.user;
    const { startDate, endDate } = req.query;

    // Validation
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "Start date and end date are required" });
    }

    // Total hours by project
    const projectHours = await pool.query(
      `SELECT
        p.project_name,
        c.client_name,
        SUM(te.hours) as total_hours,
        COUNT(DISTINCT te.entry_date) as days_worked,
        AVG(te.hours) as avg_daily_hours
      FROM timesheet_entries te
      JOIN timesheets t ON te.timesheet_id = t.timesheet_id
      LEFT JOIN projects p ON te.project_id = p.project_id
      LEFT JOIN clients c ON te.client_id = c.client_id
      WHERE t.employee_id = $1
      AND te.entry_date BETWEEN $2 AND $3
      GROUP BY p.project_name, c.client_name
      ORDER BY total_hours DESC`,
      [employeeId, startDate, endDate]
    );

    // Daily hours
    const dailyHours = await pool.query(
      `SELECT
        te.entry_date,
        SUM(te.hours) as total_hours,
        COUNT(*) as entry_count
      FROM timesheet_entries te
      JOIN timesheets t ON te.timesheet_id = t.timesheet_id
      WHERE t.employee_id = $1
      AND te.entry_date BETWEEN $2 AND $3
      GROUP BY te.entry_date
      ORDER BY te.entry_date ASC`,
      [employeeId, startDate, endDate]
    );

    // Timesheet status
    const timesheetStatus = await pool.query(
      `SELECT
        status,
        COUNT(*) as count,
        SUM(total_hours) as total_hours
      FROM timesheets
      WHERE employee_id = $1
      AND week_start_date BETWEEN $2 AND $3
      GROUP BY status`,
      [employeeId, startDate, endDate]
    );

    // Activity breakdown
    const activityBreakdown = await pool.query(
      `SELECT
        a.activity_name,
        SUM(te.hours) as total_hours,
        COUNT(*) as entry_count
      FROM timesheet_entries te
      JOIN timesheets t ON te.timesheet_id = t.timesheet_id
      LEFT JOIN activities a ON te.activity_id = a.activity_id
      WHERE t.employee_id = $1
      AND te.entry_date BETWEEN $2 AND $3
      GROUP BY a.activity_name
      ORDER BY total_hours DESC`,
      [employeeId, startDate, endDate]
    );

    // Summary statistics
    const summary = await pool.query(
      `SELECT
        COUNT(DISTINCT t.timesheet_id) as total_timesheets,
        SUM(te.hours) as total_hours,
        AVG(te.hours) as avg_hours,
        COUNT(DISTINCT te.entry_date) as days_worked
      FROM timesheet_entries te
      JOIN timesheets t ON te.timesheet_id = t.timesheet_id
      WHERE t.employee_id = $1
      AND te.entry_date BETWEEN $2 AND $3`,
      [employeeId, startDate, endDate]
    );

    res.json({
      projectHours: projectHours.rows,
      dailyHours: dailyHours.rows,
      timesheetStatus: timesheetStatus.rows,
      activityBreakdown: activityBreakdown.rows,
      summary: summary.rows[0],
    });
  } catch (error) {
    console.error("Employee summary error:", error);
    res.status(500).json({ error: "Failed to fetch employee summary" });
  }
};

// Export report (returns data for CSV/Excel export)
export const exportReport = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;
    const { role, employeeId } = req.user;

    if (!type || !startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "Type, start date, and end date are required" });
    }

    let query;
    let params;

    switch (type) {
      case "timesheet":
        query = `
          SELECT
            t.timesheet_id,
            t.employee_id,
            e.first_name || ' ' || e.last_name as employee_name,
            e.department,
            e.designation,
            t.week_start_date,
            t.week_end_date,
            t.status,
            t.total_hours,
            t.submitted_at,
            t.approved_at,
            m.first_name || ' ' || m.last_name as approver_name,
            t.comments
          FROM timesheets t
          JOIN employees e ON t.employee_id = e.employee_id
          LEFT JOIN employees m ON t.approved_by = m.employee_id
          WHERE t.week_start_date BETWEEN $1 AND $2
        `;
        params = [startDate, endDate];
        if (role === "MANAGER") {
          query += ` AND e.reporting_manager_id = $3`;
          params.push(employeeId);
        } else if (role === "EMPLOYEE") {
          query += ` AND t.employee_id = $3`;
          params.push(employeeId);
        }
        query += ` ORDER BY t.week_start_date DESC, e.employee_id`;
        break;

      case "detailed":
        query = `
          SELECT
            te.timesheet_entry_id,
            te.timesheet_id,
            t.employee_id,
            e.first_name || ' ' || e.last_name as employee_name,
            te.entry_date,
            p.project_name,
            c.client_name,
            a.activity_name,
            te.hours,
            te.comments
          FROM timesheet_entries te
          JOIN timesheets t ON te.timesheet_id = t.timesheet_id
          JOIN employees e ON t.employee_id = e.employee_id
          LEFT JOIN projects p ON te.project_id = p.project_id
          LEFT JOIN clients c ON te.client_id = c.client_id
          LEFT JOIN activities a ON te.activity_id = a.activity_id
          WHERE te.entry_date BETWEEN $1 AND $2
        `;
        params = [startDate, endDate];
        if (role === "MANAGER") {
          query += ` AND e.reporting_manager_id = $3`;
          params.push(employeeId);
        } else if (role === "EMPLOYEE") {
          query += ` AND t.employee_id = $3`;
          params.push(employeeId);
        }
        query += ` ORDER BY te.entry_date DESC, t.employee_id`;
        break;

      case "summary":
        query = `
          SELECT
            e.employee_id,
            e.first_name || ' ' || e.last_name as employee_name,
            e.department,
            SUM(te.hours) as total_hours,
            COUNT(DISTINCT te.entry_date) as days_worked
          FROM timesheet_entries te
          JOIN timesheets t ON te.timesheet_id = t.timesheet_id
          JOIN employees e ON t.employee_id = e.employee_id
          WHERE te.entry_date BETWEEN $1 AND $2
        `;
        params = [startDate, endDate];
        if (role === "MANAGER") {
          query += ` AND e.reporting_manager_id = $3`;
          params.push(employeeId);
        } else if (role === "EMPLOYEE") {
          query += ` AND t.employee_id = $3`;
          params.push(employeeId);
        }
        query += ` GROUP BY e.employee_id, e.first_name, e.last_name, e.department ORDER BY total_hours DESC`;
        break;

      default:
        return res
          .status(400)
          .json({
            error: "Invalid report type. Use: timesheet, detailed, summary",
          });
    }

    const result = await pool.query(query, params);

    res.json({
      reportType: type,
      startDate,
      endDate,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Export report error:", error);
    res.status(500).json({ error: "Failed to export report" });
  }
};

// Utilization report
export const getUtilizationReport = async (req, res) => {
  try {
    const { startDate, endDate, department, designation } = req.query;
    const { role, employeeId } = req.user;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "Start date and end date are required" });
    }

    let filters = [];
    let params = [startDate, endDate];
    let paramIndex = 3;

    if (role === "EMPLOYEE") {
      filters.push(`e.employee_id = $${paramIndex++}`);
      params.push(employeeId);
    }

    if (department) {
      filters.push(`e.department = $${paramIndex++}`);
      params.push(department);
    }

    if (designation) {
      filters.push(`e.designation = $${paramIndex++}`);
      params.push(designation);
    }

    const filterQuery =
      filters.length > 0 ? ` AND ${filters.join(" AND ")}` : "";

    const utilizationQuery = `
      SELECT
        e.employee_id,
        e.first_name || ' ' || e.last_name as employee_name,
        e.department,
        e.designation,
        COUNT(DISTINCT te.entry_date) as days_worked,
        SUM(te.hours) as total_hours,
        ROUND((SUM(te.hours) / (COUNT(DISTINCT te.entry_date) * 8.0) * 100), 2) as utilization_percentage
      FROM timesheet_entries te
      JOIN timesheets t ON te.timesheet_id = t.timesheet_id
      JOIN employees e ON t.employee_id = e.employee_id
      WHERE te.entry_date BETWEEN $1 AND $2
      ${filterQuery}
      GROUP BY e.employee_id, e.first_name, e.last_name, e.department, e.designation
      ORDER BY utilization_percentage DESC`;

    const result = await pool.query(utilizationQuery, params);

    res.json({
      startDate,
      endDate,
      department: department || null,
      designation: designation || null,
      data: result.rows,
    });
  } catch (error) {
    console.error("Utilization report error:", error);
    res.status(500).json({ error: "Failed to fetch utilization report" });
  }
};

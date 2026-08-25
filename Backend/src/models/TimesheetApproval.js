import pool from "../config/database.js";

class TimesheetApproval {
  // Create a new approval record
  static async create(data) {
    const {
      timesheet_id,
      employee_id,
      manager_id,
      status,
      comments = null,
    } = data;

    const result = await pool.query(
      `INSERT INTO timesheet_approval
       (timesheet_id, employee_id, manager_id, status, comments, approved_date)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [timesheet_id, employee_id, manager_id, status, comments]
    );

    return result.rows[0];
  }

  // Get all approvals for a timesheet
  static async findByTimesheetId(timesheetId) {
    const result = await pool.query(
      "SELECT * FROM timesheet_approval WHERE timesheet_id = $1 ORDER BY approved_date DESC",
      [timesheetId]
    );
    return result.rows;
  }
}

export default TimesheetApproval;

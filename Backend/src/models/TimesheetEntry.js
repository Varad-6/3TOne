import pool from "../config/database.js";

class TimesheetEntry {
  // Get all entries for a timesheet
  static async findByTimesheetId(timesheetId) {
    const result = await pool.query(
      "SELECT * FROM timesheet_entry WHERE timesheet_id = $1 ORDER BY entry_date",
      [timesheetId]
    );
    return result.rows;
  }

  // Create a single entry
  static async create(data) {
    const {
      timesheet_id,
      project_id = null,
      activity_assign_id = null,
      client_id = null,
      activity_id = null,
      employee_id,
      entry_date,
      ticket_number = null,
      hour_logged,
      description = null,
    } = data;

    const result = await pool.query(
      `INSERT INTO timesheet_entry
       (timesheet_id, project_id, activity_assign_id, client_id, activity_id, employee_id, entry_date, ticket_number, hours_logged, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        timesheet_id,
        project_id,
        activity_assign_id,
        client_id,
        activity_id,
        employee_id,
        entry_date,
        ticket_number,
        hour_logged,
        description,
      ]
    );

    return result.rows[0];
  }

  // Bulk create entries (transactional)
  static async bulkCreate(entries) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const created = [];

      for (const entry of entries) {
        const result = await client.query(
          `INSERT INTO timesheet_entry
           (timesheet_id, project_id, activity_assign_id, client_id, activity_id, employee_id, entry_date, ticket_number, hours_logged, description)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING *`,
          [
            entry.timesheet_id,
            entry.project_id || null,
            entry.activity_assign_id || null,
            entry.client_id || null,
            entry.activity_id || null,
            entry.employee_id,
            entry.entry_date,
            entry.ticket_number || null,
            entry.hour_logged,
            entry.description || null,
          ]
        );
        created.push(result.rows[0]);
      }

      await client.query("COMMIT");
      return created;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  // Delete all entries for a timesheet
  static async deleteByTimesheetId(timesheetId) {
    await pool.query("DELETE FROM timesheet_entry WHERE timesheet_id = $1", [
      timesheetId,
    ]);
  }
}

export default TimesheetEntry;

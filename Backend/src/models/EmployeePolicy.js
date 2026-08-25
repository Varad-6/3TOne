import pool from "../config/database.js";

class EmployeePolicy {
  // Get active policy by employee ID
  static async findByEmployeeId(employeeId) {
    const result = await pool.query(
      "SELECT * FROM employee_policy WHERE employee_id = $1 AND is_active = TRUE",
      [employeeId]
    );
    return result.rows[0];
  }

  // Create a new employee policy
  static async create(data) {
    const {
      employee_id,
      working_hours_per_day,
      saturday_working = false,
      sunday_working = false,
      allow_future_entries = false,
      is_active = true,
    } = data;

    const result = await pool.query(
      `INSERT INTO employee_policy 
       (employee_id, working_hours_per_day, saturday_working, sunday_working, allow_future_entries, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        employee_id,
        working_hours_per_day,
        !!saturday_working,
        !!sunday_working,
        !!allow_future_entries,
        !!is_active,
      ]
    );

    return result.rows[0];
  }

  // Update an existing employee policy
  static async update(employeeId, data) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(data[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) return await this.findByEmployeeId(employeeId);

    fields.push("updated_at = NOW()");
    values.push(employeeId);

    const query = `UPDATE employee_policy SET ${fields.join(
      ", "
    )} WHERE employee_id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);
    return result.rows[0];
  }
}

export default EmployeePolicy;

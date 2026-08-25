// import pool from "../config/database.js";

// class Timesheet {
//   // Get all timesheets with optional filters
//   static async findAll(filters = {}) {
//     let query = "SELECT * FROM timesheet WHERE 1=1";
//     const params = [];

//     if (filters.employee_id) {
//       params.push(filters.employee_id);
//       query += ` AND employee_id = $${params.length}`;
//     }
//     if (filters.status) {
//       params.push(filters.status);
//       query += ` AND status = $${params.length}`;
//     }
//     if (filters.start_date) {
//       params.push(filters.start_date);
//       query += ` AND week_start_date >= $${params.length}`;
//     }
//     if (filters.end_date) {
//       params.push(filters.end_date);
//       query += ` AND week_end_date <= $${params.length}`;
//     }

//     query += " ORDER BY week_start_date DESC";
//     const result = await pool.query(query, params);
//     return result.rows;
//   }

//   // Get timesheet by ID
//   static async findById(id) {
//     const result = await pool.query(
//       "SELECT * FROM timesheet WHERE timesheet_id = $1",
//       [id]
//     );
//     return result.rows[0];
//   }

//   // Create a new timesheet
//   static async create(data) {
//     const {
//       timesheet_id,
//       employee_id,
//       manager_id = null,
//       week_start_date,
//       week_end_date,
//       status = "DRAFT",
//     } = data;

//     const result = await pool.query(
//       `INSERT INTO timesheet
//        (timesheet_id, employee_id, manager_id, week_start_date, week_end_date, status)
//        VALUES ($1, $2, $3, $4, $5, $6)
//        RETURNING *`,
//       [
//         timesheet_id,
//         employee_id,
//         manager_id,
//         week_start_date,
//         week_end_date,
//         status,
//       ]
//     );

//     return result.rows[0];
//   }

//   // Update an existing timesheet
//   static async update(id, data) {
//     const fields = [];
//     const values = [];
//     let paramCount = 1;

//     Object.keys(data).forEach((key) => {
//       if (data[key] !== undefined) {
//         fields.push(`${key} = $${paramCount}`);
//         values.push(data[key]);
//         paramCount++;
//       }
//     });

//     if (fields.length === 0) return await this.findById(id);

//     fields.push("updated_at = NOW()");
//     values.push(id);

//     const query = `UPDATE timesheet SET ${fields.join(
//       ", "
//     )} WHERE timesheet_id = $${paramCount} RETURNING *`;

//     const result = await pool.query(query, values);
//     return result.rows[0];
//   }

//   // Delete a timesheet and its entries
//   static async delete(id) {
//     await pool.query("DELETE FROM timesheet_entry WHERE timesheet_id = $1", [
//       id,
//     ]);
//     const result = await pool.query(
//       "DELETE FROM timesheet WHERE timesheet_id = $1 RETURNING *",
//       [id]
//     );
//     return result.rows[0];
//   }
// }

// export default Timesheet;

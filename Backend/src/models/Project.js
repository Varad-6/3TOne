import pool from "../config/database.js";

class Project {
  // Get all projects with optional filters
  static async findAll(filters = {}) {
    let query = "SELECT * FROM project_master WHERE 1=1";
    const params = [];

    if (filters.client_id) {
      params.push(filters.client_id);
      query += ` AND client_id = $${params.length}`;
    }
    if (filters.status) {
      params.push(filters.status);
      query += ` AND status = $${params.length}`;
    }

    query += " ORDER BY start_date DESC";
    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get project by ID
  static async findById(id) {
    const result = await pool.query(
      "SELECT * FROM project_master WHERE project_id = $1",
      [id]
    );
    return result.rows[0];
  }

  // Create a new project
  static async create(data) {
    const {
      project_id,
      project_name,
      client_id,
      start_date,
      end_date = null,
      approved_days = null,
      estimated_days = null,
      status = "active",
    } = data;

    const result = await pool.query(
      `INSERT INTO project_master 
      (project_id, project_name, client_id, start_date, end_date, approved_days, estimated_days, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        project_id,
        project_name,
        client_id,
        start_date,
        end_date,
        approved_days,
        estimated_days,
        status,
      ]
    );

    return result.rows[0];
  }

  // Update an existing project
  static async update(id, data) {
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

    if (fields.length === 0) return await this.findById(id);

    fields.push("updated_at = NOW()");
    values.push(id);

    const query = `UPDATE project_master SET ${fields.join(
      ", "
    )} WHERE project_id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Soft delete a project
  static async delete(id) {
    const result = await pool.query(
      "UPDATE project_master SET status = 'inactive', updated_at = NOW() WHERE project_id = $1 RETURNING *",
      [id]
    );
    return result.rows[0];
  }
}

export default Project;

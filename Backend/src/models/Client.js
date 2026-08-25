import pool from "../config/database.js";

class Client {
  // Helper: Standardize ID check
  static isUUID(str) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      str
    );
  }

  // Get all clients
  static async findAll(activeOnly = false) {
    let query = `
      SELECT 
        client_id, client_name, client_code, zoho_crm_code, alias, 
        spoc_name, spoc_phone, spoc_email, url, is_active, 
        created_at, updated_at
      FROM client_master
      WHERE 1=1
    `;
    const params = [];

    if (activeOnly) {
      query += ` AND is_active = TRUE`;
    }

    query += ` ORDER BY client_name ASC`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get client by ID or Code
  static async findByIdOrCode(identifier) {
    const column = this.isUUID(identifier) ? "client_id" : "client_code";
    const query = `SELECT * FROM client_master WHERE ${column} = $1`;

    const result = await pool.query(query, [identifier]);
    return result.rows[0];
  }

  // Create new client
  static async create(data) {
    const {
      clientName,
      clientCode,
      zohoCrmCode,
      alias,
      spocName,
      spocPhone,
      spocEmail,
      url,
    } = data;

    const query = `
      INSERT INTO client_master 
        (client_name, client_code, zoho_crm_code, alias, spoc_name, 
         spoc_phone, spoc_email, url, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
      RETURNING *
    `;

    const values = [
      clientName,
      clientCode,
      zohoCrmCode,
      alias || null,
      spocName || null,
      spocPhone || null,
      spocEmail || null,
      url || null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Update client
  static async update(identifier, data) {
    const column = this.isUUID(identifier) ? "client_id" : "client_code";
    const fields = [];
    const values = [];
    let idx = 1;

    // Map frontend keys to DB columns
    const mapping = {
      clientName: "client_name",
      clientCode: "client_code",
      zohoCrmCode: "zoho_crm_code",
      alias: "alias",
      spocName: "spoc_name",
      spocPhone: "spoc_phone",
      spocEmail: "spoc_email",
      url: "url",
      isActive: "is_active",
    };

    Object.keys(data).forEach((key) => {
      const dbCol = mapping[key];
      if (dbCol && data[key] !== undefined) {
        fields.push(`${dbCol} = $${idx}`);
        values.push(data[key]);
        idx++;
      }
    });

    if (fields.length === 0) return null;

    values.push(identifier);

    const query = `
      UPDATE client_master 
      SET ${fields.join(", ")}, updated_at = NOW() 
      WHERE ${column} = $${idx} 
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Check dependencies before delete
  static async hasProjects(clientId) {
    const result = await pool.query(
      "SELECT 1 FROM project_master WHERE client_id = $1 LIMIT 1",
      [clientId]
    );
    return result.rows.length > 0;
  }

  // Soft Delete
  static async softDelete(identifier) {
    // First resolve to ID to ensure we have the right UUID
    const client = await this.findByIdOrCode(identifier);
    if (!client) return null;

    // Dependency Check
    if (await this.hasProjects(client.client_id)) {
      throw new Error("DEPENDENCY_EXISTS");
    }

    const result = await pool.query(
      `UPDATE client_master 
       SET is_active = FALSE, updated_at = NOW() 
       WHERE client_id = $1 
       RETURNING client_id, client_name, is_active`,
      [client.client_id]
    );
    return result.rows[0];
  }
}

export default Client;

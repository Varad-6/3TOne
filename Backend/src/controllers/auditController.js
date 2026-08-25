import pool from '../config/database.js';

// Get audit logs with filters and pagination
export const getAuditLogs = async (req, res) => {
  try {
    const { startDate, endDate, action, employeeId, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT 
        al.*,
        e.first_name || ' ' || e.last_name AS employee_name
      FROM audit_logs al
      LEFT JOIN employees e ON al.employee_id = e.employee_id
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      params.push(startDate);
      query += ` AND al.created_at >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND al.created_at <= $${params.length}`;
    }
    if (action) {
      params.push(action);
      query += ` AND al.action = $${params.length}`;
    }
    if (employeeId) {
      params.push(employeeId);
      query += ` AND al.employee_id = $${params.length}`;
    }

    query += ' ORDER BY al.created_at DESC';

    params.push(parseInt(limit, 10));
    query += ` LIMIT $${params.length}`;
    params.push(parseInt(offset, 10));
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM audit_logs');

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};

// Get audit log by ID
export const getAuditLogById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        al.*,
        e.first_name || ' ' || e.last_name AS employee_name
       FROM audit_logs al
       LEFT JOIN employees e ON al.employee_id = e.employee_id
       WHERE al.log_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
};

// Export audit logs (filtered dataset)
export const exportAuditLogs = async (req, res) => {
  try {
    const { startDate, endDate, action } = req.query;

    let query = `
      SELECT 
        al.log_id,
        al.employee_id,
        e.first_name || ' ' || e.last_name AS employee_name,
        al.action,
        al.entity_type,
        al.entity_id,
        al.ip_address,
        al.user_agent,
        al.created_at
      FROM audit_logs al
      LEFT JOIN employees e ON al.employee_id = e.employee_id
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      params.push(startDate);
      query += ` AND al.created_at >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND al.created_at <= $${params.length}`;
    }
    if (action) {
      params.push(action);
      query += ` AND al.action = $${params.length}`;
    }

    query += ' ORDER BY al.created_at DESC';
    const result = await pool.query(query, params);

    res.json({
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Export audit logs error:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
};


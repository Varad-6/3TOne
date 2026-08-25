// File: src/middleware/auditMiddleware.js

import pool from "../config/database.js";

// --------------------------------------------
// Decorator: Log successful route actions
// --------------------------------------------
export const logAudit = (action, entityType) => {
  return async (req, res, next) => {
    const originalSend = res.send;

    res.send = function (data) {
      try {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const employeeId = req.user?.employeeId || null;
          const entityId = req.params.id || req.body?.id || null;
          const ipAddress = req.ip || req.connection?.remoteAddress || "";
          const userAgent = req.get("user-agent") || "";

          pool
            .query(
              `INSERT INTO audit_logs (employee_id, action, entity_type, entity_id, ip_address, user_agent, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
              [employeeId, action, entityType, entityId, ipAddress, userAgent]
            )
            .catch((err) => {
              console.error("Audit logging error:", err);
            });
        }
      } catch (e) {
        console.error("Audit decorator error:", e);
      }

      return originalSend.call(this, data);
    };

    next();
  };
};

// --------------------------------------------
// Middleware: Log every authenticated API request
// --------------------------------------------
export const auditMiddleware = async (req, res, next) => {
  try {
    if (!req.user) return next();

    const action = `${req.method} ${req.path}`;
    const employeeId = req.user.employeeId;
    const ipAddress = req.ip || req.connection?.remoteAddress || "";
    const userAgent = req.get("user-agent") || "";

    await pool.query(
      `INSERT INTO audit_logs (employee_id, action, entity_type, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [employeeId, action, "API_REQUEST", ipAddress, userAgent]
    );
  } catch (error) {
    console.error("Audit middleware error:", error);
  } finally {
    next();
  }
};

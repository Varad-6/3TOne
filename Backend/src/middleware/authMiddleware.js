import jwt from "jsonwebtoken";
import pool from "../config/database.js";

// Middleware to authenticate JWT tokens
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Join user_roles to get role name
    const result = await pool.query(
`SELECT 
         e.employee_id, 
         e.employee_code, 
         e.email,
         e.role AS role_id,
         ur.name AS role_name,
         e.is_active,
         e.department AS department_id,
         d.name AS department_name
       FROM employees e
       LEFT JOIN user_roles ur ON ur.id = e.role
       LEFT JOIN departments d ON d.id = e.department
       WHERE e.employee_id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: "Account is inactive" });
    }

    // Map DB columns to req.user object
    req.user = {
      id: user.employee_id, // UUID PK
      employeeCode: user.employee_code,
      email: user.email,
      role: user.role_name, // string, e.g. "ADMIN"
      roleId: user.role_id, // numeric FK if needed
      department: user.department_name,
      departmentId: user.department_id, // Numeric FK
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(403).json({ error: "Token expired" });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(403).json({ error: "Invalid token" });
    }

    return res.status(500).json({ error: "Authentication error" });
  }
};

// Middleware to authorize roles
const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // allowedRoles should be string names, e.g. ["ADMIN", "MANAGER"]
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Insufficient permissions",
        message: `This action requires one of the following roles: ${allowedRoles.join(
          ", "
        )}`,
      });
    }

    next();
  };
};
// Export both middleware functions
export { authenticateToken, authorizeRoles };

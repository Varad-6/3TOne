import { hashPassword } from "../utils/bcrypt.js";
import pool from "../config/database.js";

// ====================================
// Helper: Resolve Manager ID
// Accepts UUID or Employee Code (e.g., "EMP001")
// Returns employee_id (UUID) or null
// ====================================
async function resolveManagerId(managerIdentifier) {
  if (!managerIdentifier) return null;

  const isUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      managerIdentifier,
    );

  if (isUUID) {
    return managerIdentifier;
  }

  // It's an employee_code -> look up employee_id
  const result = await pool.query(
    "SELECT employee_id FROM employees WHERE employee_code = $1 AND is_active = TRUE",
    [managerIdentifier],
  );

  if (result.rows.length === 0) {
    throw new Error(
      `Manager with code "${managerIdentifier}" not found or inactive`,
    );
  }

  return result.rows[0].employee_id;
}

// ====================================
// Helper: Resolve Role ID
// Accepts numeric id or role name ("ADMIN", "MANAGER", ...)
// Returns numeric id
// ====================================
async function resolveRoleId(input) {
  if (input === undefined || input === null) {
    throw new Error("Role is required");
  }

  // If already a number or numeric string, use as id
  if (typeof input === "number" || /^\d+$/.test(String(input))) {
    return Number(input);
  }

  const name = String(input).toUpperCase().trim();

  const result = await pool.query("SELECT id FROM user_roles WHERE name = $1", [
    name,
  ]);

  if (result.rows.length === 0) {
    throw new Error(`Role "${name}" not found in user_roles`);
  }

  return result.rows[0].id;
}

// ====================================
// Helper: Resolve Department ID
// Accepts numeric id or department name ("DELIVERY", "HR", ...)
// Returns numeric id
// ====================================
async function resolveDepartmentId(input) {
  if (input === undefined || input === null) {
    // Default to COMMON if nothing provided
    input = "COMMON";
  }

  // If already a number or numeric string, use as id
  if (typeof input === "number" || /^\d+$/.test(String(input))) {
    return Number(input);
  }

  const name = String(input).toUpperCase().trim();

  const result = await pool.query(
    "SELECT id FROM departments WHERE name = $1",
    [name],
  );

  if (result.rows.length === 0) {
    throw new Error(`Department "${name}" not found in departments`);
  }

  return result.rows[0].id;
}

// ====================================
// Helper: Map Create Payload (shape only)
// ====================================
function mapCreatePayload(body) {
  return {
    // Map external employeeId to employee_code; auto-generate if not provided
    employee_code: (
      body.employeeCode ||
      `EMP${String(Math.floor(Math.random() * 999)).padStart(3, "0")}`
    ).toUpperCase(),
    first_name: body.firstName,
    last_name: body.lastName,
    email: body.email,
    raw_password: body.password,
    role: body.role, // will be resolved to id
    department: body.department, // will be resolved to id (name or id)
    designation: body.designation || null,
    doj: body.doj,
    separation_date: body.separationDate || null,
  };
}

// ====================================
// GET /api/employees/manager/:managerId
// Uses module_manager_id column
// ====================================
export const getEmployeesByManager = async (req, res) => {
  try {
    const { managerId } = req.params;
    if (!managerId) {
      return res.status(400).json({ error: "Manager ID is required" });
    }

    const managerUUID = await resolveManagerId(managerId);

    const query = `
      SELECT 
        employee_id, 
        employee_code, 
        first_name, 
        last_name, 
        email, 
        role,
        department, 
        designation,
        is_active
      FROM employees
      WHERE module_manager_id = $1 
        AND is_active = TRUE
      ORDER BY first_name ASC
    `;

    const { rows } = await pool.query(query, [managerUUID]);

    res.json(rows);
  } catch (error) {
    console.error("getEmployeesByManager error:", error);
    res.status(error.statusCode || 500).json({
      error: error.message || "Failed to fetch employees by manager",
    });
  }
};

// ====================================
// GET /api/employees
// Manager sees themselves + their employees
// Role & department filters can be ids or names
// ====================================
export const getAllEmployees = async (req, res) => {
  try {
    const { department, role, isActive, page, limit } = req.query;

    const requestorRole = req.user?.role; // string name from JWT
    const requestorId = req.user?.id; // employee_id (UUID)

    let query = `
      SELECT 
        e.employee_id, 
        e.employee_code, 
        e.first_name, 
        e.last_name, 
        e.email,
        e.role,
        e.department,
        e.designation, 
        e.doj, 
        e.separation_date, 
        e.is_active,
        e.module_manager_id,
        m.first_name AS manager_first_name,
        m.last_name AS manager_last_name,
        ur.name AS role_name,
        d.name AS department_name
      FROM employees e
      LEFT JOIN employees m ON e.module_manager_id = m.employee_id
      LEFT JOIN user_roles ur ON ur.id = e.role
      LEFT JOIN departments d ON d.id = e.department
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // Manager: see employees with role EMPLOYEE + themselves
    if (requestorRole === "MANAGER") {
      query += ` AND (ur.name = 'EMPLOYEE' OR e.employee_id = $${paramCount++})`;
      params.push(requestorId);
    }

    if (role) {
      const roleId = await resolveRoleId(role);
      query += ` AND e.role = $${paramCount++}`;
      params.push(roleId);
    }

    if (department) {
      const departmentId = await resolveDepartmentId(department);
      query += ` AND e.department = $${paramCount++}`;
      params.push(departmentId);
    }

    if (isActive !== undefined) {
      query += ` AND e.is_active = $${paramCount++}`;
      params.push(isActive === "true");
    }

    query += ` ORDER BY e.created_at DESC`;

    const result = await pool.query(query, params);
    const all = result.rows;

    if (page && limit) {
      const p = parseInt(page, 10);
      const l = parseInt(limit, 10);
      const offset = (p - 1) * l;
      const paged = all.slice(offset, offset + l);

      return res.json({
        employees: paged,
        total: all.length,
        page: p,
        limit: l,
      });
    }

    res.json({
      employees: all,
      count: all.length,
    });
  } catch (error) {
    console.error("getAllEmployees error:", error);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
};

// ====================================
// GET /api/employees/managers
// Uses user_roles table (role name = 'MANAGER')
// ====================================
export const getManagers = async (req, res) => {
  try {
    const query = `
      SELECT 
        e.employee_id, 
        e.employee_code, 
        e.first_name, 
        e.last_name, 
        e.email,
        e.role,
        e.department,
        e.designation, 
        e.is_active,
        ur.name AS role_name,
        d.name AS department_name
      FROM employees e
      JOIN user_roles ur ON ur.id = e.role
      LEFT JOIN departments d ON d.id = e.department
      WHERE ur.name IN('ADMIN', 'MANAGER') AND e.is_active = TRUE
      ORDER BY e.first_name ASC
    `;

    const result = await pool.query(query);

    res.json({
      employees: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Get managers error:", error);
    res.status(500).json({ error: "Failed to fetch managers" });
  }
};

// ====================================
// GET /api/employees/:id (id or employee_code)
// ====================================
export const getEmployeeById = async (req, res) => {
  try {
    const idParam = req.params.id;
    let id = idParam;

    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idParam,
      );

    if (!isUUID) {
      const result = await pool.query(
        "SELECT employee_id FROM employees WHERE employee_code = $1",
        [idParam],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Employee not found" });
      }
      id = result.rows[0].employee_id;
    }

    const empResult = await pool.query(
      `SELECT 
         e.employee_id, 
         e.employee_code, 
         e.first_name, 
         e.last_name, 
         e.email,
         e.role,
         e.department,
         e.designation, 
         e.doj, 
         e.separation_date, 
         e.is_active,
         e.module_manager_id,
         m.first_name AS manager_first_name,
         m.last_name AS manager_last_name,
         m.employee_code AS manager_code,
         ur.name AS role_name,
         d.name AS department_name
       FROM employees e
       LEFT JOIN employees m ON e.module_manager_id = m.employee_id
       LEFT JOIN user_roles ur ON ur.id = e.role
       LEFT JOIN departments d ON d.id = e.department
       WHERE e.employee_id = $1`,
      [id],
    );

    if (empResult.rows.length === 0)
      return res.status(404).json({ error: "Employee not found" });

    res.json(empResult.rows[0]);
  } catch (error) {
    console.error("getEmployeeById error:", error);
    res.status(500).json({ error: "Failed to fetch employee" });
  }
};

// ====================================
// POST /api/employees
// Accepts role & department as id or name
// ====================================
export const createEmployee = async (req, res) => {
  try {
    const payload = mapCreatePayload(req.body);
    const { moduleManagerId } = req.body;
    if (payload.email) {
      payload.email = payload.email.trim().toLowerCase();
    }
    // 1. Resolve Module Manager if provided
    let resolvedManagerId = null;
    if (moduleManagerId) {
      resolvedManagerId = await resolveManagerId(moduleManagerId);
    }

    // 2. Resolve role & department ids
    const roleId = await resolveRoleId(payload.role);
    const departmentId = await resolveDepartmentId(payload.department);

    // 3. Check existing email
    const emailCheck = await pool.query(
      "SELECT 1 FROM employees WHERE email = $1",
      [payload.email],
    );
    if (emailCheck.rows.length > 0)
      return res.status(409).json({ error: "Email already exists" });

    // 4. Check existing employee code
    const codeCheck = await pool.query(
      "SELECT 1 FROM employees WHERE employee_code = $1",
      [payload.employee_code],
    );
    if (codeCheck.rows.length > 0)
      return res.status(409).json({ error: "Employee code already exists" });

    const password_hash = await hashPassword(payload.raw_password);

    const insertQuery = `
      INSERT INTO employees (
        employee_code, 
        first_name, 
        last_name, 
        email, 
        password_hash, 
        role, 
        department, 
        designation, 
        doj,
        separation_date,
        module_manager_id,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    // If separation_date is set, force inactive at creation
    const isActive = payload.separation_date ? false : true;

    const result = await pool.query(insertQuery, [
      payload.employee_code,
      payload.first_name,
      payload.last_name,
      payload.email,
      password_hash,
      roleId,
      departmentId,
      payload.designation,
      payload.doj,
      payload.separation_date,
      resolvedManagerId,
      isActive,
    ]);

    res.status(201).json({
      message: "Employee created",
      employee: result.rows[0],
    });
  } catch (error) {
    console.error("createEmployee error:", error);
    res.status(error.statusCode || 500).json({
      error: error.message || "Failed to create employee",
    });
  }
};

// ====================================
// PUT /api/employees/:id
// Accepts id or employee_code; role/department as id or name
// ====================================
export const updateEmployee = async (req, res) => {
  try {
    const idParam = req.params.id;
    let id = idParam;

    // Resolve ID (UUID vs Employee Code)
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idParam,
      );
    if (!isUUID) {
      const result = await pool.query(
        "SELECT employee_id FROM employees WHERE employee_code = $1",
        [idParam],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "Employee not found" });
      id = result.rows[0].employee_id;
    }

    // Fetch current data
    const empCheck = await pool.query(
      "SELECT * FROM employees WHERE employee_id = $1",
      [id],
    );
    if (empCheck.rows.length === 0)
      return res.status(404).json({ error: "Employee not found" });
    const emp = empCheck.rows[0];

    // SECURITY CHECK: prevent editing inactive unless reactivating
    const isReactivating = req.body.isActive === true;
    if (!emp.is_active && !isReactivating) {
      return res.status(400).json({
        error: "Cannot edit an inactive employee. Reactivate them first.",
      });
    }

    const body = req.body;
    const data = {};

    if (body.firstName !== undefined) data.first_name = body.firstName;
    if (body.lastName !== undefined) data.last_name = body.lastName;
    if (body.email !== undefined) {
      data.email = body.email.trim().toLowerCase();
    }
    if (body.role !== undefined) data.role = body.role; // will resolve later
    if (body.department !== undefined) data.department = body.department; // resolve later
    if (body.designation !== undefined) data.designation = body.designation;
    if (body.employeeCode !== undefined) {
      data.employee_code = body.employeeCode.toUpperCase();
    }
    if (body.doj !== undefined) data.doj = body.doj;
    if (body.separationDate !== undefined)
      data.separation_date = body.separationDate;
    if (body.isActive !== undefined) data.is_active = !!body.isActive;

    // Module Manager
    if (body.moduleManagerId !== undefined) {
      data.module_manager_id = await resolveManagerId(body.moduleManagerId);
    }

    // If separation_date present, enforce inactive
    if (data.separation_date) {
      data.is_active = false;
    }

    // Password update
    if (body.password) {
      data.password_hash = await hashPassword(body.password);
    }

    // Resolve role & department ids if provided
    if (data.role !== undefined) {
      data.role = await resolveRoleId(data.role);
    }
    if (data.department !== undefined) {
      data.department = await resolveDepartmentId(data.department);
    }

    // Email uniqueness check
    if (data.email && data.email !== emp.email) {
      const existing = await pool.query(
        "SELECT 1 FROM employees WHERE email = $1",
        [data.email],
      );
      if (existing.rows.length > 0)
        return res.status(409).json({ error: "Email already exists" });
    }

    // Employee code uniqueness check
    if (data.employee_code && data.employee_code !== emp.employee_code) {
      const existingCode = await pool.query(
        "SELECT 1 FROM employees WHERE employee_code = $1",
        [data.employee_code],
      );
      if (existingCode.rows.length > 0)
        return res.status(409).json({ error: "Employee code already exists" });
    }

    const fields = Object.keys(data);
    if (fields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(", ");
    const values = fields.map((f) => data[f]);

    const updateQuery = `
      UPDATE employees 
      SET ${setClause}, updated_at = NOW() 
      WHERE employee_id = $1 
      RETURNING *
    `;

    const updatedRes = await pool.query(updateQuery, [id, ...values]);

    res.json({
      message: "Employee updated",
      employee: updatedRes.rows[0],
    });
  } catch (error) {
    console.error("updateEmployee error:", error);
    res.status(error.statusCode || 500).json({
      error: error.message || "Failed to update employee",
    });
  }
};

// ====================================
// DELETE /api/employees/:id (soft delete)
// Accepts id or employee_code
// ====================================
export const deleteEmployee = async (req, res) => {
  try {
    const idParam = req.params.id;
    let id = idParam;

    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idParam,
      );
    if (!isUUID) {
      const result = await pool.query(
        "SELECT employee_id FROM employees WHERE employee_code = $1",
        [idParam],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "Employee not found" });
      id = result.rows[0].employee_id;
    }

    await pool.query(
      "UPDATE employees SET is_active = FALSE, updated_at = NOW() WHERE employee_id = $1",
      [id],
    );

    res.json({ message: "Employee deactivated" });
  } catch (error) {
    console.error("deleteEmployee error:", error);
    res.status(500).json({ error: "Failed to deactivate employee" });
  }
};

// ====================================
// PATCH /api/employees/:id/reactivate
// ✅ NEW: Reactivate an inactive employee
// Accepts id or employee_code
// ====================================
export const reactivateEmployee = async (req, res) => {
  try {
    const idParam = req.params.id;
    let id = idParam;

    // Resolve ID (UUID vs Employee Code)
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idParam,
      );
    if (!isUUID) {
      const result = await pool.query(
        "SELECT employee_id FROM employees WHERE employee_code = $1",
        [idParam],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Employee not found" });
      }
      id = result.rows[0].employee_id;
    }

    // Check if employee exists
    const empCheck = await pool.query(
      "SELECT employee_id, first_name, last_name, is_active FROM employees WHERE employee_id = $1",
      [id],
    );

    if (empCheck.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const employee = empCheck.rows[0];

    // Check if already active
    if (employee.is_active) {
      return res.status(400).json({
        error: "Employee is already active",
        employee: employee,
      });
    }

    // Reactivate: set is_active = TRUE, clear separation_date
    const updateQuery = `
      UPDATE employees 
      SET 
        is_active = TRUE, 
        separation_date = NULL,
        updated_at = NOW() 
      WHERE employee_id = $1 
      RETURNING 
        employee_id,
        employee_code,
        first_name,
        last_name,
        email,
        role,
        department,
        designation,
        is_active
    `;

    const result = await pool.query(updateQuery, [id]);

    console.log(
      `✅ Employee reactivated: ${employee.first_name} ${employee.last_name} (${id})`,
    );

    res.json({
      message: "Employee reactivated successfully",
      employee: result.rows[0],
    });
  } catch (error) {
    console.error("reactivateEmployee error:", error);
    res.status(500).json({
      error: "Failed to reactivate employee",
      details: error.message,
    });
  }
};

// ====================================
// GET /api/employees/departments
// Fetch departments from departments lookup table
// ====================================
export const getDepartments = async (req, res) => {
  try {
    const query = `
      SELECT id, name
      FROM departments
      ORDER BY name ASC
    `;

    const result = await pool.query(query);
    const departments = result.rows.map((row) => row.name);

    res.json({ departments });
  } catch (error) {
    console.error("Get departments error:", error);
    res.status(500).json({ error: "Failed to fetch department list" });
  }
};

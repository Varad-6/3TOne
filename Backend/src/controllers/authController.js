import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/database.js";

// ------------------------------------
// Login Controller
// ------------------------------------
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("🔑 Login attempt for:", email);

    // ✅ Find user by email + join role name AND department name
    const query = `
      SELECT
        e.employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        e.password_hash,
        e.role AS role_id,
        ur.name AS role_name,
        e.department AS department_id,
        d.name AS department_name,
        e.designation,
        e.is_active
      FROM employees e
      LEFT JOIN user_roles ur ON ur.id = e.role
      LEFT JOIN departments d ON d.id = e.department
      WHERE e.email = $1
    `;
    const result = await pool.query(query, [email]);
    const user = result.rows[0];

    if (!user) {
      console.log("❌ User not found:", email);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!user.is_active) {
      console.log("❌ User inactive:", email);
      return res.status(401).json({ error: "User is Inactive" });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      console.log("❌ Invalid password for:", email);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    console.log("✅ Password verified for:", email);

    // Use role_name (string) for tokens and frontend
    const roleName = user.role_name; // e.g. "ADMIN"
    const roleId = user.role_id; // numeric FK
    const departmentName = user.department_name; // e.g. "DELIVERY"
    const departmentId = user.department_id; // numeric FK

    const accessToken = jwt.sign(
      {
        id: user.employee_id, // UUID
        employeeCode: user.employee_code,
        email: user.email,
        role: roleName, // string, for auth checks / UI
        roleId, // keep numeric id if needed
        department: departmentName, // ✅ string name for frontend
        departmentId, // ✅ numeric FK if needed
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    const refreshToken = jwt.sign(
      { id: user.employee_id },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Save Refresh Token to DB
    await pool.query(
      "UPDATE employees SET refresh_token = $1, updated_at = NOW() WHERE employee_id = $2",
      [refreshToken, user.employee_id]
    );

    console.log("✅ Tokens generated & saved for:", email);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.employee_id,
        employeeCode: user.employee_code,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        role: roleName, // ✅ string: "ADMIN", "MANAGER", "EMPLOYEE"
        roleId, // numeric FK
        department: departmentName, // ✅ string: "DELIVERY", "HR", etc.
        departmentId, // numeric FK
        designation: user.designation,
      },
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
};

// ------------------------------------
// Refresh Token Controller
// ------------------------------------
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token required" });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );

    // ✅ Get user by UUID + join role AND department
    const query = `
      SELECT
        e.employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        e.role AS role_id,
        ur.name AS role_name,
        e.department AS department_id,
        d.name AS department_name,
        e.designation,
        e.is_active,
        e.refresh_token
      FROM employees e
      LEFT JOIN user_roles ur ON ur.id = e.role
      LEFT JOIN departments d ON d.id = e.department
      WHERE e.employee_id = $1
    `;
    const result = await pool.query(query, [decoded.id]);
    const user = result.rows[0];

    if (!user || user.refresh_token !== refreshToken) {
      return res.status(403).json({ error: "Invalid refresh token" });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: "Account is inactive" });
    }

    const roleName = user.role_name;
    const roleId = user.role_id;
    const departmentName = user.department_name;
    const departmentId = user.department_id;

    const accessToken = jwt.sign(
      {
        id: user.employee_id,
        employeeCode: user.employee_code,
        email: user.email,
        role: roleName,
        roleId,
        department: departmentName, // ✅ string name
        departmentId, // ✅ numeric FK
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    const newRefreshToken = jwt.sign(
      { id: user.employee_id },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    await pool.query(
      "UPDATE employees SET refresh_token = $1, updated_at = NOW() WHERE employee_id = $2",
      [newRefreshToken, user.employee_id]
    );

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    if (error.name === "TokenExpiredError") {
      return res
        .status(403)
        .json({ error: "Refresh token expired. Please login again." });
    }
    res.status(403).json({ error: "Invalid refresh token" });
  }
};

// ------------------------------------
// Logout Controller
// ------------------------------------
export const logout = async (req, res) => {
  try {
    const userId = req.user.id; // From JWT middleware (UUID)

    // Clear refresh token
    await pool.query(
      "UPDATE employees SET refresh_token = NULL, updated_at = NOW() WHERE employee_id = $1",
      [userId]
    );

    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
};

// ------------------------------------
// Change Password Controller
// ------------------------------------
export const changePassword = async (req, res) => {
  try {
    const userId = req.user.id; // ✅ From JWT middleware (UUID)
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: "Current and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters long",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        error: "New password must be different from current password",
      });
    }

    // ✅ Get current password hash using UUID
    const result = await pool.query(
      "SELECT password_hash FROM employees WHERE employee_id = $1 AND is_active = TRUE",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];

    // ✅ Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isValid) {
      return res.status(401).json({
        error: "Current password is incorrect",
      });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // ✅ Update password in database
    await pool.query(
      "UPDATE employees SET password_hash = $1, updated_at = NOW() WHERE employee_id = $2",
      [hashedPassword, userId]
    );

    console.log(`✅ Password changed successfully for user: ${userId}`);

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("❌ Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
};

// ------------------------------------
// Get Current User
// ------------------------------------
export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;

    // ✅ Join departments table
    const query = `
      SELECT
        e.employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        e.role AS role_id,
        ur.name AS role_name,
        e.department AS department_id,
        d.name AS department_name,
        e.designation
      FROM employees e
      LEFT JOIN user_roles ur ON ur.id = e.role
      LEFT JOIN departments d ON d.id = e.department
      WHERE e.employee_id = $1 AND e.is_active = TRUE
    `;
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];

    res.json({
      id: user.employee_id,
      employeeCode: user.employee_code,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      role: user.role_name, // ✅ string: "ADMIN", "MANAGER", "EMPLOYEE"
      roleId: user.role_id, // numeric FK
      department: user.department_name, // ✅ string: "DELIVERY", "HR", etc.
      departmentId: user.department_id, // numeric FK
      designation: user.designation,
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
};

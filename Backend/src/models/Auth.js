// File: src/models/auth.js
import pool from "../config/database.js";

export const AuthModel = {
  // Fetch employee by email
  async findByEmail(email) {
    const result = await pool.query(
      `SELECT *
       FROM employees
       WHERE email = $1`,
      [email]
    );
    return result.rows[0];
  },

  // Fetch employee by ID
  async findById(employeeId) {
    const result = await pool.query(
      `SELECT employee_id, email, role,  is_active, refresh_token FROM employees
       WHERE employee_id = $1`,
      [employeeId]
    );
    return result.rows[0];
  },

  // Update refresh token
  async updateRefreshToken(employeeId, refreshToken) {
    await pool.query(
      `UPDATE employees
       SET refresh_token = $1, updated_at = NOW()
       WHERE employee_id = $2`,
      [refreshToken, employeeId]
    );
  },

  // Clear refresh token (for logout)
  async clearRefreshToken(employeeId) {
    await pool.query(
      `UPDATE employees
       SET refresh_token = NULL, updated_at = NOW()
       WHERE employee_id = $1`,
      [employeeId]
    );
  },

  // Get password hash by employee ID
  async getPasswordHash(employeeId) {
    const result = await pool.query(
      `SELECT password_hash FROM employees WHERE employee_id = $1`,
      [employeeId]
    );
    return result.rows[0]?.password_hash || null;
  },

  // Update password hash
  async updatePassword(employeeId, hashedPassword) {
    await pool.query(
      `UPDATE employees
       SET password_hash = $1, updated_at = NOW()
       WHERE employee_id = $2`,
      [hashedPassword, employeeId]
    );
  },
};

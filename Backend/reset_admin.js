import bcrypt from 'bcrypt';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'timetrakpro',
  password: 'PostgresAdmin@123',
  port: 5432,
});

async function resetAdminPassword() {
  try {
    const newPassword = 'password123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);
    
    await pool.query('UPDATE employees SET password_hash = $1 WHERE email = $2', [hash, 'admin@example.com']);
    console.log('Password reset successfully for admin@example.com to: password123');
  } catch (err) {
    console.error('Error resetting password', err);
  } finally {
    await pool.end();
  }
}

resetAdminPassword();

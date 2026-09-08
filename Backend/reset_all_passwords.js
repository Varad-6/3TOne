import pool from './src/config/database.js';
import bcrypt from 'bcrypt';

async function resetAllPasswords() {
  try {
    const newPassword = 'password123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);
    
    await pool.query('UPDATE employees SET password_hash = $1', [hash]);
    console.log('All passwords reset successfully to: password123');
  } catch (err) {
    console.error('Error resetting passwords', err);
  } finally {
    await pool.end();
  }
}

resetAllPasswords();

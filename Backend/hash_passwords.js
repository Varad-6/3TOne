import pool from './src/config/database.js';
import bcrypt from 'bcrypt';

async function hashPasswords() {
  const users = await pool.query('SELECT employee_id, password_hash FROM employees');
  for (const user of users.rows) {
    if (!user.password_hash.startsWith('$2b$')) {
      const hashed = await bcrypt.hash(user.password_hash, 10);
      await pool.query('UPDATE employees SET password_hash = $1 WHERE employee_id = $2', [hashed, user.employee_id]);
      console.log(`Hashed password for user ${user.employee_id}`);
    }
  }
  console.log('All passwords hashed!');
  process.exit(0);
}
hashPasswords();

import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'timetrakpro',
  password: 'PostgresAdmin@123',
  port: 5432,
});

async function findAdmins() {
  try {
    const res = await pool.query(`
      SELECT u.id, u.email, u.first_name, ur.name as role 
      FROM employees u 
      JOIN user_roles ur ON u.role = ur.id 
      WHERE ur.name = 'ADMIN';
    `);
    console.log("Admin Users Found:");
    console.table(res.rows);
  } catch (err) {
    console.error('Error executing query', err.stack);
  } finally {
    await pool.end();
  }
}

findAdmins();

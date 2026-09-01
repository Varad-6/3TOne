import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "timetrakpro",
  password: "PostgresAdmin@123",
  port: 5432,
});

const checkUsers = async () => {
  try {
    const res = await pool.query(`
      SELECT 
        e.email, 
        e.password_hash, 
        ur.name as role_name 
      FROM employees e 
      LEFT JOIN user_roles ur ON e.role = ur.id
    `);
    console.log("Users in DB:");
    console.log(res.rows);
  } catch (error) {
    console.error("Error querying users:", error);
  } finally {
    await pool.end();
  }
};

checkUsers();

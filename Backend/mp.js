import pkg from "pg";
import bcrypt from "bcrypt";

const { Pool } = pkg;

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "timetrakpro",
  password: "PostgresAdmin@123",
  port: 5432,
});

const migratePasswords = async () => {
  try {
    const res = await pool.query("SELECT employee_id, password_hash FROM employees");

    for (const user of res.rows) {
      const plainPassword = user.password_hash; // corrected column name

      // skip empty or null passwords
      if (!plainPassword) {
        console.log(`Skipping ${user.employee_id} (no password)`);
        continue;
      }

      // if already hashed, skip
      if (plainPassword.startsWith("$2b$")) {
        console.log(`Skipping ${user.employee_id} (already hashed)`);
        continue;
      }

      // hash old plain-text password
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      // update db
      await pool.query(
        "UPDATE employees SET password_hash = $1 WHERE employee_id = $2",
        [hashedPassword, user.employee_id]
      );

      console.log(`✅ Updated password for user: ${user.employee_id}`);
    }

    console.log("🎉 Migration complete!");
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
};

migratePasswords();

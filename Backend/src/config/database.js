import pkg from "pg";
const { Pool, types } = pkg;

// ✅ FIX: Force Postgres to return dates as strings (YYYY-MM-DD)
// Type ID 1082 corresponds to the DATE type in Postgres.
// This prevents the driver from converting it to a JS Date object (which applies local timezone).
types.setTypeParser(1082, (stringValue) => {
  return stringValue;
});

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
  max: 20, // max clients in the pool
  idleTimeoutMillis: 30000, // close idle clients after 30s
  connectionTimeoutMillis: 2000, // error after 2s if cannot connect
});

// Test database connection
pool.on("connect", () => {
  console.log("✅ Database connected successfully");
});

pool.on("error", (err) => {
  console.error("❌ Unexpected database error:", err);
  process.exit(-1);
});

export default pool;

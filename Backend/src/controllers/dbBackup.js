// import cron from "node-cron";
// import { exec } from "child_process";
// import fs from "fs";
// import path from "path";
// import { fileURLToPath } from "url";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const BACKUP_DIR = process.env.BACKUP_DIR || "/backups/postgres";
// const RETENTION_DAYS = 30;

// // Ensure backup directory exists
// if (!fs.existsSync(BACKUP_DIR)) {
//   fs.mkdirSync(BACKUP_DIR, { recursive: true });
// }

// function runBackup() {
//   const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
//   const fileName = `timetrack_${timestamp}.dump`;
//   const filePath = path.join(BACKUP_DIR, fileName);

//   const { DB_USER, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT } = process.env;

//   // Pass password via env var (PGPASSWORD) instead of hardcoding in command
//   const command = `PGPASSWORD="${DB_PASSWORD}" pg_dump -U "${DB_USER}" -h "${DB_HOST}" -p "${DB_PORT || 5432}" -Fc "${DB_NAME}" -f "${filePath}"`;

//   exec(command, (error, stdout, stderr) => {
//     if (error) {
//       console.error(`❌ Backup failed: ${error.message}`);
//       return;
//     }
//     if (stderr) {
//       console.warn(`⚠️ Backup stderr: ${stderr}`);
//     }
//     console.log(`✅ Backup created: ${filePath}`);
//     cleanupOldBackups();
//   });
// }

// function cleanupOldBackups() {
//   const now = Date.now();
//   fs.readdir(BACKUP_DIR, (err, files) => {
//     if (err) return console.error("❌ Cleanup read error:", err);

//     files.forEach((file) => {
//       const filePath = path.join(BACKUP_DIR, file);
//       fs.stat(filePath, (err, stats) => {
//         if (err) return;
//         const ageDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);
//         if (ageDays > RETENTION_DAYS) {
//           fs.unlink(filePath, (err) => {
//             if (!err) console.log(`🗑️ Deleted old backup: ${file}`);
//           });
//         }
//       });
//     });
//   });
// }

// export function initDbBackupCron() {
//   // Runs daily at 2:00 AM server time
// cron.schedule("22 15 * * *", () => {
//     console.log("🕑 Running scheduled DB backup...");
//     runBackup();
//   });

//   console.log("✅ DB backup cron scheduled (daily at 2:00 AM)");
// }

// // Optional: export for manual/testing trigger
// export { runBackup };



import cron, { setLogger } from "node-cron";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

const BACKUP_DIR = process.env.BACKUP_DIR || "/backups/postgres";
const RETENTION_DAYS = 30;
const CRON_EXPRESSION = "0 2 * * *";
const CRON_TIMEZONE = process.env.TZ || "Asia/Kolkata";

setLogger({
  info: (msg) => console.log(`[NODE-CRON][INFO] ${msg}`),
  warn: (msg) => console.warn(`[NODE-CRON][WARN] ${msg}`),
  error: (msg, err) => console.error(`[NODE-CRON][ERROR] ${msg}`, err || ""),
  debug: (msg) => console.debug(`[NODE-CRON][DEBUG] ${msg}`),
});

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log(`📁 Created backup directory: ${BACKUP_DIR}`);
} else {
  console.log(`📁 Backup directory exists: ${BACKUP_DIR}`);
}

function runBackup() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const fileName = `timetrack_${timestamp}.dump`;
  const filePath = path.join(BACKUP_DIR, fileName);

  const { DB_USER, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT } = process.env;

  console.log(`🕑 Backup started at: ${now.toISOString()}`);
  console.log(`📦 Backup target file: ${filePath}`);
  console.log(`🗄️ DB: host=${DB_HOST}, port=${DB_PORT || 5432}, db=${DB_NAME}, user=${DB_USER}`);

  if (!DB_USER || !DB_HOST || !DB_NAME || !DB_PASSWORD) {
    console.error("❌ Missing DB environment variables. Check DB_USER, DB_HOST, DB_NAME, DB_PASSWORD.");
    return;
  }

  const command = `pg_dump -U "${DB_USER}" -h "${DB_HOST}" -p "${DB_PORT || 5432}" -Fc "${DB_NAME}" -f "${filePath}"`;

  exec(
    command,
    { env: { ...process.env, PGPASSWORD: DB_PASSWORD } },
    (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Backup failed: ${error.message}`);
        if (stderr) console.error(`❌ Backup stderr: ${stderr}`);
        return;
      }

      if (stderr) {
        console.warn(`⚠️ Backup stderr: ${stderr}`);
      }

      console.log(`✅ Backup created successfully: ${filePath}`);
      cleanupOldBackups();
    }
  );
}

function cleanupOldBackups() {
  const now = Date.now();

  fs.readdir(BACKUP_DIR, (err, files) => {
    if (err) {
      console.error("❌ Cleanup read error:", err);
      return;
    }

    console.log(`🧹 Checking ${files.length} files for cleanup in ${BACKUP_DIR}`);

    files.forEach((file) => {
      const filePath = path.join(BACKUP_DIR, file);

      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error(`❌ Failed to read file stats: ${filePath}`, err);
          return;
        }

        const ageDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);

        if (ageDays > RETENTION_DAYS) {
          fs.unlink(filePath, (err) => {
            if (err) {
              console.error(`❌ Failed to delete old backup: ${file}`, err);
              return;
            }
            console.log(`🗑️ Deleted old backup: ${file}`);
          });
        }
      });
    });
  });
}

export function initDbBackupCron() {
  if (!cron.validate(CRON_EXPRESSION)) {
    console.error(`❌ Invalid cron expression: ${CRON_EXPRESSION}`);
    return;
  }

  console.log(`⏰ Scheduling DB backup cron: ${CRON_EXPRESSION}`);
  console.log(`🌍 Cron timezone: ${CRON_TIMEZONE}`);
  console.log(`📂 Backup directory: ${BACKUP_DIR}`);

  const task = cron.schedule(
    CRON_EXPRESSION,
    () => {
      console.log("🚀 Cron triggered, starting scheduled DB backup...");
      runBackup();
    },
    {
      timezone: CRON_TIMEZONE,
    }
  );

  task.on("execution:missed", (ctx) => {
    console.warn(`⚠️ Cron execution missed at: ${ctx.date?.toISOString?.() || "unknown time"}`);
  });

  task.on("execution:started", (ctx) => {
    console.log(`▶️ Cron execution started at: ${ctx.date?.toISOString?.() || "unknown time"}`);
  });

  task.on("execution:finished", (ctx) => {
    console.log(`✅ Cron execution finished at: ${ctx.date?.toISOString?.() || "unknown time"}`);
  });

  task.on("execution:failed", (ctx) => {
    console.error(`❌ Cron execution failed at: ${ctx.date?.toISOString?.() || "unknown time"}`);
    if (ctx.execution?.error) {
      console.error("❌ Cron execution error:", ctx.execution.error);
    }
  });

  console.log("✅ DB backup cron scheduled successfully");
}

export { runBackup };
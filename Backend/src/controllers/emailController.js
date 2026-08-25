// src/controllers/emailController.js
import cron from "node-cron";
import db from "../config/database.js";
import { sendSingleEmail, verifyConnection } from "../services/emailService.js";

// ═════════════════════════════════════════════════════════════════════════════
// CONDITION 1 — DAILY MISSED TIMESHEET REMINDER
// ─────────────────────────────────────────────────────────────────────────────
// WHEN : Mon–Sat at 8:00 PM (cron — auto-started on server boot)
// WHO  : Every active non-admin employee with < 480 min logged today
// ═════════════════════════════════════════════════════════════════════════════
export const triggerMissedTimesheetReminder = async () => {
  const today = new Date().toISOString().split("T")[0];
  console.log(`\n📧 [Cond 1] Missed-timesheet check for ${today}...`);
  const defaulters = [];

  // ✅ Helper: normalize any email format safely
  const normalizeEmail = (value = "") => {
    const match = value.match(/<([^>]+)>/); // Extract if "Name <email>"
    return (match ? match[1] : value).toLowerCase().trim();
  };

  // 🔴 Hardcoded exclusion list (temporary solution)
  const excludedEmails = new Set(
    [
      "balaram.p@abhiyantatech.com",
      "umesh@abhiyantatech.com",
      "accounts@abhiyantatech.com",
      "kishor.j@abhiyantatech.com",
      "anand@abhiyantatech.com",
      "swapnil.m@abhiyantatech.com",
      "mahesh.b@abhiyantatech.com",
    ].map(normalizeEmail),
  );

  try {
    const { rows } = await db.query(
      `
      SELECT
        e.employee_id,
        e.first_name,
        e.last_name,
        e.email,
        COALESCE(SUM(dte.total_hours), 0) AS logged_mins
      FROM employees e
      LEFT JOIN daily_timesheet_entries dte
             ON dte.employee_id = e.employee_id
            AND dte.entry_date  = $1
      WHERE e.is_active = true
        AND e.role != (SELECT id FROM user_roles WHERE name = 'ADMIN')
      GROUP BY e.employee_id, e.first_name, e.last_name, e.email
      HAVING COALESCE(SUM(dte.total_hours), 0) < 480
      ORDER BY e.first_name
      `,
      [today],
    );

    if (!rows.length) {
      console.log("  ✅ All employees have 8+ hours. No emails sent.");
      return;
    }

    console.log(`  ⚠  ${rows.length} employee(s) need a reminder.`);

    const displayDate = new Date(today).toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const fmt = (m) => {
      const h = Math.floor(m / 60);
      const min = m % 60;
      return h > 0 && min > 0 ? `${h}h ${min}m` : h > 0 ? `${h}h` : `${min}m`;
    };

    let sentCount = 0;
    let skippedCount = 0;

    for (const emp of rows) {
      const email = normalizeEmail(emp.email);

      // 🔴 Skip excluded emails (case-insensitive + display-safe)
      if (excludedEmails.has(email)) {
        console.log(`  ⏭ Skipping ${emp.email} (excluded manually)`);
        skippedCount++;
        continue;
      }

      const logged = parseInt(emp.logged_mins, 10);
      const remaining = 480 - logged;
      defaulters.push({
        name: `${emp.first_name} ${emp.last_name}`,
        email: emp.email,
        logged,
        remaining,
      });
      const subject =
        logged === 0
          ? `Action Required: No Timesheet Entry for ${displayDate}`
          : `Reminder: Incomplete Timesheet — Only ${fmt(logged)} logged for ${displayDate}`;

      const body = `==================================================
              TIMESHEET REMINDER
==================================================
Hi ${emp.first_name} ${emp.last_name},
This is a reminder regarding your timesheet for:

📅 ${displayDate}
--------------------------------------------------
${
  logged === 0
    ? `❗ You have not logged any time entries today.`
    : `⏳ You have logged ${fmt(logged)} out of the required 8 hours.`
}
🕒 Remaining time to log: ${fmt(remaining)}
--------------------------------------------------
Please update your timesheet at the earliest:
${process.env.APP_URL || "https://timetrack.abhiyantatech.com"}

If you have already completed your entries, please ignore this message.

Note:This is an auto-generated mail. Please do not reply.`;

      try {
        await sendSingleEmail({ to: emp.email, subject, body });

        console.log(
          `  ✅ → ${emp.email} [logged: ${logged}m, remaining: ${remaining}m]`,
        );

        sentCount++;
      } catch (err) {
        console.error(`  ❌ → ${emp.email}: ${err.message}`);
      }
    }
    // ── Send summary to Admin/HR ─────────────────────────────
    if (defaulters.length) {
      const adminEmail = "lokesh.j@abhiyantatech.com"; // change if needed

      const list = defaulters
        .map(
          (d, i) =>
            `${i + 1}. ${d.name} (${d.email})  | Logged: ${fmt(d.logged)} | Remaining: ${fmt(d.remaining)}`,
        )
        .join("\n\n");

      const subject = `Timesheet Defaulters — ${displayDate}`;

      const body = `Hi,

The following employees have not completed their timesheet for:

📅 ${displayDate}

--------------------------------------------------
EMPLOYEE LIST
--------------------------------------------------
${list}

--------------------------------------------------

Total Defaulters: ${defaulters.length}

Please follow up if required.

Note: This is an auto-generated mail. Please do not reply.
`;

      try {
        await sendSingleEmail({
          to: adminEmail,
          subject,
          body,
        });

        console.log(`  📊 Summary email sent → ${adminEmail}`);
      } catch (err) {
        console.error("  ❌ Failed to send summary email:", err.message);
      }
    }

    console.log(
      `\n  📊 Summary: Sent=${sentCount}, Skipped=${skippedCount}, TotalChecked=${rows.length}`,
    );
    console.log("  📊 Condition 1 done.\n");
  } catch (err) {
    console.error("❌ [Cond 1] Error:", err.message);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// CONDITION 2 — TIMESHEET WEEK SUBMITTED
// ─────────────────────────────────────────────────────────────────────────────
// WHEN : Called from entryController.js → submitWeek() after COMMIT
// WHO  : Each unique manager assigned to the submitted entries for that week
//        (manager_id on daily_timesheet_entries — already resolved per-entry
//         by submitWeek's approver logic, including AIS internal billing →
//         module_manager_id routing)
//        One consolidated email per manager. Entries with manager_id=NULL
//        go to Admin (skipped unless ADMIN_EMAIL is set in .env).
//
// Wire in entryController.js — already done — just after COMMIT:
//   triggerTimesheetSubmitted({ employeeId, weekStart, weekEnd }).catch(...)
// ═════════════════════════════════════════════════════════════════════════════
export const triggerTimesheetSubmitted = async ({
  employeeId,
  weekStart,
  weekEnd,
}) => {
  console.log(
    `\n📧 [Cond 2] Timesheet submitted — employee: ${employeeId} | week: ${weekStart} → ${weekEnd}`,
  );

  try {
    // ── 1. Submitter info ───────────────────────────────────────────────────
    const { rows: empRows } = await db.query(
      `SELECT first_name, last_name, email FROM employees WHERE employee_id = $1`,
      [employeeId],
    );
    if (!empRows.length) throw new Error(`Employee ${employeeId} not found.`);
    const emp = empRows[0];
    const empName = `${emp.first_name} ${emp.last_name}`;

    // ── 2. Fetch all submitted entries for this week (with full context) ────
    //    GROUP BY manager so we can send one email per manager later.
    //    We include ticket name, project name, entry_date, total_hours
    //    so the email body shows a proper breakdown.
    const { rows: entries } = await db.query(
      `
      SELECT
        dte.entry_id,
        dte.entry_date,
        dte.total_hours,
        dte.manager_id,
        mgr.first_name      AS mgr_first,
        mgr.last_name       AS mgr_last,
        mgr.email           AS mgr_email,
        tm.ticket_name,
        tm.zoho_crm_code    AS ticket_code,
        pm.project_name
      FROM daily_timesheet_entries dte
      JOIN timesheet_status ts ON ts.id = dte.status AND ts.name = 'Submitted'
      LEFT JOIN employees   mgr ON mgr.employee_id = dte.manager_id
      LEFT JOIN ticket_master  tm  ON tm.ticket_id   = dte.ticket_id
      LEFT JOIN project_master pm  ON pm.project_id  = dte.project_id
      WHERE dte.employee_id     = $1
        AND dte.week_start_date = $2
        AND dte.week_end_date   = $3
      ORDER BY dte.entry_date, tm.ticket_name
      `,
      [employeeId, weekStart, weekEnd],
    );

    if (!entries.length) {
      console.warn("  ⚠  No submitted entries found. Email skipped.");
      return;
    }

    // ── 3. Group entries by manager ─────────────────────────────────────────
    //    Key = manager_id (or "__ADMIN__" if NULL)
    const grouped = new Map();

    for (const row of entries) {
      const key = row.manager_id || "__ADMIN__";

      if (!grouped.has(key)) {
        grouped.set(key, {
          managerId: row.manager_id,
          mgrFirst: row.mgr_first,
          mgrLast: row.mgr_last,
          mgrEmail: row.mgr_email,
          entries: [],
        });
      }
      grouped.get(key).entries.push(row);
    }

    // ── 4. Date helpers ─────────────────────────────────────────────────────
    const fmt = (m) => {
      const h = Math.floor(m / 60),
        min = m % 60;
      return h > 0 && min > 0 ? `${h}h ${min}m` : h > 0 ? `${h}h` : `${min}m`;
    };
    const fmtDate = (d) =>
      new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    const weekLabel = `${fmtDate(weekStart)} – ${fmtDate(weekEnd)}`;

    // ── 5. Send one email per manager ───────────────────────────────────────
    for (const [key, group] of grouped) {
      // NULL manager_id → Admin approves directly
      // Send to ADMIN_EMAIL if configured, else skip
      const toEmail = group.mgrEmail || process.env.ADMIN_EMAIL || null;
      if (!toEmail) {
        console.log(
          `  ℹ  manager_id=NULL and no ADMIN_EMAIL set — skipping that group.`,
        );
        continue;
      }

      const greeting = group.mgrFirst
        ? `${group.mgrFirst} ${group.mgrLast}`
        : "Admin";

      // Build entry table as plain text
      const lines = group.entries.map(
        (e) =>
          `  ${fmtDate(e.entry_date)}  |  ${e.project_name || "—"}  |  ${e.ticket_name || "—"} [${e.ticket_code || "—"}]  |  ${fmt(e.total_hours)}`,
      );

      const totalMins = group.entries.reduce(
        (s, e) => s + Number(e.total_hours),
        0,
      );

      const subject = `Timesheet Submitted for Approval — ${empName} (${weekLabel})`;

      const body =
        `Hi ${greeting},\n\n` +
        `${empName} has submitted timesheet for the week of ${weekLabel} and it is awaiting your approval.\n\n` +
        `──────────────────────────────────────────────────\n` +
        `SUBMISSION SUMMARY\n` +
        `──────────────────────────────────────────────────\n` +
        `Employee   : ${empName}\n` +
        `Week       : ${weekLabel}\n` +
        `Total Hours: ${fmt(totalMins)}\n` +
        `Entries    : ${group.entries.length}\n` +
        `─────────────────────────────────────────────────────────────────────────────\n` +
        `DATE          |  PROJECT            |  TICKET                     |  HOURS\n` +
        `─────────────────────────────────────────────────────────────────────────────\n` +
        lines.join("\n") +
        "\n" +
        `─────────────────────────────────────────────────────────────────────────────\n\n` +
        `Please log in to review and approve:\n` +
        `${process.env.APP_URL || "https://timetrack.abhiyantatech.com"}\n\n` +
        `Note:This is an auto-generated mail. Please do not reply.`;

      try {
        await sendSingleEmail({ to: toEmail, subject, body });
        console.log(
          `  ✅ → ${toEmail} (${greeting}) | ${group.entries.length} entries | ${fmt(totalMins)}`,
        );
      } catch (err) {
        console.error(`  ❌ → ${toEmail}: ${err.message}`);
      }
    }

    console.log("  📊 Condition 2 done.\n");
  } catch (err) {
    console.error("❌ [Cond 2] Error:", err.message);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// CONDITION 3A — TICKET ASSIGNED TO EMPLOYEE
// ─────────────────────────────────────────────────────────────────────────────
// Wire in ticketAssignmentController.js (already done):
//   import { triggerEmployeeTicketAssigned } from "../emailController.js";
//   await triggerEmployeeTicketAssigned({ ticketAssignmentId: newRow.ticket_assignments_id });
// ═════════════════════════════════════════════════════════════════════════════
export const triggerEmployeeTicketAssigned = async ({ ticketAssignmentId }) => {
  console.log(
    `\n📧 [Cond 3A] Employee ticket assigned — ${ticketAssignmentId}`,
  );

  try {
    const { rows } = await db.query(
      `
      SELECT
        ae.first_name          AS emp_first,
        ae.last_name           AS emp_last,
        ae.email               AS emp_email,
        ar.first_name          AS assigner_first,
        ar.last_name           AS assigner_last,
        tm.ticket_name,
        tm.zoho_crm_code       AS ticket_code,
        tm.description         AS ticket_desc,
        tm.start_date          AS ticket_start,
        tm.end_date            AS ticket_end,
        pm.project_name,
        ta.assign_start_date,
        ta.assign_end_date,
        ta.billable_hours
      FROM  ticket_assignments ta
      JOIN  employees ae  ON ae.employee_id = ta.employee_id
      JOIN  employees ar  ON ar.employee_id = ta.assigned_by
      JOIN  ticket_master  tm ON tm.ticket_id  = ta.ticket_id
      JOIN  project_master pm ON pm.project_id = ta.project_id
      WHERE ta.ticket_assignments_id = $1
      `,
      [ticketAssignmentId],
    );

    if (!rows.length) {
      console.warn(`  ⚠  Not found.`);
      return;
    }

    const r = rows[0];
    const fmt = (d) =>
      d
        ? new Date(d).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "Not specified";
    const fmtMins = (m) => {
      const h = Math.floor(m / 60),
        min = m % 60;
      return h > 0 && min > 0 ? `${h}h ${min}m` : h > 0 ? `${h}h` : `${min}m`;
    };

    const subject = `New Ticket Assigned to You: ${r.ticket_name} [${r.ticket_code}]`;
    const body =
      `Hi ${r.emp_first} ${r.emp_last},\n\n` +
      `${r.assigner_first} ${r.assigner_last} has assigned a new ticket to you.\n\n` +
      `──────────────────────────────\n` +
      `TICKET DETAILS\n` +
      `──────────────────────────────\n` +
      `Ticket Name    : ${r.ticket_name}\n` +
      `Ticket Code    : ${r.ticket_code}\n` +
      `Project        : ${r.project_name}\n` +
      `Description    : ${r.ticket_desc || "—"}\n` +
      `Ticket Start   : ${fmt(r.ticket_start)}\n` +
      `Ticket End     : ${fmt(r.ticket_end)}\n` +
      `Assign From    : ${fmt(r.assign_start_date)}\n` +
      `Assign Until   : ${fmt(r.assign_end_date)}\n` +
      `Billable Hours : ${fmtMins(r.billable_hours)}\n` +
      `Assigned By    : ${r.assigner_first} ${r.assigner_last}\n` +
      `──────────────────────────────\n\n` +
      `Log in to view your assignments:\n` +
      `${process.env.APP_URL || "https://timetrack.abhiyantatech.com"}\n\n` +
      `Regards,\n` +
      `Timesheet System`;

    await sendSingleEmail({ to: r.emp_email, subject, body });
    console.log(`  ✅ → ${r.emp_email}\n`);
  } catch (err) {
    console.error("❌ [Cond 3A] Error:", err.message);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// CONDITION 3B — TICKET ASSIGNED TO MANAGER (ticket_manager_scope)
// ─────────────────────────────────────────────────────────────────────────────
// Wire in managerTicketAssignmentController.js (already done):
//   import { triggerManagerTicketAssigned } from "../emailController.js";
//   await triggerManagerTicketAssigned({ ticketManagerScopeId: newRow.id });
// ═════════════════════════════════════════════════════════════════════════════
export const triggerManagerTicketAssigned = async ({
  ticketManagerScopeId,
}) => {
  console.log(
    `\n📧 [Cond 3B] Manager ticket scope assigned — ${ticketManagerScopeId}`,
  );

  try {
    const { rows } = await db.query(
      `
      SELECT
        mgr.first_name         AS mgr_first,
        mgr.last_name          AS mgr_last,
        mgr.email              AS mgr_email,
        ar.first_name          AS assigner_first,
        ar.last_name           AS assigner_last,
        tm.ticket_name,
        tm.zoho_crm_code       AS ticket_code,
        tm.description         AS ticket_desc,
        tm.start_date          AS ticket_start,
        tm.end_date            AS ticket_end,
        pm.project_name,
        tms.assign_start_date,
        tms.assign_end_date,
        tms.billable_hours
      FROM  ticket_manager_scope tms
      JOIN  employees mgr ON mgr.employee_id = tms.manager_id
      JOIN  employees ar  ON ar.employee_id  = tms.assigned_by
      JOIN  ticket_master  tm ON tm.ticket_id  = tms.ticket_id
      JOIN  project_master pm ON pm.project_id = tms.project_id
      WHERE tms.id = $1
      `,
      [ticketManagerScopeId],
    );

    if (!rows.length) {
      console.warn(`  ⚠  Not found.`);
      return;
    }

    const r = rows[0];
    const fmt = (d) =>
      d
        ? new Date(d).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "Not specified";
    const fmtMins = (m) => {
      const h = Math.floor(m / 60),
        min = m % 60;
      return h > 0 && min > 0 ? `${h}h ${min}m` : h > 0 ? `${h}h` : `${min}m`;
    };

    const subject = `New Ticket Scope Assigned to You: ${r.ticket_name} [${r.ticket_code}]`;
    const body =
      `Hi ${r.mgr_first} ${r.mgr_last},\n\n` +
      `${r.assigner_first} ${r.assigner_last} has assigned a ticket scope to you for management.\n\n` +
      `──────────────────────────────\n` +
      `TICKET DETAILS\n` +
      `──────────────────────────────\n` +
      `Ticket Name    : ${r.ticket_name}\n` +
      `Ticket Code    : ${r.ticket_code}\n` +
      `Project        : ${r.project_name}\n` +
      `Description    : ${r.ticket_desc || "—"}\n` +
      `Ticket Start   : ${fmt(r.ticket_start)}\n` +
      `Ticket End     : ${fmt(r.ticket_end)}\n` +
      `Scope From     : ${fmt(r.assign_start_date)}\n` +
      `Scope Until    : ${fmt(r.assign_end_date)}\n` +
      `Billable Hours : ${fmtMins(r.billable_hours)}\n` +
      `Assigned By    : ${r.assigner_first} ${r.assigner_last}\n` +
      `──────────────────────────────\n\n` +
      `Log in to view your ticket scope:\n` +
      `${process.env.APP_URL || "https://timetrack.abhiyantatech.com"}` +
      `Regards,\nTimesheet System`;

    await sendSingleEmail({ to: r.mgr_email, subject, body });
    console.log(`  ✅ → ${r.mgr_email}\n`);
  } catch (err) {
    console.error("❌ [Cond 3B] Error:", err.message);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// CONDITION 4 — TIMESHEET APPROVED OR REJECTED
// ─────────────────────────────────────────────────────────────────────────────
// WHEN : Called from approvalController.js → approveRejectWeek() after COMMIT
//        Fires for BOTH Manager and Admin decisions.
// WHO  : The employee whose timesheet was just approved or rejected
//
// Wire in approvalController.js (already done) — just after each COMMIT:
//   triggerTimesheetDecision({ employeeId, weekStart, weekEnd, action,
//     actorId, actorRole, comments, finalStatus }).catch(...)
// ═════════════════════════════════════════════════════════════════════════════
export const triggerTimesheetDecision = async ({
  employeeId,
  weekStart,
  weekEnd,
  action, // 'approve' | 'reject'
  actorId, // UUID of manager/admin who acted
  actorRole, // 'MANAGER' | 'ADMIN'
  comments, // rejection reason or null
  finalStatus, // computed overall status from approvalController
}) => {
  const label = action === "approve" ? "Approved" : "Rejected";
  console.log(
    `\n📧 [Cond 4] Timesheet ${label} — employee: ${employeeId} | week: ${weekStart} → ${weekEnd} | by: ${actorRole}`,
  );

  try {
    // ── 1. Fetch employee (recipient) ───────────────────────────────────────
    const { rows: empRows } = await db.query(
      `SELECT first_name, last_name, email FROM employees WHERE employee_id = $1`,
      [employeeId],
    );
    if (!empRows.length) throw new Error(`Employee ${employeeId} not found.`);
    const emp = empRows[0];
    const empName = `${emp.first_name} ${emp.last_name}`;

    // ── 2. Fetch actor (manager/admin who approved/rejected) ────────────────
    const { rows: actorRows } = await db.query(
      `SELECT first_name, last_name FROM employees WHERE employee_id = $1`,
      [actorId],
    );
    const actorName = actorRows.length
      ? `${actorRows[0].first_name} ${actorRows[0].last_name}`
      : actorRole;

    // ── 3. Date and status formatting ───────────────────────────────────────
    const fmtDate = (d) =>
      new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    const weekLabel = `${fmtDate(weekStart)} – ${fmtDate(weekEnd)}`;

    // Map computed finalStatus to a human-readable label
    const statusLabels = {
      Approved: "Fully Approved ✅",
      Rejected: "Fully Rejected ❌",
      Partially_Approved: "Partially Approved ⚠️",
      Partially_Rejected: "Partially Rejected ⚠️",
      Submitted: "Pending (awaiting other approvals) ⏳",
    };
    const statusDisplay = statusLabels[finalStatus] || finalStatus;

    // ── 4. Build email ──────────────────────────────────────────────────────
    const isApproved = action === "approve";
    const subject = isApproved
      ? `Timesheet ${actorRole === "ADMIN" ? "Final " : ""}Approved — ${weekLabel}`
      : `Timesheet ${actorRole === "ADMIN" ? "Final " : ""}Rejected — ${weekLabel}`;

    const body =
      `Hi ${emp.first_name} ${emp.last_name},\n\n` +
      (isApproved
        ? `Your timesheet for the week of ${weekLabel} has been approved by ${actorName} (${actorRole}).\n`
        : `Your timesheet for the week of ${weekLabel} has been rejected by ${actorName} (${actorRole}).\n`) +
      `\n` +
      `──────────────────────────────\n` +
      `DECISION SUMMARY\n` +
      `──────────────────────────────\n` +
      `Week        : ${weekLabel}\n` +
      `Action By   : ${actorName} (${actorRole})\n` +
      `Overall Status: ${statusDisplay}\n` +
      (comments ? `Reason/Comments: ${comments}\n` : "") +
      `──────────────────────────────\n\n` +
      (isApproved
        ? `No further action is needed from you for this week.\n`
        : `Please log in to review the feedback and resubmit your timesheet:\n` +
          `${process.env.APP_URL || "https://timetrack.abhiyantatech.com"}`) +
      `\nRegards,\nTimesheet System`;

    await sendSingleEmail({ to: emp.email, subject, body });
    console.log(
      `  ✅ Decision email → ${emp.email} [${label} | ${finalStatus}]\n`,
    );
  } catch (err) {
    console.error("❌ [Cond 4] Error:", err.message);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// CRON INIT — call once from server.js on startup
// ══════════╗═╗═╗═╗═╗═╗═╗═╗═╗═╗═╗═╗═╗═╗═╗═╗═╗═╗═╗═╗═╗═╗═╗═╗─
export const initEmailCrons = () => {
  cron.schedule("0 18 * * 1-5", () => triggerMissedTimesheetReminder(), {
    timezone: process.env.CRON_TIMEZONE || "Asia/Kolkata",
  });
  console.log("📅 Email cron: Missed timesheet reminder");
};

// ═════════════════════════════════════════════════════════════════════════════
// REST HANDLERS
// ═════════════════════════════════════════════════════════════════════════════
export const healthCheck = (req, res) => {
  res.json({
    status: "ok",
    email: process.env.OUTLOOK_EMAIL || "not configured",
  });
};

export const verifySmtp = async (req, res) => {
  try {
    await verifyConnection();
    res.json({ success: true, message: "SMTP connection verified!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

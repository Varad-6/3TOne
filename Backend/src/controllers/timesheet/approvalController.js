// import pool from "../../config/database.js";

// // Helper: resolve a single timesheet_status id from its name
// async function getTimesheetStatusId(statusName) {
//   const result = await pool.query(
//     "SELECT id FROM timesheet_status WHERE name = $1",
//     [statusName],
//   );
//   if (result.rows.length === 0) {
//     throw new Error(`Timesheet status "${statusName}" not found`);
//   }
//   return result.rows[0].id;
// }

// // Helper: resolve multiple timesheet_status ids from names
// async function getTimesheetStatusIds(statusNames) {
//   if (!statusNames || statusNames.length === 0) return [];
//   const result = await pool.query(
//     "SELECT id, name FROM timesheet_status WHERE name = ANY($1)",
//     [statusNames],
//   );
//   const map = new Map(result.rows.map((r) => [r.name, r.id]));
//   return statusNames.map((name) => {
//     const id = map.get(name);
//     if (id === undefined) {
//       throw new Error(`Timesheet status "${name}" not found`);
//     }
//     return id;
//   });
// }

// // ✅ Helper function to extract date from various formats
// function extractDateString(dateInput) {
//   if (!dateInput) return null;

//   // Already in YYYY-MM-DD format
//   if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
//     return dateInput;
//   }

//   // ISO string with time (e.g., "2025-12-08T00:00:00.000Z")
//   if (typeof dateInput === "string" && dateInput.includes("T")) {
//     return dateInput.split("T")[0];
//   }

//   // Try to parse as date
//   try {
//     const date = new Date(dateInput);
//     if (!isNaN(date.getTime())) {
//       return date.toISOString().split("T")[0];
//     }
//   } catch (e) {
//     console.error("Date parsing error:", e);
//   }

//   return null;
// }

// // ===============================
// // ✅ FIXED: APPROVE/REJECT WEEK - Support Multi-Manager Scenarios
// // ===============================
// export const approveRejectWeek = async (req, res) => {
//   const client = await pool.connect();

//   try {
//     const { id: userId, role: userRole } = req.user;
//     let { employeeId, weekStart, weekEnd, action, comments } = req.body;

//     weekStart = extractDateString(weekStart);
//     weekEnd = extractDateString(weekEnd);

//     if (!employeeId || !weekStart || !weekEnd || !action) {
//       return res.status(400).json({ error: "Missing required fields" });
//     }

//     if (!["approve", "reject"].includes(action)) {
//       return res.status(400).json({
//         error: "Invalid action. Must be 'approve' or 'reject'",
//       });
//     }

//     if (userId === employeeId) {
//       return res.status(403).json({ error: "Cannot self-approve" });
//     }

//     if (!["MANAGER", "ADMIN"].includes(userRole)) {
//       return res.status(403).json({ error: "Unauthorized" });
//     }

//     await client.query("BEGIN");

//     // --------------------------------------------------
//     // 1️⃣ Resolve Status IDs
//     // --------------------------------------------------

//     const submittedStatusId = await getTimesheetStatusId("Submitted");
//     const managerApprovedId = await getTimesheetStatusId("Manager_Approved");
//     const managerRejectedId = await getTimesheetStatusId("Manager_Rejected");
//     const partiallyApprovedId =
//       await getTimesheetStatusId("Partially_Approved");
//     const partiallyRejectedId =
//       await getTimesheetStatusId("Partially_Rejected");
//     const adminApprovedId = await getTimesheetStatusId("Admin_Approved");
//     const adminRejectedId = await getTimesheetStatusId("Admin_Rejected");

//     // --------------------------------------------------
//     // 2️⃣ MANAGER ACTION
//     // --------------------------------------------------

//     if (userRole === "MANAGER") {
//       const newStatusId =
//         action === "approve" ? managerApprovedId : managerRejectedId;

//       const updateResult = await client.query(
//         `
//         UPDATE daily_timesheet_entries
//         SET status = $1,
//             approved_at = CASE WHEN $2 = 'approve' THEN NOW() ELSE approved_at END,
//             approved_by = CASE WHEN $2 = 'approve' THEN $3 ELSE approved_by END,
//             rejected_at = CASE WHEN $2 = 'reject' THEN NOW() ELSE rejected_at END,
//             rejected_by = CASE WHEN $2 = 'reject' THEN $3 ELSE rejected_by END,
//             rejection_reason = CASE WHEN $2 = 'reject' THEN $4 ELSE rejection_reason END,
//             updated_at = NOW()
//         WHERE employee_id = $5
//           AND week_start_date = $6
//           AND week_end_date = $7
//           AND status = $8
//           AND manager_id = $3
//           AND NOT (manager_id = employee_id) -- prevent self-approval
//         `,
//         [
//           newStatusId,
//           action,
//           userId,
//           comments || null,
//           employeeId,
//           weekStart,
//           weekEnd,
//           submittedStatusId,
//         ],
//       );

//       if (updateResult.rowCount === 0) {
//         await client.query("ROLLBACK");
//         return res.status(400).json({
//           error: "No eligible entries found for approval/rejection.",
//         });
//       }

//       // --------------------------------------------------
//       // 3️⃣ Recalculate Final Week Status (scoped per manager slice)
//       // --------------------------------------------------
//       // We aggregate counts across ALL entries for the week so the
//       // overall "week status" reflects the complete picture.
//       // We deliberately do NOT overwrite every entry's status — we
//       // only touched this manager's entries above.  The aggregation
//       // here is for the response payload only.

//       const aggregation = await client.query(
//         `
//         SELECT
//           COUNT(*) FILTER (WHERE status = $1) AS approved_count,
//           COUNT(*) FILTER (WHERE status = $2) AS rejected_count,
//           COUNT(*) FILTER (WHERE status = $3) AS pending_count
//         FROM daily_timesheet_entries
//         WHERE employee_id     = $4
//           AND week_start_date = $5
//           AND week_end_date   = $6
//         `,
//         [
//           managerApprovedId,
//           managerRejectedId,
//           submittedStatusId,
//           employeeId,
//           weekStart,
//           weekEnd,
//         ],
//       );

//       const { approved_count, rejected_count, pending_count } =
//         aggregation.rows[0];

//       let finalStatusName = null;

//       if (Number(pending_count) > 0) {
//         finalStatusName = "Submitted"; // still waiting on other managers
//       } else if (Number(approved_count) > 0 && Number(rejected_count) > 0) {
//         finalStatusName = "Partially_Approved";
//       }else if (Number(approved_count) > 0 && Number(rejected_count) === 0) {
//         finalStatusName = "Partially_Rejected";
//       }else if (Number(rejected_count) > 0) {
//         finalStatusName = "Manager_Approved";
//       } else if (Number(rejected_count) > 0) {
//         finalStatusName = "Manager_Rejected";
//       }

//       await client.query("COMMIT");

//       return res.json({
//         message: `Manager ${action} completed.`,
//         entriesUpdated: updateResult.rowCount,
//         finalStatus: finalStatusName,
//       });
//     }

//     // --------------------------------------------------
//     // 4️⃣ ADMIN ACTION (FINAL DECISION)
//     // --------------------------------------------------

//     if (userRole === "ADMIN") {
//       const newStatusId =
//         action === "approve" ? adminApprovedId : adminRejectedId;

//       // Admin can only finalise entries that are Submitted, Manager_Approved,
//       // or Partially_Approved — not re-decide already Admin-decided ones.
//       const adminEligibleIds = [
//         submittedStatusId,
//         managerApprovedId,
//         partiallyApprovedId,
//       ];

//       const updateResult = await client.query(
//         `
//         UPDATE daily_timesheet_entries
//         SET status           = $1,
//             approved_at      = CASE WHEN $2 = 'approve' THEN NOW() ELSE approved_at END,
//             approved_by      = CASE WHEN $2 = 'approve' THEN $3    ELSE approved_by END,
//             rejected_at      = CASE WHEN $2 = 'reject'  THEN NOW() ELSE rejected_at END,
//             rejected_by      = CASE WHEN $2 = 'reject'  THEN $3    ELSE rejected_by END,
//             rejection_reason = CASE WHEN $2 = 'reject'  THEN $4    ELSE rejection_reason END,
//             updated_at       = NOW()
//         WHERE employee_id     = $5
//           AND week_start_date = $6
//           AND week_end_date   = $7
//           AND status          = ANY($8::int[])
//           AND NOT (employee_id = $3)   -- self-approval guard
//         `,
//         [
//           newStatusId,
//           action,
//           userId,
//           comments || null,
//           employeeId,
//           weekStart,
//           weekEnd,
//           adminEligibleIds,
//         ],
//       );

//       if (updateResult.rowCount === 0) {
//         await client.query("ROLLBACK");
//         return res.status(400).json({
//           error:
//             "No eligible entries found for admin approval/rejection. " +
//             "Entries may already be finalised or not yet manager-reviewed.",
//         });
//       }

//       await client.query("COMMIT");

//       return res.json({
//         message: `Admin ${action} completed.`,
//         entriesUpdated: updateResult.rowCount,
//         finalStatus: action === "approve" ? "Admin_Approved" : "Admin_Rejected",
//       });
//     }
//   } catch (error) {
//     await client.query("ROLLBACK");
//     console.error("❌ Approve/Reject error:", error);
//     return res.status(500).json({
//       error: "Failed to approve/reject",
//       details: error.message,
//     });
//   } finally {
//     client.release();
//   }
// };

// // ===============================
// // ✅ GET PENDING APPROVALS - Return per-entry billable hours
// // ===============================
// export const getPendingApprovals = async (req, res) => {
//   try {
//     const { id: userId, role } = req.user;
//     const statusFilter = req.query.status;

//     let targetStatusNames = [];
//     if (statusFilter && statusFilter !== "all") {
//       targetStatusNames = [statusFilter];
//     } else {
//       if (role === "MANAGER") targetStatusNames = ["Submitted"];
//       // ADMIN sees entries that have passed manager review OR submitted directly
//       // (manager submitted own project → Submitted with manager_id = NULL, no manager stop)
//       // and entries already manager-approved / partially-approved awaiting final sign-off.
//       if (role === "ADMIN")
//         targetStatusNames = [
//           "Submitted",
//           "Manager_Approved",
//           "Manager_Rejected",
//           "Partially_Approved",
//           "Partially_Rejected",
//         ];
//     }

//     if (targetStatusNames.length === 0) {
//       return res.json({ pendingApprovals: [] });
//     }

//     const targetStatusIds = await getTimesheetStatusIds(targetStatusNames);
//     const isManager = role === "MANAGER";

//     // ✅ Build params FIRST to avoid $2 reference issues
//     const params = [targetStatusIds];
//     let whereClause = "d.status = ANY($1::int[])";

//     if (isManager) {
//       params.push(userId);
//       const managerParamIndex = params.length;

//       whereClause += `
//     AND d.manager_id = $${managerParamIndex}
//     AND NOT (d.manager_id = d.employee_id)
//   `;
//     }

//     // ✅ SAFE: No $2 in JSON_AGG - use CASE with boolean logic
//     let query = `
//       SELECT
//         d.employee_id,
//         e.employee_code,
//         (e.first_name || ' ' || e.last_name) as employee_name,
//         e.designation,
//         dept.name as department,
//         d.week_start_date,
//         d.week_end_date,
//         SUM(d.total_hours) as total_hours,
//         SUM(d.billable_hours) as total_billable_hours,
//         SUM(d.non_billable_hours) as total_non_billable_hours,
//         COUNT(*) as entry_count,
//         MAX(d.submitted_at) as submitted_at,
//         STRING_AGG(DISTINCT p.project_name, ', ') as projects,
//         STRING_AGG(DISTINCT t.ticket_name, ', ') as activities,
//         MIN(ts.name) as status,
//         JSON_AGG(
//           JSON_BUILD_OBJECT(
//             'entry_id', d.entry_id,
//             'date', d.entry_date,
//             'projectName', p.project_name,
//             'projectId', d.project_id,
//             'ticketName', t.ticket_name,
//             'ticketId', d.ticket_id,
//             'taskName', tm.task,
//             'taskId', d.task_id,
//             'ticket_number', d.ticket_number,
//             'billable_hours', d.billable_hours,
//             'non_billable_hours', d.non_billable_hours,
//             'total_hours', d.total_hours,
//             'description', d.description,
//             'managerId', d.manager_id,
//             'isOwn', ${isManager ? "d.manager_id = $2" : "TRUE"}
//           ) ORDER BY d.entry_date
//         ) as entries
//       FROM daily_timesheet_entries d
//       JOIN employees e ON d.employee_id = e.employee_id
//       LEFT JOIN departments dept ON e.department = dept.id
//       LEFT JOIN project_master p ON d.project_id = p.project_id
//       LEFT JOIN ticket_master t ON d.ticket_id = t.ticket_id
//       LEFT JOIN task_master tm ON d.task_id = tm.task_id
//       JOIN timesheet_status ts ON ts.id = d.status
//       WHERE ${whereClause}
//         AND d.week_start_date IS NOT NULL
//         AND d.week_end_date IS NOT NULL
//       GROUP BY
//         d.employee_id,
//         e.employee_code,
//         e.first_name,
//         e.last_name,
//         e.designation,
//         dept.name,
//         d.week_start_date,
//         d.week_end_date
//       ORDER BY d.week_start_date DESC
//     `;

//     console.log("📊 Fetching pending approvals...");
//     console.log("Query params:", params);
//     console.log("Manager filter:", isManager, "userId:", userId);

//     const result = await pool.query(query, params);
//     console.log(`✅ Found ${result.rows.length} pending approvals`);

//     res.json({ pendingApprovals: result.rows });
//   } catch (e) {
//     console.error("❌ Fetch pending error:", e);
//     res.status(500).json({ error: "Fetch failed", details: e.message });
//   }
// };

// export const getAllPendingApprovals = getPendingApprovals;

import pool from "../../config/database.js";
import { triggerTimesheetDecision } from "../emailController.js";

async function getTimesheetStatusId(statusName) {
  const result = await pool.query(
    "SELECT id FROM timesheet_status WHERE name = $1",
    [statusName],
  );
  if (result.rows.length === 0) {
    throw new Error(`Timesheet status "${statusName}" not found`);
  }
  return result.rows[0].id;
}
// Helper: resolve multiple timesheet_status ids from names
async function getTimesheetStatusIds(statusNames) {
  if (!statusNames || statusNames.length === 0) return [];
  const result = await pool.query(
    "SELECT id, name FROM timesheet_status WHERE name = ANY($1)",
    [statusNames],
  );
  const map = new Map(result.rows.map((r) => [r.name, r.id]));
  return statusNames.map((name) => {
    const id = map.get(name);
    if (id === undefined)
      throw new Error(`Timesheet status "${name}" not found`);
    return id;
  });
}
// ✅ Helper function to extract date from various formats
function extractDateString(dateInput) {
  if (!dateInput) return null;
  // Already in YYYY-MM-DD format
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput))
    return dateInput;
  // ISO string with time (e.g., "2025-12-08T00:00:00.000Z")
  if (typeof dateInput === "string" && dateInput.includes("T"))
    return dateInput.split("T")[0];
  // Try to parse as date
  try {
    const date = new Date(dateInput);
    if (!isNaN(date.getTime())) return date.toISOString().split("T")[0];
  } catch (e) {
    console.error("Date parsing error:", e);
  }
  return null;
}

// ─────────────────────────────────────────────
// OVERALL STATUS COMPUTATION
//
// Individual entry DB statuses: Draft | Submitted | Manager_Approved |
//   Manager_Rejected | Admin_Approved | Admin_Rejected
//
// Computed display status rules:
//   All approved  (Mgr or Admin)        → "Approved"
//   All rejected  (Mgr or Admin)        → "Rejected"
//   Some approved (regardless of rest)  → "Partially_Approved"
//   At least one rejected, 0 approved   → "Partially_Rejected"
//   Everything else                     → "Submitted"
// ─────────────────────────────────────────────
function computeOverallStatus({ approved, rejected, total }) {
  if (total === 0) return "Submitted";
  if (approved === total) return "Approved";
  if (rejected === total) return "Rejected";
  if (approved > 0) return "Partially_Approved";
  if (rejected > 0) return "Partially_Rejected";
  return "Submitted";
}

// ─────────────────────────────────────────────
// APPROVE / REJECT WEEK
// ─────────────────────────────────────────────
export const approveRejectWeek = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id: userId, role: userRole } = req.user;
    let { employeeId, weekStart, weekEnd, action, comments } = req.body;

    weekStart = extractDateString(weekStart);
    weekEnd = extractDateString(weekEnd);

    if (!employeeId || !weekStart || !weekEnd || !action) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!["approve", "reject"].includes(action)) {
      return res
        .status(400)
        .json({ error: "Invalid action. Must be 'approve' or 'reject'" });
    }
    if (userId === employeeId) {
      return res.status(403).json({ error: "Cannot self-approve" });
    }
    if (!["MANAGER", "ADMIN"].includes(userRole)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await client.query("BEGIN");
    // --------------------------------------------------
    // Resolve all needed status IDs up-front
    // --------------------------------------------------

    const submittedStatusId = await getTimesheetStatusId("Submitted");
    const managerApprovedId = await getTimesheetStatusId("Manager_Approved");
    const managerRejectedId = await getTimesheetStatusId("Manager_Rejected");
    const adminApprovedId = await getTimesheetStatusId("Admin_Approved");
    const adminRejectedId = await getTimesheetStatusId("Admin_Rejected");

    // ─── MANAGER ACTION ───────────────────────────────────────────────────────
    if (userRole === "MANAGER") {
      const newStatusId =
        action === "approve" ? managerApprovedId : managerRejectedId;

      // Manager may only act on entries in "Submitted" status assigned to them
      const updateResult = await client.query(
        `
        UPDATE daily_timesheet_entries
        SET status           = $1,
            approved_at      = CASE WHEN $2 = 'approve' THEN NOW() ELSE approved_at END,
            approved_by      = CASE WHEN $2 = 'approve' THEN $3    ELSE approved_by END,
            rejected_at      = CASE WHEN $2 = 'reject'  THEN NOW() ELSE rejected_at END,
            rejected_by      = CASE WHEN $2 = 'reject'  THEN $3    ELSE rejected_by END,
            rejection_reason = CASE WHEN $2 = 'reject'  THEN $4    ELSE rejection_reason END,
            updated_at       = NOW()
        WHERE employee_id     = $5
          AND week_start_date = $6
          AND week_end_date   = $7
          AND status          = $8
          AND manager_id      = $3
          AND manager_id     != employee_id   -- hard self-approval guard
        `,
        [
          newStatusId,
          action,
          userId,
          comments || null,
          employeeId,
          weekStart,
          weekEnd,
          submittedStatusId,
        ],
      );

      if (updateResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error:
            "No eligible entries found. Entries may not be in Submitted " +
            "status or may not be assigned to you.",
        });
      }

      // Compute overall display status across ALL entries in the week
      const agg = await client.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE ts.name IN ('Manager_Approved','Admin_Approved')) AS approved_count,
          COUNT(*) FILTER (WHERE ts.name IN ('Manager_Rejected','Admin_Rejected')) AS rejected_count,
          COUNT(*) AS total_count
        FROM daily_timesheet_entries d
        JOIN timesheet_status ts ON ts.id = d.status
        WHERE d.employee_id     = $1
          AND d.week_start_date = $2
          AND d.week_end_date   = $3
        `,
        [employeeId, weekStart, weekEnd],
      );

      const { approved_count, rejected_count, total_count } = agg.rows[0];
      const finalStatus = computeOverallStatus({
        approved: Number(approved_count),
        rejected: Number(rejected_count),
        total: Number(total_count),
      });

      await client.query("COMMIT");

      triggerTimesheetDecision({
        employeeId,
        weekStart,
        weekEnd,
        action,
        actorId: userId,
        actorRole: userRole,
        comments: comments || null,
        finalStatus,
      }).catch((err) =>
        console.error("📧 [Approval email] silent error:", err.message),
      );

      return res.json({
        message: `Manager ${action} completed.`,
        entriesUpdated: updateResult.rowCount,
        finalStatus,
      });
    }

    // ─── ADMIN ACTION ─────────────────────────────────────────────────────────
    //
    // CRITICAL RULE: Admin MUST NOT override Manager_Approved entries.
    //
    //   Approve → set Submitted + Manager_Rejected → Admin_Approved
    //             (Manager_Approved entries are LEFT UNTOUCHED)
    //
    //   Reject  → set Submitted + Manager_Rejected → Admin_Rejected
    //             (Manager_Approved entries are LEFT UNTOUCHED)
    //
    // ─────────────────────────────────────────────────────────────────────────
    if (userRole === "ADMIN") {
      const newStatusId =
        action === "approve" ? adminApprovedId : adminRejectedId;

      // Only act on entries that are NOT yet Manager_Approved
      const adminEligibleIds = [submittedStatusId, managerRejectedId];

      const updateResult = await client.query(
        `
        UPDATE daily_timesheet_entries
        SET status           = $1,
            approved_at      = CASE WHEN $2 = 'approve' THEN NOW() ELSE approved_at END,
            approved_by      = CASE WHEN $2 = 'approve' THEN $3    ELSE approved_by END,
            rejected_at      = CASE WHEN $2 = 'reject'  THEN NOW() ELSE rejected_at END,
            rejected_by      = CASE WHEN $2 = 'reject'  THEN $3    ELSE rejected_by END,
            rejection_reason = CASE WHEN $2 = 'reject'  THEN $4    ELSE rejection_reason END,
            updated_at       = NOW()
        WHERE employee_id     = $5
          AND week_start_date = $6
          AND week_end_date   = $7
          AND status          = ANY($8::int[])
          AND employee_id    != $3   -- self-approval guard
        `,
        [
          newStatusId,
          action,
          userId,
          comments || null,
          employeeId,
          weekStart,
          weekEnd,
          adminEligibleIds,
        ],
      );

      if (updateResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error:
            "No eligible entries found for admin action. " +
            "All entries may already be Manager_Approved, or already finalised.",
        });
      }

      // Compute overall display status after the update
      const agg = await client.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE ts.name IN ('Manager_Approved','Admin_Approved')) AS approved_count,
          COUNT(*) FILTER (WHERE ts.name IN ('Manager_Rejected','Admin_Rejected')) AS rejected_count,
          COUNT(*) AS total_count
        FROM daily_timesheet_entries d
        JOIN timesheet_status ts ON ts.id = d.status
        WHERE d.employee_id     = $1
          AND d.week_start_date = $2
          AND d.week_end_date   = $3
        `,
        [employeeId, weekStart, weekEnd],
      );

      const { approved_count, rejected_count, total_count } = agg.rows[0];
      const finalStatus = computeOverallStatus({
        approved: Number(approved_count),
        rejected: Number(rejected_count),
        total: Number(total_count),
      });

      await client.query("COMMIT");

      triggerTimesheetDecision({
        employeeId,
        weekStart,
        weekEnd,
        action,
        actorId: userId,
        actorRole: userRole,
        comments: comments || null,
        finalStatus,
      }).catch((err) =>
        console.error("📧 [Approval email] silent error:", err.message),
      );

      return res.json({
        message: `Admin ${action} completed.`,
        entriesUpdated: updateResult.rowCount,
        finalStatus,
      });
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Approve/Reject error:", error);
    return res
      .status(500)
      .json({ error: "Failed to approve/reject", details: error.message });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// GET PENDING APPROVALS
// ─────────────────────────────────────────────
export const getPendingApprovals = async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    const statusFilter = req.query.status;
    const isManager = role === "MANAGER";

    // ── Decide which individual entry-level DB statuses to include ────────────
    //
    // NOTE: "Partially_Approved" / "Partially_Rejected" are COMPUTED display
    // statuses, NOT stored per-entry.  We always query individual entry statuses
    // and compute the overall status via SQL CASE in the SELECT.
    //
    let entryStatusNames;

    if (isManager) {
      // Manager only ever sees entries awaiting their approval
      entryStatusNames = ["Submitted"];
    } else {
      // Admin sees all non-Draft entry statuses
      entryStatusNames = [
        "Submitted",
        "Manager_Approved",
        "Manager_Rejected",
        "Admin_Approved",
        "Admin_Rejected",
      ];
    }

    const entryStatusIds = await getTimesheetStatusIds(entryStatusNames);

    if (entryStatusIds.length === 0) {
      return res.json({ pendingApprovals: [] });
    }

    // ── Build WHERE clause ────────────────────────────────────────────────────
    const params = [entryStatusIds];
    let whereClause = "d.status = ANY($1::int[])";

    if (isManager) {
      params.push(userId);
      whereClause += `
        AND d.manager_id  = $${params.length}
        AND d.manager_id != d.employee_id
      `;
    }

    // $2 is userId when isManager, otherwise we use a literal in JSON_BUILD_OBJECT
    const isOwnExpr = isManager ? `(d.manager_id = $2)` : `TRUE`;

    const query = `
      SELECT
        d.employee_id,
        e.employee_code,
        (e.first_name || ' ' || e.last_name)  AS employee_name,
        e.designation,
        dept.name                              AS department,
        d.week_start_date,
        d.week_end_date,
        SUM(d.total_hours)                     AS total_hours,
        SUM(d.billable_hours)                  AS total_billable_hours,
        SUM(d.non_billable_hours)              AS total_non_billable_hours,
        COUNT(*)                               AS entry_count,
        MAX(d.submitted_at)                    AS submitted_at,
        STRING_AGG(DISTINCT p.project_name, ', ') AS projects,
        STRING_AGG(DISTINCT t.ticket_name,  ', ') AS activities,

        -- ── Computed overall status ──────────────────────────────────────────
        -- Derived purely from individual entry statuses; never stored as-is.
        CASE
          WHEN COUNT(*) FILTER (WHERE ts.name IN ('Manager_Approved','Admin_Approved'))
               = COUNT(*)
            THEN 'Approved'
          WHEN COUNT(*) FILTER (WHERE ts.name IN ('Manager_Rejected','Admin_Rejected'))
               = COUNT(*)
            THEN 'Rejected'
          WHEN COUNT(*) FILTER (WHERE ts.name IN ('Manager_Approved','Admin_Approved'))
               > 0
            THEN 'Partially_Approved'
          WHEN COUNT(*) FILTER (WHERE ts.name IN ('Manager_Rejected','Admin_Rejected'))
               > 0
            THEN 'Partially_Rejected'
          ELSE 'Submitted'
        END AS overall_status,

        -- ── Admin action eligibility ─────────────────────────────────────────
        -- TRUE when there is at least one entry an admin can still act on
        -- (Submitted or Manager_Rejected — never Manager_Approved)
        (COUNT(*) FILTER (WHERE ts.name IN ('Submitted','Manager_Rejected')) > 0)
          AS has_actionable_entries,

        -- ── Per-entry drill-down ─────────────────────────────────────────────
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'entry_id',           d.entry_id,
            'date',               d.entry_date,
            'projectName',        p.project_name,
            'projectId',          d.project_id,
            'ticketName',         t.ticket_name,
            'ticketId',           d.ticket_id,
            'ticketCode',         t.zoho_crm_code,
            'taskName',           tm.task,
            'taskId',             d.task_id,
            'ticket_number',      d.ticket_number,
            'billable_hours',     d.billable_hours,
            'non_billable_hours', d.non_billable_hours,
            'total_hours',        d.total_hours,
            'description',        d.description,
            'managerId',          d.manager_id,
            'entryStatus',        ts.name,
            'isOwn',              ${isOwnExpr},
            'isActionable',       (ts.name IN ('Submitted','Manager_Rejected')),
            'approvedAt',         d.approved_at,
            'approvedByName',     approver.first_name || ' ' || approver.last_name,
            'rejectedAt',         d.rejected_at,
            'rejectedByName',     rejector.first_name || ' ' || rejector.last_name,
            'rejectionReason',    d.rejection_reason
          ) ORDER BY d.entry_date ASC, d.created_at ASC
        ) AS entries

      FROM daily_timesheet_entries d
      JOIN  employees       e       ON d.employee_id  = e.employee_id
      LEFT JOIN departments dept    ON e.department   = dept.id
      LEFT JOIN project_master p    ON d.project_id   = p.project_id
      LEFT JOIN ticket_master  t    ON d.ticket_id    = t.ticket_id
      LEFT JOIN task_master    tm   ON d.task_id      = tm.task_id
      JOIN  timesheet_status   ts   ON ts.id          = d.status
      LEFT JOIN employees   approver ON d.approved_by = approver.employee_id
      LEFT JOIN employees   rejector ON d.rejected_by = rejector.employee_id
      WHERE ${whereClause}
        AND d.week_start_date IS NOT NULL
        AND d.week_end_date   IS NOT NULL
      GROUP BY
        d.employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.designation,
        dept.name,
        d.week_start_date,
        d.week_end_date
      ORDER BY d.week_start_date DESC
    `;

    console.log("📊 Fetching pending approvals for role:", role);
    const result = await pool.query(query, params);
    console.log(`✅ Found ${result.rows.length} timesheet groups`);

    // ── Optional client-side status filter (admin only) ───────────────────────
    // The frontend may pass a specific overall_status to filter by.
    // We filter here so we don't need a HAVING clause that would complicate the query.
    let rows = result.rows;
    if (
      !isManager &&
      statusFilter &&
      statusFilter !== "all" &&
      statusFilter !== "history"
    ) {
      // Map frontend filter values → computed overall_status values
      const filterMap = {
        Submitted: "Submitted",
        Manager_Approved: "Approved", // pure manager-approved week
        Manager_Rejected: "Rejected", // pure manager-rejected week
        Partially_Approved: "Partially_Approved",
        Partially_Rejected: "Partially_Rejected",
        Admin_Approved: "Approved",
        Admin_Rejected: "Rejected",
        history: null, // show all; handled below
      };

      const targetOverall = filterMap[statusFilter];

      if (statusFilter === "history") {
        // "history" = show Admin_Approved / Admin_Rejected (finalised) weeks only
        rows = rows.filter(
          (r) =>
            r.overall_status === "Approved" || r.overall_status === "Rejected",
        );
      } else if (targetOverall) {
        rows = rows.filter((r) => r.overall_status === targetOverall);
      }
    }

    res.json({ pendingApprovals: rows });
  } catch (e) {
    console.error("❌ Fetch pending error:", e);
    res.status(500).json({ error: "Fetch failed", details: e.message });
  }
};

export const getAllPendingApprovals = getPendingApprovals;

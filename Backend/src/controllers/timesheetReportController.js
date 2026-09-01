// import pool from "../config/database.js";
// import ExcelJS from "exceljs";

// // ╔══════════════════════════════════════════════════════════════╗
// // ║              TIMESHEET REPORT CONTROLLER                     ║
// // ║                                                              ║
// // ║  Exports:                                                    ║
// // ║    getReportFilterOptions    GET /filter-options             ║
// // ║    getTimesheetReport        GET /                           ║
// // ║    getGroupedTimesheetReport GET /grouped                    ║
// // ║    getEmployeeSummaryReport  GET /employee-summary           ║
// // ║    getProjectSummaryReport   GET /project-summary            ║
// // ║    getTicketSummaryReport       GET /ticket-summary          ║
// // ║    getEmployeeBillableReport    GET /employee-billable [NEW] ║
// // ╚══════════════════════════════════════════════════════════════╝

// // ──────────────────────────────────────────────────────────────
// // HELPERS
// // ──────────────────────────────────────────────────────────────

// /** Returns true if val looks like a UUID. */
// function isUUID(val) {
//   return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
//     String(val),
//   );
// }

// /**
//  * Resolve an employee identifier (UUID or employee_code) to a UUID.
//  * Returns null silently when not found — never throws.
//  * This lets callers skip the filter rather than crashing the request.
//  */
// async function resolveEmployeeId(identifier) {
//   if (!identifier) return null;
//   if (isUUID(identifier)) return identifier;

//   const { rows } = await pool.query(
//     `SELECT employee_id FROM employees WHERE employee_code = $1 LIMIT 1`,
//     [identifier],
//   );

//   if (!rows.length) {
//     console.warn(
//       `[TimesheetReport] resolveEmployeeId: code "${identifier}" not found — filter skipped`,
//     );
//     return null;
//   }
//   return rows[0].employee_id;
// }

// /**
//  * Resolve one or more project identifiers (comma-sep UUIDs or zoho_crm_codes)
//  * into an array of UUIDs. Unresolvable values are silently skipped.
//  * Returns [] when input is empty/blank — caller must guard before using.
//  *
//  * Examples:
//  *   "uuid1"           → ["uuid1"]
//  *   "uuid1,uuid2"     → ["uuid1","uuid2"]
//  *   "PROJ-01,uuid2"   → [resolved_uuid, "uuid2"]
//  */
// async function resolveProjectIds(raw) {
//   if (!raw) return [];
//   const identifiers = String(raw)
//     .split(",")
//     .map((s) => s.trim())
//     .filter(Boolean);
//   if (!identifiers.length) return [];

//   const resolved = await Promise.all(
//     identifiers.map(async (id) => {
//       if (isUUID(id)) return id;
//       const { rows } = await pool.query(
//         `SELECT project_id FROM project_master
//           WHERE LOWER(zoho_crm_code) = LOWER($1) LIMIT 1`,
//         [id],
//       );
//       if (!rows.length) {
//         console.warn(
//           `[TimesheetReport] resolveProjectIds: code "${id}" not found — skipped`,
//         );
//         return null;
//       }
//       return rows[0].project_id;
//     }),
//   );
//   return resolved.filter(Boolean); // drop nulls
// }

// /**
//  * Resolve one or more ticket identifiers (comma-sep UUIDs or zoho_crm_codes)
//  * into an array of UUIDs. Unresolvable values are silently skipped.
//  * Returns [] when input is empty/blank.
//  */
// async function resolveTicketIds(raw) {
//   if (!raw) return [];
//   const identifiers = String(raw)
//     .split(",")
//     .map((s) => s.trim())
//     .filter(Boolean);
//   if (!identifiers.length) return [];

//   const resolved = await Promise.all(
//     identifiers.map(async (id) => {
//       if (isUUID(id)) return id;
//       const { rows } = await pool.query(
//         `SELECT ticket_id FROM ticket_master
//           WHERE LOWER(zoho_crm_code) = LOWER($1) LIMIT 1`,
//         [id],
//       );
//       if (!rows.length) {
//         console.warn(
//           `[TimesheetReport] resolveTicketIds: code "${id}" not found — skipped`,
//         );
//         return null;
//       }
//       return rows[0].ticket_id;
//     }),
//   );
//   return resolved.filter(Boolean);
// }

// /**
//  * Safe query wrapper.
//  * If a query fails it logs the specific error and returns [] so the
//  * rest of a Promise.all() call still succeeds with partial data.
//  * Used in filter-options so one bad table never silences all dropdowns.
//  */
// async function safeQuery(label, sql, params = []) {
//   try {
//     const { rows } = await pool.query(sql, params);
//     return rows;
//   } catch (err) {
//     console.error(
//       `[TimesheetReport] safeQuery FAILED [${label}]: ${err.message}`,
//     );
//     return [];
//   }
// }

// // Resolve comma-separated employee identifiers → array of UUIDs
// async function resolveEmployeeIds(raw) {
//   if (!raw) return [];
//   const parts = raw
//     .split(",")
//     .map((s) => s.trim())
//     .filter(Boolean);
//   const uuids = await Promise.all(parts.map(resolveEmployeeId));
//   return uuids.filter(Boolean);
// }

// // ──────────────────────────────────────────────────────────────
// // GET /api/timesheet-report/filter-options
// //
// // Returns every dropdown dataset the frontend needs in one call.
// // Each sub-query runs independently via safeQuery() — one failing
// // table never blocks the others from returning data.
// //
// // KEY FIXES vs original:
// //  • employees — removed is_active filter → ALL employees visible
// //  • projects  — removed is_active filter → ALL projects visible
// //  • tickets   — ADDED (was completely missing)
// // ──────────────────────────────────────────────────────────────
// export const getReportFilterOptions = async (req, res) => {
//   try {
//     // ── Identify caller role and identity ────────────────────────────────────
//     // req.user is populated by authenticateToken middleware from the JWT payload.
//     // employee_id is the standard field; fall back to id for safety.
//     const callerRole = req.user?.role;
//     const callerId = req.user?.employee_id || req.user?.id;
//     const isManager = callerRole === "MANAGER";

//     console.log(
//       "[TimesheetReport] Fetching filter options for role:",
//       callerRole,
//     );

//     // ── MANAGER: get the project_ids they are assigned to ───────────────────
//     // Uses project_manager_assignment table.
//     // All scoped dropdowns (projects, tickets, clients) are restricted to these.
//     let managerProjectIds = [];
//     if (isManager && callerId) {
//       const { rows: pmaRows } = await pool.query(
//         `SELECT DISTINCT project_id
//            FROM project_manager_assignment
//           WHERE manager_id = $1
//             AND project_id IS NOT NULL`,
//         [callerId],
//       );
//       managerProjectIds = pmaRows.map((r) => r.project_id).filter(Boolean);
//     }

//     // When manager has no assigned projects, scoped queries should return empty.
//     // We still run them (they'll just return 0 rows) so the response shape is consistent.
//     const projectIdFilter =
//       isManager && managerProjectIds.length > 0
//         ? managerProjectIds
//         : isManager
//           ? ["00000000-0000-0000-0000-000000000000"] // dummy uuid → 0 rows
//           : null; // null = ADMIN = no restriction

//     // ── 1. Employees ─────────────────────────────────────────────────────────
//     //   ADMIN   → ALL employees (active + inactive)
//     //   MANAGER → employees who have LOGGED TIME on the manager's projects.
//     //             Uses daily_timesheet_entries as the source of truth so that
//     //             employees always appear even when ticket_assignments is empty
//     //             or not populated. Also catches employees assigned via
//     //             ticket_manager_scope (managers logging their own time).
//     const employees = isManager
//       ? await safeQuery(
//           "employees",
//           `SELECT DISTINCT
//              e.employee_id                       AS id,
//              e.employee_code                     AS code,
//              e.first_name || ' ' || e.last_name  AS name,
//              e.designation,
//              d.name                              AS department,
//              e.is_active
//            FROM employees e
//            LEFT JOIN departments d ON d.id = e.department
//            WHERE e.employee_id IN (
//              SELECT DISTINCT dte.employee_id
//              FROM   daily_timesheet_entries dte
//              WHERE  dte.project_id = ANY($1::uuid[])
//                AND  dte.employee_id IS NOT NULL
//            )
//            ORDER BY e.is_active DESC, e.first_name ASC, e.last_name ASC`,
//           [projectIdFilter],
//         )
//       : await safeQuery(
//           "employees",
//           `SELECT
//              e.employee_id                       AS id,
//              e.employee_code                     AS code,
//              e.first_name || ' ' || e.last_name  AS name,
//              e.designation,
//              d.name                              AS department,
//              e.is_active
//            FROM employees e
//            LEFT JOIN departments d ON d.id = e.department
//            ORDER BY e.is_active DESC, e.first_name ASC, e.last_name ASC`,
//         );

//     // ── 2. Projects ──────────────────────────────────────────────────────────
//     //   ADMIN   → ALL projects (active + inactive)
//     //   MANAGER → only projects assigned to them via project_manager_assignment
//     const projects = isManager
//       ? await safeQuery(
//           "projects",
//           `SELECT
//              pm.project_id                       AS id,
//              pm.project_name                     AS name,
//              pm.zoho_crm_code                    AS code,
//              ps.name                             AS status,
//              cm.client_name,
//              pm.is_active
//            FROM project_master pm
//            LEFT JOIN project_status ps ON ps.id       = pm.status
//            LEFT JOIN client_master  cm ON cm.client_id = pm.client_id
//            WHERE pm.project_id = ANY($1::uuid[])
//            ORDER BY pm.is_active DESC, pm.project_name ASC`,
//           [projectIdFilter],
//         )
//       : await safeQuery(
//           "projects",
//           `SELECT
//              pm.project_id                       AS id,
//              pm.project_name                     AS name,
//              pm.zoho_crm_code                    AS code,
//              ps.name                             AS status,
//              cm.client_name,
//              pm.is_active
//            FROM project_master pm
//            LEFT JOIN project_status ps ON ps.id       = pm.status
//            LEFT JOIN client_master  cm ON cm.client_id = pm.client_id
//            ORDER BY pm.is_active DESC, pm.project_name ASC`,
//         );

//     // ── 3. Tickets ───────────────────────────────────────────────────────────
//     //   ADMIN   → ALL tickets
//     //   MANAGER → only tickets belonging to their assigned projects
//     const tickets = isManager
//       ? await safeQuery(
//           "tickets",
//           `SELECT
//              tm.ticket_id                        AS id,
//              tm.ticket_name                      AS name,
//              tm.zoho_crm_code                    AS code,
//              pm.project_id,
//              pm.project_name,
//              cm.client_name,
//              tm.is_active
//            FROM ticket_master tm
//            LEFT JOIN project_master pm ON pm.project_id = tm.project_id
//            LEFT JOIN client_master  cm ON cm.client_id  = pm.client_id
//            WHERE tm.project_id = ANY($1::uuid[])
//            ORDER BY tm.is_active DESC, tm.ticket_name ASC`,
//           [projectIdFilter],
//         )
//       : await safeQuery(
//           "tickets",
//           `SELECT
//              tm.ticket_id                        AS id,
//              tm.ticket_name                      AS name,
//              tm.zoho_crm_code                    AS code,
//              pm.project_id,
//              pm.project_name,
//              cm.client_name,
//              tm.is_active
//            FROM ticket_master tm
//            LEFT JOIN project_master pm ON pm.project_id = tm.project_id
//            LEFT JOIN client_master  cm ON cm.client_id  = pm.client_id
//            ORDER BY tm.is_active DESC, tm.ticket_name ASC`,
//         );

//     // ── 4. Clients ───────────────────────────────────────────────────────────
//     //   ADMIN   → ALL active clients
//     //   MANAGER → only clients whose projects are assigned to them
//     const clients = isManager
//       ? await safeQuery(
//           "clients",
//           `SELECT DISTINCT
//              cm.client_id   AS id,
//              cm.client_name AS name,
//              cm.client_code AS code
//            FROM client_master cm
//            JOIN project_master pm ON pm.client_id = cm.client_id
//            WHERE pm.project_id = ANY($1::uuid[])
//              AND cm.is_active = TRUE
//            ORDER BY cm.client_name ASC`,
//           [projectIdFilter],
//         )
//       : await safeQuery(
//           "clients",
//           `SELECT
//              client_id   AS id,
//              client_name AS name,
//              client_code AS code
//            FROM client_master
//            WHERE is_active = TRUE
//            ORDER BY client_name ASC`,
//         );

//     // ── 5. Statuses — same for everyone ──────────────────────────────────────
//     const statuses = await safeQuery(
//       "statuses",
//       `SELECT id, name FROM timesheet_status ORDER BY id ASC`,
//     );

//     // ── 6. Departments — same for everyone ───────────────────────────────────
//     const departments = await safeQuery(
//       "departments",
//       `SELECT id, name FROM departments ORDER BY name ASC`,
//     );

//     console.log("[TimesheetReport] Filter options loaded:", {
//       role: callerRole,
//       employees: employees.length,
//       projects: projects.length,
//       tickets: tickets.length,
//       clients: clients.length,
//       statuses: statuses.length,
//       departments: departments.length,
//     });

//     // managers field removed — Manager filter has been removed from the UI.
//     return res.json({
//       employees,
//       projects,
//       tickets,
//       clients,
//       statuses,
//       departments,
//     });
//   } catch (error) {
//     console.error(
//       "[TimesheetReport] getReportFilterOptions FATAL:",
//       error.message,
//     );
//     return res.json({
//       employees: [],
//       projects: [],
//       tickets: [],
//       clients: [],
//       statuses: [],
//       departments: [],
//       _error: error.message,
//     });
//   }
// };

// // ──────────────────────────────────────────────────────────────
// // GET /api/timesheet-report
// //
// // Paginated, sorted, fully-filtered main timesheet report.
// // Runs three queries in parallel: data + count + summary KPIs.
// // All filters are optional — no filters = all records paginated.
// //
// // Query params:
// //   employeeId   UUID | employee_code
// //   projectIds   comma-sep UUIDs | zoho_crm_codes  (multi-select)
// //   ticketIds    comma-sep UUIDs | zoho_crm_codes  (multi-select)
// //   clientId     UUID
// //   departmentId integer
// //   fromDate     YYYY-MM-DD
// //   toDate       YYYY-MM-DD
// //   status       timesheet_status.name string
// //   managerId    UUID | employee_code
// //   page         integer, default 1
// //   pageSize     integer, default 25, max 100
// //   sortBy       entry_date|hours|status|employee|project|ticket|submitted_at
// //   sortDir      asc|desc
// // ──────────────────────────────────────────────────────────────
// export const getTimesheetReport = async (req, res) => {
//   try {
//     const {
//       employeeIds, // comma-separated UUIDs — multi-select
//       projectIds, // comma-separated UUIDs — multi-select
//       ticketIds, // comma-separated UUIDs — multi-select
//       clientIds, // comma-separated UUIDs — multi-select
//       departmentId,
//       fromDate,
//       toDate,
//       status,
//       managerId,
//       page = 1,
//       pageSize = 25,
//       sortBy = "entry_date",
//       sortDir = "desc",
//     } = req.query;

//     // ── Pagination ───────────────────────────────────────────
//     const p = Math.max(parseInt(page, 10) || 1, 1);
//     const ps = Math.min(Math.max(parseInt(pageSize, 10) || 25, 1), 100);
//     const offset = (p - 1) * ps;

//     // ── Sort — whitelisted to prevent SQL injection ──────────
//     const ALLOWED_SORT = {
//       entry_date: "dte.entry_date",
//       hours: "dte.total_hours",
//       status: "ts.name",
//       employee: "e.first_name",
//       project: "pm.project_name",
//       ticket: "tm.ticket_name",
//       submitted_at: "dte.submitted_at",
//     };
//     const sortCol = ALLOWED_SORT[sortBy] || "dte.entry_date";
//     const dir = sortDir === "asc" ? "ASC" : "DESC";

//     // Manager scope: restrict unfiltered reports to assigned projects
//     const callerRole = req.user?.role;
//     const callerId = req.user?.employee_id || req.user?.id;
//     const isManager = callerRole === "MANAGER";
//     let managerProjectIds = [];
//     if (isManager && callerId) {
//       const pmaRows = await pool.query(
//         "SELECT DISTINCT project_id FROM project_manager_assignment WHERE manager_id = $1 AND project_id IS NOT NULL",
//         [callerId],
//       );
//       managerProjectIds = pmaRows.rows.map((r) => r.project_id).filter(Boolean);
//     }

//     // ── Build dynamic WHERE conditions ───────────────────────
//     // Rule: every resolve*() returns null on miss → guard with if(uuid)
//     // so a bad/stale filter value skips that condition instead of crashing.
//     const conditions = [];
//     const params = [];
//     let idx = 1; // tracks the next $N parameter slot

//     // Employees — multi-select: ANY($N::uuid[])
//     if (employeeIds) {
//       const uuids = await resolveEmployeeIds(employeeIds);
//       if (uuids.length > 0) {
//         conditions.push(`dte.employee_id = ANY($${idx++}::uuid[])`);
//         params.push(uuids);
//       }
//     }

//     // Projects — multi-select: ANY($N::uuid[])
//     if (projectIds) {
//       const uuids = await resolveProjectIds(projectIds);
//       if (uuids.length > 0) {
//         conditions.push(`dte.project_id = ANY($${idx++}::uuid[])`);
//         params.push(uuids);
//       }
//     }

//     // Manager scope — ALWAYS enforced for MANAGER callers regardless of whether
//     // the user also sent a projectIds filter. Both conditions are ANDed together,
//     // so the result is the intersection: entries from the user-chosen projects
//     // that also belong to the manager's assigned projects. This prevents a
//     // manager from bypassing the scope by providing arbitrary projectIds.
//     if (isManager) {
//       const scopeIds =
//         managerProjectIds.length > 0
//           ? managerProjectIds
//           : ["00000000-0000-0000-0000-000000000000"]; // dummy → 0 rows when no assigned projects
//       conditions.push(`dte.project_id = ANY($${idx++}::uuid[])`);
//       params.push(scopeIds);
//     }

//     // Tickets — multi-select: ANY($N::uuid[])
//     if (ticketIds) {
//       const uuids = await resolveTicketIds(ticketIds);
//       if (uuids.length > 0) {
//         conditions.push(`dte.ticket_id = ANY($${idx++}::uuid[])`);
//         params.push(uuids);
//       }
//     }

//     // Clients — multi-select: ANY($N::uuid[])
//     if (clientIds) {
//       const uuids = clientIds
//         .split(",")
//         .map((s) => s.trim())
//         .filter(Boolean);
//       if (uuids.length > 0) {
//         conditions.push(`dte.client_id = ANY($${idx++}::uuid[])`);
//         params.push(uuids);
//       }
//     }

//     // Department (NEW filter) — filters on the employee's department
//     if (departmentId) {
//       conditions.push(`e.department = $${idx++}`);
//       params.push(departmentId);
//     }

//     // Timesheet status
//     if (status) {
//       conditions.push(`ts.name = $${idx++}`);
//       params.push(status);
//     }

//     // Manager stored on the timesheet entry
//     if (managerId) {
//       const uuid = await resolveEmployeeId(managerId);
//       if (uuid) {
//         conditions.push(`dte.manager_id = $${idx++}`);
//         params.push(uuid);
//       }
//     }

//     // Date range — four distinct behaviours:
//     //   fromDate only  → single exact day
//     //   fromDate+toDate → inclusive range
//     //   toDate only    → everything up to that date
//     //   neither        → no date restriction
//     if (fromDate && !toDate) {
//       conditions.push(`dte.entry_date = $${idx++}`);
//       params.push(fromDate);
//     } else if (fromDate && toDate) {
//       conditions.push(
//         `dte.entry_date >= $${idx++} AND dte.entry_date <= $${idx++}`,
//       );
//       params.push(fromDate, toDate);
//     } else if (!fromDate && toDate) {
//       conditions.push(`dte.entry_date <= $${idx++}`);
//       params.push(toDate);
//     }

//     const whereClause =
//       conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

//     // ── Shared FROM + JOINs (reused in all 3 parallel queries) ──
//     const baseJoins = `
//       FROM daily_timesheet_entries dte
//       JOIN  timesheet_status  ts    ON ts.id            = dte.status
//       JOIN  employees         e     ON e.employee_id     = dte.employee_id
//       LEFT JOIN departments   dept  ON dept.id           = e.department
//       LEFT JOIN project_master pm   ON pm.project_id     = dte.project_id
//       LEFT JOIN project_status pst  ON pst.id            = pm.status
//       LEFT JOIN client_master  cm   ON cm.client_id      = dte.client_id
//       LEFT JOIN ticket_master  tm   ON tm.ticket_id      = dte.ticket_id
//       LEFT JOIN employees      mgr  ON mgr.employee_id   = dte.manager_id
//       LEFT JOIN employees      apr  ON apr.employee_id   = dte.approved_by
//       LEFT JOIN employees      rej  ON rej.employee_id   = dte.rejected_by
//       LEFT JOIN task_master    task ON task.task_id      = dte.task_id
//       LEFT JOIN departments    dtsk ON dtsk.id           = task.department
//     `;

//     // idx now = params.length + 1, which is where LIMIT goes
//     const limitIdx = idx;
//     const offsetIdx = idx + 1;

//     // ── 1. Data query — paginated rows ───────────────────────
//     const dataQuery = `
//       SELECT
//         -- Core entry fields
//         dte.entry_id,
//         dte.entry_date,
//         dte.week_start_date,
//         dte.week_end_date,
//         dte.total_hours,
//         dte.billable_hours,
//         dte.non_billable_hours,
//         dte.ticket_number,
//         dte.description,
//         dte.submitted_at,
//         dte.approved_at,
//         dte.rejected_at,
//         dte.rejection_reason,
//         dte.created_at,
//         dte.updated_at,

//         -- Status
//         ts.name                                              AS status,

//         -- Employee
//         e.employee_id,
//         e.employee_code,
//         e.first_name                                         AS employee_first_name,
//         e.last_name                                          AS employee_last_name,
//         e.email                                              AS employee_email,
//         e.designation                                        AS employee_designation,
//         dept.name                                            AS employee_department,

//         -- Project
//         pm.project_id,
//         pm.project_name,
//         pm.zoho_crm_code                                     AS project_code,
//         pst.name                                             AS project_status,

//         -- Client
//         cm.client_id,
//         cm.client_name,
//         cm.client_code,

//         -- Ticket
//         tm.ticket_id,
//         tm.ticket_name,
//         tm.zoho_crm_code                                     AS ticket_code,
//         tm.estimated_hours,
//         tm.approved_hours,

//         -- Manager (responsible person on entry)
//         mgr.employee_id                                      AS manager_id,
//         mgr.first_name                                       AS manager_first_name,
//         mgr.last_name                                        AS manager_last_name,

//         -- Approver / Rejector full names
//         COALESCE(apr.first_name || ' ' || apr.last_name, '') AS approved_by_name,
//         COALESCE(rej.first_name || ' ' || rej.last_name, '') AS rejected_by_name,

//         -- Task
//         task.task                                            AS task_name,
//         task.internal_project                                AS task_internal_project,
//         dtsk.name                                            AS task_department

//       ${baseJoins}
//       ${whereClause}
//       ORDER BY ${sortCol} ${dir}
//       LIMIT  $${limitIdx}
//       OFFSET $${offsetIdx}
//     `;

//     // ── 2. Count query — total matching rows for pagination ──
//     const countQuery = `
//       SELECT COUNT(*) AS total
//       ${baseJoins}
//       ${whereClause}
//     `;

//     // ── 3. Summary / KPI aggregation ─────────────────────────
//     // FIX: replaced non-existent 'Pending' with correct 'Draft'
//     const summaryQuery = `
//       SELECT
//         COUNT(*)                                                         AS total_entries,
//         COALESCE(SUM(dte.total_hours),        0)                        AS total_hours,
//         COALESCE(SUM(dte.billable_hours),     0)                        AS billable_hours,
//         COALESCE(SUM(dte.non_billable_hours), 0)                        AS non_billable_hours,
//         COUNT(DISTINCT dte.employee_id)                                  AS total_employees,
//         COUNT(DISTINCT dte.project_id)                                   AS total_projects,
//         COUNT(DISTINCT dte.ticket_id)                                    AS total_tickets,
//         COUNT(DISTINCT dte.entry_date)                                   AS working_days,
//         COUNT(DISTINCT CASE WHEN ts.name = 'Draft'
//               THEN dte.entry_id END)                                     AS draft_count,
//         COUNT(DISTINCT CASE WHEN ts.name = 'Submitted'
//               THEN dte.entry_id END)                                     AS submitted_count,
//         COUNT(DISTINCT CASE WHEN ts.name = 'Manager_Approved'
//               THEN dte.entry_id END)                                     AS mgr_approved_count,
//         COUNT(DISTINCT CASE WHEN ts.name = 'Admin_Approved'
//               THEN dte.entry_id END)                                     AS admin_approved_count,
//         COUNT(DISTINCT CASE WHEN ts.name IN ('Manager_Approved','Admin_Approved')
//               THEN dte.entry_id END)                                     AS approved_count,
//         COUNT(DISTINCT CASE WHEN ts.name = 'Manager_Rejected'
//               THEN dte.entry_id END)                                     AS mgr_rejected_count,
//         COUNT(DISTINCT CASE WHEN ts.name = 'Admin_Rejected'
//               THEN dte.entry_id END)                                     AS admin_rejected_count,
//         COUNT(DISTINCT CASE WHEN ts.name IN ('Manager_Rejected','Admin_Rejected')
//               THEN dte.entry_id END)                                     AS rejected_count,
//         COUNT(DISTINCT CASE WHEN ts.name = 'Partially_Approved'
//               THEN dte.entry_id END)                                     AS partial_count
//       ${baseJoins}
//       ${whereClause}
//     `;

//     // ── Run all three queries in parallel ────────────────────
//     const [dataResult, countResult, summaryResult] = await Promise.all([
//       pool.query(dataQuery, [...params, ps, offset]),
//       pool.query(countQuery, params),
//       pool.query(summaryQuery, params),
//     ]);

//     const totalCount = parseInt(countResult.rows[0].total, 10);
//     const totalPages = Math.ceil(totalCount / ps) || 1;
//     const s = summaryResult.rows[0];
//     const totalHours = parseFloat(s.total_hours);
//     const workingDays = parseInt(s.working_days, 10);

//     return res.json({
//       data: dataResult.rows,
//       pagination: {
//         page: p,
//         pageSize: ps,
//         totalCount,
//         totalPages,
//         hasNextPage: p < totalPages,
//         hasPrevPage: p > 1,
//       },
//       summary: {
//         totalEntries: parseInt(s.total_entries, 10),
//         totalHours,
//         billableHours: parseFloat(s.billable_hours),
//         nonBillableHours: parseFloat(s.non_billable_hours),
//         totalEmployees: parseInt(s.total_employees, 10),
//         totalProjects: parseInt(s.total_projects, 10),
//         totalTickets: parseInt(s.total_tickets, 10),
//         workingDays,
//         avgHoursPerDay:
//           workingDays > 0
//             ? parseFloat((totalHours / workingDays).toFixed(2))
//             : 0,
//         statusBreakdown: {
//           draft: parseInt(s.draft_count, 10),
//           submitted: parseInt(s.submitted_count, 10),
//           managerApproved: parseInt(s.mgr_approved_count, 10),
//           adminApproved: parseInt(s.admin_approved_count, 10),
//           approved: parseInt(s.approved_count, 10),
//           managerRejected: parseInt(s.mgr_rejected_count, 10),
//           adminRejected: parseInt(s.admin_rejected_count, 10),
//           rejected: parseInt(s.rejected_count, 10),
//           partiallyApproved: parseInt(s.partial_count, 10),
//         },
//       },
//     });
//   } catch (error) {
//     console.error("[TimesheetReport] getTimesheetReport error:", error.message);
//     return res
//       .status(500)
//       .json({ error: error.message || "Failed to fetch report" });
//   }
// };

// // ──────────────────────────────────────────────────────────────
// // GET /api/timesheet-report/grouped
// //
// // Same filters as getTimesheetReport but groups entries by date.
// // Each date row has subtotals + a full entries[] array inside.
// // Used by frontend date-grouped / calendar view.
// // ──────────────────────────────────────────────────────────────
// export const getGroupedTimesheetReport = async (req, res) => {
//   try {
//     const {
//       employeeId,
//       projectIds,
//       ticketIds,
//       clientIds, // ← was `clientId` (singular) — client filter was silently broken
//       departmentId,
//       fromDate,
//       toDate,
//       status,
//       managerId,
//     } = req.query;

//     // ── Manager scope ───────────────────────────────────────────
//     const callerRole = req.user?.role;
//     const callerId = req.user?.employee_id || req.user?.id;
//     const isManager = callerRole === "MANAGER";
//     let managerProjectIds = [];
//     if (isManager && callerId) {
//       const pmaRows = await pool.query(
//         `SELECT DISTINCT project_id
//            FROM project_manager_assignment
//           WHERE manager_id = $1 AND project_id IS NOT NULL`,
//         [callerId],
//       );
//       managerProjectIds = pmaRows.rows.map((r) => r.project_id).filter(Boolean);
//     }

//     const conditions = [];
//     const params = [];
//     let idx = 1;

//     if (employeeId) {
//       const uuid = await resolveEmployeeId(employeeId);
//       if (uuid) {
//         conditions.push(`dte.employee_id = $${idx++}`);
//         params.push(uuid);
//       }
//     }
//     if (projectIds) {
//       const uuids = await resolveProjectIds(projectIds);
//       if (uuids.length > 0) {
//         conditions.push(`dte.project_id = ANY($${idx++}::uuid[])`);
//         params.push(uuids);
//       }
//     }
//     // Always enforce manager scope
//     if (isManager) {
//       const scopeIds =
//         managerProjectIds.length > 0
//           ? managerProjectIds
//           : ["00000000-0000-0000-0000-000000000000"];
//       conditions.push(`dte.project_id = ANY($${idx++}::uuid[])`);
//       params.push(scopeIds);
//     }
//     if (ticketIds) {
//       const uuids = await resolveTicketIds(ticketIds);
//       if (uuids.length > 0) {
//         conditions.push(`dte.ticket_id = ANY($${idx++}::uuid[])`);
//         params.push(uuids);
//       }
//     }
//     if (clientIds) {
//       const uuids = clientIds
//         .split(",")
//         .map((s) => s.trim())
//         .filter(Boolean);
//       if (uuids.length > 0) {
//         conditions.push(`dte.client_id = ANY($${idx++}::uuid[])`);
//         params.push(uuids);
//       }
//     }
//     if (departmentId) {
//       conditions.push(`e.department = $${idx++}`);
//       params.push(departmentId);
//     }
//     if (status) {
//       conditions.push(`ts.name = $${idx++}`);
//       params.push(status);
//     }
//     if (managerId) {
//       const uuid = await resolveEmployeeId(managerId);
//       if (uuid) {
//         conditions.push(`dte.manager_id = $${idx++}`);
//         params.push(uuid);
//       }
//     }
//     if (fromDate && !toDate) {
//       conditions.push(`dte.entry_date = $${idx++}`);
//       params.push(fromDate);
//     } else if (fromDate && toDate) {
//       conditions.push(
//         `dte.entry_date >= $${idx++} AND dte.entry_date <= $${idx++}`,
//       );
//       params.push(fromDate, toDate);
//     } else if (!fromDate && toDate) {
//       conditions.push(`dte.entry_date <= $${idx++}`);
//       params.push(toDate);
//     }

//     const whereClause =
//       conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

//     const query = `
//       SELECT
//         dte.entry_date,
//         SUM(dte.total_hours)                AS day_total_hours,
//         SUM(dte.billable_hours)             AS day_billable_hours,
//         SUM(dte.non_billable_hours)         AS day_non_billable_hours,
//         COUNT(dte.entry_id)                 AS day_entry_count,
//         COUNT(DISTINCT dte.employee_id)     AS day_employee_count,

//         json_agg(
//           json_build_object(
//             'entry_id',           dte.entry_id,
//             'total_hours',        dte.total_hours,
//             'billable_hours',     dte.billable_hours,
//             'non_billable_hours', dte.non_billable_hours,
//             'description',        dte.description,
//             'ticket_number',      dte.ticket_number,
//             'status',             ts.name,
//             'submitted_at',       dte.submitted_at,
//             'approved_at',        dte.approved_at,
//             'rejected_at',        dte.rejected_at,
//             'rejection_reason',   dte.rejection_reason,
//             'employee_id',        e.employee_id,
//             'employee_code',      e.employee_code,
//             'employee_name',      e.first_name || ' ' || e.last_name,
//             'employee_designation', e.designation,
//             'project_id',         pm.project_id,
//             'project_name',       pm.project_name,
//             'project_code',       pm.zoho_crm_code,
//             'ticket_id',          tm.ticket_id,
//             'ticket_name',        tm.ticket_name,
//             'ticket_code',        tm.zoho_crm_code,
//             'client_name',        cm.client_name,
//             'manager_name',       COALESCE(mgr.first_name || ' ' || mgr.last_name, ''),
//             'task_name',          task.task
//           )
//           ORDER BY dte.entry_id ASC
//         ) AS entries

//       FROM daily_timesheet_entries dte
//       JOIN  timesheet_status  ts    ON ts.id            = dte.status
//       JOIN  employees         e     ON e.employee_id     = dte.employee_id
//       LEFT JOIN departments   dept  ON dept.id           = e.department
//       LEFT JOIN project_master pm   ON pm.project_id     = dte.project_id
//       LEFT JOIN client_master  cm   ON cm.client_id      = dte.client_id
//       LEFT JOIN ticket_master  tm   ON tm.ticket_id      = dte.ticket_id
//       LEFT JOIN employees      mgr  ON mgr.employee_id   = dte.manager_id
//       LEFT JOIN task_master    task ON task.task_id      = dte.task_id
//       ${whereClause}
//       GROUP BY dte.entry_date
//       ORDER BY dte.entry_date DESC
//     `;

//     const { rows } = await pool.query(query, params);

//     return res.json({
//       data: rows.map((row) => ({
//         date: row.entry_date,
//         dayTotalHours: parseFloat(row.day_total_hours),
//         dayBillableHours: parseFloat(row.day_billable_hours),
//         dayNonBillableHours: parseFloat(row.day_non_billable_hours),
//         dayEntryCount: parseInt(row.day_entry_count, 10),
//         dayEmployeeCount: parseInt(row.day_employee_count, 10),
//         isOvertime: parseFloat(row.day_total_hours) > 8,
//         entries: row.entries || [],
//       })),
//     });
//   } catch (error) {
//     console.error(
//       "[TimesheetReport] getGroupedTimesheetReport error:",
//       error.message,
//     );
//     return res
//       .status(500)
//       .json({ error: error.message || "Failed to fetch grouped report" });
//   }
// };

// // ──────────────────────────────────────────────────────────────
// // GET /api/timesheet-report/employee-summary
// //
// // Per-employee rollup. Shows ALL active employees, even those
// // with zero matching timesheet entries (they show 0 hours).
// // Filters on timesheet entries are applied to the JOIN condition,
// // not to the outer WHERE, so all employees remain visible.
// //
// // Query params: fromDate, toDate, departmentId, projectId, managerId, employeeId
// // ──────────────────────────────────────────────────────────────
// export const getEmployeeSummaryReport = async (req, res) => {
//   try {
//     const {
//       fromDate,
//       toDate,
//       departmentId,
//       projectIds,
//       managerId,
//       employeeId,
//     } = req.query;

//     // Filters on the timesheet JOIN — keeps all employees in results
//     const dteFilters = [];
//     const params = [];
//     let idx = 1;

//     if (fromDate && toDate) {
//       dteFilters.push(
//         `dte.entry_date >= $${idx++} AND dte.entry_date <= $${idx++}`,
//       );
//       params.push(fromDate, toDate);
//     } else if (fromDate) {
//       dteFilters.push(`dte.entry_date >= $${idx++}`);
//       params.push(fromDate);
//     } else if (toDate) {
//       dteFilters.push(`dte.entry_date <= $${idx++}`);
//       params.push(toDate);
//     }

//     if (projectIds) {
//       const uuids = await resolveProjectIds(projectIds);
//       if (uuids.length > 0) {
//         dteFilters.push(`dte.project_id = ANY($${idx++}::uuid[])`);
//         params.push(uuids);
//       }
//     }

//     // Filters on which employees appear in the outer result set
//     const empFilters = [];

//     if (departmentId) {
//       empFilters.push(`e.department = $${idx++}`);
//       params.push(departmentId);
//     }

//     if (managerId) {
//       const uuid = await resolveEmployeeId(managerId);
//       if (uuid) {
//         empFilters.push(`e.module_manager_id = $${idx++}`);
//         params.push(uuid);
//       }
//     }

//     if (employeeId) {
//       const uuid = await resolveEmployeeId(employeeId);
//       if (uuid) {
//         empFilters.push(`e.employee_id = $${idx++}`);
//         params.push(uuid);
//       }
//     }

//     const dteJoinExtra =
//       dteFilters.length > 0 ? `AND ${dteFilters.join(" AND ")}` : "";

//     const empWhereExtra =
//       empFilters.length > 0 ? `AND ${empFilters.join(" AND ")}` : "";

//     const query = `
//       SELECT
//         e.employee_id,
//         e.employee_code,
//         e.first_name || ' ' || e.last_name          AS employee_name,
//         e.email                                      AS employee_email,
//         e.designation,
//         e.is_active,
//         dept.name                                    AS department,
//         COALESCE(mgr.first_name || ' ' || mgr.last_name, '') AS manager_name,

//         -- Aggregates (COALESCE → 0 when no entries match)
//         COUNT(dte.entry_id)                          AS total_entries,
//         COALESCE(SUM(dte.total_hours),        0)     AS total_hours,
//         COALESCE(SUM(dte.billable_hours),     0)     AS billable_hours,
//         COALESCE(SUM(dte.non_billable_hours), 0)     AS non_billable_hours,
//         COUNT(DISTINCT dte.entry_date)               AS working_days,
//         COUNT(DISTINCT dte.project_id)               AS total_projects,
//         COUNT(DISTINCT dte.ticket_id)                AS total_tickets,
//         MAX(dte.entry_date)                          AS last_entry_date,
//         MIN(dte.entry_date)                          AS first_entry_date,

//         ROUND(
//           COALESCE(SUM(dte.total_hours), 0) /
//           NULLIF(COUNT(DISTINCT dte.entry_date), 0)
//         , 2)                                         AS avg_hours_per_day,

//         -- Status breakdown
//         COUNT(CASE WHEN ts.name = 'Draft'                               THEN 1 END) AS draft_count,
//         COUNT(CASE WHEN ts.name = 'Submitted'                           THEN 1 END) AS submitted_count,
//         COUNT(CASE WHEN ts.name = 'Manager_Approved'                    THEN 1 END) AS mgr_approved_count,
//         COUNT(CASE WHEN ts.name = 'Admin_Approved'                      THEN 1 END) AS admin_approved_count,
//         COUNT(CASE WHEN ts.name IN ('Manager_Approved','Admin_Approved') THEN 1 END) AS approved_count,
//         COUNT(CASE WHEN ts.name IN ('Manager_Rejected','Admin_Rejected') THEN 1 END) AS rejected_count,
//         COUNT(CASE WHEN ts.name = 'Partially_Approved'                  THEN 1 END) AS partial_count

//       FROM employees e
//       -- DTE join uses extra conditions in the ON clause, NOT a WHERE,
//       -- so employees without matching entries still appear with 0 values.
//       LEFT JOIN daily_timesheet_entries dte
//              ON dte.employee_id = e.employee_id ${dteJoinExtra}
//       LEFT JOIN timesheet_status ts   ON ts.id           = dte.status
//       LEFT JOIN departments      dept ON dept.id         = e.department
//       LEFT JOIN employees        mgr  ON mgr.employee_id = e.module_manager_id

//       WHERE e.is_active = TRUE ${empWhereExtra}

//       GROUP BY
//         e.employee_id, e.employee_code, e.first_name, e.last_name,
//         e.email, e.designation, e.is_active,
//         dept.name, mgr.first_name, mgr.last_name

//       ORDER BY total_hours DESC, e.first_name ASC
//     `;

//     const { rows } = await pool.query(query, params);

//     return res.json({
//       data: rows.map((r) => ({
//         ...r,
//         total_hours: parseFloat(r.total_hours),
//         billable_hours: parseFloat(r.billable_hours),
//         non_billable_hours: parseFloat(r.non_billable_hours),
//         avg_hours_per_day: parseFloat(r.avg_hours_per_day) || 0,
//         total_entries: parseInt(r.total_entries, 10),
//         working_days: parseInt(r.working_days, 10),
//         total_projects: parseInt(r.total_projects, 10),
//         total_tickets: parseInt(r.total_tickets, 10),
//         statusBreakdown: {
//           draft: parseInt(r.draft_count, 10),
//           submitted: parseInt(r.submitted_count, 10),
//           managerApproved: parseInt(r.mgr_approved_count, 10),
//           adminApproved: parseInt(r.admin_approved_count, 10),
//           approved: parseInt(r.approved_count, 10),
//           rejected: parseInt(r.rejected_count, 10),
//           partial: parseInt(r.partial_count, 10),
//         },
//       })),
//     });
//   } catch (error) {
//     console.error(
//       "[TimesheetReport] getEmployeeSummaryReport error:",
//       error.message,
//     );
//     return res
//       .status(500)
//       .json({ error: error.message || "Failed to fetch employee summary" });
//   }
// };

// // ──────────────────────────────────────────────────────────────
// // GET /api/timesheet-report/project-summary
// //
// // Per-project rollup. Shows ALL active projects even those with
// // zero timesheet entries. Filters on entries are applied to the
// // JOIN ON clause so projects without matching entries still appear.
// //
// // Query params: fromDate, toDate, clientId, projectId, status
// // ──────────────────────────────────────────────────────────────
// export const getProjectSummaryReport = async (req, res) => {
//   try {
//     const { fromDate, toDate, clientId, projectIds, status } = req.query;

//     // DTE join filters
//     const dteFilters = [];
//     const params = [];
//     let idx = 1;

//     if (fromDate && toDate) {
//       dteFilters.push(
//         `dte.entry_date >= $${idx++} AND dte.entry_date <= $${idx++}`,
//       );
//       params.push(fromDate, toDate);
//     } else if (fromDate) {
//       dteFilters.push(`dte.entry_date >= $${idx++}`);
//       params.push(fromDate);
//     } else if (toDate) {
//       dteFilters.push(`dte.entry_date <= $${idx++}`);
//       params.push(toDate);
//     }

//     // Project master outer WHERE filters
//     const pmFilters = [];

//     if (clientId) {
//       pmFilters.push(`pm.client_id = $${idx++}`);
//       params.push(clientId);
//     }

//     if (projectIds) {
//       const uuids = await resolveProjectIds(projectIds);
//       if (uuids.length > 0) {
//         pmFilters.push(`pm.project_id = ANY($${idx++}::uuid[])`);
//         params.push(uuids);
//       }
//     }

//     if (status) {
//       // status here = project_status.name (e.g. "In Progress")
//       pmFilters.push(`ps.name = $${idx++}`);
//       params.push(status);
//     }

//     const dteJoinExtra =
//       dteFilters.length > 0 ? `AND ${dteFilters.join(" AND ")}` : "";

//     const pmWhereExtra =
//       pmFilters.length > 0 ? `AND ${pmFilters.join(" AND ")}` : "";

//     const query = `
//       SELECT
//         pm.project_id,
//         pm.project_name,
//         pm.zoho_crm_code                                AS project_code,
//         ps.name                                         AS project_status,
//         pm.start_date,
//         pm.end_date,
//         cm.client_id,
//         cm.client_name,
//         cm.client_code,

//         COUNT(DISTINCT dte.employee_id)                 AS total_employees,
//         COUNT(DISTINCT dte.ticket_id)                   AS total_tickets,
//         COUNT(dte.entry_id)                             AS total_entries,
//         COALESCE(SUM(dte.total_hours),        0)        AS total_hours,
//         COALESCE(SUM(dte.billable_hours),     0)        AS billable_hours,
//         COALESCE(SUM(dte.non_billable_hours), 0)        AS non_billable_hours,
//         COUNT(DISTINCT dte.entry_date)                  AS working_days,
//         MIN(dte.entry_date)                             AS first_entry,
//         MAX(dte.entry_date)                             AS last_entry,

//         COUNT(CASE WHEN ts.name IN ('Manager_Approved','Admin_Approved')
//               THEN dte.entry_id END)                    AS approved_entries,
//         COUNT(CASE WHEN ts.name IN ('Manager_Rejected','Admin_Rejected')
//               THEN dte.entry_id END)                    AS rejected_entries,
//         COUNT(CASE WHEN ts.name = 'Submitted'
//               THEN dte.entry_id END)                    AS submitted_entries

//       FROM project_master pm
//       JOIN  project_status ps  ON ps.id           = pm.status
//       LEFT JOIN client_master  cm  ON cm.client_id = pm.client_id
//       LEFT JOIN daily_timesheet_entries dte
//              ON dte.project_id = pm.project_id ${dteJoinExtra}
//       LEFT JOIN timesheet_status ts ON ts.id = dte.status

//       WHERE pm.is_active = TRUE ${pmWhereExtra}

//       GROUP BY
//         pm.project_id, pm.project_name, pm.zoho_crm_code,
//         ps.name, pm.start_date, pm.end_date,
//         cm.client_id, cm.client_name, cm.client_code

//       ORDER BY total_hours DESC, pm.project_name ASC
//     `;

//     const { rows } = await pool.query(query, params);

//     return res.json({
//       data: rows.map((r) => ({
//         ...r,
//         total_hours: parseFloat(r.total_hours),
//         billable_hours: parseFloat(r.billable_hours),
//         non_billable_hours: parseFloat(r.non_billable_hours),
//         total_entries: parseInt(r.total_entries, 10),
//         total_employees: parseInt(r.total_employees, 10),
//         total_tickets: parseInt(r.total_tickets, 10),
//         working_days: parseInt(r.working_days, 10),
//         approved_entries: parseInt(r.approved_entries, 10),
//         rejected_entries: parseInt(r.rejected_entries, 10),
//         submitted_entries: parseInt(r.submitted_entries, 10),
//       })),
//     });
//   } catch (error) {
//     console.error(
//       "[TimesheetReport] getProjectSummaryReport error:",
//       error.message,
//     );
//     return res
//       .status(500)
//       .json({ error: error.message || "Failed to fetch project summary" });
//   }
// };

// // ──────────────────────────────────────────────────────────────
// // GET /api/timesheet-report/ticket-summary      ← NEW FUNCTION
// //
// // Per-ticket rollup showing logged hours vs estimated/approved,
// // employee count, status breakdown, and utilisation %.
// // Shows ALL active tickets; entries filtered via JOIN ON clause.
// //
// // Query params: fromDate, toDate, projectId, clientId, employeeId, status
// // ──────────────────────────────────────────────────────────────
// export const getTicketSummaryReport = async (req, res) => {
//   try {
//     const { fromDate, toDate, projectIds, clientId, employeeId, status } =
//       req.query;

//     const dteFilters = [];
//     const params = [];
//     let idx = 1;

//     if (fromDate && toDate) {
//       dteFilters.push(
//         `dte.entry_date >= $${idx++} AND dte.entry_date <= $${idx++}`,
//       );
//       params.push(fromDate, toDate);
//     } else if (fromDate) {
//       dteFilters.push(`dte.entry_date >= $${idx++}`);
//       params.push(fromDate);
//     } else if (toDate) {
//       dteFilters.push(`dte.entry_date <= $${idx++}`);
//       params.push(toDate);
//     }

//     if (employeeId) {
//       const uuid = await resolveEmployeeId(employeeId);
//       if (uuid) {
//         dteFilters.push(`dte.employee_id = $${idx++}`);
//         params.push(uuid);
//       }
//     }

//     if (status) {
//       dteFilters.push(`ts.name = $${idx++}`);
//       params.push(status);
//     }

//     // Ticket-level outer WHERE filters
//     const tmFilters = [`tm.is_active = TRUE`];

//     if (projectIds) {
//       const uuids = await resolveProjectIds(projectIds);
//       if (uuids.length > 0) {
//         tmFilters.push(`tm.project_id = ANY($${idx++}::uuid[])`);
//         params.push(uuids);
//       }
//     }

//     if (clientId) {
//       tmFilters.push(`pm.client_id = $${idx++}`);
//       params.push(clientId);
//     }

//     const dteJoinExtra =
//       dteFilters.length > 0 ? `AND ${dteFilters.join(" AND ")}` : "";
//     const tmWhereClause = `WHERE ${tmFilters.join(" AND ")}`;

//     const query = `
//       SELECT
//         tm.ticket_id,
//         tm.ticket_name,
//         tm.zoho_crm_code                              AS ticket_code,
//         tm.estimated_hours,
//         tm.approved_hours,
//         pm.project_id,
//         pm.project_name,
//         pm.zoho_crm_code                              AS project_code,
//         cm.client_name,

//         -- Logged timesheet aggregates
//         COUNT(DISTINCT dte.employee_id)               AS total_employees,
//         COUNT(dte.entry_id)                           AS total_entries,
//         COALESCE(SUM(dte.total_hours),        0)      AS logged_hours,
//         COALESCE(SUM(dte.billable_hours),     0)      AS logged_billable_hours,
//         COALESCE(SUM(dte.non_billable_hours), 0)      AS logged_non_billable_hours,
//         COUNT(DISTINCT dte.entry_date)                AS working_days,
//         MIN(dte.entry_date)                           AS first_entry,
//         MAX(dte.entry_date)                           AS last_entry,

//         -- Utilisation: logged vs estimated (null when no estimate)
//         CASE
//           WHEN tm.estimated_hours > 0 THEN
//             ROUND((COALESCE(SUM(dte.total_hours), 0) / tm.estimated_hours) * 100, 1)
//           ELSE NULL
//         END                                           AS utilisation_pct,

//         -- Status breakdown on logged entries
//         COUNT(CASE WHEN ts.name IN ('Manager_Approved','Admin_Approved')
//               THEN dte.entry_id END)                  AS approved_entries,
//         COUNT(CASE WHEN ts.name IN ('Manager_Rejected','Admin_Rejected')
//               THEN dte.entry_id END)                  AS rejected_entries,
//         COUNT(CASE WHEN ts.name = 'Submitted'
//               THEN dte.entry_id END)                  AS submitted_entries,
//         COUNT(CASE WHEN ts.name = 'Draft'
//               THEN dte.entry_id END)                  AS draft_entries

//       FROM ticket_master tm
//       LEFT JOIN project_master pm  ON pm.project_id = tm.project_id
//       LEFT JOIN client_master  cm  ON cm.client_id  = pm.client_id
//       LEFT JOIN daily_timesheet_entries dte
//              ON dte.ticket_id = tm.ticket_id ${dteJoinExtra}
//       LEFT JOIN timesheet_status ts ON ts.id = dte.status

//       ${tmWhereClause}

//       GROUP BY
//         tm.ticket_id, tm.ticket_name, tm.zoho_crm_code,
//         tm.estimated_hours, tm.approved_hours,
//         pm.project_id, pm.project_name, pm.zoho_crm_code,
//         cm.client_name

//       ORDER BY logged_hours DESC, tm.ticket_name ASC
//     `;

//     const { rows } = await pool.query(query, params);

//     return res.json({
//       data: rows.map((r) => ({
//         ...r,
//         logged_hours: parseFloat(r.logged_hours),
//         logged_billable_hours: parseFloat(r.logged_billable_hours),
//         logged_non_billable_hours: parseFloat(r.logged_non_billable_hours),
//         estimated_hours: parseFloat(r.estimated_hours) || 0,
//         approved_hours: parseFloat(r.approved_hours) || 0,
//         utilisation_pct:
//           r.utilisation_pct !== null ? parseFloat(r.utilisation_pct) : null,
//         total_employees: parseInt(r.total_employees, 10),
//         total_entries: parseInt(r.total_entries, 10),
//         working_days: parseInt(r.working_days, 10),
//         approved_entries: parseInt(r.approved_entries, 10),
//         rejected_entries: parseInt(r.rejected_entries, 10),
//         submitted_entries: parseInt(r.submitted_entries, 10),
//         draft_entries: parseInt(r.draft_entries, 10),
//       })),
//     });
//   } catch (error) {
//     console.error(
//       "[TimesheetReport] getTicketSummaryReport error:",
//       error.message,
//     );
//     return res
//       .status(500)
//       .json({ error: error.message || "Failed to fetch ticket summary" });
//   }
// };

// // ──────────────────────────────────────────────────────────────
// // GET /api/timesheet-report/employee-billable
// //
// // JSON preview — one row per (employee × client).
// // Same filter params as getTimesheetReport (minus pagination/sort).
// // Hours are decimal (already ÷60). Self Study = task ILIKE 'Self Study'.
// //
// // Response: { data: [...], total: N }
// // Access: ADMIN, MANAGER
// // ──────────────────────────────────────────────────────────────
// export const getEmployeeBillableReport = async (req, res) => {
//   try {
//     const {
//       employeeIds,
//       projectIds,
//       ticketIds,
//       clientIds,
//       departmentId,
//       fromDate,
//       toDate,
//       status,
//       managerId,
//     } = req.query;

//     const callerRole = req.user?.role;
//     const callerId = req.user?.employee_id || req.user?.id;
//     const isManager = callerRole === "MANAGER";

//     // Resolve the manager's assigned project IDs once — used in two places:
//     //   1. DTE LEFT JOIN ON clause (scope which hours are aggregated)
//     //   2. Employee WHERE clause (scope which employees are visible)
//     let managerProjectIds = [];
//     if (isManager && callerId) {
//       const { rows: pmaRows } = await pool.query(
//         `SELECT DISTINCT project_id
//            FROM project_manager_assignment
//           WHERE manager_id = $1 AND project_id IS NOT NULL`,
//         [callerId],
//       );
//       managerProjectIds = pmaRows.map((r) => r.project_id).filter(Boolean);
//     }

//     // Dummy UUID used when manager has no assigned projects so queries
//     // return 0 rows rather than an empty-array syntax error.
//     const DUMMY_UUID = "00000000-0000-0000-0000-000000000000";
//     const managerScopeIds = isManager
//       ? managerProjectIds.length > 0
//         ? managerProjectIds
//         : [DUMMY_UUID]
//       : null; // null = ADMIN = no scope restriction

//     // ── Parameter index tracker ─────────────────────────────────────────────
//     // Parameters are positional ($1, $2 …) and must be pushed in exactly the
//     // order they appear in the SQL string (top-to-bottom, left-to-right).
//     // Rule: DTE JOIN ON conditions come first in the SQL, then employee WHERE
//     // conditions, so we build them in that order.
//     const params = [];
//     let idx = 1;

//     // ── A. DTE LEFT JOIN ON conditions ──────────────────────────────────────
//     // These scope WHICH HOURS are aggregated for each employee.
//     // Because they live in the JOIN ON clause (not WHERE), employees whose
//     // DTE rows are all filtered out still appear with COALESCE(SUM(...), 0).
//     const dteJoinConds = [];

//     // User-supplied project filter
//     if (projectIds) {
//       const uuids = await resolveProjectIds(projectIds);
//       if (uuids.length > 0) {
//         dteJoinConds.push(`dte.project_id = ANY($${idx++}::uuid[])`);
//         params.push(uuids);
//       }
//     }

//     // Manager project scope on DTE aggregation (always for MANAGER callers)
//     if (isManager) {
//       dteJoinConds.push(`dte.project_id = ANY($${idx++}::uuid[])`);
//       params.push(managerScopeIds);
//     }

//     // Ticket filter
//     if (ticketIds) {
//       const uuids = await resolveTicketIds(ticketIds);
//       if (uuids.length > 0) {
//         dteJoinConds.push(`dte.ticket_id = ANY($${idx++}::uuid[])`);
//         params.push(uuids);
//       }
//     }

//     // Client filter
//     if (clientIds) {
//       const uuids = clientIds
//         .split(",")
//         .map((s) => s.trim())
//         .filter(Boolean);
//       if (uuids.length > 0) {
//         dteJoinConds.push(`dte.client_id = ANY($${idx++}::uuid[])`);
//         params.push(uuids);
//       }
//     }

//     // Timesheet status filter (ts alias is resolved in the DTE LEFT JOIN chain)
//     if (status) {
//       dteJoinConds.push(`ts_eb.name = $${idx++}`);
//       params.push(status);
//     }

//     // Manager-on-entry filter
//     if (managerId) {
//       const uuid = await resolveEmployeeId(managerId);
//       if (uuid) {
//         dteJoinConds.push(`dte.manager_id = $${idx++}`);
//         params.push(uuid);
//       }
//     }

//     // Date range
//     if (fromDate && !toDate) {
//       dteJoinConds.push(`dte.entry_date = $${idx++}`);
//       params.push(fromDate);
//     } else if (fromDate && toDate) {
//       dteJoinConds.push(
//         `dte.entry_date >= $${idx++} AND dte.entry_date <= $${idx++}`,
//       );
//       params.push(fromDate, toDate);
//     } else if (!fromDate && toDate) {
//       dteJoinConds.push(`dte.entry_date <= $${idx++}`);
//       params.push(toDate);
//     }

//     const dteJoinExtra =
//       dteJoinConds.length > 0 ? `AND ${dteJoinConds.join(" AND ")}` : "";

//     // ── B. Employee WHERE conditions ────────────────────────────────────────
//     // These control WHICH EMPLOYEES appear in the result set.
//     // Always exclude ADMIN-role employees.
//     const empWhereConds = [];

//     // Exclude ADMIN role (role id looked up inline to avoid an extra query)
//     empWhereConds.push(
//       `e.role != (SELECT id FROM user_roles WHERE name = 'ADMIN' LIMIT 1)`,
//     );

//     // Only active employees
//     empWhereConds.push(`e.is_active = TRUE`);

//     // Explicit employee filter (user multi-selected specific employees)
//     if (employeeIds) {
//       const uuids = await resolveEmployeeIds(employeeIds);
//       if (uuids.length > 0) {
//         empWhereConds.push(`e.employee_id = ANY($${idx++}::uuid[])`);
//         params.push(uuids);
//       }
//     }

//     // Department filter
//     if (departmentId) {
//       empWhereConds.push(`e.department = $${idx++}`);
//       params.push(departmentId);
//     }

//     // Manager employee-visibility scope:
//     //   Show only employees who are assigned to tickets under the manager's
//     //   projects (ticket_assignments). Using ticket_assignments (not DTE) means
//     //   employees with zero logged hours but existing assignments still appear.
//     if (isManager) {
//       empWhereConds.push(`
//         e.employee_id IN (
//           SELECT DISTINCT ta.employee_id
//           FROM   ticket_assignments ta
//           JOIN   ticket_master      tm ON tm.ticket_id   = ta.ticket_id
//           WHERE  tm.project_id = ANY($${idx++}::uuid[])
//             AND  ta.employee_id IS NOT NULL
//         )
//       `);
//       params.push(managerScopeIds);
//     }

//     const empWhereClause = `WHERE ${empWhereConds.join(" AND ")}`;

//     // ── Build and run the query ─────────────────────────────────────────────
//     const sql = `
//   SELECT
//     e.employee_id,
//     e.employee_code,
//     e.first_name || ' ' || e.last_name               AS employee_name,
//     e.designation,
//     dept.name                                       AS department,

//     -- Client comes from the DTE row; NULL when employee has no entries.
//     cm.client_id,
//     COALESCE(cm.client_name, '(No Client)')         AS client_name,

//     -- ✅ Billable (unchanged)
//     COALESCE(SUM(dte.billable_hours), 0)            AS billable_hours_mins,

//     -- ✅ Non-Billable (EXCLUDING official off tasks)
//     COALESCE(
//       SUM(dte.non_billable_hours)
//       FILTER (
//         WHERE task_eb.task NOT IN (
//           'Official Leave',
//           'Official Saturday Off',
//           'Official Sunday Off',
//           'Public Holiday'
//         )
//       ),
//       0
//     )                                               AS non_billable_hours_mins,
//     -- ✅ NEW: Official Off Days
//     COALESCE(
//       SUM(dte.total_hours)
//       FILTER (
//         WHERE task_eb.task IN (
//           'Official Leave',
//           'Official Saturday Off',
//           'Official Sunday Off',
//           'Public Holiday'
//         )
//       ),
//       0
//     )                                               AS official_off_hours_mins,
//     -- Self Study (unchanged)
//     COALESCE(
//       SUM(dte.total_hours)
//       FILTER (WHERE task_eb.task ILIKE 'Self Study'),
//       0
//     )                                               AS self_study_hours_mins,
//     COUNT(DISTINCT dte.entry_date)                  AS working_days,
//     MIN(dte.entry_date)                             AS first_entry,
//     MAX(dte.entry_date)                             AS last_entry
//   FROM employees e
//   LEFT JOIN departments dept ON dept.id = e.department
//   -- DTE LEFT JOIN preserved (important for zero-entry employees)
//   LEFT JOIN daily_timesheet_entries dte
//          ON dte.employee_id = e.employee_id ${dteJoinExtra}
//   LEFT JOIN timesheet_status ts_eb   ON ts_eb.id       = dte.status
//   LEFT JOIN client_master    cm      ON cm.client_id   = dte.client_id
//   LEFT JOIN task_master      task_eb ON task_eb.task_id = dte.task_id
//   ${empWhereClause}
//   GROUP BY
//     e.employee_id,
//     e.employee_code,
//     e.first_name,
//     e.last_name,
//     e.designation,
//     dept.name,
//     cm.client_id,
//     cm.client_name
//   ORDER BY
//     e.first_name   ASC,
//     e.last_name    ASC,
//     cm.client_name ASC NULLS LAST
// `;

//     const { rows } = await pool.query(sql, params);

//     // Convert INTEGER MINUTES → decimal hours for the JSON response.
//     // The frontend's decimalToHHMM() turns these into H:MM display strings.
//     const toHrs = (mins) =>
//       mins != null ? Math.round((parseFloat(mins) / 60) * 100) / 100 : 0;

//     return res.json({
//       data: rows.map((r) => ({
//         employee_id: r.employee_id,
//         employee_code: r.employee_code,
//         employee_name: r.employee_name,
//         designation: r.designation || "",
//         department: r.department || "",
//         client_id: r.client_id || null,
//         client_name: r.client_name,
//         billable_hours: toHrs(r.billable_hours_mins),
//         non_billable_hours: toHrs(r.non_billable_hours_mins),
//         self_study_hours: toHrs(r.self_study_hours_mins),
//         working_days: parseInt(r.working_days, 10),
//         first_entry: r.first_entry,
//         last_entry: r.last_entry,
//       })),
//       total: rows.length,
//     });
//   } catch (error) {
//     console.error(
//       "[TimesheetReport] getEmployeeBillableReport error:",
//       error.message,
//     );
//     return res.status(500).json({
//       error: error.message || "Failed to fetch employee billable report",
//     });
//   }
// };

// // ──────────────────────────────────────────────────────────────
// // GET /api/timesheet-report/header-preview
// //
// // JSON preview — one row per (client × project × ticket).
// //
// // ROOT CAUSE FIX: previously drove from ticket_master, so only clients
// // that had at least one active ticket were visible. Clients with no
// // tickets were completely absent from the report.
// //
// // NEW QUERY STRUCTURE — drives from client_master:
// //   client_master
// //     └─ LEFT JOIN project_master  (projectIds filter in JOIN ON)
// //          └─ LEFT JOIN ticket_master  (ticketIds + is_active in JOIN ON)
// //               └─ LEFT JOIN daily_timesheet_entries  (entry-level filters in JOIN ON)
// //
// // By putting every scope filter in the JOIN ON clauses (not WHERE),
// // a client with no matching projects/tickets still produces a row
// // with NULL ticket info and 0 hours — all clients always appear.
// //
// // The only WHERE conditions are on client_master itself:
// //   ADMIN   → cm.is_active = TRUE  (all active clients)
// //   MANAGER → cm.is_active = TRUE AND cm.client_id IN (
// //               SELECT DISTINCT pm2.client_id FROM project_master pm2
// //               WHERE pm2.project_id = ANY($managerScopeIds)
// //             )  — only clients whose projects the manager manages
// //
// // Hours returned as INTEGER MINUTES. Frontend divides by 60 for display.
// // Response: { data: [...], total: N }
// // Access: ADMIN, MANAGER
// // ──────────────────────────────────────────────────────────────
// export const getHeaderPreviewReport = async (req, res) => {
//   try {
//     const {
//       employeeIds,
//       projectIds,
//       ticketIds,
//       clientIds,
//       departmentId,
//       fromDate,
//       toDate,
//       status,
//       managerId,
//     } = req.query;

//     const callerRole = req.user?.role;
//     const callerId = req.user?.employee_id || req.user?.id;
//     const isManager = callerRole === "MANAGER";
//     let managerProjectIds = [];
//     if (isManager && callerId) {
//       const pmaRows = await pool.query(
//         `SELECT DISTINCT project_id
//            FROM project_manager_assignment
//           WHERE manager_id = $1 AND project_id IS NOT NULL`,
//         [callerId],
//       );
//       managerProjectIds = pmaRows.rows.map((r) => r.project_id).filter(Boolean);
//     }
//     const DUMMY = "00000000-0000-0000-0000-000000000000";
//     const managerScopeIds = isManager
//       ? managerProjectIds.length > 0
//         ? managerProjectIds
//         : [DUMMY]
//       : null;

//     const hParams = [];
//     let hIdx = 1;

//     // ── A. project_master JOIN ON conditions ────────────────────────────────
//     // Controls which projects appear per client. Does NOT eliminate client rows
//     // when empty — the LEFT JOIN still produces the client row with NULL project.
//     const pmJoinConds = [];

//     if (projectIds) {
//       const uuids = await resolveProjectIds(projectIds);
//       if (uuids.length > 0) {
//         pmJoinConds.push(`pm.project_id = ANY($${hIdx++}::uuid[])`);
//         hParams.push(uuids);
//       }
//     }
//     // Manager scope on projects — restricts which projects are joined per client
//     if (isManager) {
//       pmJoinConds.push(`pm.project_id = ANY($${hIdx++}::uuid[])`);
//       hParams.push(managerScopeIds);
//     }

//     // ── B. ticket_master JOIN ON conditions ─────────────────────────────────
//     // is_active always here (moved out of WHERE) so inactive tickets are excluded
//     // without eliminating client or project rows.
//     const tmJoinConds = [`tm.is_active = TRUE`];

//     if (ticketIds) {
//       const uuids = await resolveTicketIds(ticketIds);
//       if (uuids.length > 0) {
//         tmJoinConds.push(`tm.ticket_id = ANY($${hIdx++}::uuid[])`);
//         hParams.push(uuids);
//       }
//     }

//     // ── C. DTE LEFT JOIN ON conditions — scope which hours are aggregated ────
//     // Entry-level filters here so tickets/clients with 0 matching entries still
//     // appear with 0 hours rather than disappearing.
//     const hDteJoin = [];

//     // clientIds: moved here (was incorrectly in WHERE as pm.client_id).
//     // Using dte.client_id scopes which hours are counted, not which rows appear.
//     if (clientIds) {
//       const uuids = clientIds
//         .split(",")
//         .map((s) => s.trim())
//         .filter(Boolean);
//       if (uuids.length > 0) {
//         hDteJoin.push(`dte.client_id = ANY($${hIdx++}::uuid[])`);
//         hParams.push(uuids);
//       }
//     }
//     if (employeeIds) {
//       const uuids = await resolveEmployeeIds(employeeIds);
//       if (uuids.length > 0) {
//         hDteJoin.push(`dte.employee_id = ANY($${hIdx++}::uuid[])`);
//         hParams.push(uuids);
//       }
//     }
//     if (departmentId) {
//       hDteJoin.push(`e_h.department = $${hIdx++}`);
//       hParams.push(departmentId);
//     }
//     if (managerId) {
//       const uuid = await resolveEmployeeId(managerId);
//       if (uuid) {
//         hDteJoin.push(`dte.manager_id = $${hIdx++}`);
//         hParams.push(uuid);
//       }
//     }
//     if (status) {
//       hDteJoin.push(`ts_h.name = $${hIdx++}`);
//       hParams.push(status);
//     }
//     if (fromDate && !toDate) {
//       hDteJoin.push(`dte.entry_date = $${hIdx++}`);
//       hParams.push(fromDate);
//     } else if (fromDate && toDate) {
//       hDteJoin.push(
//         `dte.entry_date >= $${hIdx++} AND dte.entry_date <= $${hIdx++}`,
//       );
//       hParams.push(fromDate, toDate);
//     } else if (!fromDate && toDate) {
//       hDteJoin.push(`dte.entry_date <= $${hIdx++}`);
//       hParams.push(toDate);
//     }

//     // ── D. client_master WHERE conditions ───────────────────────────────────
//     // ADMIN   → all active clients
//     // MANAGER → only clients whose projects this manager manages
//     const cmWhereConds = [`cm.is_active = TRUE`];

//     if (isManager) {
//       // Restrict which clients appear to only those the manager has projects for
//       cmWhereConds.push(`cm.client_id IN (
//         SELECT DISTINCT pm2.client_id
//         FROM   project_master pm2
//         WHERE  pm2.project_id = ANY($${hIdx++}::uuid[])
//           AND  pm2.client_id IS NOT NULL
//       )`);
//       hParams.push(managerScopeIds);
//     }

//     // Explicit clientIds filter from user — applies to both roles
//     if (clientIds) {
//       const uuids = clientIds
//         .split(",")
//         .map((s) => s.trim())
//         .filter(Boolean);
//       if (uuids.length > 0) {
//         cmWhereConds.push(`cm.client_id = ANY($${hIdx++}::uuid[])`);
//         hParams.push(uuids);
//       }
//     }

//     // ── Assemble SQL fragments ───────────────────────────────────────────────
//     const pmJoinExtra =
//       pmJoinConds.length > 0 ? `AND ${pmJoinConds.join(" AND ")}` : "";
//     const tmJoinStr = tmJoinConds.join(" AND ");
//     const hJoinExtra =
//       hDteJoin.length > 0 ? `AND ${hDteJoin.join(" AND ")}` : "";
//     const hWhereClause = `WHERE ${cmWhereConds.join(" AND ")}`;

//     const headerQuery = `
//       SELECT
//         cm.client_id,
//         COALESCE(cm.client_name,  '(No Client)')         AS client_name,
//         COALESCE(pm.project_name, '(No Project)')        AS project_name,
//         COALESCE(pst.name, '')                           AS project_status,
//         tm.ticket_name,
//         tm.zoho_crm_code                                 AS ticket_code,
//         COALESCE(tst.name, '')                           AS ticket_status,
//         COALESCE(tm.description, '')                     AS ticket_description,
//         COALESCE(tm.approved_hours, 0)                   AS approved_hours_mins,
//         COALESCE(SUM(dte.billable_hours),     0)         AS billable_hours_mins,
//         COALESCE(SUM(dte.non_billable_hours), 0)         AS non_billable_hours_mins

//       FROM client_master cm

//       -- Projects LEFT JOIN: scope conditions in ON so client rows survive
//       LEFT JOIN project_master pm
//              ON pm.client_id = cm.client_id ${pmJoinExtra}
//       LEFT JOIN project_status pst ON pst.id = pm.status

//       -- Tickets LEFT JOIN: is_active + user ticket filter in ON
//       LEFT JOIN ticket_master tm
//              ON tm.project_id = pm.project_id AND ${tmJoinStr}
//       LEFT JOIN ticket_status tst ON tst.id = tm.status

//       -- DTE LEFT JOIN: all entry-level filters in ON
//       LEFT JOIN daily_timesheet_entries dte
//              ON dte.ticket_id = tm.ticket_id ${hJoinExtra}
//       LEFT JOIN employees        e_h  ON e_h.employee_id = dte.employee_id
//       LEFT JOIN timesheet_status ts_h ON ts_h.id         = dte.status

//       ${hWhereClause}

//       GROUP BY
//         cm.client_id,
//         cm.client_name,
//         pm.project_id,
//         pm.project_name,
//         pst.name,
//         tst.name,
//         tm.ticket_id,
//         tm.ticket_name,
//         tm.zoho_crm_code,
//         tm.description,
//         tm.approved_hours

//       ORDER BY
//         cm.client_name  ASC NULLS LAST,
//         pm.project_name ASC NULLS LAST,
//         tm.ticket_name  ASC NULLS LAST
//     `;

//     const { rows } = await pool.query(headerQuery, hParams);

//     return res.json({
//       data: rows.map((r) => ({
//         ...r,
//         client_id: r.client_id || null,
//         approved_hours_mins: parseInt(r.approved_hours_mins, 10) || 0,
//         billable_hours_mins: parseInt(r.billable_hours_mins, 10) || 0,
//         non_billable_hours_mins: parseInt(r.non_billable_hours_mins, 10) || 0,
//       })),
//       total: rows.length,
//     });
//   } catch (error) {
//     console.error(
//       "[TimesheetReport] getHeaderPreviewReport error:",
//       error.message,
//     );
//     return res
//       .status(500)
//       .json({ error: error.message || "Failed to fetch header preview" });
//   }
// };

// // ──────────────────────────────────────────────────────────────
// // GET /api/timesheet-report/export
// //
// // Downloads ALL matching rows (no pagination) as an Excel file.
// // Applies identical filter + manager-scope logic as getTimesheetReport.
// // Hours stored as INTEGER MINUTES — divided by 60 for display.
// //
// // Query params: same as getTimesheetReport (page/pageSize/sortBy/sortDir ignored)
// // Access: ADMIN, MANAGER
// // ──────────────────────────────────────────────────────────────
// export const exportTimesheetReport = async (req, res) => {
//   try {
//     const {
//       employeeIds, // comma-separated UUIDs — multi-select
//       projectIds, // comma-separated UUIDs — multi-select
//       ticketIds, // comma-separated UUIDs — multi-select
//       clientIds, // comma-separated UUIDs — multi-select
//       departmentId,
//       fromDate,
//       toDate,
//       status,
//       managerId,
//       sortBy = "entry_date",
//       sortDir = "desc",
//       exportMode = "item", // "item" (default) | "header" | "employee-billable"
//     } = req.query;

//     // ── Sort whitelist ────────────────────────────────────────
//     const ALLOWED_SORT = {
//       entry_date: "dte.entry_date",
//       hours: "dte.total_hours",
//       status: "ts.name",
//       employee: "e.first_name",
//       project: "pm.project_name",
//       ticket: "tm.ticket_name",
//       submitted_at: "dte.submitted_at",
//     };
//     const sortCol = ALLOWED_SORT[sortBy] || "dte.entry_date";
//     const dir = sortDir === "asc" ? "ASC" : "DESC";

//     // ── Manager scope (identical to getTimesheetReport) ───────
//     const callerRole = req.user?.role;
//     const callerId = req.user?.employee_id || req.user?.id;
//     const isManager = callerRole === "MANAGER";
//     let managerProjectIds = [];
//     if (isManager && callerId) {
//       const pmaRows = await pool.query(
//         `SELECT DISTINCT project_id
//            FROM project_manager_assignment
//           WHERE manager_id = $1 AND project_id IS NOT NULL`,
//         [callerId],
//       );
//       managerProjectIds = pmaRows.rows.map((r) => r.project_id).filter(Boolean);
//     }

//     // ── Build WHERE conditions ────────────────────────────────
//     const conditions = [];
//     const params = [];
//     let idx = 1;

//     if (employeeIds) {
//       const uuids = await resolveEmployeeIds(employeeIds);
//       if (uuids.length > 0) {
//         conditions.push(`dte.employee_id = ANY($${idx++}::uuid[])`);
//         params.push(uuids);
//       }
//     }

//     if (projectIds) {
//       const uuids = await resolveProjectIds(projectIds);
//       if (uuids.length > 0) {
//         conditions.push(`dte.project_id = ANY($${idx++}::uuid[])`);
//         params.push(uuids);
//       }
//     }

//     // Always enforce manager scope
//     if (isManager) {
//       const scopeIds =
//         managerProjectIds.length > 0
//           ? managerProjectIds
//           : ["00000000-0000-0000-0000-000000000000"];
//       conditions.push(`dte.project_id = ANY($${idx++}::uuid[])`);
//       params.push(scopeIds);
//     }

//     if (ticketIds) {
//       const uuids = await resolveTicketIds(ticketIds);
//       if (uuids.length > 0) {
//         conditions.push(`dte.ticket_id = ANY($${idx++}::uuid[])`);
//         params.push(uuids);
//       }
//     }

//     if (clientIds) {
//       const uuids = clientIds
//         .split(",")
//         .map((s) => s.trim())
//         .filter(Boolean);
//       if (uuids.length > 0) {
//         conditions.push(`dte.client_id = ANY($${idx++}::uuid[])`);
//         params.push(uuids);
//       }
//     }
//     if (departmentId) {
//       conditions.push(`e.department = $${idx++}`);
//       params.push(departmentId);
//     }
//     if (status) {
//       conditions.push(`ts.name = $${idx++}`);
//       params.push(status);
//     }

//     if (managerId) {
//       const uuid = await resolveEmployeeId(managerId);
//       if (uuid) {
//         conditions.push(`dte.manager_id = $${idx++}`);
//         params.push(uuid);
//       }
//     }

//     if (fromDate && !toDate) {
//       conditions.push(`dte.entry_date = $${idx++}`);
//       params.push(fromDate);
//     } else if (fromDate && toDate) {
//       conditions.push(
//         `dte.entry_date >= $${idx++} AND dte.entry_date <= $${idx++}`,
//       );
//       params.push(fromDate, toDate);
//     } else if (!fromDate && toDate) {
//       conditions.push(`dte.entry_date <= $${idx++}`);
//       params.push(toDate);
//     }

//     const whereClause =
//       conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

//     // ── Fetch ALL matching rows (no LIMIT/OFFSET) ─────────────
//     const { rows } = await pool.query(
//       `SELECT
//          dte.entry_date,
//          e.employee_code,
//          e.first_name || ' ' || e.last_name          AS employee_name,
//          e.designation                                AS employee_designation,
//          dept.name                                    AS employee_department,
//          pm.project_name,
//          pm.zoho_crm_code                             AS project_code,
//          cm.client_name,
//          tm.ticket_name,
//          tm.zoho_crm_code                             AS ticket_code,
//          task.task                                    AS task_name,
//          dte.total_hours,
//          dte.billable_hours,
//          dte.non_billable_hours,
//          ts.name                                      AS status,
//          dte.description,
//          dte.ticket_number,
//          mgr.first_name || ' ' || mgr.last_name      AS manager_name,
//          dte.submitted_at,
//          COALESCE(apr.first_name || ' ' || apr.last_name, '') AS approved_by_name,
//          dte.approved_at,
//          dte.rejection_reason
//        FROM daily_timesheet_entries dte
//        JOIN  timesheet_status  ts    ON ts.id            = dte.status
//        JOIN  employees         e     ON e.employee_id     = dte.employee_id
//        LEFT JOIN departments   dept  ON dept.id           = e.department
//        LEFT JOIN project_master pm   ON pm.project_id     = dte.project_id
//        LEFT JOIN client_master  cm   ON cm.client_id      = dte.client_id
//        LEFT JOIN ticket_master  tm   ON tm.ticket_id      = dte.ticket_id
//        LEFT JOIN employees      mgr  ON mgr.employee_id   = dte.manager_id
//        LEFT JOIN employees      apr  ON apr.employee_id   = dte.approved_by
//        LEFT JOIN task_master    task ON task.task_id      = dte.task_id
//        ${whereClause}
//        ORDER BY ${sortCol} ${dir}`,
//       params,
//     );

//     // ────────────────────────────────────────────────────────────────────────
//     // SHARED HELPERS
//     // ────────────────────────────────────────────────────────────────────────

//     /** INTEGER MINUTES → decimal hours rounded to 2 dp */
//     const toHrs = (mins) =>
//       mins != null ? Math.round((parseFloat(mins) / 60) * 100) / 100 : 0;

//     const fmtDate = (val) => {
//       if (!val) return "";
//       const d = new Date(
//         typeof val === "string" && val.length === 10 ? val + "T00:00:00" : val,
//       );
//       return isNaN(d.getTime())
//         ? String(val)
//         : d.toLocaleDateString("en-GB", {
//             day: "2-digit",
//             month: "short",
//             year: "numeric",
//           });
//     };

//     const solidFill = (argb) => ({
//       type: "pattern",
//       pattern: "solid",
//       fgColor: { argb },
//     });
//     const hairBdr = () => ({
//       bottom: { style: "hair", color: { argb: "FFCBD5E1" } },
//       right: { style: "hair", color: { argb: "FFCBD5E1" } },
//     });

//     const dateStr = new Date().toISOString().split("T")[0];
//     const workbook = new ExcelJS.Workbook();
//     workbook.creator = "TimeTrack Pro";
//     workbook.created = new Date();

//     // ════════════════════════════════════════════════════════════════════════
//     // EMPLOYEE-BILLABLE MODE
//     // One row per (employee × client):
//     //   Employee Code | Employee Name | Designation | Department
//     //   Client Name
//     //   Billable Hours | Non-Billable Hours | Self Study Hours | Working Days
//     //
//     // Self Study = entries where task_master.task ILIKE 'Self Study'.
//     // Filters work the same as item-mode (all filters applied to DTE WHERE).
//     // ════════════════════════════════════════════════════════════════════════
//     if (exportMode === "employee-billable") {
//       // ── Rebuild params independently ──────────────────────────────────────
//       // Cannot reuse the shared `conditions` / `params` built above: those are
//       // structured around DTE as the driving table. Here we drive from `employees`
//       // with DTE as a LEFT JOIN, so filters live in two separate zones:
//       //
//       //   ebDteJoin   → LEFT JOIN ON clause for daily_timesheet_entries
//       //                 Entry-level filters: projects, tickets, clients, status,
//       //                 managerId (on entry), date range.
//       //                 Placing them here means employees with 0 matching DTE
//       //                 rows still appear with COALESCE(SUM(...), 0) = 0.
//       //
//       //   ebEmpWhere  → WHERE on employees
//       //                 Employee-level filters: is_active, exclude ADMIN role,
//       //                 explicit employeeIds, departmentId, manager visibility.
//       //
//       const ebDteJoin = [];
//       const ebEmpWhere = [];
//       const ebParams = [];
//       let ebIdx = 1;

//       // ── DTE JOIN ON conditions ─────────────────────────────────────────────
//       if (projectIds) {
//         const uuids = await resolveProjectIds(projectIds);
//         if (uuids.length > 0) {
//           ebDteJoin.push(`dte.project_id = ANY($${ebIdx++}::uuid[])`);
//           ebParams.push(uuids);
//         }
//       }
//       // Manager project scope on DTE aggregation
//       if (isManager) {
//         const scopeIds =
//           managerProjectIds.length > 0
//             ? managerProjectIds
//             : ["00000000-0000-0000-0000-000000000000"];
//         ebDteJoin.push(`dte.project_id = ANY($${ebIdx++}::uuid[])`);
//         ebParams.push(scopeIds);
//       }
//       if (ticketIds) {
//         const uuids = await resolveTicketIds(ticketIds);
//         if (uuids.length > 0) {
//           ebDteJoin.push(`dte.ticket_id = ANY($${ebIdx++}::uuid[])`);
//           ebParams.push(uuids);
//         }
//       }
//       if (clientIds) {
//         const uuids = clientIds
//           .split(",")
//           .map((s) => s.trim())
//           .filter(Boolean);
//         if (uuids.length > 0) {
//           ebDteJoin.push(`dte.client_id = ANY($${ebIdx++}::uuid[])`);
//           ebParams.push(uuids);
//         }
//       }
//       if (status) {
//         ebDteJoin.push(`ts_eb.name = $${ebIdx++}`);
//         ebParams.push(status);
//       }
//       if (managerId) {
//         const uuid = await resolveEmployeeId(managerId);
//         if (uuid) {
//           ebDteJoin.push(`dte.manager_id = $${ebIdx++}`);
//           ebParams.push(uuid);
//         }
//       }
//       if (fromDate && !toDate) {
//         ebDteJoin.push(`dte.entry_date = $${ebIdx++}`);
//         ebParams.push(fromDate);
//       } else if (fromDate && toDate) {
//         ebDteJoin.push(
//           `dte.entry_date >= $${ebIdx++} AND dte.entry_date <= $${ebIdx++}`,
//         );
//         ebParams.push(fromDate, toDate);
//       } else if (!fromDate && toDate) {
//         ebDteJoin.push(`dte.entry_date <= $${ebIdx++}`);
//         ebParams.push(toDate);
//       }

//       // ── Employee WHERE conditions ──────────────────────────────────────────
//       // Always exclude ADMIN-role employees and inactive employees
//       ebEmpWhere.push(
//         `e.role != (SELECT id FROM user_roles WHERE name = 'ADMIN' LIMIT 1)`,
//       );
//       ebEmpWhere.push(`e.is_active = TRUE`);

//       if (employeeIds) {
//         const uuids = await resolveEmployeeIds(employeeIds);
//         if (uuids.length > 0) {
//           ebEmpWhere.push(`e.employee_id = ANY($${ebIdx++}::uuid[])`);
//           ebParams.push(uuids);
//         }
//       }
//       if (departmentId) {
//         ebEmpWhere.push(`e.department = $${ebIdx++}`);
//         ebParams.push(departmentId);
//       }
//       // Manager employee-visibility scope: only show employees assigned to
//       // tickets in the manager's projects (even if they have 0 hours logged)
//       if (isManager) {
//         const scopeIds =
//           managerProjectIds.length > 0
//             ? managerProjectIds
//             : ["00000000-0000-0000-0000-000000000000"];
//         ebEmpWhere.push(`e.employee_id IN (
//           SELECT DISTINCT ta.employee_id
//           FROM   ticket_assignments ta
//           JOIN   ticket_master      tm2 ON tm2.ticket_id = ta.ticket_id
//           WHERE  tm2.project_id = ANY($${ebIdx++}::uuid[])
//             AND  ta.employee_id IS NOT NULL
//         )`);
//         ebParams.push(scopeIds);
//       }

//       const ebDteExtra =
//         ebDteJoin.length > 0 ? `AND ${ebDteJoin.join(" AND ")}` : "";
//       const ebWhereClause = `WHERE ${ebEmpWhere.join(" AND ")}`;

//       const ebQuery = `
//         SELECT
//           e.employee_id,
//           e.employee_code,
//           e.first_name || ' ' || e.last_name             AS employee_name,
//           e.designation,
//           dept.name                                       AS department,
//           cm.client_id,
//           COALESCE(cm.client_name, '(No Client)')         AS client_name,
//           COALESCE(SUM(dte.billable_hours),     0)        AS billable_hours_mins,
//           COALESCE(SUM(dte.non_billable_hours), 0)        AS non_billable_hours_mins,
//           COALESCE(
//             SUM(dte.total_hours)
//             FILTER (WHERE task_eb.task ILIKE 'Self Study'),
//             0
//           )                                               AS self_study_hours_mins,
//           COUNT(DISTINCT dte.entry_date)                  AS working_days
//         FROM employees e
//         LEFT JOIN departments dept ON dept.id = e.department

//         -- DTE is LEFT JOIN so employees with 0 matching entries still appear.
//         -- All entry-level filters live in the ON clause, not in WHERE.
//         LEFT JOIN daily_timesheet_entries dte
//                ON dte.employee_id = e.employee_id ${ebDteExtra}
//         LEFT JOIN timesheet_status ts_eb   ON ts_eb.id        = dte.status
//         LEFT JOIN client_master    cm      ON cm.client_id    = dte.client_id
//         LEFT JOIN task_master      task_eb ON task_eb.task_id = dte.task_id

//         ${ebWhereClause}

//         GROUP BY
//           e.employee_id, e.employee_code,
//           e.first_name, e.last_name,
//           e.designation, dept.name,
//           cm.client_id, cm.client_name
//         ORDER BY
//           e.first_name ASC, e.last_name ASC,
//           cm.client_name ASC NULLS LAST
//       `;

//       const { rows: ebRows } = await pool.query(ebQuery, ebParams);

//       // ── Build workbook ────────────────────────────────────────
//       const ws = workbook.addWorksheet("Employee Billable Report");

//       // Title banner row
//       ws.mergeCells("A1:H1");
//       const titleCell = ws.getCell("A1");
//       titleCell.value = "Employee Billable Hours Report";
//       titleCell.font = {
//         bold: true,
//         size: 13,
//         color: { argb: "FFFFFFFF" },
//         name: "Calibri",
//       };
//       titleCell.fill = solidFill("FF1E3A5F");
//       titleCell.alignment = { vertical: "middle", horizontal: "center" };
//       ws.getRow(1).height = 26;

//       // Column definitions
//       ws.columns = [
//         { key: "employee_code", width: 16 },
//         { key: "employee_name", width: 26 },
//         { key: "designation", width: 22 },
//         { key: "department", width: 20 },
//         { key: "client_name", width: 28 },
//         { key: "billable_hours", width: 18 },
//         { key: "non_billable_hours", width: 20 },
//         { key: "self_study_hours", width: 18 },
//       ];

//       // Header row (row 2)
//       const COL_HEADERS = [
//         "Employee Code",
//         "Employee Name",
//         "Designation",
//         "Department",
//         "Client Name",
//         "Billable Hours",
//         "Non-Billable Hours",
//         "Self Study Hours",
//       ];
//       const hdrRow = ws.getRow(2);
//       COL_HEADERS.forEach((h, i) => {
//         const cell = hdrRow.getCell(i + 1);
//         cell.value = h;
//         cell.font = {
//           bold: true,
//           color: { argb: "FFFFFFFF" },
//           size: 11,
//           name: "Calibri",
//         };
//         cell.fill = solidFill("FF2D5F8A");
//         cell.alignment = { vertical: "middle", horizontal: "center" };
//         cell.border = {
//           bottom: { style: "medium", color: { argb: "FF1E3A5F" } },
//         };
//       });
//       hdrRow.height = 20;
//       ws.views = [{ state: "frozen", ySplit: 2 }];
//       ws.autoFilter = {
//         from: { row: 2, column: 1 },
//         to: { row: 2, column: 8 },
//       };

//       if (ebRows.length === 0) {
//         ws.mergeCells("A3:H3");
//         const emptyCell = ws.getCell("A3");
//         emptyCell.value = "No data found for the selected filters.";
//         emptyCell.font = {
//           italic: true,
//           color: { argb: "FF94A3B8" },
//           size: 10,
//         };
//         emptyCell.alignment = { horizontal: "center" };
//       } else {
//         // Group rows by employee for visual grouping + per-employee subtotals
//         const empGroups = [];
//         let curGroup = null;
//         for (const r of ebRows) {
//           if (!curGroup || curGroup.employeeId !== r.employee_id) {
//             if (curGroup) empGroups.push(curGroup);
//             curGroup = {
//               employeeId: r.employee_id,
//               rows: [],
//             };
//           }
//           curGroup.rows.push(r);
//         }
//         if (curGroup) empGroups.push(curGroup);

//         let groupToggle = false;

//         empGroups.forEach((grp) => {
//           groupToggle = !groupToggle;
//           // Even group: pale blue identity cols / white data cols
//           // Odd group:  light grey identity cols / near-white data cols
//           const empBg = groupToggle ? "FFEAF4FF" : "FFF1F5F9";
//           const cliBg = groupToggle ? "FFFFFFFF" : "FFF8FAFC";

//           let grpBillable = 0;
//           let grpNonBillable = 0;
//           let grpSelfStudy = 0;
//           let grpWorkingDays = 0;

//           grp.rows.forEach((r) => {
//             const bill = toHrs(r.billable_hours_mins);
//             const nonB = toHrs(r.non_billable_hours_mins);
//             const self = toHrs(r.self_study_hours_mins);
//             const wdays = parseInt(r.working_days, 10);

//             grpBillable += bill;
//             grpNonBillable += nonB;
//             grpSelfStudy += self;
//             grpWorkingDays = Math.max(grpWorkingDays, wdays);

//             const dataRow = ws.addRow([
//               r.employee_code || "",
//               r.employee_name || "",
//               r.designation || "",
//               r.department || "",
//               r.client_name || "(No Client)",
//               bill,
//               nonB,
//               self,
//             ]);
//             dataRow.eachCell((cell, colNum) => {
//               cell.fill = solidFill(colNum <= 4 ? empBg : cliBg);
//               cell.font = { size: 10, name: "Calibri" };
//               cell.alignment = {
//                 vertical: "middle",
//                 horizontal: colNum >= 6 ? "right" : "left",
//               };
//               cell.border = hairBdr();
//             });
//             [6, 7, 8].forEach((c) => {
//               dataRow.getCell(c).numFmt = "0.00";
//             });
//             dataRow.height = 18;
//           });

//           // Subtotal row — only when employee spans 2+ clients
//           if (grp.rows.length > 1) {
//             const subRow = ws.addRow([
//               "",
//               `${grp.rows[0].employee_name} — Total`,
//               "",
//               "",
//               `${grp.rows.length} clients`,
//               Math.round(grpBillable * 100) / 100,
//               Math.round(grpNonBillable * 100) / 100,
//               Math.round(grpSelfStudy * 100) / 100,
//             ]);
//             subRow.eachCell((cell, colNum) => {
//               cell.fill = solidFill("FFE0EFFF");
//               cell.font = {
//                 bold: true,
//                 size: 10,
//                 name: "Calibri",
//                 color: { argb: "FF1E3A5F" },
//               };
//               cell.alignment = {
//                 vertical: "middle",
//                 horizontal: colNum >= 6 ? "right" : "left",
//               };
//               cell.border = {
//                 top: { style: "thin", color: { argb: "FF2D5F8A" } },
//                 bottom: { style: "medium", color: { argb: "FF1E3A5F" } },
//                 left: { style: "hair", color: { argb: "FFCBD5E1" } },
//                 right: { style: "hair", color: { argb: "FFCBD5E1" } },
//               };
//             });
//             [6, 7, 8].forEach((c) => {
//               subRow.getCell(c).numFmt = "0.00";
//             });
//             subRow.height = 18;
//           }
//         });

//         // Grand total row
//         const totBillable = ebRows.reduce(
//           (s, r) => s + toHrs(r.billable_hours_mins),
//           0,
//         );
//         const totNonBillable = ebRows.reduce(
//           (s, r) => s + toHrs(r.non_billable_hours_mins),
//           0,
//         );
//         const totSelfStudy = ebRows.reduce(
//           (s, r) => s + toHrs(r.self_study_hours_mins),
//           0,
//         );

//         const grandRow = ws.addRow([
//           "",
//           "GRAND TOTAL",
//           "",
//           "",
//           `${ebRows.length} rows`,
//           Math.round(totBillable * 100) / 100,
//           Math.round(totNonBillable * 100) / 100,
//           Math.round(totSelfStudy * 100) / 100,
//         ]);
//         grandRow.eachCell((cell, colNum) => {
//           cell.fill = solidFill("FF1E3A5F");
//           cell.font = {
//             bold: true,
//             size: 11,
//             name: "Calibri",
//             color: { argb: "FFFFFFFF" },
//           };
//           cell.alignment = {
//             vertical: "middle",
//             horizontal: colNum >= 6 ? "right" : "left",
//           };
//           cell.border = {
//             top: { style: "medium", color: { argb: "FF2D5F8A" } },
//           };
//         });
//         [6, 7, 8].forEach((c) => {
//           grandRow.getCell(c).numFmt = "0.00";
//         });
//         grandRow.height = 20;
//       }

//       const ebBuffer = await workbook.xlsx.writeBuffer();
//       const ebFilename = `EmployeeBillable_${dateStr}.xlsx`;
//       res.setHeader(
//         "Content-Type",
//         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//       );
//       res.setHeader(
//         "Content-Disposition",
//         `attachment; filename="${ebFilename}"`,
//       );
//       res.setHeader("Content-Length", ebBuffer.length);
//       res.end(ebBuffer);
//       console.log(
//         `[TimesheetReport] Employee-Billable export: ${ebRows.length} rows → ${ebFilename}`,
//       );
//       return;
//     }

//     // ════════════════════════════════════════════════════════════════════════
//     // HEADER MODE — one row per (client × project × ticket)
//     // ════════════════════════════════════════════════════════════════════════
//     // Drives from client_master so ALL active clients always appear, even those
//     // with no tickets or no DTE entries (they show with 0 hours).
//     // Identical query structure as getHeaderPreviewReport.
//     // ════════════════════════════════════════════════════════════════════════
//     if (exportMode === "header") {
//       const hParams = [];
//       let hIdx = 1;

//       // A. project_master JOIN ON conditions
//       const pmJoinConds = [];
//       if (projectIds) {
//         const uuids = await resolveProjectIds(projectIds);
//         if (uuids.length > 0) {
//           pmJoinConds.push(`pm.project_id = ANY($${hIdx++}::uuid[])`);
//           hParams.push(uuids);
//         }
//       }
//       if (isManager) {
//         const scopeIds =
//           managerProjectIds.length > 0
//             ? managerProjectIds
//             : ["00000000-0000-0000-0000-000000000000"];
//         pmJoinConds.push(`pm.project_id = ANY($${hIdx++}::uuid[])`);
//         hParams.push(scopeIds);
//       }

//       // B. ticket_master JOIN ON conditions
//       const tmJoinConds = [`tm.is_active = TRUE`];
//       if (ticketIds) {
//         const uuids = await resolveTicketIds(ticketIds);
//         if (uuids.length > 0) {
//           tmJoinConds.push(`tm.ticket_id = ANY($${hIdx++}::uuid[])`);
//           hParams.push(uuids);
//         }
//       }

//       // C. DTE LEFT JOIN ON conditions (entry-level filters)
//       const hDteJoin = [];
//       if (clientIds) {
//         const uuids = clientIds
//           .split(",")
//           .map((s) => s.trim())
//           .filter(Boolean);
//         if (uuids.length > 0) {
//           hDteJoin.push(`dte.client_id = ANY($${hIdx++}::uuid[])`);
//           hParams.push(uuids);
//         }
//       }
//       if (employeeIds) {
//         const uuids = await resolveEmployeeIds(employeeIds);
//         if (uuids.length > 0) {
//           hDteJoin.push(`dte.employee_id = ANY($${hIdx++}::uuid[])`);
//           hParams.push(uuids);
//         }
//       }
//       if (departmentId) {
//         hDteJoin.push(`e_h.department = $${hIdx++}`);
//         hParams.push(departmentId);
//       }
//       if (managerId) {
//         const uuid = await resolveEmployeeId(managerId);
//         if (uuid) {
//           hDteJoin.push(`dte.manager_id = $${hIdx++}`);
//           hParams.push(uuid);
//         }
//       }
//       if (status) {
//         hDteJoin.push(`ts_h.name = $${hIdx++}`);
//         hParams.push(status);
//       }
//       if (fromDate && !toDate) {
//         hDteJoin.push(`dte.entry_date = $${hIdx++}`);
//         hParams.push(fromDate);
//       } else if (fromDate && toDate) {
//         hDteJoin.push(
//           `dte.entry_date >= $${hIdx++} AND dte.entry_date <= $${hIdx++}`,
//         );
//         hParams.push(fromDate, toDate);
//       } else if (!fromDate && toDate) {
//         hDteJoin.push(`dte.entry_date <= $${hIdx++}`);
//         hParams.push(toDate);
//       }

//       // D. client_master WHERE conditions
//       const cmWhereConds = [`cm.is_active = TRUE`];
//       if (isManager) {
//         const scopeIds =
//           managerProjectIds.length > 0
//             ? managerProjectIds
//             : ["00000000-0000-0000-0000-000000000000"];
//         cmWhereConds.push(`cm.client_id IN (
//           SELECT DISTINCT pm2.client_id
//           FROM   project_master pm2
//           WHERE  pm2.project_id = ANY($${hIdx++}::uuid[])
//             AND  pm2.client_id IS NOT NULL
//         )`);
//         hParams.push(scopeIds);
//       }
//       if (clientIds) {
//         const uuids = clientIds
//           .split(",")
//           .map((s) => s.trim())
//           .filter(Boolean);
//         if (uuids.length > 0) {
//           cmWhereConds.push(`cm.client_id = ANY($${hIdx++}::uuid[])`);
//           hParams.push(uuids);
//         }
//       }

//       const pmJoinExtra =
//         pmJoinConds.length > 0 ? `AND ${pmJoinConds.join(" AND ")}` : "";
//       const tmJoinStr = tmJoinConds.join(" AND ");
//       const hJoinExtra =
//         hDteJoin.length > 0 ? `AND ${hDteJoin.join(" AND ")}` : "";
//       const hWhereClause = `WHERE ${cmWhereConds.join(" AND ")}`;

//       const headerQuery = `
//         SELECT
//           cm.client_id,
//           COALESCE(cm.client_name,  '(No Client)')         AS client_name,
//           COALESCE(pm.project_name, '(No Project)')        AS project_name,
//           COALESCE(pst.name, '')                           AS project_status,
//           tm.ticket_name,
//           tm.zoho_crm_code                                 AS ticket_code,
//           COALESCE(tst.name, '')                           AS ticket_status,
//           COALESCE(tm.description, '')                     AS ticket_description,
//           COALESCE(tm.approved_hours, 0)                   AS approved_hours_mins,
//           COALESCE(SUM(dte.billable_hours),     0)         AS billable_hours_mins,
//           COALESCE(SUM(dte.non_billable_hours), 0)         AS non_billable_hours_mins

//         FROM client_master cm
//         LEFT JOIN project_master pm
//                ON pm.client_id = cm.client_id ${pmJoinExtra}
//         LEFT JOIN project_status pst ON pst.id = pm.status
//         LEFT JOIN ticket_master tm
//                ON tm.project_id = pm.project_id AND ${tmJoinStr}
//         LEFT JOIN ticket_status tst ON tst.id = tm.status
//         LEFT JOIN daily_timesheet_entries dte
//                ON dte.ticket_id = tm.ticket_id ${hJoinExtra}
//         LEFT JOIN employees        e_h  ON e_h.employee_id = dte.employee_id
//         LEFT JOIN timesheet_status ts_h ON ts_h.id         = dte.status

//         ${hWhereClause}

//         GROUP BY
//           cm.client_id,
//           cm.client_name,
//           pm.project_id,
//           pm.project_name,
//           pst.name,
//           tst.name,
//           tm.ticket_id,
//           tm.ticket_name,
//           tm.zoho_crm_code,
//           tm.description,
//           tm.approved_hours

//         ORDER BY
//           cm.client_name  ASC NULLS LAST,
//           pm.project_name ASC NULLS LAST,
//           tm.ticket_name  ASC NULLS LAST
//       `;

//       const { rows: hRows } = await pool.query(headerQuery, hParams);

//       // ── Build Header workbook ─────────────────────────────────
//       const ws = workbook.addWorksheet("Header Report");
//       ws.columns = [
//         { header: "Client Name", key: "client_name", width: 26 },
//         { header: "Client Status", key: "client_status", width: 14 },
//         { header: "Project Name", key: "project_name", width: 28 },
//         { header: "Project Status", key: "project_status", width: 16 },
//         { header: "Ticket", key: "ticket_name", width: 32 },
//         { header: "Ticket Status", key: "ticket_status", width: 14 },
//         { header: "Ticket Number", key: "ticket_number", width: 18 },
//         { header: "Ticket Description", key: "ticket_description", width: 34 },
//         { header: "Total Approved Hours", key: "approved_hours", width: 20 },
//         { header: "Actual Billable Hours", key: "billable_hours", width: 22 },
//         { header: "Non-Billable Hours", key: "non_billable_hours", width: 20 },
//       ];

//       const hdrRow = ws.getRow(1);
//       hdrRow.eachCell((cell) => {
//         cell.font = {
//           bold: true,
//           color: { argb: "FFFFFFFF" },
//           size: 11,
//           name: "Calibri",
//         };
//         cell.fill = solidFill("FF1E3A5F");
//         cell.alignment = { vertical: "middle", horizontal: "center" };
//         cell.border = {
//           bottom: { style: "thin", color: { argb: "FF2D5F8A" } },
//         };
//       });
//       hdrRow.height = 22;
//       ws.views = [{ state: "frozen", ySplit: 1 }];
//       ws.autoFilter = { from: "A1", to: "K1" };

//       if (hRows.length === 0) {
//         const empty = ws.addRow(["No data found for the selected filters."]);
//         empty.getCell(1).font = {
//           italic: true,
//           color: { argb: "FF94A3B8" },
//           size: 10,
//         };
//         empty.getCell(1).alignment = { horizontal: "center" };
//         ws.mergeCells("A2:K2");
//       } else {
//         hRows.forEach((r, i) => {
//           const bg = i % 2 === 0 ? "FFFFFFFF" : "FFF0F6FF";
//           const row = ws.addRow({
//             client_name: r.client_name || "",
//             client_status: "Active", // not in DB schema
//             project_name: r.project_name || "",
//             project_status: r.project_status || "",
//             ticket_name: r.ticket_name || "",
//             // from ticket_status table (tst.name) — e.g. "In Progress", "Completed"
//             ticket_status: r.ticket_status || "",
//             ticket_number: r.ticket_code || "",
//             // from tm.description (TEXT column on ticket_master)
//             ticket_description: r.ticket_description || "",
//             // tm.approved_hours is INTEGER MINUTES → convert to decimal hours
//             approved_hours: toHrs(r.approved_hours_mins),
//             // SUM of DTE billable_hours (INTEGER MINUTES) → decimal hours
//             billable_hours: toHrs(r.billable_hours_mins),
//             // SUM of DTE non_billable_hours (INTEGER MINUTES) → decimal hours
//             non_billable_hours: toHrs(r.non_billable_hours_mins),
//           });
//           row.eachCell((cell, colNum) => {
//             cell.fill = solidFill(bg);
//             cell.font = { size: 10, name: "Calibri" };
//             cell.alignment = { vertical: "top" };
//             cell.border = hairBdr();
//           });
//           // Numeric format for hour columns (cols 9, 10, 11)
//           [9, 10, 11].forEach((c) => {
//             row.getCell(c).numFmt = "0.00";
//           });
//           row.height = 18;
//         });
//       }

//       const buffer = await workbook.xlsx.writeBuffer();
//       const filename = `TimesheetReport_Header_${dateStr}.xlsx`;
//       res.setHeader(
//         "Content-Type",
//         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//       );
//       res.setHeader(
//         "Content-Disposition",
//         `attachment; filename="${filename}"`,
//       );
//       res.setHeader("Content-Length", buffer.length);
//       res.end(buffer);
//       console.log(
//         `[TimesheetReport] Header export: ${hRows.length} ticket rows → ${filename}`,
//       );
//       return;
//     }

//     // ════════════════════════════════════════════════════════════════════════
//     // ITEM MODE — one row per timesheet entry (original format, unchanged)
//     // ════════════════════════════════════════════════════════════════════════
//     const sheet = workbook.addWorksheet("Timesheet Report");
//     sheet.columns = [
//       { header: "Date", key: "entry_date", width: 14 },
//       { header: "Employee Code", key: "employee_code", width: 16 },
//       { header: "Employee Name", key: "employee_name", width: 24 },
//       { header: "Designation", key: "employee_designation", width: 20 },
//       { header: "Department", key: "employee_department", width: 18 },
//       { header: "Client", key: "client_name", width: 22 },
//       { header: "Project", key: "project_name", width: 28 },
//       { header: "Project Code", key: "project_code", width: 16 },
//       { header: "Ticket", key: "ticket_name", width: 28 },
//       { header: "Ticket Code", key: "ticket_code", width: 16 },
//       { header: "Task", key: "task_name", width: 20 },
//       { header: "Hours", key: "total_hours", width: 10 },
//       { header: "Billable Hrs", key: "billable_hours", width: 13 },
//       { header: "Non-Billable Hrs", key: "non_billable_hours", width: 16 },
//       { header: "Status", key: "status", width: 20 },
//       { header: "Description", key: "description", width: 36 },
//       { header: "Ticket No.", key: "ticket_number", width: 14 },
//       { header: "Manager", key: "manager_name", width: 22 },
//       { header: "Submitted At", key: "submitted_at", width: 18 },
//       { header: "Approved By", key: "approved_by_name", width: 22 },
//       { header: "Approved At", key: "approved_at", width: 18 },
//       { header: "Rejection Reason", key: "rejection_reason", width: 28 },
//     ];

//     const headerRow = sheet.getRow(1);
//     headerRow.eachCell((cell) => {
//       cell.font = {
//         bold: true,
//         color: { argb: "FFFFFFFF" },
//         size: 11,
//         name: "Calibri",
//       };
//       cell.fill = solidFill("FF1E3A5F");
//       cell.alignment = { vertical: "middle", horizontal: "center" };
//       cell.border = { bottom: { style: "thin", color: { argb: "FF2D5F8A" } } };
//     });
//     headerRow.height = 22;
//     sheet.views = [{ state: "frozen", ySplit: 1 }];
//     sheet.autoFilter = {
//       from: "A1",
//       to: `${String.fromCharCode(64 + sheet.columns.length)}1`,
//     };

//     const STATUS_COLORS = {
//       Draft: "FFE2E8F0",
//       Submitted: "FFDBEAFE",
//       Manager_Approved: "FFD1FAE5",
//       Admin_Approved: "FFA7F3D0",
//       Manager_Rejected: "FFFEE2E2",
//       Admin_Rejected: "FFFECACA",
//       Partially_Approved: "FFFFEDD5",
//     };

//     rows.forEach((r, i) => {
//       const rowBg = i % 2 === 0 ? "FFFFFFFF" : "FFF0F6FF";
//       const statusBg = STATUS_COLORS[r.status] || rowBg;

//       const row = sheet.addRow({
//         entry_date: fmtDate(r.entry_date),
//         employee_code: r.employee_code || "",
//         employee_name: r.employee_name || "",
//         employee_designation: r.employee_designation || "",
//         employee_department: r.employee_department || "",
//         client_name: r.client_name || "",
//         project_name: r.project_name || "",
//         project_code: r.project_code || "",
//         ticket_name: r.ticket_name || "",
//         ticket_code: r.ticket_code || "",
//         task_name: r.task_name || "",
//         total_hours: toHrs(r.total_hours),
//         billable_hours: toHrs(r.billable_hours),
//         non_billable_hours: toHrs(r.non_billable_hours),
//         status: (r.status || "").replace(/_/g, " "),
//         description: r.description || "",
//         ticket_number: r.ticket_number || "",
//         manager_name: r.manager_name || "",
//         submitted_at: fmtDate(r.submitted_at),
//         approved_by_name: r.approved_by_name || "",
//         approved_at: fmtDate(r.approved_at),
//         rejection_reason: r.rejection_reason || "",
//       });

//       row.eachCell((cell, colNum) => {
//         cell.fill = solidFill(colNum === 15 ? statusBg : rowBg);
//         cell.font = { size: 10, name: "Calibri" };
//         cell.alignment = { vertical: "top", wrapText: colNum === 16 };
//         cell.border = hairBdr();
//       });
//       row.height = 18;
//     });

//     if (rows.length === 0) {
//       const emptyRow = sheet.addRow([
//         "No data found for the selected filters.",
//       ]);
//       emptyRow.getCell(1).font = {
//         italic: true,
//         color: { argb: "FF94A3B8" },
//         size: 10,
//       };
//       emptyRow.getCell(1).alignment = { horizontal: "center" };
//       sheet.mergeCells("A2:V2");
//     }

//     const buffer = await workbook.xlsx.writeBuffer();
//     const filename = `TimesheetReport_${dateStr}.xlsx`;
//     res.setHeader(
//       "Content-Type",
//       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//     );
//     res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
//     res.setHeader("Content-Length", buffer.length);
//     res.end(buffer);
//     console.log(
//       `[TimesheetReport] Item export: ${rows.length} rows → ${filename}`,
//     );
//   } catch (error) {
//     console.error(
//       "[TimesheetReport] exportTimesheetReport error:",
//       error.message,
//     );
//     if (!res.headersSent) {
//       return res.status(500).json({ error: error.message || "Export failed" });
//     }
//   }
// };

import pool from "../config/database.js";
import ExcelJS from "exceljs";

// ╔══════════════════════════════════════════════════════════════╗
// ║              TIMESHEET REPORT CONTROLLER                     ║
// ║                                                              ║
// ║  Exports:                                                    ║
// ║    getReportFilterOptions    GET /filter-options             ║
// ║    getTimesheetReport        GET /                           ║
// ║    getGroupedTimesheetReport GET /grouped                    ║
// ║    getEmployeeSummaryReport  GET /employee-summary           ║
// ║    getProjectSummaryReport   GET /project-summary            ║
// ║    getTicketSummaryReport       GET /ticket-summary          ║
// ║    getEmployeeBillableReport    GET /employee-billable [NEW] ║
// ╚══════════════════════════════════════════════════════════════╝

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────

/** Returns true if val looks like a UUID. */
function isUUID(val) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(val),
  );
}

/**
 * Resolve an employee identifier (UUID or employee_code) to a UUID.
 * Returns null silently when not found — never throws.
 * This lets callers skip the filter rather than crashing the request.
 */
async function resolveEmployeeId(identifier) {
  if (!identifier) return null;
  if (isUUID(identifier)) return identifier;

  const { rows } = await pool.query(
    `SELECT employee_id FROM employees WHERE employee_code = $1 LIMIT 1`,
    [identifier],
  );

  if (!rows.length) {
    console.warn(
      `[TimesheetReport] resolveEmployeeId: code "${identifier}" not found — filter skipped`,
    );
    return null;
  }
  return rows[0].employee_id;
}

/**
 * Resolve one or more project identifiers (comma-sep UUIDs or zoho_crm_codes)
 * into an array of UUIDs. Unresolvable values are silently skipped.
 * Returns [] when input is empty/blank — caller must guard before using.
 *
 * Examples:
 *   "uuid1"           → ["uuid1"]
 *   "uuid1,uuid2"     → ["uuid1","uuid2"]
 *   "PROJ-01,uuid2"   → [resolved_uuid, "uuid2"]
 */
async function resolveProjectIds(raw) {
  if (!raw) return [];
  const identifiers = String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!identifiers.length) return [];

  const resolved = await Promise.all(
    identifiers.map(async (id) => {
      if (isUUID(id)) return id;
      const { rows } = await pool.query(
        `SELECT project_id FROM project_master
          WHERE LOWER(zoho_crm_code) = LOWER($1) LIMIT 1`,
        [id],
      );
      if (!rows.length) {
        console.warn(
          `[TimesheetReport] resolveProjectIds: code "${id}" not found — skipped`,
        );
        return null;
      }
      return rows[0].project_id;
    }),
  );
  return resolved.filter(Boolean); // drop nulls
}

/**
 * Resolve one or more ticket identifiers (comma-sep UUIDs or zoho_crm_codes)
 * into an array of UUIDs. Unresolvable values are silently skipped.
 * Returns [] when input is empty/blank.
 */
async function resolveTicketIds(raw) {
  if (!raw) return [];
  const identifiers = String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!identifiers.length) return [];

  const resolved = await Promise.all(
    identifiers.map(async (id) => {
      if (isUUID(id)) return id;
      const { rows } = await pool.query(
        `SELECT ticket_id FROM ticket_master
          WHERE LOWER(zoho_crm_code) = LOWER($1) LIMIT 1`,
        [id],
      );
      if (!rows.length) {
        console.warn(
          `[TimesheetReport] resolveTicketIds: code "${id}" not found — skipped`,
        );
        return null;
      }
      return rows[0].ticket_id;
    }),
  );
  return resolved.filter(Boolean);
}

/**
 * Safe query wrapper.
 * If a query fails it logs the specific error and returns [] so the
 * rest of a Promise.all() call still succeeds with partial data.
 * Used in filter-options so one bad table never silences all dropdowns.
 */
async function safeQuery(label, sql, params = []) {
  try {
    const { rows } = await pool.query(sql, params);
    return rows;
  } catch (err) {
    console.error(
      `[TimesheetReport] safeQuery FAILED [${label}]: ${err.message}`,
    );
    return [];
  }
}

// Resolve comma-separated employee identifiers → array of UUIDs
async function resolveEmployeeIds(raw) {
  if (!raw) return [];
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const uuids = await Promise.all(parts.map(resolveEmployeeId));
  return uuids.filter(Boolean);
}

// ──────────────────────────────────────────────────────────────
// GET /api/timesheet-report/filter-options
//
// Returns every dropdown dataset the frontend needs in one call.
// Each sub-query runs independently via safeQuery() — one failing
// table never blocks the others from returning data.
//
// KEY FIXES vs original:
//  • employees — removed is_active filter → ALL employees visible
//  • projects  — removed is_active filter → ALL projects visible
//  • tickets   — ADDED (was completely missing)
// ──────────────────────────────────────────────────────────────
export const getReportFilterOptions = async (req, res) => {
  try {
    // ── Identify caller role and identity ────────────────────────────────────
    // req.user is populated by authenticateToken middleware from the JWT payload.
    // employee_id is the standard field; fall back to id for safety.
    const callerRole = req.user?.role;
    const callerId = req.user?.employee_id || req.user?.id;
    const isManager = callerRole === "MANAGER";

    console.log(
      "[TimesheetReport] Fetching filter options for role:",
      callerRole,
    );

    // ── MANAGER: get the project_ids they are assigned to ───────────────────
    // Uses project_manager_assignment table.
    // All scoped dropdowns (projects, tickets, clients) are restricted to these.
    let managerProjectIds = [];
    if (isManager && callerId) {
      const { rows: pmaRows } = await pool.query(
        `SELECT DISTINCT project_id
           FROM project_manager_assignment
          WHERE manager_id = $1
            AND project_id IS NOT NULL`,
        [callerId],
      );
      managerProjectIds = pmaRows.map((r) => r.project_id).filter(Boolean);
    }

    // When manager has no assigned projects, scoped queries should return empty.
    // We still run them (they'll just return 0 rows) so the response shape is consistent.
    const projectIdFilter =
      isManager && managerProjectIds.length > 0
        ? managerProjectIds
        : isManager
          ? ["00000000-0000-0000-0000-000000000000"] // dummy uuid → 0 rows
          : null; // null = ADMIN = no restriction

    // ── 1. Employees ─────────────────────────────────────────────────────────
    //   ADMIN   → ALL employees (active + inactive)
    //   MANAGER → employees who have LOGGED TIME on the manager's projects.
    //             Uses daily_timesheet_entries as the source of truth so that
    //             employees always appear even when ticket_assignments is empty
    //             or not populated. Also catches employees assigned via
    //             ticket_manager_scope (managers logging their own time).
    const employees = isManager
      ? await safeQuery(
          "employees",
          `SELECT DISTINCT
             e.employee_id                       AS id,
             e.employee_code                     AS code,
             e.first_name || ' ' || e.last_name  AS name,
             e.designation,
             d.name                              AS department,
             e.is_active
           FROM employees e
           LEFT JOIN departments d ON d.id = e.department
           WHERE e.employee_id IN (
             SELECT DISTINCT dte.employee_id
             FROM   daily_timesheet_entries dte
             WHERE  dte.project_id = ANY($1::uuid[])
               AND  dte.employee_id IS NOT NULL
           )
           ORDER BY e.is_active DESC, e.first_name ASC, e.last_name ASC`,
          [projectIdFilter],
        )
      : await safeQuery(
          "employees",
          `SELECT
             e.employee_id                       AS id,
             e.employee_code                     AS code,
             e.first_name || ' ' || e.last_name  AS name,
             e.designation,
             d.name                              AS department,
             e.is_active
           FROM employees e
           LEFT JOIN departments d ON d.id = e.department
           ORDER BY e.is_active DESC, e.first_name ASC, e.last_name ASC`,
        );

    // ── 2. Projects ──────────────────────────────────────────────────────────
    //   ADMIN   → ALL projects (active + inactive)
    //   MANAGER → only projects assigned to them via project_manager_assignment
    const projects = isManager
      ? await safeQuery(
          "projects",
          `SELECT
             pm.project_id                       AS id,
             pm.project_name                     AS name,
             pm.zoho_crm_code                    AS code,
             ps.name                             AS status,
             cm.client_name,
             pm.is_active
           FROM project_master pm
           LEFT JOIN project_status ps ON ps.id       = pm.status
           LEFT JOIN client_master  cm ON cm.client_id = pm.client_id
           WHERE pm.project_id = ANY($1::uuid[])
           ORDER BY pm.is_active DESC, pm.project_name ASC`,
          [projectIdFilter],
        )
      : await safeQuery(
          "projects",
          `SELECT
             pm.project_id                       AS id,
             pm.project_name                     AS name,
             pm.zoho_crm_code                    AS code,
             ps.name                             AS status,
             cm.client_name,
             pm.is_active
           FROM project_master pm
           LEFT JOIN project_status ps ON ps.id       = pm.status
           LEFT JOIN client_master  cm ON cm.client_id = pm.client_id
           ORDER BY pm.is_active DESC, pm.project_name ASC`,
        );

    // ── 3. Tickets ───────────────────────────────────────────────────────────
    //   ADMIN   → ALL tickets
    //   MANAGER → only tickets belonging to their assigned projects
    const tickets = isManager
      ? await safeQuery(
          "tickets",
          `SELECT
             tm.ticket_id                        AS id,
             tm.ticket_name                      AS name,
             tm.zoho_crm_code                    AS code,
             pm.project_id,
             pm.project_name,
             cm.client_name,
             tm.is_active
           FROM ticket_master tm
           LEFT JOIN project_master pm ON pm.project_id = tm.project_id
           LEFT JOIN client_master  cm ON cm.client_id  = pm.client_id
           WHERE tm.project_id = ANY($1::uuid[])
           ORDER BY tm.is_active DESC, tm.ticket_name ASC`,
          [projectIdFilter],
        )
      : await safeQuery(
          "tickets",
          `SELECT
             tm.ticket_id                        AS id,
             tm.ticket_name                      AS name,
             tm.zoho_crm_code                    AS code,
             pm.project_id,
             pm.project_name,
             cm.client_name,
             tm.is_active
           FROM ticket_master tm
           LEFT JOIN project_master pm ON pm.project_id = tm.project_id
           LEFT JOIN client_master  cm ON cm.client_id  = pm.client_id
           ORDER BY tm.is_active DESC, tm.ticket_name ASC`,
        );

    // ── 4. Clients ───────────────────────────────────────────────────────────
    //   ADMIN   → ALL active clients
    //   MANAGER → only clients whose projects are assigned to them
    const clients = isManager
      ? await safeQuery(
          "clients",
          `SELECT DISTINCT
             cm.client_id   AS id,
             cm.client_name AS name,
             cm.client_code AS code
           FROM client_master cm
           JOIN project_master pm ON pm.client_id = cm.client_id
           WHERE pm.project_id = ANY($1::uuid[])
             AND cm.is_active = TRUE
           ORDER BY cm.client_name ASC`,
          [projectIdFilter],
        )
      : await safeQuery(
          "clients",
          `SELECT
             client_id   AS id,
             client_name AS name,
             client_code AS code
           FROM client_master
           WHERE is_active = TRUE
           ORDER BY client_name ASC`,
        );

    // ── 5. Statuses — same for everyone ──────────────────────────────────────
    const statuses = await safeQuery(
      "statuses",
      `SELECT id, name FROM timesheet_status ORDER BY id ASC`,
    );

    // ── 6. Departments — same for everyone ───────────────────────────────────
    const departments = await safeQuery(
      "departments",
      `SELECT id, name FROM departments ORDER BY name ASC`,
    );

    console.log("[TimesheetReport] Filter options loaded:", {
      role: callerRole,
      employees: employees.length,
      projects: projects.length,
      tickets: tickets.length,
      clients: clients.length,
      statuses: statuses.length,
      departments: departments.length,
    });

    // managers field removed — Manager filter has been removed from the UI.
    return res.json({
      employees,
      projects,
      tickets,
      clients,
      statuses,
      departments,
    });
  } catch (error) {
    console.error(
      "[TimesheetReport] getReportFilterOptions FATAL:",
      error.message,
    );
    return res.json({
      employees: [],
      projects: [],
      tickets: [],
      clients: [],
      statuses: [],
      departments: [],
      _error: error.message,
    });
  }
};

// ──────────────────────────────────────────────────────────────
// GET /api/timesheet-report
//
// Paginated, sorted, fully-filtered main timesheet report.
// Runs three queries in parallel: data + count + summary KPIs.
// All filters are optional — no filters = all records paginated.
//
// Query params:
//   employeeId   UUID | employee_code
//   projectIds   comma-sep UUIDs | zoho_crm_codes  (multi-select)
//   ticketIds    comma-sep UUIDs | zoho_crm_codes  (multi-select)
//   clientId     UUID
//   departmentId integer
//   fromDate     YYYY-MM-DD
//   toDate       YYYY-MM-DD
//   status       timesheet_status.name string
//   managerId    UUID | employee_code
//   page         integer, default 1
//   pageSize     integer, default 25, max 100
//   sortBy       entry_date|hours|status|employee|project|ticket|submitted_at
//   sortDir      asc|desc
// ──────────────────────────────────────────────────────────────
export const getTimesheetReport = async (req, res) => {
  try {
    const {
      employeeIds, // comma-separated UUIDs — multi-select
      projectIds, // comma-separated UUIDs — multi-select
      ticketIds, // comma-separated UUIDs — multi-select
      clientIds, // comma-separated UUIDs — multi-select
      departmentId,
      fromDate,
      toDate,
      status,
      managerId,
      page = 1,
      pageSize = 25,
      sortBy = "entry_date",
      sortDir = "desc",
    } = req.query;

    // ── Pagination ───────────────────────────────────────────
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const ps = Math.min(Math.max(parseInt(pageSize, 10) || 25, 1), 100);
    const offset = (p - 1) * ps;

    // ── Sort — whitelisted to prevent SQL injection ──────────
    const ALLOWED_SORT = {
      entry_date: "dte.entry_date",
      hours: "dte.total_hours",
      status: "ts.name",
      employee: "e.first_name",
      project: "pm.project_name",
      ticket: "tm.ticket_name",
      // submitted_at: "dte.submitted_at",
    };
    const sortCol = ALLOWED_SORT[sortBy] || "dte.entry_date";
    const dir = sortDir === "asc" ? "ASC" : "DESC";

    // Manager scope: restrict unfiltered reports to assigned projects
    const callerRole = req.user?.role;
    const callerId = req.user?.employee_id || req.user?.id;
    const isManager = callerRole === "MANAGER";
    let managerProjectIds = [];
    if (isManager && callerId) {
      const pmaRows = await pool.query(
        "SELECT DISTINCT project_id FROM project_manager_assignment WHERE manager_id = $1 AND project_id IS NOT NULL",
        [callerId],
      );
      managerProjectIds = pmaRows.rows.map((r) => r.project_id).filter(Boolean);
    }

    // ── Build dynamic WHERE conditions ───────────────────────
    // Rule: every resolve*() returns null on miss → guard with if(uuid)
    // so a bad/stale filter value skips that condition instead of crashing.
    const conditions = [];
    const params = [];
    let idx = 1; // tracks the next $N parameter slot

    // Employees — multi-select: ANY($N::uuid[])
    if (employeeIds) {
      const uuids = await resolveEmployeeIds(employeeIds);
      if (uuids.length > 0) {
        conditions.push(`dte.employee_id = ANY($${idx++}::uuid[])`);
        params.push(uuids);
      }
    }

    // Projects — multi-select: ANY($N::uuid[])
    if (projectIds) {
      const uuids = await resolveProjectIds(projectIds);
      if (uuids.length > 0) {
        conditions.push(`dte.project_id = ANY($${idx++}::uuid[])`);
        params.push(uuids);
      }
    }

    // Manager scope — ALWAYS enforced for MANAGER callers regardless of whether
    // the user also sent a projectIds filter. Both conditions are ANDed together,
    // so the result is the intersection: entries from the user-chosen projects
    // that also belong to the manager's assigned projects. This prevents a
    // manager from bypassing the scope by providing arbitrary projectIds.
    if (isManager) {
      const scopeIds =
        managerProjectIds.length > 0
          ? managerProjectIds
          : ["00000000-0000-0000-0000-000000000000"]; // dummy → 0 rows when no assigned projects
      conditions.push(`dte.project_id = ANY($${idx++}::uuid[])`);
      params.push(scopeIds);
    }

    // Tickets — multi-select: ANY($N::uuid[])
    if (ticketIds) {
      const uuids = await resolveTicketIds(ticketIds);
      if (uuids.length > 0) {
        conditions.push(`dte.ticket_id = ANY($${idx++}::uuid[])`);
        params.push(uuids);
      }
    }

    // Clients — multi-select: ANY($N::uuid[])
    if (clientIds) {
      const uuids = clientIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (uuids.length > 0) {
        conditions.push(`dte.client_id = ANY($${idx++}::uuid[])`);
        params.push(uuids);
      }
    }

    // Department (NEW filter) — filters on the employee's department
    if (departmentId) {
      conditions.push(`e.department = $${idx++}`);
      params.push(departmentId);
    }

    // Timesheet status
    if (status) {
      conditions.push(`ts.name = $${idx++}`);
      params.push(status);
    }

    // Manager stored on the timesheet entry
    if (managerId) {
      const uuid = await resolveEmployeeId(managerId);
      if (uuid) {
        conditions.push(`dte.manager_id = $${idx++}`);
        params.push(uuid);
      }
    }

    // Date range — four distinct behaviours:
    //   fromDate only  → single exact day
    //   fromDate+toDate → inclusive range
    //   toDate only    → everything up to that date
    //   neither        → no date restriction
    if (fromDate && !toDate) {
      conditions.push(`dte.entry_date = $${idx++}`);
      params.push(fromDate);
    } else if (fromDate && toDate) {
      conditions.push(
        `dte.entry_date >= $${idx++} AND dte.entry_date <= $${idx++}`,
      );
      params.push(fromDate, toDate);
    } else if (!fromDate && toDate) {
      conditions.push(`dte.entry_date <= $${idx++}`);
      params.push(toDate);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // ── Shared FROM + JOINs (reused in all 3 parallel queries) ──
    const baseJoins = `
      FROM daily_timesheet_entries dte
      JOIN  timesheet_status  ts    ON ts.id            = dte.status
      JOIN  employees         e     ON e.employee_id     = dte.employee_id
      LEFT JOIN departments   dept  ON dept.id           = e.department
      LEFT JOIN project_master pm   ON pm.project_id     = dte.project_id
      LEFT JOIN project_status pst  ON pst.id            = pm.status
      LEFT JOIN client_master  cm   ON cm.client_id      = dte.client_id
      LEFT JOIN ticket_master  tm   ON tm.ticket_id      = dte.ticket_id
      LEFT JOIN employees      mgr  ON mgr.employee_id   = dte.manager_id
      -- LEFT JOIN employees      apr  ON apr.employee_id   = dte.approved_by
      -- LEFT JOIN employees      rej  ON rej.employee_id   = dte.rejected_by
      LEFT JOIN task_master    task ON task.task_id      = dte.task_id
      LEFT JOIN departments    dtsk ON dtsk.id           = task.department
    `;

    // idx now = params.length + 1, which is where LIMIT goes
    const limitIdx = idx;
    const offsetIdx = idx + 1;

    // ── 1. Data query — paginated rows ───────────────────────
    const dataQuery = `
      SELECT
        -- Core entry fields
        dte.entry_id,
        dte.entry_date,
        dte.week_start_date,
        dte.week_end_date,
        dte.total_hours,
        dte.billable_hours,
        dte.non_billable_hours,
        dte.ticket_number,
        dte.description,
        -- dte.submitted_at,
        dte.approved_at,
        dte.rejected_at,
        dte.rejection_reason,
        -- dte.created_at,
        -- dte.updated_at,

        -- Status
        ts.name                                              AS status,

        -- Employee
        e.employee_id,
        e.employee_code,
        e.first_name                                         AS employee_first_name,
        e.last_name                                          AS employee_last_name,
        e.email                                              AS employee_email,
        e.designation                                        AS employee_designation,
        dept.name                                            AS employee_department,

        -- Project
        pm.project_id,
        pm.project_name,
        pm.zoho_crm_code                                     AS project_code,
        pst.name                                             AS project_status,

        -- Client
        cm.client_id,
        cm.client_name,
        cm.client_code,

        -- Ticket
        tm.ticket_id,
        tm.ticket_name,
        tm.zoho_crm_code                                     AS ticket_code,
        tm.estimated_hours,
        tm.approved_hours,

        -- Manager (responsible person on entry)
        mgr.employee_id                                      AS manager_id,
        mgr.first_name                                       AS manager_first_name,
        mgr.last_name                                        AS manager_last_name,

        -- Approver / Rejector full names
        COALESCE(apr.first_name || ' ' || apr.last_name, '') AS approved_by_name,
        COALESCE(rej.first_name || ' ' || rej.last_name, '') AS rejected_by_name,

        -- Task
        task.task                                            AS task_name,
        task.internal_project                                AS task_internal_project,
        dtsk.name                                            AS task_department

      ${baseJoins}
      ${whereClause}
      ORDER BY ${sortCol} ${dir}
      LIMIT  $${limitIdx}
      OFFSET $${offsetIdx}
    `;

    // ── 2. Count query — total matching rows for pagination ──
    const countQuery = `
      SELECT COUNT(*) AS total
      ${baseJoins}
      ${whereClause}
    `;

    // ── 3. Summary / KPI aggregation ─────────────────────────
    // FIX: replaced non-existent 'Pending' with correct 'Draft'
    const summaryQuery = `
      SELECT
        COUNT(*)                                                         AS total_entries,
        COALESCE(SUM(dte.total_hours),        0)                        AS total_hours,
        COALESCE(SUM(dte.billable_hours),     0)                        AS billable_hours,
        COALESCE(SUM(dte.non_billable_hours), 0)                        AS non_billable_hours,
        COUNT(DISTINCT dte.employee_id)                                  AS total_employees,
        COUNT(DISTINCT dte.project_id)                                   AS total_projects,
        COUNT(DISTINCT dte.ticket_id)                                    AS total_tickets,
        COUNT(DISTINCT dte.entry_date)                                   AS working_days,
        COUNT(DISTINCT CASE WHEN ts.name = 'Draft'
              THEN dte.entry_id END)                                     AS draft_count,
        COUNT(DISTINCT CASE WHEN ts.name = 'Submitted'
              THEN dte.entry_id END)                                     AS submitted_count,
        COUNT(DISTINCT CASE WHEN ts.name = 'Manager_Approved'
              THEN dte.entry_id END)                                     AS mgr_approved_count,
        COUNT(DISTINCT CASE WHEN ts.name = 'Admin_Approved'
              THEN dte.entry_id END)                                     AS admin_approved_count,
        COUNT(DISTINCT CASE WHEN ts.name IN ('Manager_Approved','Admin_Approved')
              THEN dte.entry_id END)                                     AS approved_count,
        COUNT(DISTINCT CASE WHEN ts.name = 'Manager_Rejected'
              THEN dte.entry_id END)                                     AS mgr_rejected_count,
        COUNT(DISTINCT CASE WHEN ts.name = 'Admin_Rejected'
              THEN dte.entry_id END)                                     AS admin_rejected_count,
        COUNT(DISTINCT CASE WHEN ts.name IN ('Manager_Rejected','Admin_Rejected')
              THEN dte.entry_id END)                                     AS rejected_count,
        COUNT(DISTINCT CASE WHEN ts.name = 'Partially_Approved'
              THEN dte.entry_id END)                                     AS partial_count
      ${baseJoins}
      ${whereClause}
    `;

    // ── Run all three queries in parallel ────────────────────
    const [dataResult, countResult, summaryResult] = await Promise.all([
      pool.query(dataQuery, [...params, ps, offset]),
      pool.query(countQuery, params),
      pool.query(summaryQuery, params),
    ]);

    const totalCount = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalCount / ps) || 1;
    const s = summaryResult.rows[0];
    const totalHours = parseFloat(s.total_hours);
    const workingDays = parseInt(s.working_days, 10);

    return res.json({
      data: dataResult.rows,
      pagination: {
        page: p,
        pageSize: ps,
        totalCount,
        totalPages,
        hasNextPage: p < totalPages,
        hasPrevPage: p > 1,
      },
      summary: {
        totalEntries: parseInt(s.total_entries, 10),
        totalHours,
        billableHours: parseFloat(s.billable_hours),
        nonBillableHours: parseFloat(s.non_billable_hours),
        totalEmployees: parseInt(s.total_employees, 10),
        totalProjects: parseInt(s.total_projects, 10),
        totalTickets: parseInt(s.total_tickets, 10),
        workingDays,
        avgHoursPerDay:
          workingDays > 0
            ? parseFloat((totalHours / workingDays).toFixed(2))
            : 0,
        statusBreakdown: {
          draft: parseInt(s.draft_count, 10),
          submitted: parseInt(s.submitted_count, 10),
          managerApproved: parseInt(s.mgr_approved_count, 10),
          adminApproved: parseInt(s.admin_approved_count, 10),
          approved: parseInt(s.approved_count, 10),
          managerRejected: parseInt(s.mgr_rejected_count, 10),
          adminRejected: parseInt(s.admin_rejected_count, 10),
          rejected: parseInt(s.rejected_count, 10),
          partiallyApproved: parseInt(s.partial_count, 10),
        },
      },
    });
  } catch (error) {
    console.error("[TimesheetReport] getTimesheetReport error:", error.message);
    return res
      .status(500)
      .json({ error: error.message || "Failed to fetch report" });
  }
};

// ──────────────────────────────────────────────────────────────
// GET /api/timesheet-report/grouped
//
// Same filters as getTimesheetReport but groups entries by date.
// Each date row has subtotals + a full entries[] array inside.
// Used by frontend date-grouped / calendar view.
// ──────────────────────────────────────────────────────────────
export const getGroupedTimesheetReport = async (req, res) => {
  try {
    const {
      employeeId,
      projectIds,
      ticketIds,
      clientIds, // ← was `clientId` (singular) — client filter was silently broken
      departmentId,
      fromDate,
      toDate,
      status,
      managerId,
    } = req.query;

    // ── Manager scope ───────────────────────────────────────────
    const callerRole = req.user?.role;
    const callerId = req.user?.employee_id || req.user?.id;
    const isManager = callerRole === "MANAGER";
    let managerProjectIds = [];
    if (isManager && callerId) {
      const pmaRows = await pool.query(
        `SELECT DISTINCT project_id
           FROM project_manager_assignment
          WHERE manager_id = $1 AND project_id IS NOT NULL`,
        [callerId],
      );
      managerProjectIds = pmaRows.rows.map((r) => r.project_id).filter(Boolean);
    }

    const conditions = [];
    const params = [];
    let idx = 1;

    if (employeeId) {
      const uuid = await resolveEmployeeId(employeeId);
      if (uuid) {
        conditions.push(`dte.employee_id = $${idx++}`);
        params.push(uuid);
      }
    }
    if (projectIds) {
      const uuids = await resolveProjectIds(projectIds);
      if (uuids.length > 0) {
        conditions.push(`dte.project_id = ANY($${idx++}::uuid[])`);
        params.push(uuids);
      }
    }
    // Always enforce manager scope
    if (isManager) {
      const scopeIds =
        managerProjectIds.length > 0
          ? managerProjectIds
          : ["00000000-0000-0000-0000-000000000000"];
      conditions.push(`dte.project_id = ANY($${idx++}::uuid[])`);
      params.push(scopeIds);
    }
    if (ticketIds) {
      const uuids = await resolveTicketIds(ticketIds);
      if (uuids.length > 0) {
        conditions.push(`dte.ticket_id = ANY($${idx++}::uuid[])`);
        params.push(uuids);
      }
    }
    if (clientIds) {
      const uuids = clientIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (uuids.length > 0) {
        conditions.push(`dte.client_id = ANY($${idx++}::uuid[])`);
        params.push(uuids);
      }
    }
    if (departmentId) {
      conditions.push(`e.department = $${idx++}`);
      params.push(departmentId);
    }
    if (status) {
      conditions.push(`ts.name = $${idx++}`);
      params.push(status);
    }
    if (managerId) {
      const uuid = await resolveEmployeeId(managerId);
      if (uuid) {
        conditions.push(`dte.manager_id = $${idx++}`);
        params.push(uuid);
      }
    }
    if (fromDate && !toDate) {
      conditions.push(`dte.entry_date = $${idx++}`);
      params.push(fromDate);
    } else if (fromDate && toDate) {
      conditions.push(
        `dte.entry_date >= $${idx++} AND dte.entry_date <= $${idx++}`,
      );
      params.push(fromDate, toDate);
    } else if (!fromDate && toDate) {
      conditions.push(`dte.entry_date <= $${idx++}`);
      params.push(toDate);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT
        dte.entry_date,
        SUM(dte.total_hours)                AS day_total_hours,
        SUM(dte.billable_hours)             AS day_billable_hours,
        SUM(dte.non_billable_hours)         AS day_non_billable_hours,
        COUNT(dte.entry_id)                 AS day_entry_count,
        COUNT(DISTINCT dte.employee_id)     AS day_employee_count,

        json_agg(
          json_build_object(
            'entry_id',           dte.entry_id,
            'total_hours',        dte.total_hours,
            'billable_hours',     dte.billable_hours,
            'non_billable_hours', dte.non_billable_hours,
            'description',        dte.description,
            'ticket_number',      dte.ticket_number,
            'status',             ts.name,
            -- 'submitted_at',       dte.submitted_at,
            'approved_at',        dte.approved_at,
            'rejected_at',        dte.rejected_at,
            'rejection_reason',   dte.rejection_reason,
            'employee_id',        e.employee_id,
            'employee_code',      e.employee_code,
            'employee_name',      e.first_name || ' ' || e.last_name,
            'employee_designation', e.designation,
            'project_id',         pm.project_id,
            'project_name',       pm.project_name,
            'project_code',       pm.zoho_crm_code,
            'ticket_id',          tm.ticket_id,
            'ticket_name',        tm.ticket_name,
            'ticket_code',        tm.zoho_crm_code,
            'client_name',        cm.client_name,
            'manager_name',       COALESCE(mgr.first_name || ' ' || mgr.last_name, ''),
            'task_name',          task.task
          )
          ORDER BY dte.entry_id ASC
        ) AS entries

      FROM daily_timesheet_entries dte
      JOIN  timesheet_status  ts    ON ts.id            = dte.status
      JOIN  employees         e     ON e.employee_id     = dte.employee_id
      LEFT JOIN departments   dept  ON dept.id           = e.department
      LEFT JOIN project_master pm   ON pm.project_id     = dte.project_id
      LEFT JOIN client_master  cm   ON cm.client_id      = dte.client_id
      LEFT JOIN ticket_master  tm   ON tm.ticket_id      = dte.ticket_id
      LEFT JOIN employees      mgr  ON mgr.employee_id   = dte.manager_id
      LEFT JOIN task_master    task ON task.task_id      = dte.task_id
      ${whereClause}
      GROUP BY dte.entry_date
      ORDER BY dte.entry_date DESC
    `;

    const { rows } = await pool.query(query, params);

    return res.json({
      data: rows.map((row) => ({
        date: row.entry_date,
        dayTotalHours: parseFloat(row.day_total_hours),
        dayBillableHours: parseFloat(row.day_billable_hours),
        dayNonBillableHours: parseFloat(row.day_non_billable_hours),
        dayEntryCount: parseInt(row.day_entry_count, 10),
        dayEmployeeCount: parseInt(row.day_employee_count, 10),
        isOvertime: parseFloat(row.day_total_hours) > 8,
        entries: row.entries || [],
      })),
    });
  } catch (error) {
    console.error(
      "[TimesheetReport] getGroupedTimesheetReport error:",
      error.message,
    );
    return res
      .status(500)
      .json({ error: error.message || "Failed to fetch grouped report" });
  }
};

// ──────────────────────────────────────────────────────────────
// GET /api/timesheet-report/employee-summary
//
// Per-employee rollup. Shows ALL active employees, even those
// with zero matching timesheet entries (they show 0 hours).
// Filters on timesheet entries are applied to the JOIN condition,
// not to the outer WHERE, so all employees remain visible.
//
// Query params: fromDate, toDate, departmentId, projectId, managerId, employeeId
// ──────────────────────────────────────────────────────────────
export const getEmployeeSummaryReport = async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      departmentId,
      projectIds,
      managerId,
      employeeId,
    } = req.query;

    // Filters on the timesheet JOIN — keeps all employees in results
    const dteFilters = [];
    const params = [];
    let idx = 1;

    if (fromDate && toDate) {
      dteFilters.push(
        `dte.entry_date >= $${idx++} AND dte.entry_date <= $${idx++}`,
      );
      params.push(fromDate, toDate);
    } else if (fromDate) {
      dteFilters.push(`dte.entry_date >= $${idx++}`);
      params.push(fromDate);
    } else if (toDate) {
      dteFilters.push(`dte.entry_date <= $${idx++}`);
      params.push(toDate);
    }

    if (projectIds) {
      const uuids = await resolveProjectIds(projectIds);
      if (uuids.length > 0) {
        dteFilters.push(`dte.project_id = ANY($${idx++}::uuid[])`);
        params.push(uuids);
      }
    }

    // Filters on which employees appear in the outer result set
    const empFilters = [];

    if (departmentId) {
      empFilters.push(`e.department = $${idx++}`);
      params.push(departmentId);
    }

    if (managerId) {
      const uuid = await resolveEmployeeId(managerId);
      if (uuid) {
        empFilters.push(`e.module_manager_id = $${idx++}`);
        params.push(uuid);
      }
    }

    if (employeeId) {
      const uuid = await resolveEmployeeId(employeeId);
      if (uuid) {
        empFilters.push(`e.employee_id = $${idx++}`);
        params.push(uuid);
      }
    }

    const dteJoinExtra =
      dteFilters.length > 0 ? `AND ${dteFilters.join(" AND ")}` : "";

    const empWhereExtra =
      empFilters.length > 0 ? `AND ${empFilters.join(" AND ")}` : "";

    const query = `
      SELECT
        e.employee_id,
        e.employee_code,
        e.first_name || ' ' || e.last_name          AS employee_name,
        e.email                                      AS employee_email,
        e.designation,
        e.is_active,
        dept.name                                    AS department,
        COALESCE(mgr.first_name || ' ' || mgr.last_name, '') AS manager_name,

        -- Aggregates (COALESCE → 0 when no entries match)
        COUNT(dte.entry_id)                          AS total_entries,
        COALESCE(SUM(dte.total_hours),        0)     AS total_hours,
        COALESCE(SUM(dte.billable_hours),     0)     AS billable_hours,
        COALESCE(SUM(dte.non_billable_hours), 0)     AS non_billable_hours,
        COUNT(DISTINCT dte.entry_date)               AS working_days,
        COUNT(DISTINCT dte.project_id)               AS total_projects,
        COUNT(DISTINCT dte.ticket_id)                AS total_tickets,
        MAX(dte.entry_date)                          AS last_entry_date,
        MIN(dte.entry_date)                          AS first_entry_date,

        ROUND(
          COALESCE(SUM(dte.total_hours), 0) /
          NULLIF(COUNT(DISTINCT dte.entry_date), 0)
        , 2)                                         AS avg_hours_per_day,

        -- Status breakdown
        COUNT(CASE WHEN ts.name = 'Draft'                               THEN 1 END) AS draft_count,
        COUNT(CASE WHEN ts.name = 'Submitted'                           THEN 1 END) AS submitted_count,
        COUNT(CASE WHEN ts.name = 'Manager_Approved'                    THEN 1 END) AS mgr_approved_count,
        COUNT(CASE WHEN ts.name = 'Admin_Approved'                      THEN 1 END) AS admin_approved_count,
        COUNT(CASE WHEN ts.name IN ('Manager_Approved','Admin_Approved') THEN 1 END) AS approved_count,
        COUNT(CASE WHEN ts.name IN ('Manager_Rejected','Admin_Rejected') THEN 1 END) AS rejected_count,
        COUNT(CASE WHEN ts.name = 'Partially_Approved'                  THEN 1 END) AS partial_count

      FROM employees e
      -- DTE join uses extra conditions in the ON clause, NOT a WHERE,
      -- so employees without matching entries still appear with 0 values.
      LEFT JOIN daily_timesheet_entries dte
             ON dte.employee_id = e.employee_id ${dteJoinExtra}
      LEFT JOIN timesheet_status ts   ON ts.id           = dte.status
      LEFT JOIN departments      dept ON dept.id         = e.department
      LEFT JOIN employees        mgr  ON mgr.employee_id = e.module_manager_id

      WHERE e.is_active = TRUE ${empWhereExtra}

      GROUP BY
        e.employee_id, e.employee_code, e.first_name, e.last_name,
        e.email, e.designation, e.is_active,
        dept.name, mgr.first_name, mgr.last_name

      ORDER BY total_hours DESC, e.first_name ASC
    `;

    const { rows } = await pool.query(query, params);

    return res.json({
      data: rows.map((r) => ({
        ...r,
        total_hours: parseFloat(r.total_hours),
        billable_hours: parseFloat(r.billable_hours),
        non_billable_hours: parseFloat(r.non_billable_hours),
        avg_hours_per_day: parseFloat(r.avg_hours_per_day) || 0,
        total_entries: parseInt(r.total_entries, 10),
        working_days: parseInt(r.working_days, 10),
        total_projects: parseInt(r.total_projects, 10),
        total_tickets: parseInt(r.total_tickets, 10),
        statusBreakdown: {
          draft: parseInt(r.draft_count, 10),
          submitted: parseInt(r.submitted_count, 10),
          managerApproved: parseInt(r.mgr_approved_count, 10),
          adminApproved: parseInt(r.admin_approved_count, 10),
          approved: parseInt(r.approved_count, 10),
          rejected: parseInt(r.rejected_count, 10),
          partial: parseInt(r.partial_count, 10),
        },
      })),
    });
  } catch (error) {
    console.error(
      "[TimesheetReport] getEmployeeSummaryReport error:",
      error.message,
    );
    return res
      .status(500)
      .json({ error: error.message || "Failed to fetch employee summary" });
  }
};

// ──────────────────────────────────────────────────────────────
// GET /api/timesheet-report/project-summary
//
// Per-project rollup. Shows ALL active projects even those with
// zero timesheet entries. Filters on entries are applied to the
// JOIN ON clause so projects without matching entries still appear.
//
// Query params: fromDate, toDate, clientId, projectId, status
// ──────────────────────────────────────────────────────────────
export const getProjectSummaryReport = async (req, res) => {
  try {
    const { fromDate, toDate, clientId, projectIds, status } = req.query;

    // DTE join filters
    const dteFilters = [];
    const params = [];
    let idx = 1;

    if (fromDate && toDate) {
      dteFilters.push(
        `dte.entry_date >= $${idx++} AND dte.entry_date <= $${idx++}`,
      );
      params.push(fromDate, toDate);
    } else if (fromDate) {
      dteFilters.push(`dte.entry_date >= $${idx++}`);
      params.push(fromDate);
    } else if (toDate) {
      dteFilters.push(`dte.entry_date <= $${idx++}`);
      params.push(toDate);
    }

    // Project master outer WHERE filters
    const pmFilters = [];

    if (clientId) {
      pmFilters.push(`pm.client_id = $${idx++}`);
      params.push(clientId);
    }

    if (projectIds) {
      const uuids = await resolveProjectIds(projectIds);
      if (uuids.length > 0) {
        pmFilters.push(`pm.project_id = ANY($${idx++}::uuid[])`);
        params.push(uuids);
      }
    }

    if (status) {
      // status here = project_status.name (e.g. "In Progress")
      pmFilters.push(`ps.name = $${idx++}`);
      params.push(status);
    }

    const dteJoinExtra =
      dteFilters.length > 0 ? `AND ${dteFilters.join(" AND ")}` : "";

    const pmWhereExtra =
      pmFilters.length > 0 ? `AND ${pmFilters.join(" AND ")}` : "";

    const query = `
      SELECT
        pm.project_id,
        pm.project_name,
        pm.zoho_crm_code                                AS project_code,
        ps.name                                         AS project_status,
        pm.start_date,
        pm.end_date,
        cm.client_id,
        cm.client_name,
        cm.client_code,

        COUNT(DISTINCT dte.employee_id)                 AS total_employees,
        COUNT(DISTINCT dte.ticket_id)                   AS total_tickets,
        COUNT(dte.entry_id)                             AS total_entries,
        COALESCE(SUM(dte.total_hours),        0)        AS total_hours,
        COALESCE(SUM(dte.billable_hours),     0)        AS billable_hours,
        COALESCE(SUM(dte.non_billable_hours), 0)        AS non_billable_hours,
        COUNT(DISTINCT dte.entry_date)                  AS working_days,
        MIN(dte.entry_date)                             AS first_entry,
        MAX(dte.entry_date)                             AS last_entry,

        COUNT(CASE WHEN ts.name IN ('Manager_Approved','Admin_Approved')
              THEN dte.entry_id END)                    AS approved_entries,
        COUNT(CASE WHEN ts.name IN ('Manager_Rejected','Admin_Rejected')
              THEN dte.entry_id END)                    AS rejected_entries,
        COUNT(CASE WHEN ts.name = 'Submitted'
              THEN dte.entry_id END)                    AS submitted_entries

      FROM project_master pm
      JOIN  project_status ps  ON ps.id           = pm.status
      LEFT JOIN client_master  cm  ON cm.client_id = pm.client_id
      LEFT JOIN daily_timesheet_entries dte
             ON dte.project_id = pm.project_id ${dteJoinExtra}
      LEFT JOIN timesheet_status ts ON ts.id = dte.status

      WHERE pm.is_active = TRUE ${pmWhereExtra}

      GROUP BY
        pm.project_id, pm.project_name, pm.zoho_crm_code,
        ps.name, pm.start_date, pm.end_date,
        cm.client_id, cm.client_name, cm.client_code

      ORDER BY total_hours DESC, pm.project_name ASC
    `;

    const { rows } = await pool.query(query, params);

    return res.json({
      data: rows.map((r) => ({
        ...r,
        total_hours: parseFloat(r.total_hours),
        billable_hours: parseFloat(r.billable_hours),
        non_billable_hours: parseFloat(r.non_billable_hours),
        total_entries: parseInt(r.total_entries, 10),
        total_employees: parseInt(r.total_employees, 10),
        total_tickets: parseInt(r.total_tickets, 10),
        working_days: parseInt(r.working_days, 10),
        approved_entries: parseInt(r.approved_entries, 10),
        rejected_entries: parseInt(r.rejected_entries, 10),
        submitted_entries: parseInt(r.submitted_entries, 10),
      })),
    });
  } catch (error) {
    console.error(
      "[TimesheetReport] getProjectSummaryReport error:",
      error.message,
    );
    return res
      .status(500)
      .json({ error: error.message || "Failed to fetch project summary" });
  }
};

// ──────────────────────────────────────────────────────────────
// GET /api/timesheet-report/ticket-summary      ← NEW FUNCTION
//
// Per-ticket rollup showing logged hours vs estimated/approved,
// employee count, status breakdown, and utilisation %.
// Shows ALL active tickets; entries filtered via JOIN ON clause.
//
// Query params: fromDate, toDate, projectId, clientId, employeeId, status
// ──────────────────────────────────────────────────────────────
export const getTicketSummaryReport = async (req, res) => {
  try {
    const { fromDate, toDate, projectIds, clientId, employeeId, status } =
      req.query;

    const dteFilters = [];
    const params = [];
    let idx = 1;

    if (fromDate && toDate) {
      dteFilters.push(
        `dte.entry_date >= $${idx++} AND dte.entry_date <= $${idx++}`,
      );
      params.push(fromDate, toDate);
    } else if (fromDate) {
      dteFilters.push(`dte.entry_date >= $${idx++}`);
      params.push(fromDate);
    } else if (toDate) {
      dteFilters.push(`dte.entry_date <= $${idx++}`);
      params.push(toDate);
    }

    if (employeeId) {
      const uuid = await resolveEmployeeId(employeeId);
      if (uuid) {
        dteFilters.push(`dte.employee_id = $${idx++}`);
        params.push(uuid);
      }
    }

    if (status) {
      dteFilters.push(`ts.name = $${idx++}`);
      params.push(status);
    }

    // Ticket-level outer WHERE filters
    const tmFilters = [`tm.is_active = TRUE`];

    if (projectIds) {
      const uuids = await resolveProjectIds(projectIds);
      if (uuids.length > 0) {
        tmFilters.push(`tm.project_id = ANY($${idx++}::uuid[])`);
        params.push(uuids);
      }
    }

    if (clientId) {
      tmFilters.push(`pm.client_id = $${idx++}`);
      params.push(clientId);
    }

    const dteJoinExtra =
      dteFilters.length > 0 ? `AND ${dteFilters.join(" AND ")}` : "";
    const tmWhereClause = `WHERE ${tmFilters.join(" AND ")}`;

    const query = `
      SELECT
        tm.ticket_id,
        tm.ticket_name,
        tm.zoho_crm_code                              AS ticket_code,
        tm.estimated_hours,
        tm.approved_hours,
        pm.project_id,
        pm.project_name,
        pm.zoho_crm_code                              AS project_code,
        cm.client_name,

        -- Logged timesheet aggregates
        COUNT(DISTINCT dte.employee_id)               AS total_employees,
        COUNT(dte.entry_id)                           AS total_entries,
        COALESCE(SUM(dte.total_hours),        0)      AS logged_hours,
        COALESCE(SUM(dte.billable_hours),     0)      AS logged_billable_hours,
        COALESCE(SUM(dte.non_billable_hours), 0)      AS logged_non_billable_hours,
        COUNT(DISTINCT dte.entry_date)                AS working_days,
        MIN(dte.entry_date)                           AS first_entry,
        MAX(dte.entry_date)                           AS last_entry,

        -- Utilisation: logged vs estimated (null when no estimate)
        CASE
          WHEN tm.estimated_hours > 0 THEN
            ROUND((COALESCE(SUM(dte.total_hours), 0) / tm.estimated_hours) * 100, 1)
          ELSE NULL
        END                                           AS utilisation_pct,

        -- Status breakdown on logged entries
        COUNT(CASE WHEN ts.name IN ('Manager_Approved','Admin_Approved')
              THEN dte.entry_id END)                  AS approved_entries,
        COUNT(CASE WHEN ts.name IN ('Manager_Rejected','Admin_Rejected')
              THEN dte.entry_id END)                  AS rejected_entries,
        COUNT(CASE WHEN ts.name = 'Submitted'
              THEN dte.entry_id END)                  AS submitted_entries,
        COUNT(CASE WHEN ts.name = 'Draft'
              THEN dte.entry_id END)                  AS draft_entries

      FROM ticket_master tm
      LEFT JOIN project_master pm  ON pm.project_id = tm.project_id
      LEFT JOIN client_master  cm  ON cm.client_id  = pm.client_id
      LEFT JOIN daily_timesheet_entries dte
             ON dte.ticket_id = tm.ticket_id ${dteJoinExtra}
      LEFT JOIN timesheet_status ts ON ts.id = dte.status

      ${tmWhereClause}

      GROUP BY
        tm.ticket_id, tm.ticket_name, tm.zoho_crm_code,
        tm.estimated_hours, tm.approved_hours,
        pm.project_id, pm.project_name, pm.zoho_crm_code,
        cm.client_name

      ORDER BY logged_hours DESC, tm.ticket_name ASC
    `;

    const { rows } = await pool.query(query, params);

    return res.json({
      data: rows.map((r) => ({
        ...r,
        logged_hours: parseFloat(r.logged_hours),
        logged_billable_hours: parseFloat(r.logged_billable_hours),
        logged_non_billable_hours: parseFloat(r.logged_non_billable_hours),
        estimated_hours: parseFloat(r.estimated_hours) || 0,
        approved_hours: parseFloat(r.approved_hours) || 0,
        utilisation_pct:
          r.utilisation_pct !== null ? parseFloat(r.utilisation_pct) : null,
        total_employees: parseInt(r.total_employees, 10),
        total_entries: parseInt(r.total_entries, 10),
        working_days: parseInt(r.working_days, 10),
        approved_entries: parseInt(r.approved_entries, 10),
        rejected_entries: parseInt(r.rejected_entries, 10),
        submitted_entries: parseInt(r.submitted_entries, 10),
        draft_entries: parseInt(r.draft_entries, 10),
      })),
    });
  } catch (error) {
    console.error(
      "[TimesheetReport] getTicketSummaryReport error:",
      error.message,
    );
    return res
      .status(500)
      .json({ error: error.message || "Failed to fetch ticket summary" });
  }
};

// ──────────────────────────────────────────────────────────────
// GET /api/timesheet-report/employee-billable
//
// JSON preview — one row per (employee × client).
// Same filter params as getTimesheetReport (minus pagination/sort).
// Hours are decimal (already ÷60). Self Study = task ILIKE 'Self Study'.
//
// Response: { data: [...], total: N }
// Access: ADMIN, MANAGER
// ──────────────────────────────────────────────────────────────
export const getEmployeeBillableReport = async (req, res) => {
  try {
    const {
      employeeIds,
      projectIds,
      ticketIds,
      clientIds,
      departmentId,
      fromDate,
      toDate,
      status,
      managerId,
    } = req.query;

    const callerRole = req.user?.role;
    const callerId = req.user?.employee_id || req.user?.id;
    const isManager = callerRole === "MANAGER";

    // Resolve the manager's assigned project IDs once — used in two places:
    //   1. DTE LEFT JOIN ON clause (scope which hours are aggregated)
    //   2. Employee WHERE clause (scope which employees are visible)
    let managerProjectIds = [];
    if (isManager && callerId) {
      const { rows: pmaRows } = await pool.query(
        `SELECT DISTINCT project_id
           FROM project_manager_assignment
          WHERE manager_id = $1 AND project_id IS NOT NULL`,
        [callerId],
      );
      managerProjectIds = pmaRows.map((r) => r.project_id).filter(Boolean);
    }

    // Dummy UUID used when manager has no assigned projects so queries
    // return 0 rows rather than an empty-array syntax error.
    const DUMMY_UUID = "00000000-0000-0000-0000-000000000000";
    const managerScopeIds = isManager
      ? managerProjectIds.length > 0
        ? managerProjectIds
        : [DUMMY_UUID]
      : null; // null = ADMIN = no scope restriction

    // ── Parameter index tracker ─────────────────────────────────────────────
    // Parameters are positional ($1, $2 …) and must be pushed in exactly the
    // order they appear in the SQL string (top-to-bottom, left-to-right).
    // Rule: DTE JOIN ON conditions come first in the SQL, then employee WHERE
    // conditions, so we build them in that order.
    const params = [];
    let idx = 1;

    // ── A. DTE LEFT JOIN ON conditions ──────────────────────────────────────
    // These scope WHICH HOURS are aggregated for each employee.
    // Because they live in the JOIN ON clause (not WHERE), employees whose
    // DTE rows are all filtered out still appear with COALESCE(SUM(...), 0).
    const dteJoinConds = [];

    // User-supplied project filter
    if (projectIds) {
      const uuids = await resolveProjectIds(projectIds);
      if (uuids.length > 0) {
        dteJoinConds.push(`dte.project_id = ANY($${idx++}::uuid[])`);
        params.push(uuids);
      }
    }

    // Manager project scope on DTE aggregation (always for MANAGER callers)
    if (isManager) {
      dteJoinConds.push(`dte.project_id = ANY($${idx++}::uuid[])`);
      params.push(managerScopeIds);
    }

    // Ticket filter
    if (ticketIds) {
      const uuids = await resolveTicketIds(ticketIds);
      if (uuids.length > 0) {
        dteJoinConds.push(`dte.ticket_id = ANY($${idx++}::uuid[])`);
        params.push(uuids);
      }
    }

    // Client filter
    if (clientIds) {
      const uuids = clientIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (uuids.length > 0) {
        dteJoinConds.push(`dte.client_id = ANY($${idx++}::uuid[])`);
        params.push(uuids);
      }
    }

    // Timesheet status filter (ts alias is resolved in the DTE LEFT JOIN chain)
    if (status) {
      dteJoinConds.push(`ts_eb.name = $${idx++}`);
      params.push(status);
    }

    // Manager-on-entry filter
    if (managerId) {
      const uuid = await resolveEmployeeId(managerId);
      if (uuid) {
        dteJoinConds.push(`dte.manager_id = $${idx++}`);
        params.push(uuid);
      }
    }

    // Date range
    if (fromDate && !toDate) {
      dteJoinConds.push(`dte.entry_date = $${idx++}`);
      params.push(fromDate);
    } else if (fromDate && toDate) {
      dteJoinConds.push(
        `dte.entry_date >= $${idx++} AND dte.entry_date <= $${idx++}`,
      );
      params.push(fromDate, toDate);
    } else if (!fromDate && toDate) {
      dteJoinConds.push(`dte.entry_date <= $${idx++}`);
      params.push(toDate);
    }

    const dteJoinExtra =
      dteJoinConds.length > 0 ? `AND ${dteJoinConds.join(" AND ")}` : "";

    // ── B. Employee WHERE conditions ────────────────────────────────────────
    // These control WHICH EMPLOYEES appear in the result set.
    // Always exclude ADMIN-role employees.
    const empWhereConds = [];

    // Exclude ADMIN role (role id looked up inline to avoid an extra query)
    empWhereConds.push(
      `e.role != (SELECT id FROM user_roles WHERE name = 'ADMIN' LIMIT 1)`,
    );

    // Only active employees
    empWhereConds.push(`e.is_active = TRUE`);

    // Explicit employee filter (user multi-selected specific employees)
    if (employeeIds) {
      const uuids = await resolveEmployeeIds(employeeIds);
      if (uuids.length > 0) {
        empWhereConds.push(`e.employee_id = ANY($${idx++}::uuid[])`);
        params.push(uuids);
      }
    }

    // Department filter
    if (departmentId) {
      empWhereConds.push(`e.department = $${idx++}`);
      params.push(departmentId);
    }

    // Manager employee-visibility scope:
    //   Show only employees who are assigned to tickets under the manager's
    //   projects (ticket_assignments). Using ticket_assignments (not DTE) means
    //   employees with zero logged hours but existing assignments still appear.
    if (isManager) {
      empWhereConds.push(`
        e.employee_id IN (
          SELECT DISTINCT ta.employee_id
          FROM   ticket_assignments ta
          JOIN   ticket_master      tm ON tm.ticket_id   = ta.ticket_id
          WHERE  tm.project_id = ANY($${idx++}::uuid[])
            AND  ta.employee_id IS NOT NULL
        )
      `);
      params.push(managerScopeIds);
    }

    const empWhereClause = `WHERE ${empWhereConds.join(" AND ")}`;

    // ── Build and run the query ─────────────────────────────────────────────
    const sql = `
      SELECT
        e.employee_id,
        e.employee_code,
        e.first_name || ' ' || e.last_name               AS employee_name,
        e.designation,
        dept.name                                         AS department,
 
        -- Client comes from the DTE row; NULL when employee has no entries.
        cm.client_id,
        COALESCE(cm.client_name, '(No Client)')           AS client_name,
 
        -- All hour aggregates default to 0 via COALESCE so zero-entry
        -- employees display 0 rather than NULL.
        COALESCE(SUM(dte.billable_hours), 0)               AS billable_hours_mins,
        -- Non-Billable excludes off-day tasks (Official Leave / Saturday Off / Sunday Off / Public Holiday)
        COALESCE(
          SUM(dte.non_billable_hours)
          FILTER (
            WHERE task_eb.task IS NULL
               OR (    task_eb.task NOT ILIKE 'Official Leave'
                   AND task_eb.task NOT ILIKE 'Official Saturday Off'
                   AND task_eb.task NOT ILIKE 'Official Sunday Off'
                   AND task_eb.task NOT ILIKE 'Public Holiday')
          ),
          0
        )                                                 AS non_billable_hours_mins,
        -- Self Study hours (unchanged)
        COALESCE(
          SUM(dte.total_hours)
          FILTER (WHERE task_eb.task ILIKE 'Self Study'),
          0
        )                                                 AS self_study_hours_mins,
        -- Official Off Days: total_hours for the three off-day task types
        COALESCE(
          SUM(dte.total_hours)
          FILTER (
            WHERE task_eb.task ILIKE 'Official Leave'
               OR task_eb.task ILIKE 'Official Saturday Off'
               OR task_eb.task ILIKE 'Official Sunday Off'
               OR task_eb.task ILIKE 'Public Holiday'
          ),
          0
        )                                                 AS official_off_hours_mins,
        COUNT(DISTINCT dte.entry_date)                    AS working_days,
        MIN(dte.entry_date)                               AS first_entry,
        MAX(dte.entry_date)                               AS last_entry
 
      FROM employees e
      LEFT JOIN departments dept ON dept.id = e.department
 
      -- DTE is LEFT JOIN so employees with no matching entries still appear.
      -- All entry-level filters (dates, projects, tickets …) live here in the
      -- ON clause rather than in WHERE so they do NOT eliminate employee rows.
      LEFT JOIN daily_timesheet_entries dte
             ON dte.employee_id = e.employee_id ${dteJoinExtra}
 
      -- Secondary LEFT JOINs hang off the DTE row; they produce NULLs when
      -- dte itself is NULL (zero-entry employee), which is fine because the
      -- SELECT columns either use COALESCE or are grouped away.
      LEFT JOIN timesheet_status ts_eb   ON ts_eb.id       = dte.status
      LEFT JOIN client_master    cm      ON cm.client_id   = dte.client_id
      LEFT JOIN task_master      task_eb ON task_eb.task_id = dte.task_id
 
      ${empWhereClause}
 
      GROUP BY
        e.employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.designation,
        dept.name,
        cm.client_id,
        cm.client_name
 
      ORDER BY
        e.first_name   ASC,
        e.last_name    ASC,
        cm.client_name ASC NULLS LAST
    `;

    const { rows } = await pool.query(sql, params);

    // Convert INTEGER MINUTES → decimal hours for the JSON response.
    // The frontend's decimalToHHMM() turns these into H:MM display strings.
    const toHrs = (mins) =>
      mins != null ? Math.round((parseFloat(mins) / 60) * 100) / 100 : 0;

    return res.json({
      data: rows.map((r) => ({
        employee_id: r.employee_id,
        employee_code: r.employee_code,
        employee_name: r.employee_name,
        designation: r.designation || "",
        department: r.department || "",
        client_id: r.client_id || null,
        client_name: r.client_name,
        billable_hours: toHrs(r.billable_hours_mins),
        non_billable_hours: toHrs(r.non_billable_hours_mins),
        self_study_hours: toHrs(r.self_study_hours_mins),
        official_off_hours: toHrs(r.official_off_hours_mins), // ← BUG 1 FIX: was missing
        working_days: parseInt(r.working_days, 10),
        first_entry: r.first_entry,
        last_entry: r.last_entry,
      })),
      total: rows.length,
    });
  } catch (error) {
    console.error(
      "[TimesheetReport] getEmployeeBillableReport error:",
      error.message,
    );
    return res.status(500).json({
      error: error.message || "Failed to fetch employee billable report",
    });
  }
};

// ──────────────────────────────────────────────────────────────
// GET /api/timesheet-report/header-preview
//
// JSON preview — one row per (client × project × ticket).
//
// ROOT CAUSE FIX: previously drove from ticket_master, so only clients
// that had at least one active ticket were visible. Clients with no
// tickets were completely absent from the report.
//
// NEW QUERY STRUCTURE — drives from client_master:
//   client_master
//     └─ LEFT JOIN project_master  (projectIds filter in JOIN ON)
//          └─ LEFT JOIN ticket_master  (ticketIds + is_active in JOIN ON)
//               └─ LEFT JOIN daily_timesheet_entries  (entry-level filters in JOIN ON)
//
// By putting every scope filter in the JOIN ON clauses (not WHERE),
// a client with no matching projects/tickets still produces a row
// with NULL ticket info and 0 hours — all clients always appear.
//
// The only WHERE conditions are on client_master itself:
//   ADMIN   → cm.is_active = TRUE  (all active clients)
//   MANAGER → cm.is_active = TRUE AND cm.client_id IN (
//               SELECT DISTINCT pm2.client_id FROM project_master pm2
//               WHERE pm2.project_id = ANY($managerScopeIds)
//             )  — only clients whose projects the manager manages
//
// Hours returned as INTEGER MINUTES. Frontend divides by 60 for display.
// Response: { data: [...], total: N }
// Access: ADMIN, MANAGER
// ──────────────────────────────────────────────────────────────
export const getHeaderPreviewReport = async (req, res) => {
  try {
    const {
      employeeIds,
      projectIds,
      ticketIds,
      clientIds,
      departmentId,
      fromDate,
      toDate,
      status,
      managerId,
    } = req.query;

    const callerRole = req.user?.role;
    const callerId = req.user?.employee_id || req.user?.id;
    const isManager = callerRole === "MANAGER";
    let managerProjectIds = [];
    if (isManager && callerId) {
      const pmaRows = await pool.query(
        `SELECT DISTINCT project_id
           FROM project_manager_assignment
          WHERE manager_id = $1 AND project_id IS NOT NULL`,
        [callerId],
      );
      managerProjectIds = pmaRows.rows.map((r) => r.project_id).filter(Boolean);
    }
    const DUMMY = "00000000-0000-0000-0000-000000000000";
    const managerScopeIds = isManager
      ? managerProjectIds.length > 0
        ? managerProjectIds
        : [DUMMY]
      : null;

    const hParams = [];
    let hIdx = 1;

    // ── A. project_master JOIN ON conditions ────────────────────────────────
    // Controls which projects appear per client. Does NOT eliminate client rows
    // when empty — the LEFT JOIN still produces the client row with NULL project.
    const pmJoinConds = [];

    if (projectIds) {
      const uuids = await resolveProjectIds(projectIds);
      if (uuids.length > 0) {
        pmJoinConds.push(`pm.project_id = ANY($${hIdx++}::uuid[])`);
        hParams.push(uuids);
      }
    }
    // Manager scope on projects — restricts which projects are joined per client
    if (isManager) {
      pmJoinConds.push(`pm.project_id = ANY($${hIdx++}::uuid[])`);
      hParams.push(managerScopeIds);
    }

    // ── B. ticket_master JOIN ON conditions ─────────────────────────────────
    // is_active always here (moved out of WHERE) so inactive tickets are excluded
    // without eliminating client or project rows.
    const tmJoinConds = [`tm.is_active = TRUE`];

    if (ticketIds) {
      const uuids = await resolveTicketIds(ticketIds);
      if (uuids.length > 0) {
        tmJoinConds.push(`tm.ticket_id = ANY($${hIdx++}::uuid[])`);
        hParams.push(uuids);
      }
    }

    // ── C. DTE LEFT JOIN ON conditions — scope which hours are aggregated ────
    // Entry-level filters here so tickets/clients with 0 matching entries still
    // appear with 0 hours rather than disappearing.
    const hDteJoin = [];

    // clientIds: moved here (was incorrectly in WHERE as pm.client_id).
    // Using dte.client_id scopes which hours are counted, not which rows appear.
    if (clientIds) {
      const uuids = clientIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (uuids.length > 0) {
        hDteJoin.push(`dte.client_id = ANY($${hIdx++}::uuid[])`);
        hParams.push(uuids);
      }
    }
    if (employeeIds) {
      const uuids = await resolveEmployeeIds(employeeIds);
      if (uuids.length > 0) {
        hDteJoin.push(`dte.employee_id = ANY($${hIdx++}::uuid[])`);
        hParams.push(uuids);
      }
    }
    if (departmentId) {
      hDteJoin.push(`e_h.department = $${hIdx++}`);
      hParams.push(departmentId);
    }
    if (managerId) {
      const uuid = await resolveEmployeeId(managerId);
      if (uuid) {
        hDteJoin.push(`dte.manager_id = $${hIdx++}`);
        hParams.push(uuid);
      }
    }
    if (status) {
      hDteJoin.push(`ts_h.name = $${hIdx++}`);
      hParams.push(status);
    }
    if (fromDate && !toDate) {
      hDteJoin.push(`dte.entry_date = $${hIdx++}`);
      hParams.push(fromDate);
    } else if (fromDate && toDate) {
      hDteJoin.push(
        `dte.entry_date >= $${hIdx++} AND dte.entry_date <= $${hIdx++}`,
      );
      hParams.push(fromDate, toDate);
    } else if (!fromDate && toDate) {
      hDteJoin.push(`dte.entry_date <= $${hIdx++}`);
      hParams.push(toDate);
    }

    // ── D. client_master WHERE conditions ───────────────────────────────────
    // ADMIN   → all active clients
    // MANAGER → only clients whose projects this manager manages
    const cmWhereConds = [`cm.is_active = TRUE`];

    if (isManager) {
      // Restrict which clients appear to only those the manager has projects for
      cmWhereConds.push(`cm.client_id IN (
        SELECT DISTINCT pm2.client_id
        FROM   project_master pm2
        WHERE  pm2.project_id = ANY($${hIdx++}::uuid[])
          AND  pm2.client_id IS NOT NULL
      )`);
      hParams.push(managerScopeIds);
    }

    // Explicit clientIds filter from user — applies to both roles
    if (clientIds) {
      const uuids = clientIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (uuids.length > 0) {
        cmWhereConds.push(`cm.client_id = ANY($${hIdx++}::uuid[])`);
        hParams.push(uuids);
      }
    }

    // ── Assemble SQL fragments ───────────────────────────────────────────────
    const pmJoinExtra =
      pmJoinConds.length > 0 ? `AND ${pmJoinConds.join(" AND ")}` : "";
    const tmJoinStr = tmJoinConds.join(" AND ");
    const hJoinExtra =
      hDteJoin.length > 0 ? `AND ${hDteJoin.join(" AND ")}` : "";
    const hWhereClause = `WHERE ${cmWhereConds.join(" AND ")}`;

    const headerQuery = `
      SELECT
        cm.client_id,
        COALESCE(cm.client_name,  '(No Client)')         AS client_name,
        COALESCE(pm.project_name, '(No Project)')        AS project_name,
        COALESCE(pst.name, '')                           AS project_status,
        tm.ticket_name,
        tm.zoho_crm_code                                 AS ticket_code,
        COALESCE(tst.name, '')                           AS ticket_status,
        COALESCE(tm.description, '')                     AS ticket_description,
        COALESCE(tm.approved_hours, 0)                   AS approved_hours_mins,
        COALESCE(SUM(dte.billable_hours),     0)         AS billable_hours_mins,
        COALESCE(SUM(dte.non_billable_hours), 0)         AS non_billable_hours_mins

      FROM client_master cm

      -- Projects LEFT JOIN: scope conditions in ON so client rows survive
      LEFT JOIN project_master pm
             ON pm.client_id = cm.client_id ${pmJoinExtra}
      LEFT JOIN project_status pst ON pst.id = pm.status

      -- Tickets LEFT JOIN: is_active + user ticket filter in ON
      LEFT JOIN ticket_master tm
             ON tm.project_id = pm.project_id AND ${tmJoinStr}
      LEFT JOIN ticket_status tst ON tst.id = tm.status

      -- DTE LEFT JOIN: all entry-level filters in ON
      LEFT JOIN daily_timesheet_entries dte
             ON dte.ticket_id = tm.ticket_id ${hJoinExtra}
      LEFT JOIN employees        e_h  ON e_h.employee_id = dte.employee_id
      LEFT JOIN timesheet_status ts_h ON ts_h.id         = dte.status

      ${hWhereClause}

      GROUP BY
        cm.client_id,
        cm.client_name,
        pm.project_id,
        pm.project_name,
        pst.name,
        tst.name,
        tm.ticket_id,
        tm.ticket_name,
        tm.zoho_crm_code,
        tm.description,
        tm.approved_hours

      ORDER BY
        cm.client_name  ASC NULLS LAST,
        pm.project_name ASC NULLS LAST,
        tm.ticket_name  ASC NULLS LAST
    `;

    const { rows } = await pool.query(headerQuery, hParams);

    return res.json({
      data: rows.map((r) => ({
        ...r,
        client_id: r.client_id || null,
        approved_hours_mins: parseInt(r.approved_hours_mins, 10) || 0,
        billable_hours_mins: parseInt(r.billable_hours_mins, 10) || 0,
        non_billable_hours_mins: parseInt(r.non_billable_hours_mins, 10) || 0,
      })),
      total: rows.length,
    });
  } catch (error) {
    console.error(
      "[TimesheetReport] getHeaderPreviewReport error:",
      error.message,
    );
    return res
      .status(500)
      .json({ error: error.message || "Failed to fetch header preview" });
  }
};

// ──────────────────────────────────────────────────────────────
// GET /api/timesheet-report/export
//
// Downloads ALL matching rows (no pagination) as an Excel file.
// Applies identical filter + manager-scope logic as getTimesheetReport.
// Hours stored as INTEGER MINUTES — divided by 60 for display.
//
// Query params: same as getTimesheetReport (page/pageSize/sortBy/sortDir ignored)
// Access: ADMIN, MANAGER
// ──────────────────────────────────────────────────────────────
export const exportTimesheetReport = async (req, res) => {
  try {
    const {
      employeeIds, // comma-separated UUIDs — multi-select
      projectIds, // comma-separated UUIDs — multi-select
      ticketIds, // comma-separated UUIDs — multi-select
      clientIds, // comma-separated UUIDs — multi-select
      departmentId,
      fromDate,
      toDate,
      status,
      managerId,
      sortBy = "entry_date",
      sortDir = "desc",
      exportMode = "item", // "item" (default) | "header" | "employee-billable"
    } = req.query;

    // ── Sort whitelist ────────────────────────────────────────
    const ALLOWED_SORT = {
      entry_date: "dte.entry_date",
      hours: "dte.total_hours",
      status: "ts.name",
      employee: "e.first_name",
      project: "pm.project_name",
      ticket: "tm.ticket_name",
      // submitted_at: "dte.submitted_at",
    };
    const sortCol = ALLOWED_SORT[sortBy] || "dte.entry_date";
    const dir = sortDir === "asc" ? "ASC" : "DESC";

    // ── Manager scope (identical to getTimesheetReport) ───────
    const callerRole = req.user?.role;
    const callerId = req.user?.employee_id || req.user?.id;
    const isManager = callerRole === "MANAGER";
    let managerProjectIds = [];
    if (isManager && callerId) {
      const pmaRows = await pool.query(
        `SELECT DISTINCT project_id
           FROM project_manager_assignment
          WHERE manager_id = $1 AND project_id IS NOT NULL`,
        [callerId],
      );
      managerProjectIds = pmaRows.rows.map((r) => r.project_id).filter(Boolean);
    }

    // ── Build WHERE conditions ────────────────────────────────
    const conditions = [];
    const params = [];
    let idx = 1;

    if (employeeIds) {
      const uuids = await resolveEmployeeIds(employeeIds);
      if (uuids.length > 0) {
        conditions.push(`dte.employee_id = ANY($${idx++}::uuid[])`);
        params.push(uuids);
      }
    }

    if (projectIds) {
      const uuids = await resolveProjectIds(projectIds);
      if (uuids.length > 0) {
        conditions.push(`dte.project_id = ANY($${idx++}::uuid[])`);
        params.push(uuids);
      }
    }

    // Always enforce manager scope
    if (isManager) {
      const scopeIds =
        managerProjectIds.length > 0
          ? managerProjectIds
          : ["00000000-0000-0000-0000-000000000000"];
      conditions.push(`dte.project_id = ANY($${idx++}::uuid[])`);
      params.push(scopeIds);
    }

    if (ticketIds) {
      const uuids = await resolveTicketIds(ticketIds);
      if (uuids.length > 0) {
        conditions.push(`dte.ticket_id = ANY($${idx++}::uuid[])`);
        params.push(uuids);
      }
    }

    if (clientIds) {
      const uuids = clientIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (uuids.length > 0) {
        conditions.push(`dte.client_id = ANY($${idx++}::uuid[])`);
        params.push(uuids);
      }
    }
    if (departmentId) {
      conditions.push(`e.department = $${idx++}`);
      params.push(departmentId);
    }
    if (status) {
      conditions.push(`ts.name = $${idx++}`);
      params.push(status);
    }

    if (managerId) {
      const uuid = await resolveEmployeeId(managerId);
      if (uuid) {
        conditions.push(`dte.manager_id = $${idx++}`);
        params.push(uuid);
      }
    }

    if (fromDate && !toDate) {
      conditions.push(`dte.entry_date = $${idx++}`);
      params.push(fromDate);
    } else if (fromDate && toDate) {
      conditions.push(
        `dte.entry_date >= $${idx++} AND dte.entry_date <= $${idx++}`,
      );
      params.push(fromDate, toDate);
    } else if (!fromDate && toDate) {
      conditions.push(`dte.entry_date <= $${idx++}`);
      params.push(toDate);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // ── Fetch ALL matching rows (no LIMIT/OFFSET) ─────────────
    const { rows } = await pool.query(
      `SELECT
         dte.entry_date,
         e.employee_code,
         e.first_name || ' ' || e.last_name          AS employee_name,
         e.designation                                AS employee_designation,
         dept.name                                    AS employee_department,
         pm.project_name,
         pm.zoho_crm_code                             AS project_code,
         cm.client_name,
         tm.ticket_name,
         tm.zoho_crm_code                             AS ticket_code,
         task.task                                    AS task_name,
         dte.total_hours,
         dte.billable_hours,
         dte.non_billable_hours,
         ts.name                                      AS status,
         dte.description,
         dte.ticket_number,
         mgr.first_name || ' ' || mgr.last_name      AS manager_name,
         -- dte.submitted_at,
         COALESCE(apr.first_name || ' ' || apr.last_name, '') AS approved_by_name,
         dte.approved_at,
         dte.rejection_reason
       FROM daily_timesheet_entries dte
       JOIN  timesheet_status  ts    ON ts.id            = dte.status
       JOIN  employees         e     ON e.employee_id     = dte.employee_id
       LEFT JOIN departments   dept  ON dept.id           = e.department
       LEFT JOIN project_master pm   ON pm.project_id     = dte.project_id
       LEFT JOIN client_master  cm   ON cm.client_id      = dte.client_id
       LEFT JOIN ticket_master  tm   ON tm.ticket_id      = dte.ticket_id
       LEFT JOIN employees      mgr  ON mgr.employee_id   = dte.manager_id
       -- LEFT JOIN employees      apr  ON apr.employee_id   = dte.approved_by
       LEFT JOIN task_master    task ON task.task_id      = dte.task_id
       ${whereClause}
       ORDER BY ${sortCol} ${dir}`,
      params,
    );

    // ────────────────────────────────────────────────────────────────────────
    // SHARED HELPERS
    // ────────────────────────────────────────────────────────────────────────

    /** INTEGER MINUTES → decimal hours rounded to 2 dp */
    const toHrs = (mins) =>
      mins != null ? Math.round((parseFloat(mins) / 60) * 100) / 100 : 0;

    const fmtDate = (val) => {
      if (!val) return "";
      const d = new Date(
        typeof val === "string" && val.length === 10 ? val + "T00:00:00" : val,
      );
      return isNaN(d.getTime())
        ? String(val)
        : d.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
    };

    const solidFill = (argb) => ({
      type: "pattern",
      pattern: "solid",
      fgColor: { argb },
    });
    const hairBdr = () => ({
      bottom: { style: "hair", color: { argb: "FFCBD5E1" } },
      right: { style: "hair", color: { argb: "FFCBD5E1" } },
    });

    const dateStr = new Date().toISOString().split("T")[0];
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "TimeTrack Pro";
    workbook.created = new Date();

    // ════════════════════════════════════════════════════════════════════════
    // EMPLOYEE-BILLABLE MODE
    // One row per (employee × client):
    //   Employee Code | Employee Name | Designation | Department
    //   Client Name
    //   Billable Hours | Non-Billable Hours | Self Study Hours | Working Days
    //
    // Self Study = entries where task_master.task ILIKE 'Self Study'.
    // Filters work the same as item-mode (all filters applied to DTE WHERE).
    // ════════════════════════════════════════════════════════════════════════
    if (exportMode === "employee-billable") {
      // ── Rebuild params independently ──────────────────────────────────────
      // Cannot reuse the shared `conditions` / `params` built above: those are
      // structured around DTE as the driving table. Here we drive from `employees`
      // with DTE as a LEFT JOIN, so filters live in two separate zones:
      //
      //   ebDteJoin   → LEFT JOIN ON clause for daily_timesheet_entries
      //                 Entry-level filters: projects, tickets, clients, status,
      //                 managerId (on entry), date range.
      //                 Placing them here means employees with 0 matching DTE
      //                 rows still appear with COALESCE(SUM(...), 0) = 0.
      //
      //   ebEmpWhere  → WHERE on employees
      //                 Employee-level filters: is_active, exclude ADMIN role,
      //                 explicit employeeIds, departmentId, manager visibility.
      //
      const ebDteJoin = [];
      const ebEmpWhere = [];
      const ebParams = [];
      let ebIdx = 1;

      // ── DTE JOIN ON conditions ─────────────────────────────────────────────
      if (projectIds) {
        const uuids = await resolveProjectIds(projectIds);
        if (uuids.length > 0) {
          ebDteJoin.push(`dte.project_id = ANY($${ebIdx++}::uuid[])`);
          ebParams.push(uuids);
        }
      }
      // Manager project scope on DTE aggregation
      if (isManager) {
        const scopeIds =
          managerProjectIds.length > 0
            ? managerProjectIds
            : ["00000000-0000-0000-0000-000000000000"];
        ebDteJoin.push(`dte.project_id = ANY($${ebIdx++}::uuid[])`);
        ebParams.push(scopeIds);
      }
      if (ticketIds) {
        const uuids = await resolveTicketIds(ticketIds);
        if (uuids.length > 0) {
          ebDteJoin.push(`dte.ticket_id = ANY($${ebIdx++}::uuid[])`);
          ebParams.push(uuids);
        }
      }
      if (clientIds) {
        const uuids = clientIds
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (uuids.length > 0) {
          ebDteJoin.push(`dte.client_id = ANY($${ebIdx++}::uuid[])`);
          ebParams.push(uuids);
        }
      }
      if (status) {
        ebDteJoin.push(`ts_eb.name = $${ebIdx++}`);
        ebParams.push(status);
      }
      if (managerId) {
        const uuid = await resolveEmployeeId(managerId);
        if (uuid) {
          ebDteJoin.push(`dte.manager_id = $${ebIdx++}`);
          ebParams.push(uuid);
        }
      }
      if (fromDate && !toDate) {
        ebDteJoin.push(`dte.entry_date = $${ebIdx++}`);
        ebParams.push(fromDate);
      } else if (fromDate && toDate) {
        ebDteJoin.push(
          `dte.entry_date >= $${ebIdx++} AND dte.entry_date <= $${ebIdx++}`,
        );
        ebParams.push(fromDate, toDate);
      } else if (!fromDate && toDate) {
        ebDteJoin.push(`dte.entry_date <= $${ebIdx++}`);
        ebParams.push(toDate);
      }

      // ── Employee WHERE conditions ──────────────────────────────────────────
      // Always exclude ADMIN-role employees and inactive employees
      ebEmpWhere.push(
        `e.role != (SELECT id FROM user_roles WHERE name = 'ADMIN' LIMIT 1)`,
      );
      ebEmpWhere.push(`e.is_active = TRUE`);

      if (employeeIds) {
        const uuids = await resolveEmployeeIds(employeeIds);
        if (uuids.length > 0) {
          ebEmpWhere.push(`e.employee_id = ANY($${ebIdx++}::uuid[])`);
          ebParams.push(uuids);
        }
      }
      if (departmentId) {
        ebEmpWhere.push(`e.department = $${ebIdx++}`);
        ebParams.push(departmentId);
      }
      // Manager employee-visibility scope: only show employees assigned to
      // tickets in the manager's projects (even if they have 0 hours logged)
      if (isManager) {
        const scopeIds =
          managerProjectIds.length > 0
            ? managerProjectIds
            : ["00000000-0000-0000-0000-000000000000"];
        ebEmpWhere.push(`e.employee_id IN (
          SELECT DISTINCT ta.employee_id
          FROM   ticket_assignments ta
          JOIN   ticket_master      tm2 ON tm2.ticket_id = ta.ticket_id
          WHERE  tm2.project_id = ANY($${ebIdx++}::uuid[])
            AND  ta.employee_id IS NOT NULL
        )`);
        ebParams.push(scopeIds);
      }

      const ebDteExtra =
        ebDteJoin.length > 0 ? `AND ${ebDteJoin.join(" AND ")}` : "";
      const ebWhereClause = `WHERE ${ebEmpWhere.join(" AND ")}`;

      const ebQuery = `
        SELECT
          e.employee_id,
          e.employee_code,
          e.first_name || ' ' || e.last_name             AS employee_name,
          e.designation,
          dept.name                                       AS department,
          cm.client_id,
          COALESCE(cm.client_name, '(No Client)')         AS client_name,
          COALESCE(SUM(dte.billable_hours), 0)             AS billable_hours_mins,
          -- Non-Billable excludes off-day tasks
          COALESCE(
            SUM(dte.non_billable_hours)
            FILTER (
              WHERE task_eb.task IS NULL
                 OR (    task_eb.task NOT ILIKE 'Official Leave'
                     AND task_eb.task NOT ILIKE 'Official Saturday Off'
                     AND task_eb.task NOT ILIKE 'Official Sunday Off'
                     AND task_eb.task NOT ILIKE 'Public Holiday')
            ),
            0
          )                                               AS non_billable_hours_mins,
          COALESCE(
            SUM(dte.total_hours)
            FILTER (WHERE task_eb.task ILIKE 'Self Study'),
            0
          )                                               AS self_study_hours_mins,
          -- Official Off Days aggregate
          COALESCE(
            SUM(dte.total_hours)
            FILTER (
              WHERE task_eb.task ILIKE 'Official Leave'
                 OR task_eb.task ILIKE 'Official Saturday Off'
                 OR task_eb.task ILIKE 'Official Sunday Off'
                 OR task_eb.task ILIKE 'Public Holiday'
            ),
            0
          )                                               AS official_off_hours_mins,
          COUNT(DISTINCT dte.entry_date)                  AS working_days
        FROM employees e
        LEFT JOIN departments dept ON dept.id = e.department
 
        -- DTE is LEFT JOIN so employees with 0 matching entries still appear.
        -- All entry-level filters live in the ON clause, not in WHERE.
        LEFT JOIN daily_timesheet_entries dte
               ON dte.employee_id = e.employee_id ${ebDteExtra}
        LEFT JOIN timesheet_status ts_eb   ON ts_eb.id        = dte.status
        LEFT JOIN client_master    cm      ON cm.client_id    = dte.client_id
        LEFT JOIN task_master      task_eb ON task_eb.task_id = dte.task_id
 
        ${ebWhereClause}
 
        GROUP BY
          e.employee_id, e.employee_code,
          e.first_name, e.last_name,
          e.designation, dept.name,
          cm.client_id, cm.client_name
        ORDER BY
          e.first_name ASC, e.last_name ASC,
          cm.client_name ASC NULLS LAST
      `;

      const { rows: ebRows } = await pool.query(ebQuery, ebParams);

      // ── Build workbook ────────────────────────────────────────
      const ws = workbook.addWorksheet("Employee Billable Report");

      // Title banner row
      ws.mergeCells("A1:I1");
      const titleCell = ws.getCell("A1");
      titleCell.value = "Employee Billable Hours Report";
      titleCell.font = {
        bold: true,
        size: 13,
        color: { argb: "FFFFFFFF" },
        name: "Calibri",
      };
      titleCell.fill = solidFill("FF1E3A5F");
      titleCell.alignment = { vertical: "middle", horizontal: "center" };
      ws.getRow(1).height = 26;

      // Column definitions
      ws.columns = [
        { key: "employee_code", width: 16 },
        { key: "employee_name", width: 26 },
        { key: "designation", width: 22 },
        { key: "department", width: 20 },
        { key: "client_name", width: 28 },
        { key: "billable_hours", width: 18 },
        { key: "non_billable_hours", width: 20 },
        { key: "self_study_hours", width: 18 },
        { key: "official_off_hours", width: 20 }, // ← BUG 3 FIX: new column
      ];

      // Header row (row 2)
      const COL_HEADERS = [
        "Employee Code",
        "Employee Name",
        "Designation",
        "Department",
        "Client Name",
        "Billable Hours",
        "Non-Billable Hours",
        "Self Study Hours",
        "Official Off Days", // ← BUG 3 FIX: new header
      ];
      const hdrRow = ws.getRow(2);
      COL_HEADERS.forEach((h, i) => {
        const cell = hdrRow.getCell(i + 1);
        cell.value = h;
        cell.font = {
          bold: true,
          color: { argb: "FFFFFFFF" },
          size: 11,
          name: "Calibri",
        };
        cell.fill = solidFill("FF2D5F8A");
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          bottom: { style: "medium", color: { argb: "FF1E3A5F" } },
        };
      });
      hdrRow.height = 20;
      ws.views = [{ state: "frozen", ySplit: 2 }];
      ws.autoFilter = {
        from: { row: 2, column: 1 },
        to: { row: 2, column: 9 },
      };

      if (ebRows.length === 0) {
        ws.mergeCells("A3:I3");
        const emptyCell = ws.getCell("A3");
        emptyCell.value = "No data found for the selected filters.";
        emptyCell.font = {
          italic: true,
          color: { argb: "FF94A3B8" },
          size: 10,
        };
        emptyCell.alignment = { horizontal: "center" };
      } else {
        // Group rows by employee for visual grouping + per-employee subtotals
        const empGroups = [];
        let curGroup = null;
        for (const r of ebRows) {
          if (!curGroup || curGroup.employeeId !== r.employee_id) {
            if (curGroup) empGroups.push(curGroup);
            curGroup = {
              employeeId: r.employee_id,
              rows: [],
            };
          }
          curGroup.rows.push(r);
        }
        if (curGroup) empGroups.push(curGroup);

        let groupToggle = false;

        empGroups.forEach((grp) => {
          groupToggle = !groupToggle;
          // Even group: pale blue identity cols / white data cols
          // Odd group:  light grey identity cols / near-white data cols
          const empBg = groupToggle ? "FFEAF4FF" : "FFF1F5F9";
          const cliBg = groupToggle ? "FFFFFFFF" : "FFF8FAFC";

          let grpBillable = 0;
          let grpNonBillable = 0;
          let grpSelfStudy = 0;
          let grpOfficialOff = 0; // ← BUG 3 FIX
          let grpWorkingDays = 0;

          grp.rows.forEach((r) => {
            const bill = toHrs(r.billable_hours_mins);
            const nonB = toHrs(r.non_billable_hours_mins);
            const self = toHrs(r.self_study_hours_mins);
            const offDay = toHrs(r.official_off_hours_mins); // ← BUG 3 FIX
            const wdays = parseInt(r.working_days, 10);

            grpBillable += bill;
            grpNonBillable += nonB;
            grpSelfStudy += self;
            grpOfficialOff += offDay; // ← BUG 3 FIX
            grpWorkingDays = Math.max(grpWorkingDays, wdays);

            const dataRow = ws.addRow([
              r.employee_code || "",
              r.employee_name || "",
              r.designation || "",
              r.department || "",
              r.client_name || "(No Client)",
              bill,
              nonB,
              self,
              offDay, // ← BUG 3 FIX: 9th column
            ]);
            dataRow.eachCell((cell, colNum) => {
              cell.fill = solidFill(colNum <= 4 ? empBg : cliBg);
              cell.font = { size: 10, name: "Calibri" };
              cell.alignment = {
                vertical: "middle",
                horizontal: colNum >= 6 ? "right" : "left",
              };
              cell.border = hairBdr();
            });
            [6, 7, 8, 9].forEach((c) => {
              dataRow.getCell(c).numFmt = "0.00";
            });
            dataRow.height = 18;
          });

          // Subtotal row — only when employee spans 2+ clients
          if (grp.rows.length > 1) {
            const subRow = ws.addRow([
              "",
              `${grp.rows[0].employee_name} — Total`,
              "",
              "",
              `${grp.rows.length} clients`,
              Math.round(grpBillable * 100) / 100,
              Math.round(grpNonBillable * 100) / 100,
              Math.round(grpSelfStudy * 100) / 100,
              Math.round(grpOfficialOff * 100) / 100, // ← BUG 3 FIX
            ]);
            subRow.eachCell((cell, colNum) => {
              cell.fill = solidFill("FFE0EFFF");
              cell.font = {
                bold: true,
                size: 10,
                name: "Calibri",
                color: { argb: "FF1E3A5F" },
              };
              cell.alignment = {
                vertical: "middle",
                horizontal: colNum >= 6 ? "right" : "left",
              };
              cell.border = {
                top: { style: "thin", color: { argb: "FF2D5F8A" } },
                bottom: { style: "medium", color: { argb: "FF1E3A5F" } },
                left: { style: "hair", color: { argb: "FFCBD5E1" } },
                right: { style: "hair", color: { argb: "FFCBD5E1" } },
              };
            });
            [6, 7, 8, 9].forEach((c) => {
              subRow.getCell(c).numFmt = "0.00";
            });
            subRow.height = 18;
          }
        });

        // Grand total row
        const totBillable = ebRows.reduce(
          (s, r) => s + toHrs(r.billable_hours_mins),
          0,
        );
        const totNonBillable = ebRows.reduce(
          (s, r) => s + toHrs(r.non_billable_hours_mins),
          0,
        );
        const totSelfStudy = ebRows.reduce(
          (s, r) => s + toHrs(r.self_study_hours_mins),
          0,
        );
        const totOfficialOff = ebRows.reduce(
          // ← BUG 3 FIX
          (s, r) => s + toHrs(r.official_off_hours_mins),
          0,
        );

        const grandRow = ws.addRow([
          "",
          "GRAND TOTAL",
          "",
          "",
          `${ebRows.length} rows`,
          Math.round(totBillable * 100) / 100,
          Math.round(totNonBillable * 100) / 100,
          Math.round(totSelfStudy * 100) / 100,
          Math.round(totOfficialOff * 100) / 100, // ← BUG 3 FIX
        ]);
        grandRow.eachCell((cell, colNum) => {
          cell.fill = solidFill("FF1E3A5F");
          cell.font = {
            bold: true,
            size: 11,
            name: "Calibri",
            color: { argb: "FFFFFFFF" },
          };
          cell.alignment = {
            vertical: "middle",
            horizontal: colNum >= 6 ? "right" : "left",
          };
          cell.border = {
            top: { style: "medium", color: { argb: "FF2D5F8A" } },
          };
        });
        [6, 7, 8, 9].forEach((c) => {
          grandRow.getCell(c).numFmt = "0.00";
        });
        grandRow.height = 20;
      }

      const ebBuffer = await workbook.xlsx.writeBuffer();
      const ebFilename = `EmployeeBillable_${dateStr}.xlsx`;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${ebFilename}"`,
      );
      res.setHeader("Content-Length", ebBuffer.length);
      res.end(ebBuffer);
      console.log(
        `[TimesheetReport] Employee-Billable export: ${ebRows.length} rows → ${ebFilename}`,
      );
      return;
    }

    // ════════════════════════════════════════════════════════════════════════
    // HEADER MODE — one row per (client × project × ticket)
    // ════════════════════════════════════════════════════════════════════════
    // Drives from client_master so ALL active clients always appear, even those
    // with no tickets or no DTE entries (they show with 0 hours).
    // Identical query structure as getHeaderPreviewReport.
    // ════════════════════════════════════════════════════════════════════════
    if (exportMode === "header") {
      const hParams = [];
      let hIdx = 1;

      // A. project_master JOIN ON conditions
      const pmJoinConds = [];
      if (projectIds) {
        const uuids = await resolveProjectIds(projectIds);
        if (uuids.length > 0) {
          pmJoinConds.push(`pm.project_id = ANY($${hIdx++}::uuid[])`);
          hParams.push(uuids);
        }
      }
      if (isManager) {
        const scopeIds =
          managerProjectIds.length > 0
            ? managerProjectIds
            : ["00000000-0000-0000-0000-000000000000"];
        pmJoinConds.push(`pm.project_id = ANY($${hIdx++}::uuid[])`);
        hParams.push(scopeIds);
      }

      // B. ticket_master JOIN ON conditions
      const tmJoinConds = [`tm.is_active = TRUE`];
      if (ticketIds) {
        const uuids = await resolveTicketIds(ticketIds);
        if (uuids.length > 0) {
          tmJoinConds.push(`tm.ticket_id = ANY($${hIdx++}::uuid[])`);
          hParams.push(uuids);
        }
      }

      // C. DTE LEFT JOIN ON conditions (entry-level filters)
      const hDteJoin = [];
      if (clientIds) {
        const uuids = clientIds
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (uuids.length > 0) {
          hDteJoin.push(`dte.client_id = ANY($${hIdx++}::uuid[])`);
          hParams.push(uuids);
        }
      }
      if (employeeIds) {
        const uuids = await resolveEmployeeIds(employeeIds);
        if (uuids.length > 0) {
          hDteJoin.push(`dte.employee_id = ANY($${hIdx++}::uuid[])`);
          hParams.push(uuids);
        }
      }
      if (departmentId) {
        hDteJoin.push(`e_h.department = $${hIdx++}`);
        hParams.push(departmentId);
      }
      if (managerId) {
        const uuid = await resolveEmployeeId(managerId);
        if (uuid) {
          hDteJoin.push(`dte.manager_id = $${hIdx++}`);
          hParams.push(uuid);
        }
      }
      if (status) {
        hDteJoin.push(`ts_h.name = $${hIdx++}`);
        hParams.push(status);
      }
      if (fromDate && !toDate) {
        hDteJoin.push(`dte.entry_date = $${hIdx++}`);
        hParams.push(fromDate);
      } else if (fromDate && toDate) {
        hDteJoin.push(
          `dte.entry_date >= $${hIdx++} AND dte.entry_date <= $${hIdx++}`,
        );
        hParams.push(fromDate, toDate);
      } else if (!fromDate && toDate) {
        hDteJoin.push(`dte.entry_date <= $${hIdx++}`);
        hParams.push(toDate);
      }

      // D. client_master WHERE conditions
      const cmWhereConds = [`cm.is_active = TRUE`];
      if (isManager) {
        const scopeIds =
          managerProjectIds.length > 0
            ? managerProjectIds
            : ["00000000-0000-0000-0000-000000000000"];
        cmWhereConds.push(`cm.client_id IN (
          SELECT DISTINCT pm2.client_id
          FROM   project_master pm2
          WHERE  pm2.project_id = ANY($${hIdx++}::uuid[])
            AND  pm2.client_id IS NOT NULL
        )`);
        hParams.push(scopeIds);
      }
      if (clientIds) {
        const uuids = clientIds
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (uuids.length > 0) {
          cmWhereConds.push(`cm.client_id = ANY($${hIdx++}::uuid[])`);
          hParams.push(uuids);
        }
      }

      const pmJoinExtra =
        pmJoinConds.length > 0 ? `AND ${pmJoinConds.join(" AND ")}` : "";
      const tmJoinStr = tmJoinConds.join(" AND ");
      const hJoinExtra =
        hDteJoin.length > 0 ? `AND ${hDteJoin.join(" AND ")}` : "";
      const hWhereClause = `WHERE ${cmWhereConds.join(" AND ")}`;

      const headerQuery = `
        SELECT
          cm.client_id,
          COALESCE(cm.client_name,  '(No Client)')         AS client_name,
          COALESCE(pm.project_name, '(No Project)')        AS project_name,
          COALESCE(pst.name, '')                           AS project_status,
          tm.ticket_name,
          tm.zoho_crm_code                                 AS ticket_code,
          COALESCE(tst.name, '')                           AS ticket_status,
          COALESCE(tm.description, '')                     AS ticket_description,
          COALESCE(tm.approved_hours, 0)                   AS approved_hours_mins,
          COALESCE(SUM(dte.billable_hours),     0)         AS billable_hours_mins,
          COALESCE(SUM(dte.non_billable_hours), 0)         AS non_billable_hours_mins

        FROM client_master cm
        LEFT JOIN project_master pm
               ON pm.client_id = cm.client_id ${pmJoinExtra}
        LEFT JOIN project_status pst ON pst.id = pm.status
        LEFT JOIN ticket_master tm
               ON tm.project_id = pm.project_id AND ${tmJoinStr}
        LEFT JOIN ticket_status tst ON tst.id = tm.status
        LEFT JOIN daily_timesheet_entries dte
               ON dte.ticket_id = tm.ticket_id ${hJoinExtra}
        LEFT JOIN employees        e_h  ON e_h.employee_id = dte.employee_id
        LEFT JOIN timesheet_status ts_h ON ts_h.id         = dte.status

        ${hWhereClause}

        GROUP BY
          cm.client_id,
          cm.client_name,
          pm.project_id,
          pm.project_name,
          pst.name,
          tst.name,
          tm.ticket_id,
          tm.ticket_name,
          tm.zoho_crm_code,
          tm.description,
          tm.approved_hours

        ORDER BY
          cm.client_name  ASC NULLS LAST,
          pm.project_name ASC NULLS LAST,
          tm.ticket_name  ASC NULLS LAST
      `;

      const { rows: hRows } = await pool.query(headerQuery, hParams);

      // ── Build Header workbook ─────────────────────────────────
      const ws = workbook.addWorksheet("Header Report");
      ws.columns = [
        { header: "Client Name", key: "client_name", width: 26 },
        { header: "Client Status", key: "client_status", width: 14 },
        { header: "Project Name", key: "project_name", width: 28 },
        { header: "Project Status", key: "project_status", width: 16 },
        { header: "Ticket", key: "ticket_name", width: 32 },
        { header: "Ticket Status", key: "ticket_status", width: 14 },
        { header: "Ticket Number", key: "ticket_number", width: 18 },
        { header: "Ticket Description", key: "ticket_description", width: 34 },
        { header: "Total Approved Hours", key: "approved_hours", width: 20 },
        { header: "Actual Billable Hours", key: "billable_hours", width: 22 },
        { header: "Non-Billable Hours", key: "non_billable_hours", width: 20 },
      ];

      const hdrRow = ws.getRow(1);
      hdrRow.eachCell((cell) => {
        cell.font = {
          bold: true,
          color: { argb: "FFFFFFFF" },
          size: 11,
          name: "Calibri",
        };
        cell.fill = solidFill("FF1E3A5F");
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          bottom: { style: "thin", color: { argb: "FF2D5F8A" } },
        };
      });
      hdrRow.height = 22;
      ws.views = [{ state: "frozen", ySplit: 1 }];
      ws.autoFilter = { from: "A1", to: "K1" };

      if (hRows.length === 0) {
        const empty = ws.addRow(["No data found for the selected filters."]);
        empty.getCell(1).font = {
          italic: true,
          color: { argb: "FF94A3B8" },
          size: 10,
        };
        empty.getCell(1).alignment = { horizontal: "center" };
        ws.mergeCells("A2:K2");
      } else {
        hRows.forEach((r, i) => {
          const bg = i % 2 === 0 ? "FFFFFFFF" : "FFF0F6FF";
          const row = ws.addRow({
            client_name: r.client_name || "",
            client_status: "Active", // not in DB schema
            project_name: r.project_name || "",
            project_status: r.project_status || "",
            ticket_name: r.ticket_name || "",
            // from ticket_status table (tst.name) — e.g. "In Progress", "Completed"
            ticket_status: r.ticket_status || "",
            ticket_number: r.ticket_code || "",
            // from tm.description (TEXT column on ticket_master)
            ticket_description: r.ticket_description || "",
            // tm.approved_hours is INTEGER MINUTES → convert to decimal hours
            approved_hours: toHrs(r.approved_hours_mins),
            // SUM of DTE billable_hours (INTEGER MINUTES) → decimal hours
            billable_hours: toHrs(r.billable_hours_mins),
            // SUM of DTE non_billable_hours (INTEGER MINUTES) → decimal hours
            non_billable_hours: toHrs(r.non_billable_hours_mins),
          });
          row.eachCell((cell, colNum) => {
            cell.fill = solidFill(bg);
            cell.font = { size: 10, name: "Calibri" };
            cell.alignment = { vertical: "top" };
            cell.border = hairBdr();
          });
          // Numeric format for hour columns (cols 9, 10, 11)
          [9, 10, 11].forEach((c) => {
            row.getCell(c).numFmt = "0.00";
          });
          row.height = 18;
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `TimesheetReport_Header_${dateStr}.xlsx`;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.setHeader("Content-Length", buffer.length);
      res.end(buffer);
      console.log(
        `[TimesheetReport] Header export: ${hRows.length} ticket rows → ${filename}`,
      );
      return;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ITEM MODE — one row per timesheet entry (original format, unchanged)
    // ════════════════════════════════════════════════════════════════════════
    const sheet = workbook.addWorksheet("Timesheet Report");
    sheet.columns = [
      { header: "Date", key: "entry_date", width: 14 },
      { header: "Employee Code", key: "employee_code", width: 16 },
      { header: "Employee Name", key: "employee_name", width: 24 },
      { header: "Designation", key: "employee_designation", width: 20 },
      { header: "Department", key: "employee_department", width: 18 },
      { header: "Client", key: "client_name", width: 22 },
      { header: "Project", key: "project_name", width: 28 },
      { header: "Project Code", key: "project_code", width: 16 },
      { header: "Ticket", key: "ticket_name", width: 28 },
      { header: "Ticket Code", key: "ticket_code", width: 16 },
      { header: "Task", key: "task_name", width: 20 },
      { header: "Hours", key: "total_hours", width: 10 },
      { header: "Billable Hrs", key: "billable_hours", width: 13 },
      { header: "Non-Billable Hrs", key: "non_billable_hours", width: 16 },
      { header: "Status", key: "status", width: 20 },
      { header: "Description", key: "description", width: 36 },
      { header: "Ticket No.", key: "ticket_number", width: 14 },
      { header: "Manager", key: "manager_name", width: 22 },
      { header: "Submitted At", key: "submitted_at", width: 18 },
      { header: "Approved By", key: "approved_by_name", width: 22 },
      { header: "Approved At", key: "approved_at", width: 18 },
      { header: "Rejection Reason", key: "rejection_reason", width: 28 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
        size: 11,
        name: "Calibri",
      };
      cell.fill = solidFill("FF1E3A5F");
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = { bottom: { style: "thin", color: { argb: "FF2D5F8A" } } };
    });
    headerRow.height = 22;
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = {
      from: "A1",
      to: `${String.fromCharCode(64 + sheet.columns.length)}1`,
    };

    const STATUS_COLORS = {
      Draft: "FFE2E8F0",
      Submitted: "FFDBEAFE",
      Manager_Approved: "FFD1FAE5",
      Admin_Approved: "FFA7F3D0",
      Manager_Rejected: "FFFEE2E2",
      Admin_Rejected: "FFFECACA",
      Partially_Approved: "FFFFEDD5",
    };

    rows.forEach((r, i) => {
      const rowBg = i % 2 === 0 ? "FFFFFFFF" : "FFF0F6FF";
      const statusBg = STATUS_COLORS[r.status] || rowBg;

      const row = sheet.addRow({
        entry_date: fmtDate(r.entry_date),
        employee_code: r.employee_code || "",
        employee_name: r.employee_name || "",
        employee_designation: r.employee_designation || "",
        employee_department: r.employee_department || "",
        client_name: r.client_name || "",
        project_name: r.project_name || "",
        project_code: r.project_code || "",
        ticket_name: r.ticket_name || "",
        ticket_code: r.ticket_code || "",
        task_name: r.task_name || "",
        total_hours: toHrs(r.total_hours),
        billable_hours: toHrs(r.billable_hours),
        non_billable_hours: toHrs(r.non_billable_hours),
        status: (r.status || "").replace(/_/g, " "),
        description: r.description || "",
        ticket_number: r.ticket_number || "",
        manager_name: r.manager_name || "",
        submitted_at: fmtDate(r.submitted_at),
        approved_by_name: r.approved_by_name || "",
        approved_at: fmtDate(r.approved_at),
        rejection_reason: r.rejection_reason || "",
      });

      row.eachCell((cell, colNum) => {
        cell.fill = solidFill(colNum === 15 ? statusBg : rowBg);
        cell.font = { size: 10, name: "Calibri" };
        cell.alignment = { vertical: "top", wrapText: colNum === 16 };
        cell.border = hairBdr();
      });
      row.height = 18;
    });

    if (rows.length === 0) {
      const emptyRow = sheet.addRow([
        "No data found for the selected filters.",
      ]);
      emptyRow.getCell(1).font = {
        italic: true,
        color: { argb: "FF94A3B8" },
        size: 10,
      };
      emptyRow.getCell(1).alignment = { horizontal: "center" };
      sheet.mergeCells("A2:V2");
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `TimesheetReport_${dateStr}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    res.end(buffer);
    console.log(
      `[TimesheetReport] Item export: ${rows.length} rows → ${filename}`,
    );
  } catch (error) {
    console.error(
      "[TimesheetReport] exportTimesheetReport error:",
      error.message,
    );
    if (!res.headersSent) {
      return res.status(500).json({ error: error.message || "Export failed" });
    }
  }
};

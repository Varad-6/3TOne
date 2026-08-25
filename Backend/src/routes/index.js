import express from "express";

// ===============================================
// ROUTE MODULE IMPORTS
// ===============================================

// Authentication & Authorization
import authRoutes from "./authRoutes.js";

// Master Data Management
import employeeRoutes from "./employeeRoutes.js";
import clientRoutes from "./clientRoutes.js";

// Project Management
import projectRoutes from "./projectRoutes.js";
import projectAssignmentRoutes from "./projectAssignmentRoutes.js";
import adminProjectAssignmentRoutes from "./adminProjectAssignmentRoutes.js";

// Ticket Management (Formerly Activity)
import ticketRoutes from "./ticketRoutes.js";
import ticketAssignmentRoutes from "./ticketAssignmentRoutes.js"; // ✅ RBA Applied
import managerTicketAssignmentRoutes from "./managerTicketAssignmentRoutes.js"; // ✅ RBA Applied

// Task Management
import taskRoutes from "./taskRoutes.js";

// Timesheet Management
import timesheetEntryRoutes from "./timesheetEntryRoutes.js"; // ✅ RBA Applied

// Reporting & Analytics
import dashboardRoutes from "./dashboardRoutes.js";
import reportRoutes from "./reportRoutes.js";

// System Management
import settingsRoutes from "./settingsRoutes.js";
import auditRoutes from "./auditRoutes.js";
import notificationRoutes from "./notificationRoutes.js";
import exportRoutes from "./exportRoutes.js";
import timesheetReportRoutes from "./timesheetReportRoutes.js";
const router = express.Router();

// ===============================================
// ROUTE REGISTRATIONS
// ===============================================

// ========================================
// 🔐 Authentication & Authorization
// ========================================
// Public routes - No authentication required

router.use((req, res, next) => {
  console.log("** Request Received **");

  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

router.use("/auth", authRoutes);

// ========================================
// 👥 Master Data Management
// ========================================
// Protected routes - Authentication required in individual route files
router.use("/employees", employeeRoutes);
router.use("/clients", clientRoutes);

// ========================================
// 📋 Project Management
// ========================================
router.use("/projects", projectRoutes);
router.use("/project-assignments", projectAssignmentRoutes);

// Admin assigns managers to projects
// 🔒 Security: Admin only access
router.use("/admin-project-assignments", adminProjectAssignmentRoutes);

// ========================================
// 🎫 Ticket Management (Formerly Activity)
// ========================================
router.use("/tickets", ticketRoutes);

// Admin/Manager ticket assignment routes
// 🔒 Security: Role-based assignment logic
//   - Admin → Employee assignments (ticket_assignments)
//   - Admin → Manager assignments (ticket_manager_scope)
//   - Manager → Employee assignments (ticket_assignments)
//   - Manager → Self-assignment (ticket_manager_scope)
// ✅ NEW ENDPOINTS:
//   - GET /all-assignees - Returns all employees + managers (Admin only)
//   - GET /ticket/:ticketId/managers - Returns manager assignments
//   - DELETE /manager-scope/:scopeId - Removes manager assignment (Admin only)
router.use("/ticket-assignments", ticketAssignmentRoutes);

// Manager-specific ticket assignment routes
// 🔒 Security: Full RBA with project ownership validation
//   - validateSelfOrAdmin: Manager can only see own data
//   - validateAssignmentAuthority: Manager must own project
// ✅ NEW ENDPOINTS:
//   - GET /ticket/:ticketId/managers - Returns manager assignments
//   - DELETE /scope/:scopeId - Removes manager assignment (Manager can unassign self)
router.use("/manager-ticket-assignments", managerTicketAssignmentRoutes);

// ========================================
// ✅ Task Management
// ========================================
// Internal task definitions for non-project work
router.use("/tasks", taskRoutes);

// ========================================
// ⏱️  Timesheet Management
// ========================================
// 🔒 Security: Full RBA implemented
//   - validateTimesheetOwnership: Users can only edit own entries
//   - validateApprovalAuthority: Managers approve only their projects
//   - Role-based data filtering in controllers
router.use("/timesheet-entries", timesheetEntryRoutes);

// ========================================
// 📊 Reporting & Analytics
// ========================================
router.use("/dashboard", dashboardRoutes);
router.use("/reports", reportRoutes);

// ========================================
// ⚙️  System Management
// ========================================
router.use("/settings", settingsRoutes);
router.use("/audit", auditRoutes);
router.use("/notifications", notificationRoutes);

// ========================================
// ⚙️  Export Routes
// ========================================
router.use("/export", exportRoutes);

router.use("/timesheet-report", timesheetReportRoutes);
// ===============================================
// DEVELOPMENT MODE - ROUTE LOGGING
// ===============================================
if (process.env.NODE_ENV === "development") {
  console.log("\n🔐 API Routes Registered with Security:");
  console.log("   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   🔓 Public Routes:");
  console.log("     ✓ POST /api/auth/login");
  console.log("     ✓ POST /api/auth/refresh-token");
  console.log("");
  console.log("   🔒 Protected Routes (Authentication Required):");
  console.log("");
  console.log("   👥 Master Data");
  console.log("     ✓ /api/employees");
  console.log("     ✓ /api/clients");
  console.log("");
  console.log("   📋 Project Management");
  console.log("     ✓ /api/projects");
  console.log("     ✓ /api/project-assignments");
  console.log("     🔐 /api/admin-project-assignments [ADMIN only]");
  console.log("");
  console.log("   🎫 Ticket Management");
  console.log("     ✓ /api/tickets");
  console.log(
    "     🔐 /api/tickets/manager/projects-tickets [MANAGER - Manage Tickets page]"
  );
  console.log("");
  console.log("   🎫 Ticket Assignment Routes");
  console.log(
    "     🔐 /api/ticket-assignments [RBA: Admin/Manager assignment logic]"
  );
  console.log("       • POST /assign-employee - Assign to employee or manager");
  console.log("       • GET /:ticketId - Get employee assignments");
  console.log(
    "       • GET /ticket/:ticketId/managers - Get manager assignments ✅ NEW"
  );
  console.log(
    "       • GET /all-assignees - Get all employees + managers (Admin) ✅ NEW"
  );
  console.log("       • DELETE /:assignmentId - Remove employee assignment");
  console.log(
    "       • DELETE /manager-scope/:scopeId - Remove manager assignment (Admin) ✅ NEW"
  );
  console.log("");
  console.log(
    "     🔐 /api/manager-ticket-assignments [RBA: Manager assignment page]"
  );
  console.log(
    "       • GET /:managerId/projects-with-tickets - Get assignable tickets"
  );
  console.log("       • GET /:managerId/employees - Get employees + self");
  console.log("       • POST /assign - Assign to employees or self");
  console.log(
    "       • GET /ticket/:ticketId/assignments - Get employee assignments"
  );
  console.log(
    "       • GET /ticket/:ticketId/managers - Get manager assignments ✅ NEW"
  );
  console.log(
    "       • DELETE /assignments/:assignmentId - Remove employee assignment"
  );
  console.log(
    "       • DELETE /scope/:scopeId - Remove manager assignment (Self-unassign) ✅ NEW"
  );
  console.log("");
  console.log("   ✅ Task Management");
  console.log("     ✓ /api/tasks");
  console.log("");
  console.log("   ⏱️  Timesheet Management");
  console.log(
    "     🔐 /api/timesheet-entries [RBA: Full ownership & approval validation]"
  );
  console.log("       • GET /projects - Role-based project filtering");
  console.log("       • GET /my-tickets - Role-based ticket filtering");
  console.log("       • POST / - Create entry (validates ticket assignment)");
  console.log("       • PUT /:id - Update (validates ownership + status)");
  console.log(
    "       • POST /approve-reject-week - Approve (validates manager authority)"
  );
  console.log("");
  console.log("   📊 Reporting & Analytics");
  console.log("     ✓ /api/dashboard");
  console.log("     ✓ /api/reports");
  console.log("");
  console.log("   ⚙️  System Management");
  console.log("     ✓ /api/settings");
  console.log("     ✓ /api/audit");
  console.log("     ✓ /api/notifications");
  console.log("");
  console.log("   🛡️  Security Layers:");
  console.log("     1️⃣  authenticateToken - JWT validation");
  console.log(
    "     2️⃣  authorize() - Role-based access (ADMIN/MANAGER/EMPLOYEE)"
  );
  console.log("     3️⃣  validateXXX() - Resource-level permissions");
  console.log("     4️⃣  Controller logic - Business rule enforcement");
  console.log("");
  console.log("   📋 Assignment Tables:");
  console.log("     • ticket_assignments - Employee assignments");
  console.log("     • ticket_manager_scope - Manager assignments");
  console.log("");
  console.log("   📋 Manager Three Pages:");
  console.log("     1️⃣  My Tickets - GET /api/timesheet-entries/my-tickets");
  console.log("        → Shows tickets from ticket_manager_scope");
  console.log(
    "     2️⃣  Manage Tickets - GET /api/tickets/manager/projects-tickets"
  );
  console.log("        → Shows ALL tickets in assigned projects");
  console.log(
    "     3️⃣  Assign Tickets - GET /api/manager-ticket-assignments/:id/projects-with-tickets"
  );
  console.log("        → Shows tickets EXCLUDING ticket_manager_scope");
  console.log("");
  console.log("   ✅ Admin Assignment Page:");
  console.log("     • Can assign to ALL employees + ALL managers");
  console.log("     • GET /api/ticket-assignments/all-assignees");
  console.log("     • POST /api/ticket-assignments/assign-employee");
  console.log("     • Employees → ticket_assignments table");
  console.log("     • Managers → ticket_manager_scope table");
  console.log("       Admin timesheet report routes:");

  console.log("     • Export Routes:");

  console.log("   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

// ===============================================
// HEALTH CHECK ROUTE
// ===============================================
router.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    securityLayers: {
      authentication: "JWT Token",
      roleBasedAccess: "ADMIN | MANAGER | EMPLOYEE",
      resourceValidation: "Project/Ticket ownership",
      auditLogging: "Enabled",
    },
    assignmentTables: {
      employeeAssignments: "ticket_assignments",
      managerAssignments: "ticket_manager_scope",
    },
    managerPages: {
      myTickets: "/api/timesheet-entries/my-tickets",
      manageTickets: "/api/tickets/manager/projects-tickets",
      assignTickets:
        "/api/manager-ticket-assignments/:id/projects-with-tickets",
    },
    adminPages: {
      assignTickets: {
        getAllAssignees: "/api/ticket-assignments/all-assignees",
        assignToUser: "/api/ticket-assignments/assign-employee",
        getEmployeeAssignments: "/api/ticket-assignments/:ticketId",
        getManagerAssignments:
          "/api/ticket-assignments/ticket/:ticketId/managers",
        removeEmployeeAssignment: "/api/ticket-assignments/:assignmentId",
        removeManagerAssignment:
          "/api/ticket-assignments/manager-scope/:scopeId",
          timesheetReportRoutes: {
            filterOptions: "/api/timesheet-report/filter-options",
            groupedReport: "/api/timesheet-report/grouped",
            employeeSummary: "/api/timesheet-report/employee-summary",
            projectSummary: "/api/timesheet-report/project-summary",
      },
    },
    },
  });
});

export default router;

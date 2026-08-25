import express from "express";
import {
  assignProjectToManagers,
  assignTicketsToManager, // Renamed from assignActivitiesToManager
  getProjectAssignments,
  removeProjectAssignment,
  getManagerProjects,
  getManagerProjectsWithTickets, // Renamed from getManagerProjectsWithActivities
  getManagerTicketsForProject, // Renamed from getManagerActivitiesForProject
  removeTicketFromManager, // Renamed from removeActivityFromManager
  getEmployeeProjects,
  getAllAssignmentsWithTickets, // Renamed from getAllAssignmentsWithActivities
  removeProjectManagerAssignment,
} from "../controllers/projectAssignmentController.js";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// ========================================
// ADMIN ROUTES - Project & Scope Assignments
// ========================================

// Get all assignments with ticket counts
router.get(
  "/all-with-tickets", // Renamed path
  authenticateToken,
  authorizeRoles(["ADMIN"]),
  getAllAssignmentsWithTickets
);

// STEP 1: Assign project to multiple managers
router.post(
  "/assign-managers",
  authenticateToken,
  authorizeRoles(["ADMIN"]),
  assignProjectToManagers
);

// STEP 2: Assign specific tickets to a manager (define scope)
router.post(
  "/assign-tickets", // Renamed path
  authenticateToken,
  authorizeRoles(["ADMIN"]),
  assignTicketsToManager
);

// Get all assignments for a project
router.get(
  "/project/:projectId",
  authenticateToken,
  authorizeRoles(["ADMIN"]),
  getProjectAssignments
);

// Get manager's tickets for a specific project
router.get(
  "/project/:projectId/manager/:managerId/tickets", // Renamed path
  authenticateToken,
  authorizeRoles(["ADMIN", "MANAGER"]),
  getManagerTicketsForProject
);

// Remove ticket from manager's scope
router.delete(
  "/ticket/:ticketId/manager/:managerId", // Renamed path
  authenticateToken,
  authorizeRoles(["ADMIN"]),
  removeTicketFromManager
);

// Remove project-manager assignment (cascades to scope)
router.delete(
  "/project/:projectId/manager/:managerId",
  authenticateToken,
  authorizeRoles(["ADMIN"]),
  removeProjectManagerAssignment
);

// Remove a project assignment (by assignment ID)
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles(["ADMIN"]),
  removeProjectAssignment
);

// ========================================
// MANAGER ROUTES - View Assigned Projects & Tickets
// ========================================

// Get manager's assigned projects (summary view)
router.get(
  "/manager/:managerId/projects",
  authenticateToken,
  authorizeRoles(["ADMIN", "MANAGER"]),
  getManagerProjects
);

// Get manager's assigned projects WITH tickets (filtered by ticket_manager_scope)
router.get(
  "/manager/:managerId/projects-with-tickets", // Renamed path
  authenticateToken,
  authorizeRoles(["ADMIN", "MANAGER"]),
  getManagerProjectsWithTickets
);

// ========================================
// EMPLOYEE ROUTES - View Assigned Projects
// ========================================

// Get employee's assigned projects
router.get(
  "/employee/:employeeId/projects",
  authenticateToken,
  authorizeRoles(["ADMIN", "MANAGER", "EMPLOYEE"]),
  getEmployeeProjects
);

export default router;

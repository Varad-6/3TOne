import express from "express";
import {
  getAllActiveProjects,
  getTicketsByProject, // Renamed from getActivitiesByProject
  assignProjectsToManagers,
  assignTicketsToManager, // Renamed from assignActivitiesToManager
  getAllAssignmentsWithTickets, // Renamed from getAllAssignmentsWithActivities
  removeProjectManagerAssignment,
  deleteProjectManagerAssignment,
  getManagerAssignments,
} from "../controllers/adminProjectAssignmentController.js";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// ============================
// ADMIN ROUTES (ADMIN Only)
// ============================

router.get(
  "/projects",
  authenticateToken,
  authorizeRoles(["ADMIN"]),
  getAllActiveProjects
);

// ✅ Renamed Route: Get Tickets for a Project
router.get(
  "/tickets/project/:projectId",
  authenticateToken,
  authorizeRoles(["ADMIN"]),
  getTicketsByProject
);

router.post(
  "/assign-projects",
  authenticateToken,
  authorizeRoles(["ADMIN"]),
  assignProjectsToManagers
);

// ✅ Renamed Route: Assign Tickets to Manager
router.post(
  "/assign-tickets",
  authenticateToken,
  authorizeRoles(["ADMIN"]),
  assignTicketsToManager
);

router.get(
  "/assignments",
  authenticateToken,
  authorizeRoles(["ADMIN"]),
  getAllAssignmentsWithTickets
);

router.delete(
  "/project/:projectId/manager/:managerId",
  authenticateToken,
  authorizeRoles(["ADMIN"]),
  removeProjectManagerAssignment
);

router.delete(
  "/assignment/:assignmentId",
  authenticateToken,
  authorizeRoles(["ADMIN"]),
  deleteProjectManagerAssignment
);

// ============================
// MANAGER ROUTES (ADMIN + MANAGER)
// ============================

// Manager's assigned projects and tickets
router.get(
  "/manager/:managerId/assignments",
  authenticateToken,
  authorizeRoles(["ADMIN", "MANAGER"]),
  getManagerAssignments
);

export default router;

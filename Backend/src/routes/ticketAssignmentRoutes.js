import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import {
  authorize,
  validateAssignmentAuthority,
} from "../middleware/roleAuthMiddleware.js";
import {
  assignTicketToEmployee,
  getAssignmentsByTicket,
  getManagerAssignmentsForTicket,
  unassignEmployee,
  getAssigneesForProject, // ✅ UPDATED: Now used by both Admin and Manager
  getAllAssigneesForAdmin, // ✅ Now project-aware (requires projectId)
  removeManagerScope,
  updateTicketAssignment,
  updateManagerScopeHours,
} from "../controllers/ticketAssignmentController.js";

const router = express.Router();

// ============================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================
router.use(authenticateToken);

// ============================================
// TICKET ASSIGNMENT ROUTES (Admin & Manager)
// ============================================

router.get("/all-assignees", authorize("ADMIN"), getAllAssigneesForAdmin);

router.get("/assignees", authorize("ADMIN", "MANAGER"), getAssigneesForProject);

router.get(
  "/ticket/:ticketId/managers",
  authorize("ADMIN", "MANAGER"),
  getManagerAssignmentsForTicket
);

router.delete(
  "/manager-scope/:scopeId",
  authorize("ADMIN"),
  removeManagerScope
);

router.post(
  "/assign-employee",
  authorize("ADMIN", "MANAGER"),
  validateAssignmentAuthority,
  assignTicketToEmployee
);

router.get("/:ticketId", authorize("ADMIN", "MANAGER"), getAssignmentsByTicket);

router.patch(
  "/:assignmentId",
  authorize("ADMIN"),
  updateTicketAssignment
);

router.delete(
  "/:assignmentId",
  authorize("ADMIN"),
  unassignEmployee
);

router.patch(
  "/manager-scope/:scopeId",
  authorize("ADMIN","MANAGER"),
  updateManagerScopeHours
);

export default router;

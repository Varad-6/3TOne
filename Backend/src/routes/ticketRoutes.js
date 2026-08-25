import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleAuthMiddleware.js";
import {
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicket,
  deleteTicket,
  getTicketsByProject,
  getManagerProjectTickets,
  reactivateTicket,
  getAllTicketStatuses,
  getManagerTicketsForExport,
  // Hours approval flow
  getHoursUpdateRequests,
  approveHoursRequest,
  rejectHoursRequest,
  getProjectBudgetInfo,
} from "../controllers/ticketController.js";

const router = express.Router();

// ========================================
// SPECIFIC ROUTES FIRST (before /:id)
// ========================================

// Get all ticket statuses (for dropdowns) — all authenticated users
router.get("/statuses", authenticateToken, getAllTicketStatuses);

// Manager — ALL tickets in their assigned projects
router.get(
  "/manager/projects-tickets",
  authenticateToken,
  authorize("MANAGER"),
  getManagerProjectTickets,
);

// Manager — Export tickets as Excel data
router.get(
  "/manager/export",
  authenticateToken,
  authorize("MANAGER"),
  getManagerTicketsForExport,
);

// ─────────────────────────────────────────────────────
// HOURS APPROVAL FLOW (Admin manage, Manager view own)
// ─────────────────────────────────────────────────────

// GET  /tickets/hours-requests          → list (Admin sees all; Manager sees own)
router.get(
  "/hours-requests",
  authenticateToken,
  authorize("ADMIN", "MANAGER"),
  getHoursUpdateRequests,
);

// PATCH /tickets/hours-requests/:requestId/approve  → Admin only
router.patch(
  "/hours-requests/:requestId/approve",
  authenticateToken,
  authorize("ADMIN"),
  approveHoursRequest,
);

// PATCH /tickets/hours-requests/:requestId/reject   → Admin only
router.patch(
  "/hours-requests/:requestId/reject",
  authenticateToken,
  authorize("ADMIN"),
  rejectHoursRequest,
);

// GET /tickets/:id/budget-info  → budget remaining for a ticket's project
router.get("/:id/budget-info", authenticateToken, getProjectBudgetInfo);

// Get tickets by project (scoped by role)
router.get("/project/:projectId", authenticateToken, getTicketsByProject);

// Reactivate ticket (ADMIN & MANAGER) — before /:id
router.patch(
  "/:id/reactivate",
  authenticateToken,
  authorize("ADMIN", "MANAGER"),
  reactivateTicket,
);

// ========================================
// GENERAL ROUTES
// ========================================

router.get("/", authenticateToken, getAllTickets);
router.get("/:id", authenticateToken, getTicketById);

router.post(
  "/",
  authenticateToken,
  authorize("ADMIN", "MANAGER"),
  createTicket,
);

router.put(
  "/:id",
  authenticateToken,
  authorize("ADMIN", "MANAGER"),
  updateTicket,
);

router.delete(
  "/:id",
  authenticateToken,
  authorize("ADMIN", "MANAGER"),
  deleteTicket,
);

export default router;

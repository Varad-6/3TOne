import express from "express";
import {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  reactivateClient, // ✅ NEW: Import reactivate function
} from "../controllers/clientController.js";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// ========================================
// SPECIFIC ROUTES FIRST (before /:id)
// ========================================

// ✅ NEW: Reactivate client (ADMIN only)
// Must be before /:id routes to avoid conflict
router.patch(
  "/:id/reactivate",
  authenticateToken,
  authorizeRoles("ADMIN"),
  reactivateClient
);

// ========================================
// GENERAL ROUTES
// ========================================

// Get all clients
router.get("/", authenticateToken, getAllClients);

// Get client by ID
router.get("/:id", authenticateToken, getClientById);

// Create client (ADMIN only)
router.post("/", authenticateToken, authorizeRoles("ADMIN"), createClient);

// Update client (ADMIN only)
router.put("/:id", authenticateToken, authorizeRoles("ADMIN"), updateClient);

// Delete client (ADMIN only)
router.delete("/:id", authenticateToken, authorizeRoles("ADMIN"), deleteClient);

export default router;

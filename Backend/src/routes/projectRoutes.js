import express from "express";
import {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getProjectsByClient,
  reactivateProject, // ✅ NEW: Import reactivate function
} from "../controllers/projectController.js";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// ========================================
// PROJECT MASTER CRUD ONLY
// (No assignment logic here)
// ========================================

// ========================================
// SPECIFIC ROUTES FIRST (before /:id)
// ========================================

// Get projects by client
router.get("/client/:clientId", authenticateToken, getProjectsByClient);

// ✅ NEW: Reactivate project (ADMIN only)
// Must be before /:id routes to avoid conflict
router.patch(
  "/:id/reactivate",
  authenticateToken,
  authorizeRoles(["ADMIN"]),
  reactivateProject
);

// ========================================
// GENERAL ROUTES
// ========================================

// Get all projects (with optional filters: clientId, status, isActive)
router.get("/", authenticateToken, getAllProjects);

// Get project by ID
router.get("/:id", authenticateToken, getProjectById);

// Create project (admin only)
router.post("/", authenticateToken, authorizeRoles(["ADMIN"]), createProject);

// Update project (admin only)
router.put("/:id", authenticateToken, authorizeRoles(["ADMIN"]), updateProject);

// Delete project (admin only)
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles(["ADMIN"]),
  deleteProject
);

export default router;

import express from "express";
import {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getManagers,
  getEmployeesByManager,
  getDepartments,
  reactivateEmployee, // ✅ NEW: Import reactivate function
} from "../controllers/employeeController.js";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/authMiddleware.js";
import protectSuperAdmin from "../middleware/protectSuperAdmin.js"; // ✅ NEW LINE

const router = express.Router();

// All employee routes require auth
router.use(authenticateToken);

// ========================================
// SPECIFIC ROUTES FIRST (before /:id)
// ========================================

// ✅ Get all departments (for dropdowns)
// Must be before /:id routes
router.get(
  "/departments",
  authorizeRoles(["ADMIN", "MANAGER"]),
  getDepartments
);

// Get all managers
router.get("/managers", authorizeRoles(["ADMIN", "MANAGER"]), getManagers);

// Get employees under a specific manager (TEAM MEMBERS)
router.get(
  "/manager/:managerId",
  authorizeRoles(["ADMIN", "MANAGER"]),
  getEmployeesByManager
);

// ✅ NEW: Reactivate employee (ADMIN only)
// Must be before /:id routes to avoid conflict
router.patch("/:id/reactivate", authorizeRoles(["ADMIN"]), reactivateEmployee);

router.patch(
  "/:id/deactivate",
  authorizeRoles(["ADMIN"]),
  protectSuperAdmin, // ✅ Protection middleware
  deleteEmployee
);

// ========================================
// GENERAL ROUTES
// ========================================

// List employees (ADMIN, MANAGER)
router.get("/", authorizeRoles(["ADMIN", "MANAGER"]), getAllEmployees);

// Get employees by id (any authenticated)
router.get("/:id", getEmployeeById);

// Create employee (ADMIN)
router.post("/", authorizeRoles(["ADMIN"]), createEmployee);

// Update employee (ADMIN)
router.put("/:id", authorizeRoles(["ADMIN"]), updateEmployee);

// Deactivate employee (ADMIN)
router.delete(
  "/:id",
  authorizeRoles(["ADMIN"]),
  protectSuperAdmin, // ✅ ADD THIS LINE
  deleteEmployee
);

export default router;

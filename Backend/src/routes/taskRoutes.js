import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import * as taskController from "../controllers/taskController.js";

const router = express.Router();

// =================================================
// GET ROUTES
// =================================================

// Get distinct departments for dropdown
router.get("/departments", authenticateToken, taskController.getDepartments);

// ✅ NEW: Get tasks filtered by department AND project (for timesheet with project-based filtering)
router.get(
  "/by-department-and-project",
  authenticateToken,
  taskController.getTasksByDepartmentAndProject,
);

// ✅ Route alias for backwards compatibility
router.get(
  "/by-departmentId",
  authenticateToken,
  taskController.getTasksByDepartment
);

// Get tasks filtered by department (for timesheet)
router.get(
  "/by-department",
  authenticateToken,
  taskController.getTasksByDepartment
);

// =================================================
// SPECIFIC ROUTES (before /:id)
// =================================================

// ✅ NEW: Reactivate task (ADMIN & MANAGER)
// Must be before /:id routes to avoid conflict
router.patch(
  "/:id/reactivate",
  authenticateToken,
  taskController.reactivateTask
);

// =================================================
// GENERAL ROUTES
// =================================================

// Get all tasks (for admin grid)
router.get("/", authenticateToken, taskController.getAllTasks);

// =================================================
// CRUD ROUTES (Admin)
// =================================================

// Create a new task
router.post("/", authenticateToken, taskController.createTask);

// Update an existing task
router.put("/:id", authenticateToken, taskController.updateTask);

// Delete a task
router.delete("/:id", authenticateToken, taskController.deleteTask);

export default router;

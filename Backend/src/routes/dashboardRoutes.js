import express from "express";

import {
  getEmployeeDashboard,
  getManagerDashboard,
  getAdminDashboard,
  getPendingTimesheets,
  getTimesheetEntries,
  approveTimesheet,
  rejectTimesheet,
  getTimesheetHistory,
  getTeamMembersCount, // ADD
  getPendingApprovalsCount, // ADD
  getApprovedThisWeekCount, // ADD
  getTeamHoursThisWeek, // ADD
  getTeamSubmissionProgress, // ADD
} from "../controllers/dashboardController.js";

import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// ===== Employee Dashboard =====
router.get(
  "/employee",
  authenticateToken,
  authorizeRoles(["EMPLOYEE", "MANAGER", "ADMIN"]),
  getEmployeeDashboard
);

// ===== Manager Dashboard =====
router.get(
  "/manager",
  authenticateToken,
  authorizeRoles(["MANAGER", "ADMIN"]),
  getManagerDashboard
);

// ===== Admin Dashboard =====
router.get(
  "/admin",
  authenticateToken,
  authorizeRoles(["ADMIN"]),
  getAdminDashboard
);

// ===== Get Pending Timesheets =====
router.get(
  "/pending-timesheets",
  authenticateToken,
  authorizeRoles(["MANAGER", "ADMIN"]),
  getPendingTimesheets
);

// ===== Get Timesheet Entries =====
router.get(
  "/timesheets/:timesheetId/entries",
  authenticateToken,
  authorizeRoles(["EMPLOYEE", "MANAGER", "ADMIN"]),
  getTimesheetEntries
);

// ===== Approve Timesheet =====
router.put(
  "/approve/:timesheetId",
  authenticateToken,
  authorizeRoles(["MANAGER", "ADMIN"]),
  approveTimesheet
);

// ===== Reject Timesheet =====
router.put(
  "/reject/:timesheetId",
  authenticateToken,
  authorizeRoles(["MANAGER", "ADMIN"]),
  rejectTimesheet
);

// ===== Get Timesheet History =====
router.get(
  "/timesheet-history",
  authenticateToken,
  authorizeRoles(["EMPLOYEE", "MANAGER", "ADMIN"]),
  getTimesheetHistory
);

// ===== ADD THESE 5 NEW ROUTES =====
router.get(
  "/team-count",
  authenticateToken,
  authorizeRoles(["MANAGER", "ADMIN"]),
  getTeamMembersCount
);

router.get(
  "/pending-approvals-count",
  authenticateToken,
  authorizeRoles(["MANAGER", "ADMIN"]),
  getPendingApprovalsCount
);

router.get(
  "/approved-this-week-count",
  authenticateToken,
  authorizeRoles(["MANAGER", "ADMIN"]),
  getApprovedThisWeekCount
);

router.get(
  "/team-hours-this-week",
  authenticateToken,
  authorizeRoles(["MANAGER", "ADMIN"]),
  getTeamHoursThisWeek
);

router.get(
  "/team-submission-progress",
  authenticateToken,
  authorizeRoles(["MANAGER", "ADMIN"]),
  getTeamSubmissionProgress
);

export default router;

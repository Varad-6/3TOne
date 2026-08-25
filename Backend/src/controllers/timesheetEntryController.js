import * as entryController from "./timesheet/entryController.js";
import * as approvalController from "./timesheet/approvalController.js";
import * as lookupController from "./timesheet/lookupController.js";

// Re-export individual functions for named imports
export const {
  createEntry,
  getEntriesByDateRange,
  updateEntry,
  deleteEntry,
  getTimesheetHistory,
  getWeekStatus,
  // ✅ NEW: Recalculation endpoints
  recalculateAssignmentEntries,
  recalculateTicketEntries,
  getAffectedEntriesPreview,
} = entryController;

export const {
  submitWeek,
  approveRejectWeek,
  getPendingApprovals,
  getAllPendingApprovals,
} = approvalController;

export const {
  getAssignedProjectsForTimesheet,
  getAssignedTicketsForTimesheet, // per-project tickets
  getEmployeeAssignedTickets, // unified My Tickets logic
  getAllDepartments,
} = lookupController;

// NEW: My Tickets endpoint
export const getMyTickets = async (req, res) => {
  return lookupController.getEmployeeAssignedTickets(req, res);
};

// Default export aggregating everything
export default {
  ...entryController,
  ...approvalController,
  ...lookupController,
  getMyTickets,
};

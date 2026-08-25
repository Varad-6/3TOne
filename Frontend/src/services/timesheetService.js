import api from "./api";

// Status mapping constant (outside class)
const TIMESHEET_STATUS_ID_MAP = {
  Draft: 1,
  Submitted: 2,
  Pending_Admin: 3,
  Manager_Approved: 4,
  Manager_Rejected: 5,
  Admin_Approved: 6,
  Admin_Rejected: 7,
};

class TimesheetService {
  // =========================================================================
  // TIMESHEET ENTRY METHODS
  // =========================================================================

  /**
   * Get entries by date range
   * ✅ UPDATED: Now includes assigned_hours per entry
   * @param {string} startDate - YYYY-MM-DD format
   * @param {string} endDate - YYYY-MM-DD format
   * @returns {Promise<{entries: Array}>} Entries with assigned_hours
   */
  async getEntriesByDateRange(startDate, endDate) {
    try {
      const response = await api.get("/timesheet-entries/by-date-range", {
        params: { startDate, endDate },
      });

      // ✅ Log assigned_hours for debugging
      if (response.data?.entries?.length > 0) {
        console.log(
          `✅ Fetched ${response.data.entries.length} entries with assigned_hours:`,
          response.data.entries.map((e) => ({
            entry_id: e.entry_id,
            hours_logged: e.hours_logged,
            assigned_hours: e.assigned_hours,
          }))
        );
      }

      return response.data;
    } catch (error) {
      console.error("getEntriesByDateRange error:", error);
      throw error;
    }
  }

  /**
   * Create new or update existing entry
   * ✅ UPDATED: Response includes assigned_hours
   * @param {Object} data - Entry data
   * @returns {Promise<{entry: Object, isMerge: boolean}>}
   */
  async createTimesheetEntry(data) {
    try {
      const response = await api.post("/timesheet-entries", data);

      // ✅ Log assigned_hours in response
      if (response.data?.entry) {
        console.log(
          `✅ Created entry with assigned_hours: ${
            response.data.entry.assigned_hours || 0
          }h`
        );
      }

      return response.data;
    } catch (error) {
      console.error("createTimesheetEntry error:", error);
      throw error;
    }
  }

  /**
   * Update entry by ID
   * ✅ UPDATED: Preserves assigned_hours
   * @param {number} id - Entry ID
   * @param {Object} data - Update data
   * @returns {Promise<{entry: Object}>}
   */
  async updateTimesheetEntry(id, data) {
    try {
      const response = await api.put(`/timesheet-entries/${id}`, data);

      // ✅ Log assigned_hours preservation
      if (response.data?.entry) {
        console.log(
          `✅ Updated entry, assigned_hours preserved: ${
            response.data.entry.assigned_hours || 0
          }h`
        );
      }

      return response.data;
    } catch (error) {
      console.error("updateTimesheetEntry error:", error);
      throw error;
    }
  }

  // Delete entry
  async deleteTimesheetEntry(id) {
    try {
      await api.delete(`/timesheet-entries/${id}`);
    } catch (error) {
      console.error("deleteTimesheetEntry error:", error);
      throw error;
    }
  }

  // Submit week
  async submitWeek(weekStart, weekEnd) {
    try {
      const response = await api.post("/timesheet-entries/submit-week", {
        weekStart,
        weekEnd,
      });
      return response.data;
    } catch (error) {
      console.error("submitWeek error:", error);
      throw error;
    }
  }

  // =========================================================================
  // DASHBOARD METHODS (MANAGER-LEVEL COUNTS)
  // =========================================================================

  async getTeamMembersCount() {
    try {
      const response = await api.get("/dashboard/team-count");
      return response.data.count || 0;
    } catch (error) {
      console.error("getTeamMembersCount error:", error);
      return 0;
    }
  }

  async getPendingApprovalsCount() {
    try {
      const response = await api.get("/dashboard/pending-approvals-count");
      return response.data.count || 0;
    } catch (error) {
      console.error("getPendingApprovalsCount error:", error);
      return 0;
    }
  }

  async getApprovedThisWeekCount() {
    try {
      const response = await api.get("/dashboard/approved-this-week-count");
      return response.data.count || 0;
    } catch (error) {
      console.error("getApprovedThisWeekCount error:", error);
      return 0;
    }
  }

  async getTeamHoursThisWeek() {
    try {
      const response = await api.get("/dashboard/team-hours-this-week");
      return response.data.totalHours || 0;
    } catch (error) {
      console.error("getTeamHoursThisWeek error:", error);
      return 0;
    }
  }

  async getTeamSubmissionProgress() {
    try {
      const response = await api.get("/dashboard/team-submission-progress");
      return response.data.progress || [];
    } catch (error) {
      console.error("getTeamSubmissionProgress error:", error);
      return [];
    }
  }

  // =========================================================================
  // WEEKLY APPROVAL METHODS (MANAGER & ADMIN)
  // =========================================================================

  /**
   * Get weekly pending approvals (grouped by week).
   * ✅ UPDATED: Now includes total_assigned_hours for billable calculation
   * @param {string} status - Status filter (e.g., "Submitted", "Pending_Admin")
   * @returns {Promise<Array>} Weekly timesheets with total_assigned_hours
   */
  async getPendingApprovals(status = null) {
    try {
      const params = {};
      if (status && status !== "ALL") {
        params.status = status;
      }

      const response = await api.get("/timesheet-entries/pending-approvals", {
        params,
        skipCache: true,
      });

      const weekly = response.data?.pendingApprovals;
      if (Array.isArray(weekly)) {
        // ✅ Log total_assigned_hours for debugging
        if (weekly.length > 0) {
          console.log(
            `✅ Fetched ${weekly.length} approvals with total_assigned_hours:`,
            weekly.map((w) => ({
              employee_name: w.employee_name,
              total_hours: w.total_hours,
              total_assigned_hours: w.total_assigned_hours,
            }))
          );
        }
        return weekly;
      }

      console.warn(
        "getPendingApprovals(): No valid array returned. Raw:",
        response.data
      );
      return [];
    } catch (error) {
      console.error("getPendingApprovals error:", error);
      throw error;
    }
  }

  /**
   * Approve week (Manager/Admin)
   * @param {string} employeeId - Employee ID
   * @param {string} weekStart - YYYY-MM-DD format
   * @param {string} weekEnd - YYYY-MM-DD format
   * @param {string} comments - Optional comments
   */
  async approveWeek(employeeId, weekStart, weekEnd, comments) {
    try {
      const response = await api.post(
        "/timesheet-entries/approve-reject-week",
        {
          employeeId,
          weekStart,
          weekEnd,
          action: "approve",
          comments,
        }
      );
      return response.data;
    } catch (error) {
      console.error("approveWeek error:", error);
      throw error;
    }
  }

  /**
   * Reject week (Manager/Admin)
   * @param {string} employeeId - Employee ID
   * @param {string} weekStart - YYYY-MM-DD format
   * @param {string} weekEnd - YYYY-MM-DD format
   * @param {string} comments - Rejection reason (required)
   */
  async rejectWeek(employeeId, weekStart, weekEnd, comments) {
    try {
      const response = await api.post(
        "/timesheet-entries/approve-reject-week",
        {
          employeeId,
          weekStart,
          weekEnd,
          action: "reject",
          comments,
        }
      );
      return response.data;
    } catch (error) {
      console.error("rejectWeek error:", error);
      throw error;
    }
  }

  // =========================================================================
  // TIMESHEET APPROVAL PAGE (DETAILED DAILY VIEW)
  // =========================================================================

  /**
   * Get pending timesheets for admin approval.
   * ✅ UPDATED: Includes total_assigned_hours
   * @param {string} status - Status filter
   * @returns {Promise<Array>} Timesheets with total_assigned_hours
   */
  async getPendingTimesheets(status = "Submitted") {
    try {
      const response = await api.get("/dashboard/pending-timesheets", {
        params: { status },
      });
      const timesheets = response.data?.timesheets;

      // ✅ Log total_assigned_hours
      if (Array.isArray(timesheets) && timesheets.length > 0) {
        console.log(
          `✅ Fetched ${timesheets.length} pending timesheets with assigned_hours`
        );
      }

      return Array.isArray(timesheets) ? timesheets : [];
    } catch (error) {
      console.error("getPendingTimesheets error:", error);
      throw error;
    }
  }

  /**
   * Get entries belonging to a grouped weekly timesheet
   * ✅ UPDATED: Entries include assigned_hours
   */
  async getTimesheetEntries(timesheetId) {
    try {
      const response = await api.get(
        `/dashboard/timesheets/${timesheetId}/entries`
      );
      const entries = response.data?.entries;
      return Array.isArray(entries) ? entries : [];
    } catch (error) {
      console.error("getTimesheetEntries error:", error);
      throw error;
    }
  }

  async approveTimesheet(timesheetId, comment = "") {
    try {
      const response = await api.put(`/dashboard/approve/${timesheetId}`, {
        comment,
      });
      return response.data;
    } catch (error) {
      console.error("approveTimesheet error:", error);
      throw error;
    }
  }

  async rejectTimesheet(timesheetId, comment) {
    try {
      if (!comment?.trim()) {
        throw new Error("Rejection reason is required");
      }
      const response = await api.put(`/dashboard/reject/${timesheetId}`, {
        comment,
      });
      return response.data;
    } catch (error) {
      console.error("rejectTimesheet error:", error);
      throw error;
    }
  }

  // =========================================================================
  // EMPLOYEE TIMESHEET HISTORY
  // =========================================================================

  /**
   * Get timesheet history with optional filters
   * ✅ UPDATED: Includes total_assigned_hours
   * @param {Object} filters - { status: "Submitted" | 2, ... }
   * @returns {Promise<Array>} Array of timesheets with assigned_hours
   */
  async getTimesheets(filters = {}) {
    try {
      const params = { ...filters };

      // Map string status name to numeric id (backend now handles this, but keep for compatibility)
      if (params.status && isNaN(Number(params.status))) {
        const mappedId = TIMESHEET_STATUS_ID_MAP[params.status];
        if (mappedId) {
          params.status = mappedId;
        } else {
          console.warn(`Unknown status name: ${params.status}`);
        }
      }

      const response = await api.get("/dashboard/timesheet-history", {
        params,
      });

      const timesheets = response.data?.timesheets;
      return Array.isArray(timesheets) ? timesheets : [];
    } catch (error) {
      console.error("getTimesheets error:", error);
      throw error;
    }
  }

  // =========================================================================
  // DASHBOARD SUMMARY
  // =========================================================================

  async getDashboardStats() {
    try {
      const response = await api.get("/dashboard/stats");
      return response.data;
    } catch (error) {
      console.error("getDashboardStats error:", error);
      return {
        pendingApprovals: 0,
        approvedThisWeek: 0,
        teamMembersCount: 0,
        totalHoursThisWeek: 0,
      };
    }
  }

  // =========================================================================
  // BULK ACTIONS
  // =========================================================================

  async bulkApproveTimesheets(timesheetIds, comment = "") {
    try {
      const response = await api.post("/dashboard/bulk-approve", {
        timesheetIds,
        comment,
      });
      return response.data;
    } catch (error) {
      console.error("bulkApproveTimesheets error:", error);
      throw error;
    }
  }

  async bulkRejectTimesheets(timesheetIds, comment) {
    try {
      if (!comment?.trim()) {
        throw new Error("Rejection reason is required");
      }
      const response = await api.post("/dashboard/bulk-reject", {
        timesheetIds,
        comment,
      });
      return response.data;
    } catch (error) {
      console.error("bulkRejectTimesheets error:", error);
      throw error;
    }
  }

  // =========================================================================
  // ASSIGNED TICKETS
  // =========================================================================

  /**
   * Get my assigned tickets (renamed from getMyActivities).
   * Backend returns { tickets: [...] }.
   */
  async getMyTickets() {
    try {
      const response = await api.get("/timesheet-entries/my-tickets");
      return response.data.tickets || [];
    } catch (error) {
      console.error("getMyTickets error:", error);
      return [];
    }
  }

  // Deprecated alias
  async getMyActivities() {
    console.warn(
      "DEPRECATED: getMyActivities() is deprecated. Use getMyTickets() instead."
    );
    return this.getMyTickets();
  }

  // =========================================================================
  // ✅ NEW: BILLABLE HOURS UTILITIES
  // =========================================================================

  /**
   * Calculate billable and non-billable hours from entries
   * @param {Array} entries - Array of timesheet entries with assigned_hours
   * @param {number} requiredHours - Required weekly hours (default: 48)
   * @returns {Object} { billableHours, nonBillableHours }
   */
  calculateBillableHours(entries, requiredHours = 48) {
    const billableHours = entries.reduce(
      (sum, entry) => sum + Number(entry.assigned_hours || 0),
      0
    );
    const nonBillableHours = Math.max(0, requiredHours - billableHours);

    return {
      billableHours,
      nonBillableHours,
    };
  }

  /**
   * Calculate total_assigned_hours from weekly timesheet data
   * @param {Object} weeklyTimesheet - Weekly timesheet object
   * @returns {number} Total assigned hours
   */
  getTotalAssignedHours(weeklyTimesheet) {
    return Number(weeklyTimesheet.total_assigned_hours || 0);
  }

  /**
   * Format hours for display (e.g., 8.5 -> "8h 30m")
   * @param {number} hours - Hours in decimal format
   * @returns {string} Formatted hours string
   */
  formatHoursDisplay(hours) {
    if (!hours || hours === 0) return "0h";
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }
}

export default new TimesheetService();

import api from "./api";

class TimesheetReportService {
  /**
   * Get paginated timesheet report with optional filters.
   *
   * filters (all optional):
   *   employeeId, projectId, ticketId,
   *   fromDate (YYYY-MM-DD), toDate (YYYY-MM-DD),
   *   status, managerId,
   *   page, pageSize, sortBy, sortDir
   *
   * Date rules (matches backend logic):
   *   fromDate only  → exact day
   *   from + to      → inclusive range
   *   toDate only    → everything up to that date
   *   neither        → all records (paginated)
   */
  async getReport(filters = {}) {
    const response = await api.get("/timesheet-report", { params: filters });
    return response.data;
  }

  /**
   * Get report entries grouped by date with per-day subtotals.
   * Same filter params as getReport (minus pagination/sort).
   */
  async getGroupedReport(filters = {}) {
    const response = await api.get("/timesheet-report/grouped", {
      params: filters,
    });
    return response.data;
  }

  /**
   * Get per-employee summary rollup.
   * filters: fromDate, toDate, departmentId, projectId, managerId
   */
  async getEmployeeSummary(filters = {}) {
    const response = await api.get("/timesheet-report/employee-summary", {
      params: filters,
    });
    return response.data;
  }

  /**
   * Get per-project summary rollup. (Admin only)
   * filters: fromDate, toDate, clientId, status
   */
  async getProjectSummary(filters = {}) {
    const response = await api.get("/timesheet-report/project-summary", {
      params: filters,
    });
    return response.data;
  }

  /**
   * Get all dropdown options in a single call:
   *   { employees, projects, managers, statuses, clients, departments }
   */
  async getFilterOptions() {
    const response = await api.get("/timesheet-report/filter-options");
    return response.data;
  }

  /**
   * Get header-mode preview data (one aggregated row per ticket).
   * Same filter params as getReport (minus pagination/sort).
   * Hours returned as INTEGER MINUTES — divide by 60 for display.
   * Response: { data: [...], total: N }
   */
  async getHeaderReport(filters = {}) {
    const response = await api.get("/timesheet-report/header-preview", {
      params: filters,
    });
    return response.data;
  }

  /**
   * Get employee-billable preview data (one row per employee × client).
   * Columns: employee info, client name, billable hrs, non-billable hrs,
   *          self-study hrs, working days.
   * Hours returned as decimal (already ÷60).
   * Same filter params as getReport (minus pagination/sort).
   * Response: { data: [...], total: N }
   */
  async getEmployeeBillableReport(filters = {}) {
    const response = await api.get("/timesheet-report/employee-billable", {
      params: filters,
    });
    return response.data;
  }
}

export default new TimesheetReportService();

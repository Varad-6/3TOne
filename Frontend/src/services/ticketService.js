import api from "./api";

class TicketService {
  // ===== TICKET CRUD =====

  async getAllTicketStatuses() {
    const response = await api.get("/tickets/statuses");
    return response.data;
  }

  async getAllTickets(params = {}) {
    const response = await api.get("/tickets", { params });
    return response.data;
  }

  async getTicketById(id) {
    const response = await api.get(`/tickets/${id}`);
    return response.data;
  }

  async getTicketsByProject(projectId) {
    const response = await api.get(`/tickets/project/${projectId}`);
    return response.data;
  }

  async createTicket(data) {
    const response = await api.post("/tickets", data);
    return response.data;
  }

  async updateTicket(id, data) {
    const response = await api.put(`/tickets/${id}`, data);
    return response.data;
  }

  async deleteTicket(id) {
    await api.delete(`/tickets/${id}`);
  }

  async reactivateTicket(id) {
    const response = await api.patch(`/tickets/${id}/reactivate`);
    return response.data;
  }

  /**
   * Get budget info for a ticket's project.
   * Returns { projectBudgetMinutes, usedMinutes, remainingMinutes, budgetNotSet }
   */
  async getProjectBudgetInfo(ticketId) {
    const response = await api.get(`/tickets/${ticketId}/budget-info`);
    return response.data;
  }

  /**
   * Get budget info by project ID directly.
   */
  async getProjectBudgetInfoByProject(projectId) {
    const response = await api.get(
      `/tickets/${projectId}/budget-info?type=project`,
    );
    return response.data;
  }

  // ===== HOURS APPROVAL FLOW =====

  /**
   * Get hours update requests.
   * Admin: sees all requests.
   * Manager: sees only their own requests.
   * @param {string} [status] - 'PENDING' | 'APPROVED' | 'REJECTED' | 'all'
   */
  async getHoursUpdateRequests(status = "all") {
    const response = await api.get("/tickets/hours-requests", {
      params: status !== "all" ? { status } : {},
    });
    return response.data;
  }

  /**
   * Admin: approve a pending hours update request.
   * @param {string} requestId
   * @param {string} [remarks] - optional admin remarks
   */
  async approveHoursRequest(requestId, remarks = "") {
    const response = await api.patch(
      `/tickets/hours-requests/${requestId}/approve`,
      { remarks },
    );
    return response.data;
  }

  /**
   * Admin: reject a pending hours update request.
   * @param {string} requestId
   * @param {string} [remarks] - optional rejection reason
   */
  async rejectHoursRequest(requestId, remarks = "") {
    const response = await api.patch(
      `/tickets/hours-requests/${requestId}/reject`,
      { remarks },
    );
    return response.data;
  }

  // ===== MANAGER VIEWS =====

  async getMyTickets() {
    const response = await api.get("/timesheet-entries/my-tickets");
    return response.data;
  }

  async getManagerProjectTickets() {
    const response = await api.get("/tickets/manager/projects-tickets");
    return response.data;
  }

  async getManagerTicketsExport() {
    const response = await api.get("/tickets/manager/export");
    return response.data;
  }

  async getManagerTicketsForAssignment(managerId) {
    const response = await api.get(
      `/manager-ticket-assignments/${managerId}/projects-with-tickets`,
    );
    return response.data;
  }

  // ===== TICKET ASSIGNMENTS =====

  async getTicketAssignments(ticketId) {
    const response = await api.get(`/ticket-assignments/${ticketId}`);
    return response.data;
  }

  async assignTicketToEmployees(data) {
    const response = await api.post(
      "/ticket-assignments/assign-employee",
      data,
    );
    return response.data;
  }

  async removeTicketAssignment(assignmentId) {
    await api.delete(`/ticket-assignments/${assignmentId}`);
  }

  // ===== TIMESHEET-SPECIFIC =====

  async getAssignedTicketsForTimesheet(projectId, entryDate) {
    const response = await api.get(
      `/timesheet-entries/projects/${projectId}/tickets`,
      { params: { entryDate } },
    );
    return response.data;
  }

  async getAssignedProjectsForTimesheet() {
    const response = await api.get("/timesheet-entries/projects");
    return response.data;
  }

  // ===== LEGACY =====

  /** @deprecated Use getManagerTicketsForAssignment() instead. */
  async getManagerTickets(managerId) {
    console.warn(
      "getManagerTickets() is deprecated. Use getManagerTicketsForAssignment() instead.",
    );
    return this.getManagerTicketsForAssignment(managerId);
  }

  /** @deprecated Use getMyTickets() instead. */
  async getEmployeeTickets(employeeId) {
    console.warn(
      "getEmployeeTickets() is deprecated. Use getMyTickets() instead.",
    );
    return this.getMyTickets(employeeId);
  }
}

export default new TicketService();

import api from "./api";

class TicketAssignmentService {

  async getAssigneesForProject(projectId) {
    const response = await api.get("/ticket-assignments/assignees", {
      params: { projectId },
    });
    return response.data;
  }

  async getAllAssigneesForAdmin(projectId) {
    const response = await api.get("/ticket-assignments/all-assignees", {
      params: { projectId },
    });
    return response.data;
  }

  // ============================================
  // TICKET ASSIGNMENT (CREATE)
  // ============================================

  async assignTicketToAssignee(
    ticketId,
    employeeId,
    projectId,
    clientId,
    assignedBy,
    billableHours,
    startDate = null,
    endDate = null
  ) {
    const response = await api.post("/ticket-assignments/assign-employee", {
      ticketId,
      employeeId,
      projectId,
      clientId,
      assignedBy,
      billableHours,
      startDate,
      endDate,
    });
    return response.data;
  }

  // ============================================
  // TICKET ASSIGNMENT (READ)
  // ============================================


  async getTicketAssignments(ticketId) {
    const response = await api.get(`/ticket-assignments/${ticketId}`);
    return response.data;
  }

  async getManagerAssignmentsForTicket(ticketId) {
    const response = await api.get(
      `/ticket-assignments/ticket/${ticketId}/managers`
    );
    return response.data;
  }

  // ============================================
  // TICKET ASSIGNMENT (UPDATE)
  // ============================================

async updateTicketAssignment(assignmentId, billableHours, role) {

  if (role === "MANAGER") {
    // Manager route
    return api.patch(
      `/manager-ticket-assignments/assignments/${assignmentId}`,
      { billableHours }
    );
  }

  // Admin route
  return api.patch(
    `/ticket-assignments/${assignmentId}`,
    { billableHours }
  );
}


  async updateManagerScopeAssignment(scopeId, billableHours) {
    const response = await api.patch(
      `/ticket-assignments/manager-scope/${scopeId}`,
      { billableHours }
    );
    return response.data;
  }

  // ============================================
  // TICKET ASSIGNMENT (DELETE/UNASSIGN)
  // ============================================

  async removeTicketAssignment(assignmentId) {
    const response = await api.delete(`/ticket-assignments/${assignmentId}`);
    return response.data;
  }


  async removeManagerScopeAssignment(scopeId) {
    const response = await api.delete(
      `/ticket-assignments/manager-scope/${scopeId}`
    );
    return response.data;
  }

  // ============================================
  // MANAGER-SPECIFIC (Legacy/Alternative Endpoints)
  // ============================================


  async getManagerTickets(managerId, projectId = null) {
    const params = {};
    if (projectId) params.projectId = projectId;

    const response = await api.get(
      `/manager-ticket-assignments/${managerId}/projects-with-tickets`,
      { params }
    );
    return response.data;
  }


  async getManagerEmployees(managerId, projectId = null) {
    const params = {};
    if (projectId) params.projectId = projectId;

    const response = await api.get(
      `/manager-ticket-assignments/${managerId}/employees`,
      { params }
    );
    return response.data;
  }
}

export default new TicketAssignmentService();

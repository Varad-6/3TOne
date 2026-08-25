import api from "./api";

class ProjectService {
  // =========================================================================
  // PROJECT CRUD
  // =========================================================================

  /**
   * Get all projects.
   * `params` can include filters like isActive, clientId, managerId, etc.
   */
  async getAllProjects(params = {}) {
    const response = await api.get("/projects", { params });
    return response.data;
  }

  async getProjectById(id) {
    const response = await api.get(`/projects/${id}`);
    return response.data;
  }

  async createProject(data) {
    const response = await api.post("/projects", data);
    return response.data;
  }

  async updateProject(id, data) {
    const response = await api.put(`/projects/${id}`, data);
    return response.data;
  }

  async deleteProject(id) {
    await api.delete(`/projects/${id}`);
  }

  /**
   * ✅ NEW: Reactivate an inactive project
   * This will set is_active = TRUE
   */
  async reactivateProject(id) {
    const response = await api.patch(`/projects/${id}/reactivate`);
    return response.data;
  }

  // =========================================================================
  // PROJECT ASSIGNMENTS
  // =========================================================================

  async getProjectAssignments(projectId) {
    const response = await api.get(`/project-assignments/${projectId}`);
    return response.data;
  }

  /**
   * Get all project-manager assignments with activity counts.
   * `options.includeInactive` can be used to include inactive rows.
   */
  async getAllAssignmentsWithActivities(options = {}) {
    const params = new URLSearchParams();
    if (options.includeInactive) {
      params.append("includeInactive", "true");
    }

    const response = await api.get(
      `/project-assignments/all-with-activities?${params.toString()}`
    );
    return response.data;
  }

  // =========================================================================
  // MANAGER VIEWS
  // =========================================================================

  async getManagerProjects(managerId) {
    const response = await api.get(`/project-assignments/manager/${managerId}`);
    return response.data;
  }

  async getManagerProjectsWithActivities(managerId) {
    const response = await api.get(
      `/project-assignments/manager/${managerId}/with-activities`
    );
    return response.data;
  }

  async getManagerActivitiesForProject(projectId, managerId) {
    const response = await api.get(
      `/project-assignments/project/${projectId}/manager/${managerId}/activities`
    );
    return response.data;
  }

  // =========================================================================
  // EMPLOYEE VIEWS
  // =========================================================================

  async getEmployeeProjects(employeeId) {
    const response = await api.get(
      `/project-assignments/employee/${employeeId}`
    );
    return response.data;
  }

  // =========================================================================
  // TIMESHEET-SPECIFIC ENDPOINTS
  // =========================================================================

  /**
   * Get projects assigned to the current user for timesheet entry.
   * Uses auth token to resolve user; userId parameter is optional/ignored.
   */
  async getAssignedProjectsForTimesheet(userId) {
    void userId; // not used; left for backward compatibility
    const response = await api.get("/timesheet-entries/projects");
    return response.data;
  }

  /**
   * Get activities (tickets/tasks) for a project for timesheet entry,
   * filtered based on the current user's role and assignments.
   */
  async getAssignedActivitiesForTimesheet(projectId) {
    const response = await api.get(
      `/timesheet-entries/projects/${projectId}/activities`
    );
    return response.data;
  }
}

export default new ProjectService();

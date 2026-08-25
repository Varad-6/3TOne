import api from "./api";

/**
 * Admin Project Assignment Service
 * Handles admin operations for assigning projects + activities to managers.
 */
const adminProjectAssignmentService = {
  /**
   * Assign multiple projects to multiple managers.
   * @param {string[]|string} projectIds - Project UUID(s)
   * @param {string[]} managerIds - Manager UUIDs
   * @param {string} assignedBy - Admin UUID
   */
  assignProjectsToManagers: async (projectIds, managerIds, assignedBy) => {
    let ids = projectIds;
    if (!Array.isArray(ids)) {
      ids = [ids];
    }

    const response = await api.post(
      "/admin-project-assignments/assign-projects",
      {
        projectIds: ids,
        managerIds,
        assignedBy,
      }
    );
    return response.data;
  },

  /**
   * Assign specific activities of a project to a manager.
   * @param {string} projectId - Project UUID
   * @param {string} managerId - Manager UUID
   * @param {string[]} activityIds - Activity UUIDs
   * @param {string} assignedBy - Admin UUID
   */
  assignActivitiesToManager: async (
    projectId,
    managerId,
    activityIds,
    assignedBy
  ) => {
    const response = await api.post(
      "/admin-project-assignments/assign-activities",
      {
        projectId,
        managerId,
        activityIds,
        assignedBy,
      }
    );
    return response.data;
  },

  /**
   * Get all assignments with activity counts.
   * @param {{includeInactive?: boolean}} options
   */
  getAllAssignments: async (options = {}) => {
    const params = new URLSearchParams();
    if (options.includeInactive) {
      params.append("includeInactive", "true");
    }

    const response = await api.get(
      `/admin-project-assignments/assignments?${params.toString()}`
    );
    return response.data;
  },

  /**
   * Soft delete (unassign) a manager from a project (sets is_active = false).
   */
  unassignProjectManager: async (projectId, managerId) => {
    const response = await api.delete(
      `/admin-project-assignments/project/${projectId}/manager/${managerId}`
    );
    return response.data;
  },

  /**
   * Hard delete a project-manager assignment permanently.
   * @param {string} assignmentId - Format "projectId-managerId"
   */
  deleteProjectManagerAssignment: async (assignmentId) => {
    const response = await api.delete(
      `/admin-project-assignments/assignment/${assignmentId}`
    );
    return response.data;
  },

  /**
   * Get all projects (for admin dropdowns).
   */
  getAllProjects: async () => {
    const response = await api.get("/admin-project-assignments/projects");
    return response.data;
  },

  /**
   * Get activities for a project (for admin dropdowns).
   */
  getActivitiesByProject: async (projectId) => {
    const response = await api.get(
      `/admin-project-assignments/activities/project/${projectId}`
    );
    return response.data;
  },

  /**
   * Get manager's assigned projects and activities.
   */
  getManagerAssignments: async (managerId) => {
    const response = await api.get(
      `/admin-project-assignments/manager/${managerId}/assignments`
    );
    return response.data;
  },
};

export default adminProjectAssignmentService;

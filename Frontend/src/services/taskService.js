import api from "./api";

class TaskService {
  // =========================================================================
  // FETCH METHODS
  // =========================================================================

  /**
   * Get all tasks (for Admin Management Grid).
   * Returns { tasks: [...] }.
   */
  async getAllTasks() {
    try {
      const response = await api.get("/tasks");
      return response.data;
    } catch (error) {
      console.error("getAllTasks error:", error);
      throw error;
    }
  }

  /**
   * ✅ NEW: Get tasks filtered by department AND project
   * Supports project-type based filtering + default "AIS Internal Billing" project
   */
  async getTasksByDepartmentAndProject(departmentId, projectId) {
    try {
      const response = await api.get("/tasks/by-department-and-project", {
        params: { departmentId, projectId },
      });
      return response.data; // Expected: { tasks: [...], isDefaultProject: boolean, projectType: string }
    } catch (error) {
      console.error("getTasksByDepartmentAndProject error:", error);
      throw error;
    }
  }

  /**
   * Get tasks based on department (for Timesheet Dropdown).
   * `department` can be a name or numeric departmentId; it is forwarded as-is.
   */
  async getTasksByDepartment(departmentId) {
    try {
      const response = await api.get("/tasks/by-departmentId", {
        params: { departmentId },
      });
      return response.data; // Expected: { tasks: [...] }
    } catch (error) {
      console.error("getTasksByDepartment error:", error);
      throw error;
    }
  }

  /**
   * Get all departments (for Task Management Dropdown).
   * Returns { departments: [...] }.
   */
  async getAllDepartments() {
    try {
      const response = await api.get("/tasks/departments");
      return response.data;
    } catch (error) {
      console.error("getAllDepartments error:", error);
      throw error;
    }
  }

  // =========================================================================
  // CRUD METHODS (For Admin Page)
  // =========================================================================

  /**
   * Create a new task.
   * `data` should include department (id or name), internalProject, task, isActive.
   */
  async createTask(data) {
    try {
      const response = await api.post("/tasks", data);
      return response.data;
    } catch (error) {
      console.error("createTask error:", error);
      throw error;
    }
  }

  /**
   * Update an existing task.
   */
  async updateTask(id, data) {
    try {
      const response = await api.put(`/tasks/${id}`, data);
      return response.data;
    } catch (error) {
      console.error("updateTask error:", error);
      throw error;
    }
  }

  /**
   * Delete a task.
   */
  async deleteTask(id) {
    try {
      await api.delete(`/tasks/${id}`);
    } catch (error) {
      console.error("deleteTask error:", error);
      throw error;
    }
  }

  /**
   * ✅ NEW: Reactivate an inactive task
   * This will set is_active = TRUE
   */
  async reactivateTask(id) {
    try {
      const response = await api.patch(`/tasks/${id}/reactivate`);
      return response.data;
    } catch (error) {
      console.error("reactivateTask error:", error);
      throw error;
    }
  }
}

export default new TaskService();

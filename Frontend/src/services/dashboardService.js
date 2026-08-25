import api from "./api";

class DashboardService {
  /**
   * Get complete employee dashboard data.
   */
  async getEmployeeDashboard() {
    const response = await api.get("/dashboard/employee");
    return response.data;
  }

  /**
   * Get employee dashboard statistics.
   */
  async getDashboardStats() {
    const response = await api.get("/dashboard/employee/stats");
    return response.data;
  }

  /**
   * Get employee weekly progress.
   */
  async getWeeklyProgress() {
    const response = await api.get("/dashboard/employee/weekly-progress");
    return response.data;
  }

  /**
   * Get recent timesheets.
   */
  async getRecentTimesheets(limit = 5) {
    const response = await api.get("/dashboard/employee/recent-timesheets", {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Get project allocations for the current employee.
   */
  async getProjectAllocations() {
    const response = await api.get("/dashboard/employee/project-allocations");
    return response.data;
  }

  /**
   * Get notifications for the current employee.
   */
  async getNotifications(limit = 10) {
    const response = await api.get("/dashboard/employee/notifications", {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Get monthly summary for the current employee.
   */
  async getMonthlySummary() {
    const response = await api.get("/dashboard/employee/monthly-summary");
    return response.data;
  }

  /**
   * Mark notification as read.
   */
  async markNotificationAsRead(notificationId) {
    await api.put(
      `/dashboard/employee/notifications/${notificationId}/read`
    );
  }
}

export default new DashboardService();

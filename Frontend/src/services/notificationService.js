import api from "./api";

class NotificationService {
  // Get all notifications
  async getNotifications() {
    const response = await api.get("/notifications");
    return response.data;
  }

  // Mark a notification as read
  async markAsRead(id) {
    await api.put(`/notifications/${id}/read`);
  }

  // Mark all notifications as read
  async markAllAsRead() {
    await api.put("/notifications/mark-all-read");
  }

  // Delete a notification
  async deleteNotification(id) {
    await api.delete(`/notifications/${id}`);
  }
}

export default new NotificationService();

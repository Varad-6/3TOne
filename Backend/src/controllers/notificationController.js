import pool from '../config/database.js';
import notificationService from '../services/notificationService.js';

// Get user notifications
export const getNotifications = async (req, res) => {
  try {
    const { employeeId } = req.user;
    const { isRead, limit = 20 } = req.query;

    let query = `
      SELECT * FROM notifications
      WHERE employee_id = $1
    `;
    const params = [employeeId];

    if (isRead !== undefined) {
      params.push(isRead === 'true');
      query += ` AND is_read = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    params.push(parseInt(limit, 10));
    query += ` LIMIT $${params.length}`;

    const result = await pool.query(query, params);

    res.json({
      notifications: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// Mark a single notification as read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId } = req.user;

    const result = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE, read_at = NOW()
       WHERE notification_id = $1 AND employee_id = $2
       RETURNING *`,
      [id, employeeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({
      message: 'Notification marked as read',
      notification: result.rows[0],
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    const { employeeId } = req.user;

    await pool.query(
      `UPDATE notifications
       SET is_read = TRUE, read_at = NOW()
       WHERE employee_id = $1 AND is_read = FALSE`,
      [employeeId]
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
};

// Delete a notification
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId } = req.user;

    const result = await pool.query(
      'DELETE FROM notifications WHERE notification_id = $1 AND employee_id = $2 RETURNING *',
      [id, employeeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};

// Send notification (Admin only via route guard)
export const sendNotification = async (req, res) => {
  try {
    const { employeeId, type, title, message, link } = req.body;

    if (!employeeId || !type || !title || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const notif = await notificationService.createNotification({
      employeeId,
      type,
      title,
      message,
      link,
    });

    res.json({ message: 'Notification sent successfully', notification: notif });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
};

// Get unread count
export const getUnreadCount = async (req, res) => {
  try {
    const { employeeId } = req.user;

    const result = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE employee_id = $1 AND is_read = FALSE',
      [employeeId]
    );

    res.json({ count: parseInt(result.rows[0].count, 10) });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
};

export default {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  sendNotification,
  getUnreadCount,
};

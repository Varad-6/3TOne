import pool from '../config/database.js';

const notifications = {
  createNotification: async ({ employeeId, type, title, message, link }) => {
    try {
      const notificationId = `NOT${Date.now()}`;
      const result = await pool.query(
        `INSERT INTO notifications (notification_id, employee_id, type, title, message, link, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE, NOW())
         RETURNING *`,
        [notificationId, employeeId, type, title, message, link || null]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Create notification error:', error);
      throw error;
    }
  },

  notifyTimesheetSubmitted: async (employeeId, managerId, timesheetId) => {
    const employee = await pool.query(
      'SELECT first_name, last_name FROM employees WHERE employee_id = $1',
      [employeeId]
    );
    const emp = employee.rows[0] || { first_name: 'Employee', last_name: '' };

    await notifications.createNotification({
      employeeId: managerId,
      type: 'TIMESHEET_SUBMITTED',
      title: 'New Timesheet Submission',
      message: `${emp.first_name} ${emp.last_name} has submitted a timesheet for review.`,
      link: `/manager/timesheets/${timesheetId}`,
    });
  },

  notifyTimesheetApproved: async (employeeId, timesheetId) => {
    await notifications.createNotification({
      employeeId,
      type: 'TIMESHEET_APPROVED',
      title: 'Timesheet Approved',
      message: 'Your timesheet has been approved.',
      link: `/employee/timesheets/${timesheetId}`,
    });
  },

  notifyTimesheetRejected: async (employeeId, timesheetId, comments) => {
    await notifications.createNotification({
      employeeId,
      type: 'TIMESHEET_REJECTED',
      title: 'Timesheet Rejected',
      message: `Your timesheet was rejected. ${comments ? `Reason: ${comments}` : ''}`,
      link: `/employee/timesheets/${timesheetId}`,
    });
  },

  notifyProjectAssigned: async (employeeId, projectId, projectName) => {
    await notifications.createNotification({
      employeeId,
      type: 'PROJECT_ASSIGNED',
      title: 'Project Assigned',
      message: `You have been assigned to project: ${projectName}`,
      link: `/projects/${projectId}`,
    });
  },

  sendTimesheetReminder: async () => {
    try {
      const employees = await pool.query(
        'SELECT employee_id FROM employees WHERE is_active = TRUE'
      );

      const weekDates = notifications.getWeekDates();

      for (const emp of employees.rows) {
        const timesheet = await pool.query(
          `SELECT 1 FROM timesheets
           WHERE employee_id = $1
             AND week_start_date = $2
             AND status IN ('SUBMITTED', 'APPROVED')`,
          [emp.employee_id, weekDates.start]
        );

        if (timesheet.rows.length === 0) {
          await notifications.createNotification({
            employeeId: emp.employee_id,
            type: 'REMINDER',
            title: 'Timesheet Reminder',
            message: 'Please submit your timesheet for this week.',
            link: '/employee/timesheets/new',
          });
        }
      }
    } catch (error) {
      console.error('Send reminder error:', error);
    }
  },

  getWeekDates: () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0],
    };
  },
};

export default notifications;

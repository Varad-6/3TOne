// src/config/constants.js

const constants = {
  // Roles (match user_roles.name)
  ROLES: {
    ADMIN: "ADMIN",
    MANAGER: "MANAGER",
    EMPLOYEE: "EMPLOYEE",
  },

  // Timesheet Status (match timesheet_status.name)
  TIMESHEET_STATUS: {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    MANAGER_APPROVED: "Manager_Approved",
    MANAGER_REJECTED: "Manager_Rejected",
    ADMIN_APPROVED: "Admin_Approved",
    ADMIN_REJECTED: "Admin_Rejected",
    PARTIALLY_APPROVED: "Partially_Approved",
    // Legacy / compatibility alias if older data used a generic "Approved"
    APPROVED: "Approved",
    LOCKED: "Locked",
  },


  
  // Project Status (match project_status.name)
  PROJECT_STATUS: {
    PLANNED: "Planned",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
    ON_HOLD: "On Hold",
    CANCELLED: "Cancelled",
  },

  // Departments (match departments.name)
  DEPARTMENTS: ["DELIVERY", "PRESALES", "SALES & MARKETING", "HR", "MANAGEMENT", "COMMON"],

  // Designations (pure app-level labels)
  DESIGNATIONS: [
    "Junior Developer",
    "Senior Developer",
    "Team Lead",
    "Manager",
    "Director",
    "VP",
    "CEO",
  ],

  // Pagination
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 10,
    MAX_PAGE_SIZE: 100,
  },

  // Time
  WORKING_TIME: {
    HOURS_PER_DAY: 8,
    DAYS_PER_WEEK: 5,
  },

  // Query Limits
  SQL_LIMITS: {
    TIMESHEET_HISTORY: 50,
    SEARCH_RESULTS: 100,
  },

  // Email
  EMAIL_FROM: process.env.EMAIL_FROM || "noreply@timetrackpro.com",

  // Audit Actions
  AUDIT_ACTIONS: {
    CREATE: "CREATE",
    UPDATE: "UPDATE",
    DELETE: "DELETE",
    LOGIN: "LOGIN",
    LOGOUT: "LOGOUT",
    APPROVE: "APPROVE",
    REJECT: "REJECT",
  },

  // Notification Types
  NOTIFICATION_TYPES: {
    TIMESHEET_SUBMITTED: "TIMESHEET_SUBMITTED",
    TIMESHEET_APPROVED: "TIMESHEET_APPROVED",
    TIMESHEET_REJECTED: "TIMESHEET_REJECTED",
    PROJECT_ASSIGNED: "PROJECT_ASSIGNED",
    REMINDER: "REMINDER",
  },
};

export default constants;

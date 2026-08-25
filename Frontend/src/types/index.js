// User roles
export const UserRoles = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  EMPLOYEE: "EMPLOYEE",
};

// Timesheet status
export const TimesheetStatuses = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECT: "Reject",
};

// Project status
export const ProjectStatuses = {
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
};

// Activity status
export const ActivityStatuses = {
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

// Example user object structure
// {
//   employeeId: 'EMP001',
//   name: 'John Doe',
//   email: 'john@example.com',
//   role: UserRoles.EMPLOYEE,
//   department: 'Engineering',
//   designation: 'Developer'
// }

// Example API error structure
// {
//   error: 'Some error',
//   message: 'Optional message',
//   stack: 'Optional stack trace'
// }

// Paginated response example
// {
//   data: [], // array of items
//   count: 100,
//   page: 1,
//   limit: 10,
//   total: 100
// }

// Date range example
// {
//   startDate: '2025-01-01',
//   endDate: '2025-01-07'
// }

// Select option example
// {
//   value: 1,
//   label: 'Option 1'
// }

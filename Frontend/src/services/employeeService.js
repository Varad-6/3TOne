import api from "./api";

class EmployeeService {
  /**
   * Get count of employees by role.
   * role can be role name ("ADMIN", "MANAGER", "EMPLOYEE")
   * or numeric role id; backend will resolve it.
   */
  async getEmployeeCountByRole(role) {
    const response = await this.getAllEmployees({ role });
    return response.count;
  }

  /**
   * Get all employees with optional filters:
   * { role, department, isActive, page, limit }
   * role/department can be ids or names.
   */
  async getAllEmployees(filters) {
    const response = await api.get("/employees", { params: filters });
    return response.data;
  }

  /**
   * Get employees by role.
   * role can be name or id, same as getAllEmployees.
   */
  async getEmployeesByRole(role) {
    const response = await api.get("/employees", {
      params: { role },
    });
    return response.data;
  }

  /**
   * Get single employee by ID or employee_code.
   */
  async getEmployeeById(id) {
    const response = await api.get(`/employees/${id}`);
    return response.data;
  }

  /**
   * Create a new employee.
   * data should contain:
   *  - employeeId (optional, becomes employee_code)
   *  - firstName, lastName, email, password
   *  - role (name or id)
   *  - department (name or id)
   *  - designation, doj, separationDate, moduleManagerId
   */
  async createEmployee(data) {
    const response = await api.post("/employees", data);
    return response.data.employee;
  }

  /**
   * Update existing employee by UUID or employee_code.
   * data can include same fields as createEmployee (except password optional).
   */
  async updateEmployee(id, data) {
    const response = await api.put(`/employees/${id}`, data);
    return response.data.employee;
  }

  /**
   * Delete/deactivate employee by UUID or employee_code.
   */
  async deleteEmployee(id) {
    await api.delete(`/employees/${id}`);
  }

  /**
   * Reactivate an inactive employee by UUID or employee_code.
   * This will set is_active = TRUE and clear separation_date.
   */
  async reactivateEmployee(id) {
    const response = await api.patch(`/employees/${id}/reactivate`);
    return response.data;
  }

  /**
   * Get all managers.
   */
  async getManagers() {
    const response = await api.get("/employees/managers");
    return response.data;
  }

  /**
   * Get team members for a manager (UUID or employee_code).
   */
  async getTeamMembers(managerId) {
    const url = managerId ? `/employees/team/${managerId}` : "/employees/team";
    const response = await api.get(url);
    return response.data;
  }

  /**
   * Get all departments (names from departments lookup table).
   */
  async getDepartments() {
    const response = await api.get("/employees/departments");
    // backend returns { departments: ["DELIVERY", ...] }
    return response.data;
  }
}

export default new EmployeeService();

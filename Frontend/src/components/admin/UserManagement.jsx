import React, { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { toast } from "sonner";
import {
  UserPlus,
  Loader2,
  AlertTriangle,
  Edit,
  Trash2,
  Search,
  Eye,
  EyeOff,
  ArchiveRestore, // ✅ Add this
} from "lucide-react";
import employeeService from "../../services/employeeService";

const initialFormState = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  role: "EMPLOYEE",
  department: "",
  designation: "",
  employeeCode: "", // ✅ NEW FIELD
  doj: new Date().toISOString().split("T")[0],
  separationDate: "",
  moduleManagerId: "",
  isActive: true,
};

// Local mapping in case backend sends numeric role FK
const ROLE_MAP = {
  1: "ADMIN",
  2: "MANAGER",
  3: "EMPLOYEE",
};

const normalizeRole = (value) => {
  if (typeof value === "number") {
    return ROLE_MAP[value] || String(value);
  }
  if (!value) return "";
  const v = String(value).toUpperCase();
  if (["ADMIN", "MANAGER", "EMPLOYEE"].includes(v)) return v;
  return v;
};

export function UserManagement() {
  const [employees, setEmployees] = useState([]);
  const [managers, setManagers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  const [showDialog, setShowDialog] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

  const [editingEmployee, setEditingEmployee] = useState(null);
  const [deactivatingEmployee, setDeactivatingEmployee] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [formData, setFormData] = useState(initialFormState);

  const [separationDateInput, setSeparationDateInput] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [managerSearch, setManagerSearch] = useState("");
  const [showManagerList, setShowManagerList] = useState(false);
  const managerRef = useRef(null);

  const filteredManagers = managers.filter((mgr) => {
    if (editingEmployee && mgr.employee_id === editingEmployee.employee_id)
      return false;

    const fullName = `${mgr.first_name} ${mgr.last_name}`.toLowerCase();

    return fullName.includes(managerSearch.toLowerCase());
  });

  useEffect(() => {
    void fetchEmployees();
  }, [roleFilter]);

  useEffect(() => {
    void fetchManagers();
    void fetchDepartments();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (managerRef.current && !managerRef.current.contains(event.target)) {
        setShowManagerList(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const data = await employeeService.getAllEmployees({
        role: roleFilter !== "all" ? roleFilter : undefined,
      });
      setEmployees(data.employees || []);
    } catch (error) {
      console.error("Failed to fetch employees:", error);
      toast.error(
        error?.response?.data?.message || "Failed to fetch employees",
      );
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  const fetchManagers = useCallback(async () => {
    try {
      const data = await employeeService.getManagers();
      setManagers(data.employees || []);
    } catch (error) {
      console.error("Failed to fetch managers:", error);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const data = await employeeService.getDepartments();
      const list = (data.departments || []).map((d) => d.name || d);
      setDepartments(list);
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  }, []);

  const validateForm = () => {
    if (!formData.firstName.trim()) {
      toast.error("First name is required");
      return false;
    }
    if (!formData.lastName.trim()) {
      toast.error("Last name is required");
      return false;
    }
    if (!formData.department.trim()) {
      toast.error("Department is required");
      return false;
    }
    if (!formData.designation.trim()) {
      toast.error("Designation is required");
      return false;
    }
    if (!formData.role) {
      toast.error("Role is required");
      return false;
    }
    if (!formData.employeeCode.trim()) {
      toast.error("Employee Code is required");
      return false;
    }
    if (!formData.moduleManagerId) {
      toast.error("Please select a Reporting Manager");
      return false;
    }

    if (!formData.email.trim()) {
      toast.error("Email is required");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error("Please enter a valid email address");
      return false;
    }

    if (!editingEmployee && !formData.password) {
      toast.error("Password is required for new employees");
      return false;
    }

    if (formData.password) {
      if (formData.password.length < 12) {
        toast.error("Password must be at least 12 characters long");
        return false;
      }

      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{12,}$/;
      if (!passwordRegex.test(formData.password)) {
        toast.error(
          "Password must contain: 1 Uppercase, 1 Lowercase, 1 Number, and 1 Special Character",
        );
        return false;
      }
    }

    if (!formData.doj) {
      toast.error("Date of Joining is required");
      return false;
    }
    if (
      formData.separationDate &&
      new Date(formData.separationDate) < new Date(formData.doj)
    ) {
      toast.error("Separation date cannot be before Date of Joining");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (editingEmployee && !formData.isActive && !formData.separationDate) {
      setShowDialog(false);
      setDeactivatingEmployee(editingEmployee);
      setSeparationDateInput(new Date().toISOString().split("T")[0]);
      setShowDeactivateDialog(true);
      toast.info(
        "Please provide a Separation Date to deactivate the employee.",
      );
      return;
    }

    try {
      setSubmitting(true);

      const managerIdToSend =
        formData.moduleManagerId === "none" ? null : formData.moduleManagerId;

      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: formData.role,
        department: formData.department,
        designation: formData.designation,
        employeeCode: formData.employeeCode,
        doj: formData.doj,
        moduleManagerId: managerIdToSend,
      };

      if (editingEmployee) {
        const updateData = {
          ...payload,
          separationDate: formData.separationDate || null,
          isActive: formData.isActive,
        };
        if (formData.password) updateData.password = formData.password;

        await employeeService.updateEmployee(
          editingEmployee.employee_id,
          updateData,
        );
        toast.success("Employee updated successfully");
      } else {
        const createData = {
          ...payload,
          email: formData.email,
          password: formData.password,
        };
        await employeeService.createEmployee(createData);
        toast.success("Employee created successfully");
      }

      setShowDialog(false);
      resetForm();
      await fetchEmployees();
    } catch (error) {
      console.error("Failed to save employee:", error);
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Failed to save employee";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (employee) => {
    if (!employee.is_active) return;

    const roleName = normalizeRole(employee.role);
    setManagerSearch(
      employee.manager_first_name
        ? `${employee.manager_first_name} ${employee.manager_last_name}`
        : "",
    );

    setEditingEmployee(employee);
    setFormData({
      firstName: employee.first_name,
      lastName: employee.last_name,
      email: employee.email,
      password: "",
      role: roleName || "EMPLOYEE",
      department: employee.department_name || employee.department || "", // ✅ Use department_name
      designation: employee.designation || "",
      employeeCode: employee.employee_code || "",
      doj: employee.doj ? employee.doj.split("T")[0] : "",
      separationDate: employee.separation_date
        ? employee.separation_date.split("T")[0]
        : "",
      moduleManagerId: employee.module_manager_id || "none",
      isActive: employee.is_active,
    });
    setShowDialog(true);
  };

  const confirmDeactivation = (employee) => {
    setDeactivatingEmployee(employee);
    setSeparationDateInput(new Date().toISOString().split("T")[0]);
    setShowDeactivateDialog(true);
  };

  const handleDeactivateSubmit = async () => {
    if (!deactivatingEmployee) return;

    if (
      deactivatingEmployee.doj &&
      new Date(separationDateInput) < new Date(deactivatingEmployee.doj)
    ) {
      toast.error("Separation date cannot be before Date of Joining");
      return;
    }

    try {
      setSubmitting(true);
      await employeeService.updateEmployee(deactivatingEmployee.employee_id, {
        separationDate: separationDateInput,
        isActive: false,
      });

      toast.success("Employee deactivated successfully");
      setShowDeactivateDialog(false);
      setDeactivatingEmployee(null);
      await fetchEmployees();
    } catch (error) {
      console.error("Failed to deactivate employee:", error);
      const errorMessage =
        error?.response?.data?.message || "Failed to deactivate employee";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReactivate = async (employee) => {
    if (
      !window.confirm(
        `Are you sure you want to reactivate ${employee.first_name} ${employee.last_name}?`,
      )
    ) {
      return;
    }

    try {
      setSubmitting(true);
      await employeeService.reactivateEmployee(employee.employee_id);
      toast.success("Employee reactivated successfully");
      await fetchEmployees();
    } catch (error) {
      console.error("Failed to reactivate employee:", error);
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Failed to reactivate employee";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingEmployee(null);
    setFormData(initialFormState);
  };

  const handleDialogClose = (open) => {
    if (!open && !submitting) {
      setShowDialog(false);
      resetForm();
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const searchLower = searchQuery.toLowerCase();
    const roleName = normalizeRole(emp.role);

    // Safely get values with defaults
    const firstName = emp.first_name || "";
    const lastName = emp.last_name || "";
    const email = emp.email || "";
    const department = emp.department_name || emp.department || "";
    const designation = emp.designation || "";

    // Create full name for searching
    const fullName = `${firstName} ${lastName}`.toLowerCase();

    const matchesSearch =
      firstName.toLowerCase().includes(searchLower) ||
      lastName.toLowerCase().includes(searchLower) ||
      fullName.includes(searchLower) ||
      email.toLowerCase().includes(searchLower) ||
      department.toLowerCase().includes(searchLower) ||
      designation.toLowerCase().includes(searchLower);

    const matchesRole = roleFilter === "all" || roleFilter === roleName;

    return matchesSearch && matchesRole;
  });

  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case "ADMIN":
        return "default";
      case "MANAGER":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6 w-full min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          {/* <p className="text-muted-foreground">
            Manage employee accounts
          </p> */}
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowDialog(true);
          }}
        >
          <UserPlus className="h-4 w-4 mr-1" />
          Add Employee
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="EMPLOYEE">Employee</SelectItem>
              </SelectContent>
            </Select>
            {/* <Button
              variant="outline"
              onClick={fetchEmployees}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Refresh"
              )}
            </Button> */}
          </div>
        </CardContent>
      </Card>

      <Card className="w-full min-w-0">
        <CardHeader>
          <CardTitle>Employees ({filteredEmployees.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      <p className="text-sm text-muted-foreground mt-2">
                        Loading employees...
                      </p>
                    </TableCell>
                  </TableRow>
                ) : filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {searchQuery || roleFilter !== "all"
                        ? "No employees found matching your filters"
                        : "No employees found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((emp) => {
                    const roleName = normalizeRole(emp.role);
                    return (
                      <TableRow key={emp.employee_id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {/* <Avatar>
                              <AvatarFallback>
                                {emp.first_name?.[0]}
                                {emp.last_name?.[0]}
                              </AvatarFallback>
                            </Avatar> */}
                            <div>
                              <div className="font-medium">
                                {emp.first_name} {emp.last_name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {emp.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(roleName)}>
                            {roleName}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {emp.manager_first_name ? (
                            <span className="text-sm font-medium">
                              {emp.manager_first_name} {emp.manager_last_name}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              -
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {emp.department_name || emp.department || "-"}
                        </TableCell>
                        <TableCell>{emp.designation || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              !emp.is_active
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : "bg-green-600 hover:bg-green-700 text-white"
                            }
                          >
                            {emp.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {emp.is_active ? (
                              <>
                                {/* Active Employee - Show Edit & Deactivate */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(emp)}
                                  title="Edit"
                                  aria-label="Edit"
                                >
                                  <Edit className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => confirmDeactivation(emp)}
                                  title="Deactivate"
                                  aria-label="Delete"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive text-red-600" />
                                </Button>
                              </>
                            ) : (
                              <>
                                {/* Inactive Employee - Show Reactivate Only */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleReactivate(emp)}
                                  title="Reactivate Employee"
                                >
                                  <ArchiveRestore className="h-4 w-4 text-green-600" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl overflow-visible">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? "Edit Employee" : "Add New Employee"}
            </DialogTitle>
            <DialogDescription>
              {editingEmployee
                ? "Update employee details below"
                : "Create a new employee account"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  placeholder="Enter First Name"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  placeholder="Enter Last Name"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="Enter Email Address"
                  disabled={submitting || Boolean(editingEmployee)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">
                  {editingEmployee ? "Password (Optional)" : "Password *"}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder={
                      editingEmployee
                        ? "Enter New Password (optional)"
                        : "Enter Password"
                    }
                    disabled={submitting}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
                    disabled={submitting}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    setFormData({ ...formData, role: value })
                  }
                  disabled={submitting}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Select
                  value={formData.department}
                  onValueChange={(value) =>
                    setFormData({ ...formData, department: value })
                  }
                  disabled={submitting}
                >
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select Dept" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.length > 0 ? (
                      departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="OTHER" disabled>
                        No departments found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="designation">Designation *</Label>
                <Input
                  id="designation"
                  value={formData.designation}
                  onChange={(e) =>
                    setFormData({ ...formData, designation: e.target.value })
                  }
                  placeholder="Enter Designation"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employeeCode">Employee Code *</Label>
                <Input
                  id="employeeCode"
                  value={formData.employeeCode}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      employeeCode: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="ENTER CODE"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2 relative" ref={managerRef}>
                <Label htmlFor="moduleManagerId">Reporting Manager *</Label>
                <Input
                  id="moduleManagerId"
                  placeholder="Search Reporting Manager..."
                  value={managerSearch}
                  onChange={(e) => {
                    setManagerSearch(e.target.value);
                    setShowManagerList(true);
                  }}
                  onFocus={() => setShowManagerList(true)}
                  onClick={() => setShowManagerList(true)} // ✅ ensures open on click
                  disabled={submitting}
                  autoComplete="off"
                />

                {showManagerList && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border rounded-md shadow-md">
                    {filteredManagers.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        No manager found
                      </div>
                    ) : (
                      filteredManagers.map((mgr) => (
                        <div
                          key={mgr.employee_id}
                          className={`p-2 text-sm cursor-pointer hover:bg-gray-100 ${
                            formData.moduleManagerId === mgr.employee_id
                              ? "bg-gray-200 font-medium"
                              : ""
                          }`}
                          onClick={() => {
                            setFormData({
                              ...formData,
                              moduleManagerId: mgr.employee_id,
                            });

                            setManagerSearch(
                              `${mgr.first_name} ${mgr.last_name}`,
                            );

                            setShowManagerList(false);
                          }}
                        >
                          {mgr.first_name} {mgr.last_name}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="doj">Date of Joining *</Label>
                <Input
                  id="doj"
                  type="date"
                  value={formData.doj}
                  onChange={(e) =>
                    setFormData({ ...formData, doj: e.target.value })
                  }
                  disabled={submitting}
                />
              </div>
            </div>

            {editingEmployee && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="separationDate">Separation Date</Label>
                  <Input
                    id="separationDate"
                    type="date"
                    value={formData.separationDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        separationDate: e.target.value,
                      })
                    }
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2 flex items-center pt-8">
                  <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          isActive: e.target.checked,
                        })
                      }
                      className="form-checkbox h-5 w-5 text-primary rounded border-gray-300 focus:ring-primary"
                    />
                    <span className="text-sm font-medium leading-none">
                      Is Active Employee
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleDialogClose(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {editingEmployee ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>{editingEmployee ? "Update" : "Create"} Employee</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showDeactivateDialog}
        onOpenChange={(open) => !submitting && setShowDeactivateDialog(open)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Deactivate Employee
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate{" "}
              <b>
                {deactivatingEmployee?.first_name}{" "}
                {deactivatingEmployee?.last_name}
              </b>
              ?
              <br />
              This action will remove their access to the system.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="confirmSeparationDate">
                Separation Date (Required)
              </Label>
              <Input
                id="confirmSeparationDate"
                type="date"
                value={separationDateInput}
                onChange={(e) => setSeparationDateInput(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeactivateDialog(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivateSubmit}
              disabled={submitting || !separationDateInput}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Confirm Deactivation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

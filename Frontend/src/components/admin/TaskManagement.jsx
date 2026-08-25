import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
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
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  ListTodo,
  Loader2,
  AlertTriangle,
  Briefcase,
  ArchiveRestore, // ✅ NEW: Import reactivate icon
} from "lucide-react";
import taskService from "../../services/taskService";

const initialFormState = {
  department: "",
  internalProject: "",
  task: "",
  // For new department/project creation
  newDepartment: "",
  newInternalProject: "",
};

export function TaskManagement() {
  const [tasks, setTasks] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [internalProjects, setInternalProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState(initialFormState);

  // ✅ Track if user selected "New Department" or "New Internal Project"
  const [isNewDepartment, setIsNewDepartment] = useState(false);
  const [isNewInternalProject, setIsNewInternalProject] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchDepartments();
    fetchInternalProjects();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const data = await taskService.getAllTasks();
      setTasks(data.tasks || []);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fetch departments list
  const fetchDepartments = async () => {
    try {
      const data = await taskService.getAllDepartments();
      setDepartments(data.departments || []);
    } catch (error) {
      console.error("Failed to fetch departments:", error);
      toast.error("Failed to load departments");
    }
  };

  // ✅ Fetch unique internal projects
  const fetchInternalProjects = async () => {
    try {
      const data = await taskService.getAllTasks();
      // Extract unique internal projects
      const projects = [
        ...new Set(
          (data.tasks || [])
            .map((t) => t.internal_project)
            .filter((p) => p && p.trim())
        ),
      ];
      setInternalProjects(projects.sort());
    } catch (error) {
      console.error("Failed to fetch internal projects:", error);
    }
  };

  const handleEdit = (task) => {
    setEditingTask(task);
    setFormData({
      department: task.department || "",
      internalProject: task.internal_project || "",
      task: task.task || "",
      newDepartment: "",
      newInternalProject: "",
    });
    setIsNewDepartment(false);
    setIsNewInternalProject(false);
    setShowDialog(true);
  };

  const handleDeleteConfirm = (task) => {
    setDeletingTask(task);
    setShowDeleteDialog(true);
  };

  // ✅ NEW: Handle reactivation
  const handleReactivate = async (task) => {
    if (
      !window.confirm(
        `Are you sure you want to reactivate task "${task.task}"?`
      )
    ) {
      return;
    }

    try {
      setSubmitting(true);
      await taskService.reactivateTask(task.task_id);
      toast.success("Task reactivated successfully");
      await fetchTasks();
    } catch (error) {
      console.error("Failed to reactivate task:", error);
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Failed to reactivate task";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ UPDATED: Comprehensive validation - all 3 fields mandatory
  const validateForm = () => {
    // Department validation
    if (isNewDepartment) {
      if (!formData.newDepartment || !formData.newDepartment.trim()) {
        toast.error("Please enter a new department name");
        return false;
      }
    } else {
      if (!formData.department || !formData.department.trim()) {
        toast.error("Please select a department");
        return false;
      }
    }

    // Internal Project validation (MANDATORY)
    if (isNewInternalProject) {
      if (!formData.newInternalProject || !formData.newInternalProject.trim()) {
        toast.error("Please enter a new internal project name");
        return false;
      }
    } else {
      if (!formData.internalProject || !formData.internalProject.trim()) {
        toast.error("Please select an internal project");
        return false;
      }
    }

    // Task Name validation
    if (!formData.task || !formData.task.trim()) {
      toast.error("Task Name is required");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);

      // ✅ Determine final department value
      const finalDepartment = isNewDepartment
        ? formData.newDepartment.trim()
        : formData.department.trim();

      // ✅ Determine final internal project value
      const finalInternalProject = isNewInternalProject
        ? formData.newInternalProject.trim()
        : formData.internalProject.trim();

      const payload = {
        department: finalDepartment,
        internalProject: finalInternalProject, // Now mandatory
        task: formData.task.trim(),
      };

      if (editingTask) {
        await taskService.updateTask(editingTask.task_id, payload);
        toast.success("Task updated successfully");
      } else {
        await taskService.createTask(payload);
        toast.success("Task created successfully");
      }

      setShowDialog(false);
      setEditingTask(null);
      setFormData(initialFormState);
      setIsNewDepartment(false);
      setIsNewInternalProject(false);
      await fetchTasks();
      await fetchDepartments(); // Refresh departments if new one was added
      await fetchInternalProjects(); // Refresh projects if new one was added
    } catch (error) {
      console.error("Save task error:", error);
      toast.error(error?.response?.data?.error || "Failed to save task");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTask) return;

    try {
      setSubmitting(true);
      await taskService.deleteTask(deletingTask.task_id);
      toast.success("Task deleted successfully");
      setShowDeleteDialog(false);
      setDeletingTask(null);
      await fetchTasks();
    } catch (error) {
      console.error("Delete task error:", error);
      const msg = error?.response?.data?.error || "Failed to delete task";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDialogClose = (open) => {
    if (!open && !submitting) {
      setShowDialog(false);
      setEditingTask(null);
      setFormData(initialFormState);
      setIsNewDepartment(false);
      setIsNewInternalProject(false);
    }
  };

  // ✅ Handle department dropdown change
  const handleDepartmentChange = (value) => {
    if (value === "NEW_DEPARTMENT") {
      setIsNewDepartment(true);
      setFormData({ ...formData, department: "" });
    } else {
      setIsNewDepartment(false);
      setFormData({ ...formData, department: value });
    }
  };

  // ✅ Handle internal project dropdown change
  const handleInternalProjectChange = (value) => {
    if (value === "NEW_PROJECT") {
      setIsNewInternalProject(true);
      setFormData({ ...formData, internalProject: "" });
    } else {
      setIsNewInternalProject(false);
      setFormData({ ...formData, internalProject: value });
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const search = searchQuery.toLowerCase();
    return (
      (t.task || "").toLowerCase().includes(search) ||
      (t.department || "").toLowerCase().includes(search) ||
      (t.internal_project || "").toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ListTodo className="h-8 w-8" />
            Task Management
          </h1>
          {/* <p className="text-muted-foreground mt-1">
            Configure standard tasks for departments and internal projects.
          </p> */}
        </div>
        <Button
          onClick={() => {
            setFormData(initialFormState);
            setEditingTask(null);
            setIsNewDepartment(false);
            setIsNewInternalProject(false);
            setShowDialog(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by task, department, or project..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Tasks ({filteredTasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Internal Project</TableHead>
                  <TableHead>Task Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      <p className="text-sm text-muted-foreground mt-2">
                        Loading tasks...
                      </p>
                    </TableCell>
                  </TableRow>
                ) : filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((task) => {
                    const isInactive = task.is_active === false;

                    return (
                      <TableRow
                        key={task.task_id}
                        className={isInactive ? "opacity-50 bg-/30" : ""}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {task.department}
                            {isInactive && (
                              <Badge variant="outline" className="text-xs">
                                Inactive
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                            {task.internal_project || "-"}
                          </div>
                        </TableCell>
                        <TableCell>{task.task}</TableCell>
                        <TableCell>
                          {task.is_active ? (
                            <Badge className="bg-green-500 hover:bg-green-600">
                              Active
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500 hover:bg-red-600">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {/* ✅ UPDATED: Conditional rendering based on is_active */}
                          <div className="flex justify-end gap-2">
                            {task.is_active ? (
                              <>
                                {/* Active Task: Show Edit & Delete */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(task)}
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteConfirm(task)}
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive text-red-600"  />
                                </Button>
                              </>
                            ) : (
                              <>
                                {/* Inactive Task: Show Reactivate Only */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleReactivate(task)}
                                  title="Reactivate Task"
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

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? "Edit Task" : "Add New Task"}
            </DialogTitle>
            <DialogDescription>
              All fields are mandatory. Select existing options or add new ones.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Department Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="department">
                Department <span className="text-red-500">*</span>
              </Label>
              {isNewDepartment ? (
                <div className="space-y-2">
                  <Input
                    placeholder="Enter new department name"
                    value={formData.newDepartment}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        newDepartment: e.target.value,
                      })
                    }
                    disabled={submitting}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsNewDepartment(false);
                      setFormData({ ...formData, newDepartment: "" });
                    }}
                  >
                    Cancel - Select Existing
                  </Button>
                </div>
              ) : (
                <Select
                  value={formData.department}
                  onValueChange={handleDepartmentChange}
                  disabled={submitting || !!editingTask}
                >
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="NEW_DEPARTMENT"
                      className="font-semibold text-primary"
                    >
                      + New Department
                    </SelectItem>
                    {departments.length > 0 ? (
                      departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.name}>
                          {dept.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-options" disabled>
                        No departments found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Internal Project Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="internalProject">
                Internal Project <span className="text-red-500">*</span>
              </Label>
              {isNewInternalProject ? (
                <div className="space-y-2">
                  <Input
                    placeholder="Enter new internal project name"
                    value={formData.newInternalProject}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        newInternalProject: e.target.value,
                      })
                    }
                    disabled={submitting}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsNewInternalProject(false);
                      setFormData({ ...formData, newInternalProject: "" });
                    }}
                  >
                    Cancel - Select Existing
                  </Button>
                </div>
              ) : (
                <Select
                  value={formData.internalProject}
                  onValueChange={handleInternalProjectChange}
                  disabled={submitting}
                >
                  <SelectTrigger id="internalProject">
                    <SelectValue placeholder="Select internal project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="NEW_PROJECT"
                      className="font-semibold text-primary"
                    >
                      + New Internal Project
                    </SelectItem>
                    {internalProjects.length > 0 ? (
                      internalProjects.map((project) => (
                        <SelectItem key={project} value={project}>
                          {project}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-options" disabled>
                        No internal projects found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Task Name */}
            <div className="space-y-2">
              <Label htmlFor="task">
                Task Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="task"
                placeholder="Enter task name"
                value={formData.task}
                onChange={(e) =>
                  setFormData({ ...formData, task: e.target.value })
                }
                disabled={submitting}
              />
            </div>
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
                  {editingTask ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>{editingTask ? "Update" : "Create"} Task</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Task
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this task?
              <div className="mt-3 p-3 bg-muted rounded-md">
                <p className="font-medium">{deletingTask?.task}</p>
                <p className="text-sm text-muted-foreground">
                  {deletingTask?.department} - {deletingTask?.internal_project}
                </p>
              </div>
              <p className="mt-3 text-sm text-destructive">
                This action cannot be undone. This will permanently delete the
                task from the system.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>Delete Task</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TaskManagement;

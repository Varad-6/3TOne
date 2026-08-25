import React, { useEffect, useState, useCallback } from "react";
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
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import projectService from "../../services/projectService";
import employeeService from "../../services/employeeService";

const initialFormState = {
  clientId: 0,
  projectName: "",
  startDate: "",
  endDate: "",
  status: "Planned",
  managerId: undefined,
};

export function ProjectAssignment() {
  const [projects, setProjects] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [assignManagerId, setAssignManagerId] = useState(undefined);
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  useEffect(() => {
    fetchProjects();
    fetchManagers();
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const data = await projectService.getAllProjects();
      setProjects(data);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      toast.error(error?.response?.data?.message || "Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchManagers = useCallback(async () => {
    try {
      const data = await employeeService.getAllEmployees({ role: "MANAGER" });
      setManagers(data.employees || []);
    } catch (error) {
      console.error("Failed to fetch managers:", error);
      toast.error(error?.response?.data?.message || "Failed to fetch managers");
    }
  }, []);

  const validateForm = () => {
    if (!formData.projectName.trim()) {
      toast.error("Project name is required");
      return false;
    }
    if (!formData.clientId) {
      toast.error("Client ID is required");
      return false;
    }
    if (!formData.startDate) {
      toast.error("Start date is required");
      return false;
    }
    if (!formData.endDate) {
      toast.error("End date is required");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);

      const createUpdateData = {
        clientId: formData.clientId,
        projectName: formData.projectName,
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: formData.status,
      };

      if (editingProject) {
        await projectService.updateProject(
          editingProject.project_id,
          createUpdateData
        );
        toast.success("Project updated successfully");
      } else {
        await projectService.createProject(createUpdateData);
        toast.success("Project created successfully");
      }

      setShowDialog(false);
      resetForm();
      await fetchProjects();
    } catch (error) {
      console.error("Failed to save project:", error);
      toast.error(error?.response?.data?.message || "Failed to save project");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignManager = async () => {
    if (!editingProject?.project_id) return;
    if (!assignManagerId) {
      toast.error("Please select a manager to assign");
      return;
    }

    try {
      setAssignSubmitting(true);
      await projectService.assignManager(
        editingProject.project_id,
        assignManagerId
      );
      toast.success("Manager assigned successfully");
      setAssignManagerId(undefined);
      await fetchProjects();

      const updatedProject = await projectService.getProjectById(
        editingProject.project_id
      );
      setEditingProject(updatedProject);
    } catch (error) {
      console.error("Failed to assign manager:", error);
      toast.error(error?.response?.data?.message || "Failed to assign manager");
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleUnassignManager = async (managerId) => {
    if (!editingProject?.project_id) return;
    try {
      await projectService.unassignManager(
        editingProject.project_id,
        managerId
      );
      toast.success("Manager unassigned successfully");
      const updatedProject = await projectService.getProjectById(
        editingProject.project_id
      );
      setEditingProject(updatedProject);
      await fetchProjects();
    } catch (error) {
      console.error("Failed to unassign manager:", error);
      toast.error(
        error?.response?.data?.message || "Failed to unassign manager"
      );
    }
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setFormData({
      clientId: project.client_id,
      projectName: project.project_name,
      startDate: project.start_date,
      endDate: project.end_date,
      status: project.status,
    });
    setShowDialog(true);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to deactivate project ${name}?`))
      return;
    try {
      await projectService.deleteProject(id);
      toast.success("Project deactivated successfully");
      await fetchProjects();
    } catch (error) {
      console.error("Failed to deactivate project:", error);
      toast.error(
        error?.response?.data?.message || "Failed to deactivate project"
      );
    }
  };

  const resetForm = () => {
    setEditingProject(null);
    setFormData(initialFormState);
    setAssignManagerId(undefined);
  };

  const handleDialogClose = (open) => {
    if (!open && !submitting && !assignSubmitting) {
      setShowDialog(false);
      resetForm();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Project Assignment</h1>
          <p className="text-muted-foreground">
            Manage projects and assign them to managers
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowDialog(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Project
        </Button>
      </div>

      {/* Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle>Projects ({projects.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project Name</TableHead>
                  <TableHead>Client ID</TableHead>
                  <TableHead>Assigned Managers</TableHead>
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
                        Loading projects...
                      </p>
                    </TableCell>
                  </TableRow>
                ) : projects.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No projects found
                    </TableCell>
                  </TableRow>
                ) : (
                  projects.map((proj) => (
                    <TableRow key={proj.project_id}>
                      <TableCell>{proj.project_name}</TableCell>
                      <TableCell>{proj.client_id}</TableCell>
                      <TableCell>
                        {proj.assigned_employees &&
                        proj.assigned_employees.length > 0
                          ? proj.assigned_employees
                              .map((mgr) => mgr.manager_name)
                              .join(", ")
                          : "Unassigned"}
                      </TableCell>
                      <TableCell>{proj.status}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(proj)}
                            title="Edit"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleDelete(proj.project_id, proj.project_name)
                            }
                            title="Deactivate"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingProject ? "Edit Project" : "Add New Project"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Project form */}
            <div className="space-y-2">
              <Label htmlFor="projectName">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="projectName"
                value={formData.projectName}
                onChange={(e) =>
                  setFormData({ ...formData, projectName: e.target.value })
                }
                placeholder="Project Name"
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientId">
                Client ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="clientId"
                type="number"
                value={formData.clientId}
                onChange={(e) =>
                  setFormData({ ...formData, clientId: Number(e.target.value) })
                }
                placeholder="Client ID"
                disabled={submitting}
              />
            </div>

            <div className="flex gap-4">
              <div className="space-y-2 flex-1">
                <Label htmlFor="startDate">
                  Start Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2 flex-1">
                <Label htmlFor="endDate">
                  End Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
                disabled={submitting}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Planned">Planned</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="On Hold">On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assigned managers list with unassign buttons */}
            {editingProject && (
              <div>
                <Label>Assigned Managers:</Label>
                {editingProject.assigned_employees &&
                editingProject.assigned_employees.length > 0 ? (
                  <ul className="mb-4">
                    {editingProject.assigned_employees.map((mgr) => (
                      <li
                        key={mgr.project_assign_id}
                        className="flex items-center gap-2"
                      >
                        <span>{mgr.manager_name}</span>
                        <Button
                          variant="destructive"
                          onClick={() => handleUnassignManager(mgr.manager_id)}
                          disabled={assignSubmitting}
                          title="Unassign Manager"
                        >
                          Unassign
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No managers assigned yet.</p>
                )}

                {/* Assign new manager */}
                <div className="flex items-center gap-2">
                  <Select
                    value={assignManagerId}
                    onValueChange={(value) => setAssignManagerId(value)}
                    disabled={assignSubmitting}
                    aria-label="Assign Manager"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a manager to assign" />
                    </SelectTrigger>
                    <SelectContent>
                      {managers.map((manager) => (
                        <SelectItem
                          key={manager.employee_id}
                          value={manager.employee_id}
                        >
                          {manager.first_name} {manager.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAssignManager}
                    disabled={assignSubmitting || !assignManagerId}
                  >
                    {assignSubmitting ? "Assigning..." : "Assign Manager"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleDialogClose(false)}
              disabled={submitting || assignSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting
                ? "Saving..."
                : editingProject
                ? "Update Project"
                : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default ProjectAssignment;

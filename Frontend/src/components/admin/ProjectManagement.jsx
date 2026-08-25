import React, { useEffect, useState, useRef } from "react";
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
import { Textarea } from "../ui/textarea";
import { toast } from "sonner";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Loader2,
  Eye,
  ArchiveRestore,
} from "lucide-react";
import projectService from "../../services/projectService";
import clientService from "../../services/clientService";
import employeeService from "../../services/employeeService";
import { format } from "date-fns";

// ---------------------------------------------------------------------------
// Helpers: convert between total minutes (DB) and HH:MM display string
// ---------------------------------------------------------------------------

/**
 * Convert total minutes (integer) → "HH:MM" string.
 * e.g. 125 → "02:05",  3600 → "60:00"
 */
const minutesToHHMM = (totalMinutes) => {
  if (
    totalMinutes === null ||
    totalMinutes === undefined ||
    totalMinutes === ""
  )
    return "";
  const mins = Number(totalMinutes);
  if (isNaN(mins)) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/**
 * Convert "HH:MM" string → total minutes (integer), or null if empty/invalid.
 * Supports hours beyond 23, e.g. "100:30" → 6030.
 */
const hhmmToMinutes = (hhmm) => {
  if (!hhmm || !String(hhmm).trim()) return null;
  const parts = String(hhmm).trim().split(":");
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m) || m < 0 || m >= 60 || h < 0) return null;
  return h * 60 + m;
};

// ---------------------------------------------------------------------------

const initialFormState = {
  project_name: "",
  zoho_crm_code: "",
  client_id: "",
  manager_id: "",
  start_date: new Date(),
  end_date: null,
  status: "Planned",
  description: "",
  spoc_name: "",
  spoc_email: "",
  spoc_phone: "",
  billable_hours: "", // stored as "HH:MM" string in the form state
  isActive: true,
};

export function ProjectManagement() {
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [showDialog, setShowDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [formData, setFormData] = useState(initialFormState);

  // Client inline search
  const [clientSearch, setClientSearch] = useState("");
  const [showClientList, setShowClientList] = useState(false);

  // Manager inline search
  const [managerSearch, setManagerSearch] = useState("");
  const [showManagerList, setShowManagerList] = useState(false);

  const clientRef = useRef(null);
  const managerRef = useRef(null);

  const filteredClients = clients.filter((client) => {
    const fullName = client.client_name?.toLowerCase() || "";
    return fullName.includes(clientSearch.toLowerCase());
  });

  const filteredManagers = managers.filter((mgr) => {
    const fullName = `${mgr.first_name} ${mgr.last_name}`.toLowerCase();
    return fullName.includes(managerSearch.toLowerCase());
  });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (clientRef.current && !clientRef.current.contains(event.target)) {
        setShowClientList(false);
      }
      if (managerRef.current && !managerRef.current.contains(event.target)) {
        setShowManagerList(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchClients();
    fetchManagers();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const data = await projectService.getAllProjects();
      setProjects(data?.projects || []);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      toast.error(error?.response?.data?.message || "Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const data = await clientService.getAllClients();
      setClients(data?.clients || []);
    } catch (error) {
      console.error("Failed to fetch clients:", error);
    }
  };

  const fetchManagers = async () => {
    try {
      const data = await employeeService.getAllEmployees({ role: "MANAGER" });
      setManagers(data?.employees || []);
    } catch (error) {
      console.error("Failed to fetch managers:", error);
    }
  };

  const validateForm = () => {
    if (!formData.project_name.trim()) {
      toast.error("Project name is required");
      return false;
    }
    if (!formData.zoho_crm_code.trim()) {
      toast.error("Zoho CRM Code is required");
      return false;
    }
    if (!formData.client_id) {
      toast.error("Please select a client");
      return false;
    }
    if (!formData.start_date) {
      toast.error("Start date is required");
      return false;
    }
    if (formData.end_date && formData.end_date < formData.start_date) {
      toast.error("End date cannot be before start date");
      return false;
    }
    if (formData.spoc_email && !formData.spoc_email.includes("@")) {
      toast.error("Please enter a valid email");
      return false;
    }
    // Validate HH:MM format if a value was entered
    if (formData.billable_hours && formData.billable_hours.trim()) {
      if (hhmmToMinutes(formData.billable_hours) === null) {
        toast.error("Billable hours must be in HH:MM format (e.g. 100:30)");
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);

      // Convert HH:MM → minutes for the API
      const billableMinutes = formData.billable_hours
        ? hhmmToMinutes(formData.billable_hours)
        : null;

      const payload = {
        clientId: formData.client_id,
        projectName: formData.project_name,
        zohoCrmCode: formData.zoho_crm_code,
        managerId:
          formData.manager_id && formData.manager_id !== "none"
            ? formData.manager_id
            : null,
        startDate: format(formData.start_date, "yyyy-MM-dd"),
        endDate: formData.end_date
          ? format(formData.end_date, "yyyy-MM-dd")
          : null,
        status: formData.status,
        description: formData.description || null,
        spocName: formData.spoc_name || null,
        spocEmail: formData.spoc_email || null,
        spocPhone: formData.spoc_phone || null,
        isActive: formData.isActive,
        billableHours: billableMinutes, // sent as total minutes
      };

      if (editingProject) {
        await projectService.updateProject(editingProject.project_id, payload);
        toast.success("Project updated successfully");
      } else {
        await projectService.createProject(payload);
        toast.success("Project created successfully");
      }

      setShowDialog(false);
      resetForm();
      await fetchProjects();
    } catch (error) {
      console.error("Failed to save project:", error);
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Failed to save project";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setFormData({
      project_name: project.project_name || "",
      zoho_crm_code: project.zoho_crm_code || "",
      client_id: project.client_id || "",
      manager_id: project.manager_id || "",
      start_date: project.start_date
        ? new Date(project.start_date)
        : new Date(),
      end_date: project.end_date ? new Date(project.end_date) : null,
      status: project.status || "Planned",
      description: project.description || "",
      spoc_name: project.spoc_name || "",
      spoc_email: project.spoc_email || "",
      spoc_phone: project.spoc_phone || "",
      // Convert stored minutes → HH:MM for the form
      billable_hours: minutesToHHMM(project.billable_hours),
      isActive: project.is_active,
    });
    setClientSearch(project.client_name || "");

    if (project.manager_first_name) {
      setManagerSearch(
        `${project.manager_first_name} ${project.manager_last_name}`,
      );
    } else {
      setManagerSearch("");
    }

    setShowDialog(true);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete project "${name}"?`)) return;
    try {
      await projectService.deleteProject(id);
      toast.success("Project deleted");
      await fetchProjects();
    } catch (error) {
      console.error("Delete error:", error);
      const errorMessage =
        error?.response?.data?.message || "Failed to delete project";
      toast.error(errorMessage);
    }
  };

  const handleReactivate = async (project) => {
    if (
      !window.confirm(
        `Are you sure you want to reactivate "${project.project_name}"?`,
      )
    ) {
      return;
    }

    try {
      setSubmitting(true);
      await projectService.reactivateProject(project.project_id);
      toast.success("Project reactivated successfully");
      await fetchProjects();
    } catch (error) {
      console.error("Failed to reactivate project:", error);
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Failed to reactivate project";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingProject(null);
    setFormData(initialFormState);
    setClientSearch("");
    setManagerSearch("");
  };

  const handleDialogClose = (open) => {
    if (!open && !submitting) {
      setShowDialog(false);
      resetForm();
    }
  };

  const filteredProjects = projects.filter((project) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      project.project_name.toLowerCase().includes(q) ||
      project.zoho_crm_code?.toLowerCase().includes(q) ||
      (project.client_name && project.client_name.toLowerCase().includes(q));

    const matchesStatus =
      statusFilter === "all" || project.status === statusFilter;
    const matchesClient =
      clientFilter === "all" || project.client_id === clientFilter;

    return matchesSearch && matchesStatus && matchesClient;
  });

  const getStatusBadgeColor = (statusName) => {
    const colorMap = {
      Planned: "bg-blue-500 hover:bg-blue-600 text-white rounded-full",
      "In Progress":
        "bg-yellow-500 hover:bg-yellow-600 text-yellow-950 rounded-full",
      Completed: "bg-green-500 hover:bg-green-600 text-white rounded-full",
      "On Hold": "bg-gray-500 hover:bg-gray-600 text-white rounded-full",
      Cancelled: "bg-red-500 hover:bg-red-600 text-white rounded-full",
    };
    return (
      colorMap[statusName] ||
      "bg-gray-500 hover:bg-gray-600 text-white rounded-full"
    );
  };

  const getManagerName = (project) => {
    if (project.manager_first_name) {
      return `${project.manager_first_name} ${project.manager_last_name}`;
    }
    if (project.manager_id && managers.length > 0) {
      const mgr = managers.find((m) => m.employee_id === project.manager_id);
      if (mgr) return `${mgr.first_name} ${mgr.last_name}`;
    }
    return "-";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Project Management</h1>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowDialog(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" /> New Project
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem key="all" value="all">
                  All Clients
                </SelectItem>
                {clients
                  .filter((c) => c.is_active)
                  .map((c) => (
                    <SelectItem key={c.client_id} value={c.client_id}>
                      {c.client_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem key="all" value="all">
                  All Statuses
                </SelectItem>
                <SelectItem key="Planned" value="Planned">
                  Planned
                </SelectItem>
                <SelectItem key="In Progress" value="In Progress">
                  In Progress
                </SelectItem>
                <SelectItem key="Completed" value="Completed">
                  Completed
                </SelectItem>
                <SelectItem key="On Hold" value="On Hold">
                  On Hold
                </SelectItem>
                <SelectItem key="Cancelled" value="Cancelled">
                  Cancelled
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle>Projects ({filteredProjects.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Zoho CRM Code</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Billable Hours</TableHead>
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
                        Loading...
                      </p>
                    </TableCell>
                  </TableRow>
                ) : filteredProjects.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No projects found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProjects.map((p) => {
                    const isInactive = p.is_active === false;
                    const managerName = getManagerName(p);

                    return (
                      <TableRow
                        key={p.project_id}
                        className={isInactive ? "opacity-50 bg-muted/30" : ""}
                      >
                        <TableCell className="font-medium">
                          <span className={isInactive ? "line-through" : ""}>
                            {p.project_name}
                          </span>
                          {isInactive && (
                            <Badge className="ml-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded-full">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{p.zoho_crm_code}</TableCell>
                        <TableCell className={isInactive ? "line-through" : ""}>
                          {p.client_name || "-"}
                        </TableCell>
                        <TableCell>{managerName}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {p.billable_hours
                            ? minutesToHHMM(p.billable_hours)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(p.status)}>
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="View"
                              onClick={() => {
                                setSelectedProject(p);
                                setShowViewDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4 text-blue-600" />
                            </Button>

                            {p.is_active ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(p)}
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleDelete(p.project_id, p.project_name)
                                  }
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive text-red-600" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReactivate(p)}
                                title="Reactivate Project"
                              >
                                <ArchiveRestore className="h-4 w-4 text-green-600" />
                              </Button>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProject ? "Edit Project" : "Create New Project"}
            </DialogTitle>
            <DialogDescription>
              {editingProject
                ? "Update project details below"
                : "Add a new project to the system"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="projectName">Project Name *</Label>
              <Input
                id="projectName"
                value={formData.project_name}
                onChange={(e) =>
                  setFormData({ ...formData, project_name: e.target.value })
                }
                placeholder="Enter project name"
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zohoCrmCode">Zoho CRM Code *</Label>
              <Input
                id="zohoCrmCode"
                value={formData.zoho_crm_code}
                onChange={(e) =>
                  setFormData({ ...formData, zoho_crm_code: e.target.value })
                }
                placeholder="Zoho Project ID"
                disabled={submitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Client */}
              <div className="space-y-2 relative" ref={clientRef}>
                <Label>Client *</Label>
                <Input
                  placeholder="Search client..."
                  value={clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setShowClientList(true);
                  }}
                  onFocus={() => setShowClientList(true)}
                  onClick={() => setShowClientList(true)}
                  disabled={submitting}
                  autoComplete="off"
                />
                {showClientList && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border rounded-md shadow-md">
                    <div className="max-h-52 overflow-y-auto">
                      {filteredClients.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          No client found
                        </div>
                      ) : (
                        filteredClients.map((client) => {
                          const isSelected =
                            formData.client_id === client.client_id;
                          return (
                            <div
                              key={client.client_id}
                              className={`px-3 py-2 text-sm cursor-pointer transition-colors
                                ${isSelected ? "bg-gray-200 font-medium" : ""}
                                hover:bg-gray-100`}
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  client_id: client.client_id,
                                });
                                setClientSearch(client.client_name);
                                setShowClientList(false);
                              }}
                            >
                              {client.client_name}
                              {!client.is_active && " (Inactive)"}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Manager */}
              <div className="space-y-2 relative" ref={managerRef}>
                <Label>Project Manager</Label>
                <Input
                  placeholder="Search manager..."
                  value={managerSearch}
                  onChange={(e) => {
                    setManagerSearch(e.target.value);
                    setShowManagerList(true);
                  }}
                  onFocus={() => setShowManagerList(true)}
                  onClick={() => setShowManagerList(true)}
                  disabled={submitting}
                  autoComplete="off"
                />
                {showManagerList && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border rounded-md shadow-md">
                    <div className="max-h-52 overflow-y-auto">
                      <div
                        className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          setFormData({ ...formData, manager_id: null });
                          setManagerSearch("");
                          setShowManagerList(false);
                        }}
                      >
                        No Manager
                      </div>
                      {filteredManagers.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          No manager found
                        </div>
                      ) : (
                        filteredManagers.map((mgr) => {
                          const isSelected =
                            formData.manager_id === mgr.employee_id;
                          return (
                            <div
                              key={mgr.employee_id}
                              className={`px-3 py-2 text-sm cursor-pointer transition-colors
                                ${isSelected ? "bg-gray-200 font-medium" : ""}
                                hover:bg-gray-100`}
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  manager_id: mgr.employee_id,
                                });
                                setManagerSearch(
                                  `${mgr.first_name} ${mgr.last_name}`,
                                );
                                setShowManagerList(false);
                              }}
                            >
                              {mgr.first_name} {mgr.last_name}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Status / Start Date / End Date / Billable Hours */}
            <div className="grid grid-cols-4 gap-4">
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
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={format(formData.start_date, "yyyy-MM-dd")}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      start_date: new Date(e.target.value),
                    })
                  }
                  disabled={submitting}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={
                    formData.end_date
                      ? format(formData.end_date, "yyyy-MM-dd")
                      : ""
                  }
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      end_date: e.target.value
                        ? new Date(e.target.value)
                        : null,
                    })
                  }
                  min={format(formData.start_date, "yyyy-MM-dd")}
                  disabled={submitting}
                />
              </div>

              {/* ── Billable Hours (HH:MM) ── */}
              <div className="space-y-2">
                <Label htmlFor="billableHours">
                  Billable Hours
                </Label>
                <Input
                  id="billableHours"
                  type="text"
                  inputMode="numeric"
                  value={formData.billable_hours}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      billable_hours: e.target.value,
                    })
                  }
                  onBlur={(e) => {
                    // Auto-format on blur: "100" → "100:00", "2:5" → "02:05"
                    const raw = e.target.value.trim();
                    if (!raw) return;
                    if (!raw.includes(":")) {
                      // treat as whole hours
                      const h = parseInt(raw, 10);
                      if (!isNaN(h)) {
                        setFormData({
                          ...formData,
                          billable_hours: `${String(h).padStart(2, "0")}:00`,
                        });
                      }
                    } else {
                      // re-format both parts with leading zeros
                      const mins = hhmmToMinutes(raw);
                      if (mins !== null) {
                        setFormData({
                          ...formData,
                          billable_hours: minutesToHHMM(mins),
                        });
                      }
                    }
                  }}
                  placeholder="e.g. 100:30"
                  disabled={submitting}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Project description (optional)"
                disabled={submitting}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="spocName">SPOC Name</Label>
                <Input
                  id="spocName"
                  value={formData.spoc_name}
                  onChange={(e) =>
                    setFormData({ ...formData, spoc_name: e.target.value })
                  }
                  placeholder="Contact person"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spocEmail">SPOC Email</Label>
                <Input
                  id="spocEmail"
                  type="email"
                  value={formData.spoc_email}
                  onChange={(e) =>
                    setFormData({ ...formData, spoc_email: e.target.value })
                  }
                  placeholder="email@example.com"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spocPhone">SPOC Phone</Label>
                <Input
                  id="spocPhone"
                  type="tel"
                  value={formData.spoc_phone}
                  onChange={(e) =>
                    setFormData({ ...formData, spoc_phone: e.target.value })
                  }
                  placeholder="+1234567890"
                  disabled={submitting}
                />
              </div>
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
                  {editingProject ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>{editingProject ? "Update" : "Create"} Project</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedProject?.project_name}</DialogTitle>
            <DialogDescription>Project details</DialogDescription>
          </DialogHeader>
          {selectedProject && (
            <div className="space-y-3 mt-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">
                  Zoho Code:
                </span>
                <span>{selectedProject.zoho_crm_code || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">
                  Client:
                </span>
                <span>{selectedProject.client_name || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">
                  Manager:
                </span>
                <span>{getManagerName(selectedProject)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">
                  Status:
                </span>
                <Badge className={getStatusBadgeColor(selectedProject.status)}>
                  {selectedProject.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">
                  Start Date:
                </span>
                <span>
                  {format(new Date(selectedProject.start_date), "MMM dd, yyyy")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">
                  End Date:
                </span>
                <span>
                  {selectedProject.end_date
                    ? format(new Date(selectedProject.end_date), "MMM dd, yyyy")
                    : "-"}
                </span>
              </div>
              {/* Billable Hours in HH:MM */}
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">
                  Billable Hours:
                </span>
                <span className="font-mono">
                  {selectedProject.billable_hours
                    ? minutesToHHMM(selectedProject.billable_hours)
                    : "-"}
                </span>
              </div>
              {selectedProject.description && (
                <div>
                  <span className="font-medium text-muted-foreground">
                    Description:
                  </span>
                  <p className="mt-1 text-muted-foreground">
                    {selectedProject.description}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="default" onClick={() => setShowViewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProjectManagement;

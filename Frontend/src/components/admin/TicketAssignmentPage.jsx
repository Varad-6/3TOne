import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
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
import { Alert, AlertDescription } from "../ui/alert";
import { toast } from "sonner";
import {
  UserPlus,
  User,
  Search,
  Loader2,
  Ticket as TicketIcon,
  Users,
  Save,
  Trash2,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Circle,
} from "lucide-react";
import api from "../../services/api";
import { format } from "date-fns";
import { Switch } from "../ui/switch";
import { cn } from "@/lib/utils";
// ✅ NEW imports:
import { minutesToHHMM, hhmmToMinutes } from "../../utils/timeUtils";

export function TicketAssignmentPage() {
  const { user } = useAuth();

  // --- STATE ---
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [tickets, setTickets] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Dialog State
  const [showDialog, setShowDialog] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Assignment map: { [employeeId]: { billableHours, isAssigned, saved, assignmentId, type } }
  const [assignmentMap, setAssignmentMap] = useState({});

  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Project inline search
  const [projectSearch, setProjectSearch] = useState("");
  const [showProjectList, setShowProjectList] = useState(false);
  const projectRef = useRef(null);

  // --- ROLE-BASED TEXT ---
  const isAdmin = user?.role === "ADMIN";
  const isManager = user?.role === "MANAGER";

  const getPageTitle = () => "Assign Tickets";

  const getPageDescription = () => {
    return isAdmin
      ? "Assign project tickets directly to project-specific managers and employees."
      : "Assign project tickets to your team members with hour limits.";
  };

  const getEmployeeLabel = () => (isAdmin ? "Assignee" : "Employee");

  // ✅ ADDED: Status badge color mapping
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

  // --- INITIAL FETCH ---
  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- FETCH PROJECTS (Role-based) ---
  const fetchProjects = async () => {
    try {
      setLoading(true);
      let response;
      if (isAdmin) {
        response = await api.get("/projects", { params: { isActive: true } });
        setProjects(response.data.projects || []);
      } else if (isManager) {
        response = await api.get(
          `/manager-ticket-assignments/${user.id}/projects-with-tickets`,
        );
        setProjects(response.data.projects || []);
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  // --- FETCH EMPLOYEES (Project-aware for both Admin and Manager) ---
  const fetchEmployees = async (projectId) => {
    try {
      if (!projectId) {
        setEmployees([]);
        return;
      }

      let response;

      if (isAdmin) {
        response = await api.get("/ticket-assignments/all-assignees", {
          params: { projectId },
        });
      } else if (isManager) {
        response = await api.get(
          `/manager-ticket-assignments/${user.id}/employees`,
          { params: { projectId } },
        );
      }

      setEmployees(response.data.employees || []);
    } catch (error) {
      console.error("Failed to fetch assignees:", error);
      toast.error(`Failed to load ${getEmployeeLabel().toLowerCase()}s`);
      setEmployees([]);
    }
  };

  // --- FETCH TICKETS & EMPLOYEES (When Project Selected) ---
  useEffect(() => {
    if (!selectedProjectId) {
      setTickets([]);
      setEmployees([]);
      return;
    }

    fetchTickets(selectedProjectId);
    fetchEmployees(selectedProjectId);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (projectRef.current && !projectRef.current.contains(event.target)) {
        setShowProjectList(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const selectedProject = projects.find(
      (p) => p.project_id === selectedProjectId,
    );

    if (selectedProject) {
      setProjectSearch(selectedProject.project_name);
    }
  }, [selectedProjectId, projects]);

  const fetchTickets = async (projectId) => {
    setLoading(true);
    try {
      const response = await api.get(`/tickets/project/${projectId}`);
      setTickets(response.data.tickets || []);
    } catch (error) {
      console.error("Failed to fetch tickets:", error);
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  // --- FETCH CURRENT ASSIGNMENTS (Employees + Managers) ---
  const fetchAssignmentsForTicket = async (ticketId) => {
    try {
      const employeeResponse = await api.get(`/ticket-assignments/${ticketId}`);
      const employeeAssignments = employeeResponse.data.assignments || [];

      let managerAssignments = [];
      try {
        const managerResponse = await api.get(
          `/ticket-assignments/ticket/${ticketId}/managers`,
        );
        managerAssignments = managerResponse.data.managers || [];
      } catch (err) {
        console.log("No manager assignments or error fetching:", err);
      }

      const map = {};

      employeeAssignments.forEach((assignment) => {
        map[assignment.employee_id] = {
          assignmentId: assignment.assignment_id,
          isAssigned: true,
          billableHours: minutesToHHMM(assignment.assigned_hours || 0), // HH:MM
          saved: true,
          type: "employee",
        };
      });

      managerAssignments.forEach((assignment) => {
        map[assignment.manager_id] = {
          assignmentId: assignment.id,
          isAssigned: true,
          billableHours: minutesToHHMM(assignment.billable_hours || 0), // HH:MM
          saved: true,
          type: "manager",
        };
      });

      setAssignmentMap(map);
    } catch (error) {
      console.error("Failed to fetch assignments:", error);
      setAssignmentMap({});
    }
  };

  // --- HANDLERS ---
  const handleOpenAssignDialog = (ticket) => {
    setSelectedTicket(ticket);
    setSearchQuery("");
    setAssignmentMap({});
    fetchAssignmentsForTicket(ticket.ticket_id);
    setShowDialog(true);
  };

  const handleToggleEmployee = (employeeId) => {
    setAssignmentMap((prev) => {
      const current = prev[employeeId] || {};

      if (current.isAssigned) {
        if (!current.saved) {
          const newMap = { ...prev };
          delete newMap[employeeId];
          return newMap;
        }
        return { ...prev, [employeeId]: { ...current, isAssigned: false } };
      } else {
        return {
          ...prev,
          [employeeId]: {
            ...current,
            isAssigned: true,
            billableHours: current.billableHours || 0,
          },
        };
      }
    });
  };

  const handleHoursChange = (employeeId, hours) => {
    setAssignmentMap((prev) => ({
      ...prev,
      [employeeId]: {
        ...(prev[employeeId] || { isAssigned: true }),
        billableHours: hours,
      },
    }));
  };

  const handleSaveSingle = async (employeeId) => {
    const data = assignmentMap[employeeId];
    if (!data || !data.isAssigned) return;

    const input = String(data.billableHours || "").trim();

    // Parse HH:MM or decimal hours fallback
    let minutes = hhmmToMinutes(input);
    if (minutes === null) {
      const asNum = parseFloat(input);
      if (!Number.isNaN(asNum) && asNum > 0) minutes = Math.round(asNum * 60);
    }

    if (minutes === null || minutes <= 0) {
      toast.error("Please enter valid hours (HH:MM or decimal hours > 0)");
      return;
    }

    setSubmitting(true);
    try {
      if (data.saved && data.assignmentId) {
        if (data.type === "manager") {
          await api.patch(
            `/ticket-assignments/manager-scope/${data.assignmentId}`,
            {
              billableHours: input,
            },
          );
        } else {
          await api.patch(`/ticket-assignments/${data.assignmentId}`, {
            billableHours: input,
          });
        }

        toast.success("Assignment hours updated successfully");
      } else {
        const selectedProject = projects.find(
          (p) => p.project_id === selectedProjectId,
        );
        const clientId = selectedProject?.client_id || null;

        if (isAdmin) {
          await api.post("/ticket-assignments/assign-employee", {
            ticketId: selectedTicket.ticket_id,
            employeeId: employeeId,
            projectId: selectedProjectId,
            clientId: clientId,
            assignedBy: user.id,
            billableHours: input,
          });
        } else if (isManager) {
          await api.post("/manager-ticket-assignments/assign", {
            ticketId: selectedTicket.ticket_id,
            employeeIds: [employeeId],
            projectId: selectedProjectId,
            clientId: clientId,
            assignedBy: user.id,
            billableHours: input,
          });
        }

        toast.success(`${getEmployeeLabel()} assigned successfully`);
      }

      await fetchAssignmentsForTicket(selectedTicket.ticket_id);
    } catch (error) {
      console.error("Save failed", error);
      const errorMessage =
        error.response?.data?.error || "Failed to save assignment";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassign = async (employeeId) => {
    const data = assignmentMap[employeeId];
    if (!data || !data.assignmentId) return;

    if (
      !window.confirm(
        `Remove this ${getEmployeeLabel().toLowerCase()} from the ticket?`,
      )
    )
      return;

    setSubmitting(true);
    try {
      if (data.type === "manager") {
        if (isAdmin) {
          await api.delete(
            `/ticket-assignments/manager-scope/${data.assignmentId}`,
          );
        } else {
          await api.delete(
            `/manager-ticket-assignments/scope/${data.assignmentId}`,
          );
        }
      } else {
        await api.delete(`/ticket-assignments/${data.assignmentId}`);
      }

      toast.success(`${getEmployeeLabel()} unassigned successfully`);

      setAssignmentMap((prev) => {
        const newMap = { ...prev };
        delete newMap[employeeId];
        return newMap;
      });
    } catch (error) {
      console.error("Unassign failed", error);
      toast.error(error.response?.data?.error || "Failed to unassign");
    } finally {
      setSubmitting(false);
    }
  };

  // --- FILTERED DATA ---
  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.toLowerCase();
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    return fullName.includes(q) || emp.email.toLowerCase().includes(q);
  });

  const filteredProjects = projects.filter((project) =>
    project.project_name?.toLowerCase().includes(projectSearch.toLowerCase()),
  );

  // --- BUDGET CALCULATION ---
  const calculateBudget = () => {
    if (!selectedTicket) return { total: 0, assigned: 0, remaining: 0 };
    const total = parseInt(selectedTicket.billable_hours || 0, 10);
    const assigned = Object.values(assignmentMap).reduce((sum, data) => {
      const v = data?.billableHours;
      let mins = hhmmToMinutes(v);
      if (mins === null) {
        const h = parseFloat(v);
        if (!Number.isNaN(h)) mins = Math.round(h * 60);
      }
      return sum + (mins || 0);
    }, 0);
    const remaining = total - assigned;
    return { total, assigned, remaining };
  };

  const budget = calculateBudget();
  const isOverBudget = budget.remaining < 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            {isAdmin && <ShieldCheck className="h-8 w-8 text-primary" />}
            {getPageTitle()}
          </h1>
        </div>
      </div>

      {/* Project Selection */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
              <Label
                htmlFor="project-select"
                className="mb-2 block text-sm font-medium"
              >
                {isManager
                  ? "Select Your Assigned Project"
                  : "Select Project to Manage"}
              </Label>
              <div className="relative" ref={projectRef}>
                <Input
                  id="project-select"
                  placeholder="Search project..."
                  value={projectSearch}
                  onChange={(e) => {
                    setProjectSearch(e.target.value);
                    setShowProjectList(true);
                  }}
                  onFocus={() => setShowProjectList(true)}
                  onClick={() => setShowProjectList(true)}
                  autoComplete="off"
                />

                {showProjectList && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border rounded-md shadow-md">
                    <div className="max-h-52 overflow-y-auto">
                      {filteredProjects.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          No projects found
                        </div>
                      ) : (
                        filteredProjects.map((project) => {
                          const isSelected =
                            selectedProjectId === project.project_id;

                          return (
                            <div
                              key={project.project_id}
                              className={`px-3 py-2 text-sm cursor-pointer transition-colors
                  ${isSelected ? "bg-gray-200 font-medium" : ""}
                  hover:bg-gray-100`}
                              onClick={() => {
                                setSelectedProjectId(project.project_id);
                                setProjectSearch(project.project_name);
                                setShowProjectList(false);
                              }}
                            >
                              {project.project_name}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="hidden md:block text-sm text-muted-foreground">
              {selectedProjectId && (
                <Badge variant="secondary" className="rounded-full">
                  {tickets.length} Ticket{tickets.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      {selectedProjectId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TicketIcon className="h-5 w-5" />
              Project Tickets
            </CardTitle>
            <CardDescription>Select a ticket to Assign.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <TicketIcon className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No tickets found for this project.</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[300px]">Ticket Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Total Hours</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((ticket) => (
                      <TableRow key={ticket.ticket_id}>
                        <TableCell>
                          <div className="font-medium">
                            {ticket.ticket_name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate max-w-[250px]">
                            {ticket.description || "No description"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {/* ✅ UPDATED: Use colored badge */}
                          <Badge className={getStatusBadgeColor(ticket.status)}>
                            {ticket.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {ticket.start_date
                            ? format(new Date(ticket.start_date), "MMM d, yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {ticket.billable_hours
                            ? minutesToHHMM(ticket.billable_hours)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="default"
                            size="sm"
                            className="gap-2 rounded-md"
                            onClick={() => handleOpenAssignDialog(ticket)}
                          >
                            <UserPlus className="h-4 w-4" />
                            Assign
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Assignment Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Assign {getEmployeeLabel()}s to Ticket
            </DialogTitle>

            <div className="text-sm text-muted-foreground mt-2">
              Ticket:{" "}
              <span className="font-semibold text-foreground">
                {selectedTicket?.ticket_name}
              </span>
            </div>

            {/* Budget Display */}
            <div className="flex gap-4 mt-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Total Budget:</span>
                <Badge variant="secondary" className="rounded-full">
                  {minutesToHHMM(budget.total)}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Assigned:</span>
                <Badge variant="default" className="rounded-full">
                  {minutesToHHMM(budget.assigned)}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Remaining:</span>
                <Badge
                  variant={isOverBudget ? "destructive" : "outline"}
                  className={cn(
                    "rounded-full",
                    !isOverBudget && "text-green-600",
                  )}
                >
                  {minutesToHHMM(budget.remaining)}
                </Badge>
              </div>
            </div>

            {isOverBudget && (
              <Alert
                variant="destructive"
                className="mt-3 bg-red-50 dark:bg-red-950/30 border-red-500"
              >
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertDescription className="text-red-700 dark:text-red-300 font-medium">
                  Budget exceeded! Total assigned hours exceed ticket budget.
                </AlertDescription>
              </Alert>
            )}
          </DialogHeader>

          {/* Search */}
          <div className="py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${getEmployeeLabel().toLowerCase()}s...`}
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Assignee List Table */}
          <div className="flex-1 border rounded-md overflow-hidden flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead>{getEmployeeLabel()}</TableHead>
                    <TableHead className="w-[120px]">Hours</TableHead>
                    <TableHead className="w-[280px] text-right">
                      Assignment Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No {getEmployeeLabel().toLowerCase()}s found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const data = assignmentMap[emp.employee_id] || {};
                      const isAssigned = !!data.isAssigned;
                      const isSaved = !!data.saved;

                      return (
                        <TableRow
                          key={emp.employee_id}
                          className={cn(
                            "transition-all duration-200",
                            isAssigned &&
                              "bg-green-50/50 dark:bg-green-950/20 border-l-4 border-l-green-500",
                          )}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <div className="font-medium text-sm">
                                  {emp.first_name} {emp.last_name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {emp.email}
                                </div>
                                {emp.department && (
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {emp.department}
                                  </div>
                                )}
                              </div>
                              {emp.role === "MANAGER" && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] whitespace-nowrap rounded-full"
                                >
                                  <User className="w-3 h-3 mr-1" />
                                  MANAGER
                                </Badge>
                              )}
                              {emp.role === "EMPLOYEE" && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] whitespace-nowrap rounded-full"
                                >
                                  <User className="w-3 h-3 mr-1" />
                                  EMPLOYEE
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            {isAssigned && (
                              <Input
                                type="text"
                                placeholder="HH:MM"
                                className="h-8"
                                value={data.billableHours || ""}
                                onChange={(e) =>
                                  handleHoursChange(
                                    emp.employee_id,
                                    e.target.value,
                                  )
                                }
                                disabled={submitting}
                              />
                            )}
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div
                                className={cn(
                                  "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all",
                                  isAssigned
                                    ? "bg-green-100 dark:bg-green-900/30 border-green-500"
                                    : "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700",
                                )}
                              >
                                {isAssigned ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                ) : (
                                  <Circle className="h-3.5 w-3.5 text-gray-400" />
                                )}

                                <span
                                  className={cn(
                                    "text-xs font-medium whitespace-nowrap",
                                    isAssigned
                                      ? "text-green-700 dark:text-green-300"
                                      : "text-gray-600 dark:text-gray-400",
                                  )}
                                >
                                  {isAssigned ? "Assigned" : "Not Assigned"}
                                </span>

                                <Switch
                                  checked={isAssigned}
                                  onCheckedChange={() =>
                                    handleToggleEmployee(emp.employee_id)
                                  }
                                  disabled={submitting}
                                  className="scale-90"
                                />
                              </div>

                              {isSaved ? (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() =>
                                      handleSaveSingle(emp.employee_id)
                                    }
                                    disabled={submitting}
                                    title="Update Hours"
                                  >
                                    <Save className="h-4 w-4 text-primary" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() =>
                                      handleUnassign(emp.employee_id)
                                    }
                                    disabled={submitting}
                                    title="Unassign"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </>
                              ) : (
                                isAssigned && (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handleSaveSingle(emp.employee_id)
                                    }
                                    disabled={submitting}
                                  >
                                    {submitting ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      "Save"
                                    )}
                                  </Button>
                                )
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
          </div>

          <DialogFooter className="pt-4 border-t mt-2">
            <Button
              variant="default"
              className="rounded-md"
              onClick={() => setShowDialog(false)}
              disabled={submitting}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TicketAssignmentPage;

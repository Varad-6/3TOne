import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
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
  CheckCircle2,
  Circle,
} from "lucide-react";
import api from "../../services/api";
import { format } from "date-fns";
import { Switch } from "../ui/switch";
import { cn } from "../../lib/utils";
import { minutesToHHMM, hhmmToMinutes } from "../../utils/timeUtils";
export function ManagerTicketAssignmentPage() {
  const { user } = useAuth();

  // --- STATE ---
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [tickets, setTickets] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Dialog State
  const [showDialog, setShowDialog] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Assignment map: { employeeId: { billableHours, isAssigned, saved, assignmentId, type } }
  const [assignmentMap, setAssignmentMap] = useState({});

  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // --- INITIAL FETCH ---
  useEffect(() => {
    fetchProjects();
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- FETCH MANAGER'S ASSIGNED PROJECTS ---
  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/manager-ticket-assignments/${user.id}/projects-with-tickets`,
      );
      setProjects(response.data.projects || []);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      toast.error("Failed to load your assigned projects");
    } finally {
      setLoading(false);
    }
  };

  // --- FETCH TEAM EMPLOYEES (Includes manager self for self-assignment) ---
  const fetchEmployees = async () => {
    try {
      const response = await api.get(
        `/manager-ticket-assignments/${user.id}/employees`,
      );
      setEmployees(response.data.employees || []);
    } catch (error) {
      console.error("Failed to fetch employees:", error);
      toast.error("Failed to load team members");
    }
  };

  // --- FETCH TICKETS WHEN PROJECT SELECTED ---
  useEffect(() => {
    if (!selectedProjectId) {
      setTickets([]);
      return;
    }
    fetchTickets(selectedProjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

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
  // const fetchAssignmentsForTicket = async (ticketId) => {
  //   try {
  //     // Fetch employee assignments
  //     const employeeResponse = await api.get(`/ticket-assignments/${ticketId}`);
  //     const employeeAssignments = employeeResponse.data.assignments || [];

  //     // Fetch manager assignments from ticket_manager_scope
  //     let managerAssignments = [];
  //     try {
  //       const managerResponse = await api.get(
  //         `/manager-ticket-assignments/ticket/${ticketId}/managers`,
  //       );
  //       managerAssignments = managerResponse.data.managers || [];
  //     } catch (err) {
  //       console.log("No manager assignments or error fetching:", err);
  //     }

  //     // Convert both to map
  //     const map = {};

  //     // Add employees
  //     employeeAssignments.forEach((assignment) => {
  //       map[assignment.employee_id] = {
  //         assignmentId: assignment.assignment_id,
  //         isAssigned: true,
  //         billableHours: assignment.assigned_hours || 0,
  //         saved: true,
  //         type: "employee",
  //       };
  //     });

  //     // Add managers
  //     managerAssignments.forEach((assignment) => {
  //       map[assignment.manager_id] = {
  //         assignmentId: assignment.id,
  //         isAssigned: true,
  //         billableHours: assignment.billable_hours || 0,
  //         saved: true,
  //         type: "manager",
  //       };
  //     });

  //     setAssignmentMap(map);
  //   } catch (error) {
  //     console.error("Failed to fetch assignments:", error);
  //     setAssignmentMap({});
  //   }
  // };
  const fetchAssignmentsForTicket = async (ticketId) => {
    try {
      const [empResp, mgrResp] = await Promise.all([
        api.get(`/ticket-assignments/${ticketId}`),
        api.get(`/manager-ticket-assignments/ticket/${ticketId}/managers`),
      ]);

      const empAssignments = empResp.data.assignments || [];
      const mgrAssignments = mgrResp.data.managers || [];

      const newMap = {};

      empAssignments.forEach((a) => {
        const minutes = Number(a.assigned_hours);
        newMap[a.employee_id] = {
          isAssigned: true,
          billableHours: minutes,
          billableHoursDisplay: minutesToHHMM(minutes),
          saved: true,
          assignmentId: a.assignment_id,
          type: "employee",
        };
      });

      mgrAssignments.forEach((a) => {
        const minutes = Number(a.billable_hours);
        newMap[a.manager_id] = {
          isAssigned: true,
          billableHours: minutes,
          billableHoursDisplay: minutesToHHMM(minutes),
          saved: true,
          assignmentId: a.id,
          type: "manager",
        };
      });

      setAssignmentMap(newMap);
      console.log("Employees list:", employees);
    } catch (error) {
      console.error("Failed to fetch assignments:", error);
      toast.error("Failed to load current assignments");
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

  // Toggle using Switch
  const handleToggleEmployee = (employeeId) => {
    setAssignmentMap((prev) => {
      const current = prev[employeeId];
      if (current?.isAssigned) {
        // Unchecking
        if (!current.saved) {
          const newMap = { ...prev };
          delete newMap[employeeId];
          return newMap;
        }
        return {
          ...prev,
          [employeeId]: { ...current, isAssigned: false },
        };
      } else {
        // Checking
        return {
          ...prev,
          [employeeId]: {
            ...(current || {}),
            isAssigned: true,
            billableHours: current?.billableHours ?? 0,
            billableHoursDisplay: minutesToHHMM(current?.billableHours ?? 0),
          },
        };
      }
    });
  };

  // Update hours input
  // const handleHoursChange = (employeeId, hours) => {
  //   setAssignmentMap((prev) => ({
  //     ...prev,
  //     [employeeId]: {
  //       ...(prev[employeeId] || { isAssigned: true }),
  //       billableHours: hours,
  //     },
  //   }));
  // };

  const handleHoursChange = (employeeId, input) => {
    const minutes = hhmmToMinutes(input);

    setAssignmentMap((prev) => ({
      ...prev,
      [employeeId]: {
        ...(prev[employeeId] || { isAssigned: true }),
        billableHours: minutes,
        billableHoursDisplay: input,
      },
    }));
  };

  // Save Individual Assignment (with UPDATE support)
  const handleSaveSingle = async (employeeId) => {
    if (!selectedTicket || !selectedProjectId) {
      toast.error("Select a project and ticket before assigning");
      return;
    }

    const data = assignmentMap[employeeId];
    if (!data || !data.isAssigned) return;

    const minutes = data.billableHours;
    if (!minutes || minutes <= 0) {
      toast.error("Please enter valid time in HH:MM format (e.g., 8:00)");
      return;
    }

    setSubmitting(true);
    try {
      // If assignment already exists (saved), UPDATE it
      if (data.saved && data.assignmentId) {
        console.log("✏️ Updating existing assignment:", {
          assignmentId: data.assignmentId,
          type: data.type,
          minutes,
        });

        if (data.type === "manager") {
          // Update manager scope
          await api.patch(
            `/manager-ticket-assignments/scope/${data.assignmentId}`,
            { billableHours: minutes },
          );
        } else {
          // Update employee assignment (using admin endpoint which allows manager access)
          await api.patch(`/manager-ticket-assignments/assignments/${data.assignmentId}`, {
            billableHours: minutes,
          });
        }
        toast.success("Assignment hours updated successfully");
      } else {
        // If new assignment, CREATE it
        console.log("➕ Creating new assignment");

        // Get clientId from the selected project
        const selectedProject = projects.find(
          (p) => p.project_id === selectedProjectId,
        );
        const clientId = selectedProject?.client_id || null;

        await api.post(`/manager-ticket-assignments/assign`, {
          ticketId: selectedTicket.ticket_id,
          employeeIds: [employeeId],
          projectId: selectedProjectId,
          clientId: clientId,
          assignedBy: user.id,
          billableHours: minutes,
        });
        toast.success("Assignment saved successfully");
      }

      // Refresh assignments to get updated data
      await fetchAssignmentsForTicket(selectedTicket.ticket_id);
    } catch (error) {
      console.error("Save failed:", error);
      const errorMessage =
        error.response?.data?.error || "Failed to save assignment";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Unassign (Delete) - Handle both employees and managers
  const handleUnassign = async (employeeId) => {
    const data = assignmentMap[employeeId];
    if (!data || !data.assignmentId) return;

    if (!window.confirm("Remove this assignment from the ticket?")) return;

    setSubmitting(true);
    try {
      // Different endpoints for employee vs manager
      if (data.type === "manager") {
        // Manager deleting manager scope (self-unassign)
        await api.delete(
          `/manager-ticket-assignments/scope/${data.assignmentId}`,
        );
      } else {
        // Delete employee assignment
        await api.delete(`/manager-ticket-assignments/assignments/${data.assignmentId}`);
      }

      toast.success("Assignment removed successfully");

      // Remove from map
      setAssignmentMap((prev) => {
        const newMap = { ...prev };
        delete newMap[employeeId];
        return newMap;
      });
    } catch (error) {
      console.error("Unassign failed:", error);
      toast.error(error.response?.data?.error || "Failed to unassign");
    } finally {
      setSubmitting(false);
    }
  };

  // --- HELPER: Status Badge Color ---
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

  // --- FILTERED DATA ---
  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.toLowerCase();
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    return fullName.includes(q) || emp.email.toLowerCase().includes(q);
  });

  // --- BUDGET CALCULATION ---
  const calculateBudget = () => {
    if (!selectedTicket) return { total: 0, assigned: 0, remaining: 0 };

    const total = Number(selectedTicket.billable_hours || 0);
    const assigned = Object.values(assignmentMap).reduce((sum, data) => {
      return sum + Number(data.billableHours || 0);
    }, 0);
    const remaining = total - assigned;

    return { total, assigned, remaining };
  };

  const budget = calculateBudget();
  const isOverBudget = budget.remaining < 0;

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-7xl mx-auto p-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Assign Tickets to Team
          </h1>
          <p className="text-muted-foreground mt-1">
            Assign project tickets to your team members with hour limits.
          </p>
        </div>
      </motion.div>

      {/* Project Selection */}
      <motion.div variants={item}>
        <Card className="border-none shadow-soft bg-white dark:bg-card">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
              <Label
                htmlFor="project-select"
                className="mb-2 block text-sm font-medium"
              >
                Select Your Assigned Project
              </Label>
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
              >
                <SelectTrigger id="project-select" className="h-10">
                  <SelectValue placeholder="Choose a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No projects available
                    </SelectItem>
                  ) : (
                    projects.map((p) => (
                      <SelectItem key={p.project_id} value={p.project_id}>
                        {p.project_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="hidden md:block text-sm text-muted-foreground">
              {selectedProjectId && (
                <Badge variant="secondary">
                  {tickets.length} Ticket{tickets.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      </motion.div>

      {/* Tickets List */}
      {selectedProjectId && (
        <motion.div variants={item}>
          <Card className="border-none shadow-soft bg-white dark:bg-card">
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
                          {/* ✅ UPDATED: Colored Badge */}
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
                          {minutesToHHMM(ticket.billable_hours) || 0} hrs
                        </TableCell>
                        <TableCell className="text-right">
                          {/* ✅ UPDATED: Primary Button with rounded-md */}
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
        </motion.div>
      )}

      {/* Assignment Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Assign Team Members to Ticket
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
                placeholder="Search team members..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Team Member List Table */}
          <div className="flex-1 border rounded-md overflow-hidden flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead>Team Member</TableHead>
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
                        No team members found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const personId = emp.employee_id || emp.manager_id;
                      const data = assignmentMap[personId];
                      const isAssigned = !!data?.isAssigned;
                      const isSaved = !!data?.saved;

                      return (
                        <TableRow
                          key={personId}
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
                                  {emp.department && ` • ${emp.department}`}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {isAssigned && (
                              <Input
                                type="text"
                                placeholder="HH:MM (e.g., 8:00)"
                                className="h-8 font-mono"
                                value={
                                  data.billableHoursDisplay ??
                                  minutesToHHMM(data.billableHours ?? 0)
                                }
                                onChange={(e) =>
                                  handleHoursChange(personId, e.target.value)
                                }
                                onBlur={(e) => {
                                  const minutes = hhmmToMinutes(e.target.value);
                                  if (minutes !== null) {
                                    setAssignmentMap((prev) => ({
                                      ...prev,
                                      [personId]: {
                                        ...prev[personId],
                                        billableHoursDisplay:
                                          minutesToHHMM(minutes),
                                      },
                                    }));
                                  }
                                }}
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Colored Switch Container */}
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
                                    handleToggleEmployee(personId)
                                  }
                                  disabled={submitting}
                                  className="scale-90"
                                />
                              </div>

                              {/* Action buttons */}
                              {isSaved ? (
                                <div className="flex gap-2">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => handleSaveSingle(personId)}
                                    disabled={submitting}
                                    title="Update Hours"
                                  >
                                    <Save className="h-4 w-4 text-primary" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => handleUnassign(personId)}
                                    disabled={submitting}
                                    title="Unassign"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              ) : (
                                isAssigned && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveSingle(personId)}
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
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={submitting}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

export default ManagerTicketAssignmentPage;

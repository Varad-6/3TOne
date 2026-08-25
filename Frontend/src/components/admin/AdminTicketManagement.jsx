import React, { useEffect, useState, useCallback } from "react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableHeader,
} from "../ui/table";
import { Textarea } from "../ui/textarea";
import { toast } from "sonner";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Loader2,
  ArchiveRestore,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import ticketService from "../../services/ticketService";
import projectService from "../../services/projectService";
import { minutesToHHMM, hhmmToMinutes } from "../../utils/timeUtils";

const initialFormState = {
  ticketName: "",
  zohoCrmCode: "",
  projectId: "",
  description: "",
  startDate: new Date().toISOString().split("T")[0],
  endDate: "",
  estimatedDate: "",
  status: "",
  estimatedHours: "",
  approvedHours: "",
  billableHours: "",
};

export function AdminTicketManagement() {
  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [ticketStatuses, setTicketStatuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [formData, setFormData] = useState(initialFormState);

  // Budget info for the selected project (create/edit form)
  const [budgetInfo, setBudgetInfo] = useState(null);
  const [budgetLoading, setBudgetLoading] = useState(false);

  // Hours approval requests
  const [hoursRequests, setHoursRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [processingRequestId, setProcessingRequestId] = useState(null);
  const [requestStatusFilter, setRequestStatusFilter] = useState("PENDING");

  useEffect(() => {
    void fetchProjects();
    void fetchTicketStatuses();
    void fetchHoursRequests();
  }, []);

  useEffect(() => {
    void fetchTickets();
  }, [projectFilter, statusFilter, activeFilter]);

  useEffect(() => {
    void fetchHoursRequests();
  }, [requestStatusFilter]);

  // Load budget info when project changes in the form
  useEffect(() => {
    if (!formData.projectId) {
      setBudgetInfo(null);
      return;
    }
    const loadBudget = async () => {
      setBudgetLoading(true);
      try {
        let info;
        if (editingTicket) {
          info = await ticketService.getProjectBudgetInfo(
            editingTicket.ticket_id,
          );
        } else {
          info = await ticketService.getProjectBudgetInfoByProject(
            formData.projectId,
          );
        }
        setBudgetInfo(info);
      } catch {
        setBudgetInfo(null);
      } finally {
        setBudgetLoading(false);
      }
    };
    void loadBudget();
  }, [formData.projectId, editingTicket]);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await projectService.getAllProjects({ isActive: true });
      setProjects(data?.projects || []);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      toast.error("Failed to fetch projects");
    }
  }, []);

  const fetchTicketStatuses = useCallback(async () => {
    try {
      const data = await ticketService.getAllTicketStatuses();
      setTicketStatuses(data?.statuses || []);
    } catch (error) {
      console.error("Failed to fetch ticket statuses:", error);
      toast.error("Failed to load ticket statuses");
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (projectFilter !== "all") params.projectId = projectFilter;
      if (statusFilter !== "all") params.status = statusFilter;
      if (activeFilter === "active") params.isActive = "true";
      else if (activeFilter === "inactive") params.isActive = "false";
      const data = await ticketService.getAllTickets(params);
      setTickets(data?.tickets || []);
    } catch (error) {
      console.error("Failed to fetch tickets:", error);
      toast.error("Failed to fetch tickets");
    } finally {
      setLoading(false);
    }
  }, [projectFilter, statusFilter, activeFilter]);

  const fetchHoursRequests = useCallback(async () => {
    try {
      setRequestsLoading(true);
      const data =
        await ticketService.getHoursUpdateRequests(requestStatusFilter);
      setHoursRequests(data?.requests || []);
    } catch (error) {
      console.error("Failed to fetch hours requests:", error);
    } finally {
      setRequestsLoading(false);
    }
  }, [requestStatusFilter]);

  // ─── Validation helpers ──────────────────────────────────
  const validateTime = (value, fieldName) => {
    const minutes = hhmmToMinutes(value);
    if (minutes === null) {
      toast.error(`${fieldName} must be in HH:MM format`);
      return false;
    }
    if (minutes < 0) {
      toast.error(`${fieldName} cannot be negative`);
      return false;
    }
    return true;
  };

  const normalizeHalfHourTime = (value) => {
    if (!value) return "";
    if (!value.includes(":")) {
      const hours = parseInt(value, 10);
      if (isNaN(hours)) return "";
      return `${hours}:00`;
    }
    const [h, m] = value.split(":");
    const hours = parseInt(h, 10);
    let minutes = parseInt(m, 10);
    if (isNaN(hours)) return "";
    if (isNaN(minutes)) minutes = 0;
    minutes = minutes < 30 ? 0 : 30;
    return `${hours}:${minutes.toString().padStart(2, "0")}`;
  };

  const validateForm = () => {
    if (!formData.ticketName.trim()) {
      toast.error("Ticket Name is required");
      return false;
    }
    if (!formData.zohoCrmCode.trim()) {
      toast.error("Zoho CRM Code is required");
      return false;
    }
    if (!formData.projectId) {
      toast.error("Project is required");
      return false;
    }
    if (!formData.status) {
      toast.error("Status is required");
      return false;
    }
    if (!formData.startDate) {
      toast.error("Start Date is required");
      return false;
    }
    if (!formData.endDate) {
      toast.error("End Date is required");
      return false;
    }
    if (!formData.estimatedDate) {
      toast.error("Estimated End Date is required");
      return false;
    }
    if (formData.endDate < formData.startDate) {
      toast.error("End Date cannot be before Start Date");
      return false;
    }
    if (formData.estimatedDate < formData.startDate) {
      toast.error("Estimated End Date cannot be before Start Date");
      return false;
    }
    if (!validateTime(formData.estimatedHours, "Estimated Hours")) return false;
    if (!validateTime(formData.approvedHours, "Approved Hours")) return false;
    if (!validateTime(formData.billableHours, "Billable Hours")) return false;
    const estimated = hhmmToMinutes(formData.estimatedHours);
    const approved = hhmmToMinutes(formData.approvedHours);
    const billable = hhmmToMinutes(formData.billableHours);
    if (approved > estimated) {
      toast.error("Approved Hours cannot exceed Estimated Hours");
      return false;
    }
    if (billable > approved) {
      toast.error("Billable Hours cannot exceed Approved Hours");
      return false;
    }
    // Warn if billable exceeds remaining budget
    if (budgetInfo && !budgetInfo.budgetNotSet) {
      const billMinutes = hhmmToMinutes(formData.billableHours);
      if (billMinutes > budgetInfo.remainingMinutes) {
        toast.error(
          `Billable hours (${minutesToHHMM(billMinutes)}) exceed remaining project budget (${minutesToHHMM(budgetInfo.remainingMinutes)})`,
        );
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      setSubmitting(true);
      const payload = {
        ticketName: formData.ticketName.trim(),
        zohoCrmCode: formData.zohoCrmCode.trim(),
        projectId: formData.projectId,
        description: formData.description.trim() || null,
        status: formData.status,
        startDate: formData.startDate,
        endDate: formData.endDate,
        estimatedDate: formData.estimatedDate,
        estimatedHours: hhmmToMinutes(formData.estimatedHours),
        approvedHours: hhmmToMinutes(formData.approvedHours),
        billableHours: hhmmToMinutes(formData.billableHours),
      };
      if (editingTicket) {
        await ticketService.updateTicket(editingTicket.ticket_id, payload);
        toast.success("Ticket updated successfully");
      } else {
        await ticketService.createTicket(payload);
        toast.success("Ticket created successfully");
      }
      setShowDialog(false);
      resetForm();
      await fetchTickets();
    } catch (error) {
      console.error("Save ticket error:", error);
      toast.error(error?.response?.data?.error || "Failed to save ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (ticket) => {
    setEditingTicket(ticket);
    const safeDate = (d) => {
      if (!d) return "";
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? "" : dt.toISOString().split("T")[0];
    };
    setFormData({
      ticketName: ticket.ticket_name || "",
      zohoCrmCode: ticket.zoho_crm_code || "",
      projectId: ticket.project_id || "",
      description: ticket.description || "",
      status: ticket.status || "",
      startDate: safeDate(ticket.start_date),
      endDate: safeDate(ticket.end_date),
      estimatedDate: safeDate(ticket.estimated_date),
      estimatedHours: minutesToHHMM(ticket.estimated_hours),
      approvedHours: minutesToHHMM(ticket.approved_hours),
      billableHours: minutesToHHMM(ticket.billable_hours),
    });
    setShowDialog(true);
  };

  const handleReactivate = async (ticket) => {
    if (!window.confirm(`Reactivate ticket "${ticket.ticket_name}"?`)) return;
    try {
      setSubmitting(true);
      await ticketService.reactivateTicket(ticket.ticket_id);
      toast.success("Ticket reactivated successfully");
      await fetchTickets();
    } catch (error) {
      toast.error(
        error?.response?.data?.error || "Failed to reactivate ticket",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete ticket "${name}"?`)) return;
    try {
      await ticketService.deleteTicket(id);
      toast.success("Ticket deleted");
      await fetchTickets();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to delete ticket");
    }
  };

  // ─── Hours Request Actions ───────────────────────────────
  const handleApproveRequest = async (request) => {
    if (
      !window.confirm(
        `Approve hours update for "${request.ticket_name}"?\nRequested: ${minutesToHHMM(request.requested_hours)}`,
      )
    )
      return;
    try {
      setProcessingRequestId(request.ticket_hours_update_history_id);
      await ticketService.approveHoursRequest(
        request.ticket_hours_update_history_id,
      );
      toast.success(`Hours update approved for "${request.ticket_name}"`);
      await fetchHoursRequests();
      await fetchTickets(); // refresh ticket list
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to approve request");
    } finally {
      setProcessingRequestId(null);
    }
  };

  const openRejectDialog = (request) => {
    setRejectingRequest(request);
    setRejectRemarks("");
    setShowRejectDialog(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectingRequest) return;
    try {
      setProcessingRequestId(rejectingRequest.ticket_hours_update_history_id);
      await ticketService.rejectHoursRequest(
        rejectingRequest.ticket_hours_update_history_id,
        rejectRemarks,
      );
      toast.success(
        `Hours update rejected for "${rejectingRequest.ticket_name}"`,
      );
      setShowRejectDialog(false);
      setRejectingRequest(null);
      await fetchHoursRequests();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to reject request");
    } finally {
      setProcessingRequestId(null);
    }
  };

  const resetForm = () => {
    setEditingTicket(null);
    setFormData(initialFormState);
    setBudgetInfo(null);
  };
  const handleDialogClose = (open) => {
    if (!open && !submitting) {
      setShowDialog(false);
      resetForm();
    }
  };

  const filteredTickets = tickets.filter((t) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (t.ticket_name && t.ticket_name.toLowerCase().includes(q)) ||
      (t.zoho_crm_code && t.zoho_crm_code.toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.project_name && t.project_name.toLowerCase().includes(q))
    );
  });

  const activeTickets = filteredTickets.filter((t) => t.is_active !== false);
  const inactiveTickets = filteredTickets.filter((t) => t.is_active === false);
  const pendingCount = hoursRequests.filter(
    (r) => r.status === "PENDING",
  ).length;

  const getStatusBadgeColor = (statusName) => {
    const colorMap = {
      Planned: "bg-blue-500 hover:bg-blue-600",
      "In Progress": "bg-yellow-500 hover:bg-yellow-600 text-yellow-950",
      Completed: "bg-green-500 hover:bg-green-600",
      "On Hold": "bg-gray-500 hover:bg-gray-600",
      Cancelled: "bg-red-500 hover:bg-red-600",
    };
    return `${colorMap[statusName] || "bg-gray-500 hover:bg-gray-600"} text-white rounded-full`;
  };

  const getRequestStatusBadge = (status) => {
    if (status === "PENDING") return "bg-yellow-500 text-white rounded-full";
    if (status === "APPROVED") return "bg-green-500 text-white rounded-full";
    if (status === "REJECTED") return "bg-red-500 text-white rounded-full";
    return "bg-gray-400 text-white rounded-full";
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Budget bar helpers
  const getBudgetUsagePercent = () => {
    if (
      !budgetInfo ||
      budgetInfo.budgetNotSet ||
      budgetInfo.projectBudgetMinutes === 0
    )
      return 0;
    const bill = hhmmToMinutes(formData.billableHours) || 0;
    return Math.min(
      100,
      Math.round(
        ((budgetInfo.usedMinutes + bill) / budgetInfo.projectBudgetMinutes) *
          100,
      ),
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ticket Management</h1>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowDialog(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" /> Add Ticket
        </Button>
      </div>

      {/* ─── HOURS APPROVAL REQUESTS ──────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              Hours Update Requests
              {pendingCount > 0 && (
                <Badge className="bg-yellow-500 text-white rounded-full ml-1">
                  {pendingCount} pending
                </Badge>
              )}
            </CardTitle>
            <Select
              value={requestStatusFilter}
              onValueChange={setRequestStatusFilter}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="all">All Requests</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {requestsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading requests...
              </span>
            </div>
          ) : hoursRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No{" "}
              {requestStatusFilter === "all"
                ? ""
                : requestStatusFilter.toLowerCase()}{" "}
              hours update requests.
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Current Hours</TableHead>
                    <TableHead>Requested Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested At</TableHead>
                    {requestStatusFilter !== "PENDING" && (
                      <TableHead>Remarks</TableHead>
                    )}
                    {requestStatusFilter === "PENDING" && (
                      <TableHead className="text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hoursRequests.map((req) => (
                    <TableRow key={req.ticket_hours_update_history_id}>
                      <TableCell className="font-medium">
                        {req.ticket_name}
                      </TableCell>
                      <TableCell>{req.project_name}</TableCell>
                      <TableCell>{req.requested_by_name}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {minutesToHHMM(req.old_hours)}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-semibold text-blue-600">
                        {minutesToHHMM(req.requested_hours)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getRequestStatusBadge(req.status)}>
                          {req.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(req.requested_at)}
                      </TableCell>
                      {requestStatusFilter !== "PENDING" && (
                        <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                          {req.remarks &&
                            (() => {
                              try {
                                const parsed = JSON.parse(req.remarks);
                                if (parsed.estimatedHours !== undefined) {
                                  return `Est: ${minutesToHHMM(parsed.estimatedHours)} | App: ${minutesToHHMM(parsed.approvedHours)} | Bill: ${minutesToHHMM(parsed.requestedBillableHours)}`;
                                }
                              } catch (_) {}
                              return req.remarks;
                            })()}
                        </TableCell>
                      )}
                      {requestStatusFilter === "PENDING" && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Approve"
                              disabled={
                                processingRequestId ===
                                req.ticket_hours_update_history_id
                              }
                              onClick={() => handleApproveRequest(req)}
                            >
                              {processingRequestId ===
                              req.ticket_hours_update_history_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Reject"
                              disabled={
                                processingRequestId ===
                                req.ticket_hours_update_history_id
                              }
                              onClick={() => openRejectDialog(req)}
                            >
                              <XCircle className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.project_id} value={p.project_id}>
                    {p.project_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {ticketStatuses.map((s) => (
                  <SelectItem key={s.id} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Active Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tickets</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Tickets ({filteredTickets.length})
            {activeTickets.length > 0 && (
              <Badge variant="outline">{activeTickets.length} active</Badge>
            )}
            {inactiveTickets.length > 0 && (
              <Badge variant="secondary">
                {inactiveTickets.length} inactive
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Zoho Code</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hours (Est/Appr/Bill)</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      <p className="text-sm text-muted-foreground mt-2">
                        Loading...
                      </p>
                    </TableCell>
                  </TableRow>
                ) : filteredTickets.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No tickets found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTickets.map((t) => {
                    const isInactive = t.is_active === false;
                    return (
                      <TableRow
                        key={t.ticket_id}
                        className={isInactive ? "opacity-50 bg-muted/30" : ""}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {t.ticket_name}
                            {isInactive && (
                              <Badge variant="outline" className="text-xs">
                                Inactive
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{t.zoho_crm_code}</TableCell>
                        <TableCell>{t.project_name || "-"}</TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(t.status)}>
                            {t.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {minutesToHHMM(t.estimated_hours)} /{" "}
                          {minutesToHHMM(t.approved_hours)} /{" "}
                          {minutesToHHMM(t.billable_hours)}
                        </TableCell>
                        <TableCell>{formatDate(t.start_date)}</TableCell>
                        <TableCell>{formatDate(t.end_date)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {t.is_active ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(t)}
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleDelete(t.ticket_id, t.ticket_name)
                                  }
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReactivate(t)}
                                title="Reactivate"
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
              {editingTicket ? "Edit Ticket" : "Add New Ticket"}
            </DialogTitle>
            <DialogDescription>
              {editingTicket
                ? "Update ticket details below."
                : "Create a new ticket under a project."}{" "}
              All fields are mandatory except Description.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Ticket Name & Zoho Code */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ticketName">
                  Ticket Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="ticketName"
                  placeholder="Enter Ticket Name"
                  value={formData.ticketName}
                  onChange={(e) =>
                    setFormData({ ...formData, ticketName: e.target.value })
                  }
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zohoCrmCode">
                  Zoho CRM Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="zohoCrmCode"
                  placeholder="Enter Zoho Ticket ID"
                  value={formData.zohoCrmCode}
                  onChange={(e) =>
                    setFormData({ ...formData, zohoCrmCode: e.target.value })
                  }
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Project */}
            <div className="space-y-2">
              <Label htmlFor="projectId">
                Project <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.projectId || ""}
                onValueChange={(v) =>
                  setFormData({ ...formData, projectId: v })
                }
                disabled={submitting || !!editingTicket}
              >
                <SelectTrigger id="projectId">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.length > 0 ? (
                    projects.map((p) => (
                      <SelectItem key={p.project_id} value={p.project_id}>
                        {p.project_name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-option" disabled>
                      No active projects found
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Budget info bar */}
            {formData.projectId && (
              <div className="rounded-md border p-3 bg-muted/30 space-y-1">
                {budgetLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading budget
                    info...
                  </div>
                ) : budgetInfo ? (
                  budgetInfo.budgetNotSet ? (
                    <p className="text-sm text-muted-foreground">
                      No billable hours budget set for this project.
                    </p>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Project budget:
                        </span>
                        <span className="font-mono font-medium">
                          {minutesToHHMM(budgetInfo.projectBudgetMinutes)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Used by other tickets:
                        </span>
                        <span className="font-mono">
                          {minutesToHHMM(budgetInfo.usedMinutes)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Available for this ticket:
                        </span>
                        <span
                          className={`font-mono font-semibold ${budgetInfo.remainingMinutes === 0 ? "text-red-600" : "text-green-600"}`}
                        >
                          {minutesToHHMM(budgetInfo.remainingMinutes)}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                        <div
                          className={`h-1.5 rounded-full transition-all ${getBudgetUsagePercent() >= 100 ? "bg-red-500" : getBudgetUsagePercent() > 80 ? "bg-yellow-500" : "bg-green-500"}`}
                          style={{ width: `${getBudgetUsagePercent()}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        {getBudgetUsagePercent()}% used
                      </p>
                    </>
                  )
                ) : null}
              </div>
            )}

            {/* Hours Section */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { key: "estimatedHours", label: "Estimated Hours" },
                { key: "approvedHours", label: "Approved Hours" },
                { key: "billableHours", label: "Billable Hours" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>
                    {label} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id={key}
                    type="text"
                    inputMode="numeric"
                    placeholder="HH:MM"
                    value={formData[key]}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    onBlur={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        [key]: normalizeHalfHourTime(e.target.value),
                      }))
                    }
                    disabled={submitting}
                    className="font-mono"
                  />
                </div>
              ))}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="Enter description (optional)"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                disabled={submitting}
              />
            </div>

            {/* Status & Dates */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">
                  Status <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                  disabled={submitting}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {ticketStatuses.map((s) => (
                      <SelectItem key={s.id} value={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {[
                { key: "startDate", label: "Start Date" },
                { key: "endDate", label: "End Date" },
                { key: "estimatedDate", label: "Estimated End" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>
                    {label} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id={key}
                    type="date"
                    value={formData[key]}
                    onChange={(e) =>
                      setFormData({ ...formData, [key]: e.target.value })
                    }
                    disabled={submitting}
                  />
                </div>
              ))}
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
                  {editingTicket ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>{editingTicket ? "Update" : "Create"} Ticket</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={showRejectDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowRejectDialog(false);
            setRejectingRequest(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Hours Update Request</DialogTitle>
            <DialogDescription>
              Rejecting hours update for{" "}
              <strong>{rejectingRequest?.ticket_name}</strong>. Requested:{" "}
              {minutesToHHMM(rejectingRequest?.requested_hours)} (current:{" "}
              {minutesToHHMM(rejectingRequest?.old_hours)}).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="rejectRemarks">Rejection Reason (Optional)</Label>
            <Textarea
              id="rejectRemarks"
              placeholder="Provide a reason for rejection..."
              value={rejectRemarks}
              onChange={(e) => setRejectRemarks(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={
                processingRequestId ===
                rejectingRequest?.ticket_hours_update_history_id
              }
            >
              {processingRequestId ===
              rejectingRequest?.ticket_hours_update_history_id ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                "Confirm Reject"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminTicketManagement;

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
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
import { toast } from "sonner";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Loader2,
  ArchiveRestore,
  Download,
  Clock,
  AlertTriangle,
  Info,
} from "lucide-react";
import ticketService from "../../services/ticketService";
import projectService from "../../services/projectService";
import { minutesToHHMM, hhmmToMinutes } from "../../utils/timeUtils";
import * as XLSX from "xlsx";

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

export function ManagerTicketManagement() {
  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [ticketStatuses, setTicketStatuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [formData, setFormData] = useState(initialFormState);

  // Budget info
  const [budgetInfo, setBudgetInfo] = useState(null);
  const [budgetLoading, setBudgetLoading] = useState(false);

  // My pending hours requests
  const [myRequests, setMyRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // Track if billable hours changed from original (for the warning banner)
  const [originalBillableHours, setOriginalBillableHours] = useState(null);

  useEffect(() => {
    void fetchProjects();
    void fetchTicketStatuses();
    void fetchMyRequests();
  }, []);

  useEffect(() => {
    void fetchTickets();
  }, [projectFilter, statusFilter, activeFilter]);

  // Load budget info when project or editing ticket changes
  useEffect(() => {
    if (!formData.projectId) {
      setBudgetInfo(null);
      return;
    }
    const load = async () => {
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
    void load();
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

  const fetchMyRequests = useCallback(async () => {
    try {
      setRequestsLoading(true);
      const data = await ticketService.getHoursUpdateRequests("all");
      setMyRequests(data?.requests || []);
    } catch (error) {
      console.error("Failed to fetch my requests:", error);
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  // ─── Helpers ──────────────────────────────────────────────
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

  // Check if billable hours changed from original
  const isBillableChanged = () => {
    if (!editingTicket || originalBillableHours === null) return false;
    return hhmmToMinutes(formData.billableHours) !== originalBillableHours;
  };

  // Check if there's already a pending request for the editing ticket
  const hasPendingRequest = () => {
    if (!editingTicket) return false;
    return myRequests.some(
      (r) => r.ticket_id === editingTicket.ticket_id && r.status === "PENDING",
    );
  };

  const validateForm = () => {
    const ticketName = formData.ticketName?.trim();
    if (!ticketName) {
      toast.error("Ticket Name is required");
      return false;
    }
    if (!/[A-Za-z]/.test(ticketName)) {
      toast.error("Ticket Name must contain at least one letter");
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
    // Budget check
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
    // Block if there is already a pending request for this ticket
    if (hasPendingRequest()) {
      toast.error(
        "A billable hours update request is already pending admin approval for this ticket. Please wait for it to be resolved.",
      );
      return;
    }
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
        const result = await ticketService.updateTicket(
          editingTicket.ticket_id,
          payload,
        );
        if (result?.hoursRequestPending) {
          toast.success(
            "Ticket updated. Billable hours change submitted for admin approval.",
            { duration: 5000 },
          );
        } else {
          toast.success("Ticket updated successfully");
        }
      } else {
        await ticketService.createTicket(payload);
        toast.success("Ticket created successfully");
      }

      setShowDialog(false);
      resetForm();
      await fetchTickets();
      await fetchMyRequests(); // refresh pending requests
    } catch (error) {
      console.error("Save ticket error:", error);
      const errMsg = error?.response?.data?.error || "Failed to save ticket";
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (ticket) => {
    // Check if there's a pending request for this ticket
    const pending = myRequests.find(
      (r) => r.ticket_id === ticket.ticket_id && r.status === "PENDING",
    );
    if (pending) {
      toast.warning(
        `This ticket has a pending billable hours update request (${minutesToHHMM(pending.old_hours)} → ${minutesToHHMM(pending.requested_hours)}). Billable hours cannot be changed until the request is resolved.`,
        { duration: 6000 },
      );
    }

    setEditingTicket(ticket);
    const safeDate = (d) => {
      if (!d) return "";
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? "" : dt.toISOString().split("T")[0];
    };
    const billHH = minutesToHHMM(ticket.billable_hours);
    setOriginalBillableHours(ticket.billable_hours);
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
      billableHours: billHH,
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
    if (
      !window.confirm(
        `Delete ticket "${name}"? This will soft delete the ticket.`,
      )
    )
      return;
    try {
      setSubmitting(true);
      await ticketService.deleteTicket(id);
      toast.success("Ticket deleted successfully");
      await fetchTickets();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to delete ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingTicket(null);
    setFormData(initialFormState);
    setBudgetInfo(null);
    setOriginalBillableHours(null);
  };

  const handleDialogClose = (open) => {
    if (!open && !submitting) {
      setShowDialog(false);
      resetForm();
    }
  };

  // ─── Excel Export ─────────────────────────────────────────
  const formatDateForExcel = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const data = await ticketService.getManagerTicketsExport();
      const ticketsData = data?.tickets || [];
      if (ticketsData.length === 0) {
        toast.warning("No tickets found to export");
        return;
      }

      const headers = [
        "Ticket Name",
        "Zoho CRM Code\u00a0",
        "Project",
        "Estimated Hours",
        "Approved Hours",
        "Billable Hours\u00a0",
        "Description (Optional)",
        "Status\u00a0*",
        "Start Date\u00a0*",
        "End Date\u00a0*",
        "Estimated End\u00a0*",
        "Assigned Consultant ",
      ];
      const rows = ticketsData.map((t) => [
        t.ticket_name || "",
        t.zoho_crm_code || "",
        t.project_name || "",
        minutesToHHMM(t.estimated_hours),
        minutesToHHMM(t.approved_hours),
        minutesToHHMM(t.billable_hours),
        t.description || "",
        t.status || "",
        formatDateForExcel(t.start_date),
        formatDateForExcel(t.end_date),
        formatDateForExcel(t.estimated_date),
        t.assigned_consultants || "",
      ]);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws["!cols"] = [
        { wch: 30 },
        { wch: 22 },
        { wch: 25 },
        { wch: 18 },
        { wch: 16 },
        { wch: 16 },
        { wch: 30 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 },
        { wch: 40 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Tickets");
      const today = new Date()
        .toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
        .replace(/ /g, "_");
      XLSX.writeFile(wb, `TT_report_${today}.xlsx`, {
        bookType: "xlsx",
        cellStyles: true,
      });
      toast.success(`Exported ${ticketsData.length} ticket(s) successfully`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export tickets");
    } finally {
      setExporting(false);
    }
  };

  // ─── Derived data ─────────────────────────────────────────
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
  const pendingRequests = myRequests.filter((r) => r.status === "PENDING");

  const getStatusBadgeColor = (statusName) => {
    const colorMap = {
      Planned: "bg-blue-500 hover:bg-blue-600 text-white rounded-full",
      "In Progress":
        "bg-yellow-500 hover:bg-yellow-600 text-yellow-950 rounded-full",
      Completed: "bg-green-500 hover:bg-green-600 rounded-full",
      "On Hold": "bg-gray-500 hover:bg-gray-600 rounded-full",
      Cancelled: "bg-red-500 hover:bg-red-600 rounded-full",
    };
    return colorMap[statusName] || "bg-gray-500 hover:bg-gray-600 rounded-full";
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

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ticket Management</h1>
          <p className="text-muted-foreground">
            Create, edit, and manage tickets under projects
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={exporting || loading}
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download Report
              </>
            )}
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setShowDialog(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Add Ticket
          </Button>
        </div>
      </motion.div>

      {/* ─── MY PENDING HOURS REQUESTS ───────────────────────── */}
      {myRequests.length > 0 && (
        <motion.div variants={item}>
        <Card className="border-none shadow-soft bg-white dark:bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-yellow-500" />
              My Billable Hours Update Requests
              {pendingRequests.length > 0 && (
                <Badge className="bg-yellow-500 text-white rounded-full">
                  {pendingRequests.length} pending
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
                    <TableHead>Project</TableHead>
                    <TableHead>Current Hours</TableHead>
                    <TableHead>Requested Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actioned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requestsLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    myRequests.map((req) => (
                      <TableRow key={req.ticket_hours_update_history_id}>
                        <TableCell className="font-medium">
                          {req.ticket_name}
                        </TableCell>
                        <TableCell>{req.project_name}</TableCell>
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
                        <TableCell className="text-sm text-muted-foreground">
                          {req.action_at ? formatDate(req.action_at) : "-"}
                          {req.status === "REJECTED" && req.action_by_name && (
                            <span className="block text-xs text-red-500">
                              by {req.action_by_name}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div variants={item}>
      <Card className="border-none shadow-soft bg-white dark:bg-card">
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
      </motion.div>

      {/* Tickets Table */}
      <motion.div variants={item}>
      <Card className="border-none shadow-soft bg-white dark:bg-card">
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
                  <TableHead className="min-w-[180px]">Ticket</TableHead>
                  <TableHead className="min-w-[160px]">Zoho Code</TableHead>
                  <TableHead className="min-w-[200px] max-w-[300px]">
                    Description
                  </TableHead>
                  <TableHead className="min-w-[140px]">Project</TableHead>
                  <TableHead className="min-w-[120px]">Status</TableHead>
                  <TableHead className="min-w-[180px]">
                    Hours (Est/Appr/Bill)
                  </TableHead>
                  <TableHead className="min-w-[110px]">Start Date</TableHead>
                  <TableHead className="min-w-[110px]">End Date</TableHead>
                  <TableHead className="min-w-[100px] text-center">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      <p className="text-sm text-muted-foreground mt-2">
                        Loading...
                      </p>
                    </TableCell>
                  </TableRow>
                ) : filteredTickets.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No tickets found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTickets.map((t) => {
                    const isInactive = t.is_active === false;
                    const pendingReq = myRequests.find(
                      (r) =>
                        r.ticket_id === t.ticket_id && r.status === "PENDING",
                    );

                    return (
                      <TableRow
                        key={t.ticket_id}
                        className={isInactive ? "opacity-50 bg-muted/30" : ""}
                      >
                        <TableCell className="align-top min-w-[180px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium break-words">
                              {t.ticket_name}
                            </span>
                            {isInactive && (
                              <Badge
                                variant="outline"
                                className="text-xs shrink-0"
                              >
                                Inactive
                              </Badge>
                            )}
                            {pendingReq && (
                              <Badge
                                className="bg-yellow-500 text-white rounded-full text-xs shrink-0"
                                title="Billable hours update pending admin approval"
                              >
                                <Clock className="h-3 w-3 mr-1 inline" />
                                Pending
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="align-top min-w-[160px]">
                          <Badge className="text-sm whitespace-nowrap">
                            {t.zoho_crm_code}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top min-w-[200px] max-w-[300px]">
                          <div className="text-sm break-words">
                            {t.description || "-"}
                          </div>
                        </TableCell>
                        <TableCell className="align-top min-w-[140px]">
                          <span className="break-words">
                            {t.project_name || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="align-top min-w-[120px]">
                          <Badge className={getStatusBadgeColor(t.status)}>
                            {t.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top min-w-[180px]">
                          <span className="text-sm whitespace-nowrap font-mono">
                            {minutesToHHMM(t.estimated_hours)} /{" "}
                            {minutesToHHMM(t.approved_hours)} /{" "}
                            {minutesToHHMM(t.billable_hours)}
                          </span>
                          {pendingReq && (
                            <div className="text-xs text-yellow-600 mt-0.5">
                              Bill pending: →{" "}
                              {minutesToHHMM(pendingReq.requested_hours)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="align-top text-sm min-w-[110px] whitespace-nowrap">
                          {formatDate(t.start_date)}
                        </TableCell>
                        <TableCell className="align-top text-sm min-w-[110px] whitespace-nowrap">
                          {formatDate(t.end_date)}
                        </TableCell>
                        <TableCell className="align-top min-w-[100px]">
                          <div className="flex justify-end gap-2">
                            {isInactive ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReactivate(t)}
                                title="Reactivate"
                                disabled={submitting}
                              >
                                <ArchiveRestore className="h-4 w-4 text-green-600" />
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(t)}
                                  title="Edit"
                                  disabled={submitting}
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
                                  disabled={submitting}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTicket ? "Edit Ticket" : "Add New Ticket"}
            </DialogTitle>
            <DialogDescription>
              {editingTicket
                ? "Update ticket details. Billable hours changes require admin approval."
                : "Create a new ticket. All fields are mandatory except Description."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Pending request warning banner */}
            {editingTicket && hasPendingRequest() && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-yellow-600" />
                <span>
                  A billable hours update request is currently pending admin
                  approval for this ticket. You cannot submit another billable
                  hours change until the existing request is resolved.
                </span>
              </div>
            )}

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
                    setFormData((prev) => ({
                      ...prev,
                      ticketName: e.target.value,
                    }))
                  }
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
            <div>
              {/* Billable hours change info banner (when changing billable and no pending) */}
              {editingTicket && !hasPendingRequest() && (
                <div className="flex items-start gap-2 rounded-md border border-red-500 bg-red-100 p-3 text-sm text-red-800">
                  <Info className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />
                  <span>
                    Changing <strong>Billable Hours</strong> will submit an
                    approval request to admin.
                  </span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  key: "estimatedHours",
                  label: "Estimated Hours",
                  needsApproval: false,
                },
                {
                  key: "approvedHours",
                  label: "Approved Hours",
                  needsApproval: false,
                },
                {
                  key: "billableHours",
                  label: "Billable Hours",
                  needsApproval: true,
                },
              ].map(({ key, label, needsApproval }) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>
                    {label} <span className="text-red-500">*</span>
                    {/* {needsApproval && editingTicket && (
                      <span className="ml-1 text-xs text-yellow-600 font-normal">
                        (requires approval)
                      </span>
                    )} */}
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
                    disabled={
                      submitting ||
                      (needsApproval && editingTicket && hasPendingRequest())
                    }
                    className={`font-mono ${needsApproval && editingTicket && isBillableChanged() && !hasPendingRequest() ? "border-yellow-400 focus:ring-yellow-400" : ""}`}
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

            {/* Approval notice when billable hours will change */}
            {editingTicket && isBillableChanged() && !hasPendingRequest() && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
                <Clock className="h-4 w-4 mt-0.5 shrink-0 text-yellow-600" />
                <span>
                  You have changed the Billable Hours (
                  {minutesToHHMM(originalBillableHours)} →{" "}
                  {formData.billableHours}). Submitting will send an approval
                  request to admin. Other fields will be updated immediately.
                </span>
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
            <Button
              onClick={handleSubmit}
              disabled={
                submitting ||
                (editingTicket && hasPendingRequest() && isBillableChanged())
              }
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {editingTicket ? "Updating..." : "Creating..."}
                </>
              ) : editingTicket &&
                isBillableChanged() &&
                !hasPendingRequest() ? (
                "Update & Request Approval"
              ) : (
                <>{editingTicket ? "Update" : "Create"} Ticket</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </motion.div>
    </motion.div>
  );
}

export default ManagerTicketManagement;

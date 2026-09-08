import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { motion } from "framer-motion";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogFooter,
// } from "../../components/ui/dialog";
import {
  Search,
  Ticket as TicketIcon,
  Calendar,
  Loader2,
  AlertCircle,
  Eye,
} from "lucide-react";
import timesheetService from "../../services/timesheetService";
import { format } from "date-fns";
import { toast } from "sonner";
import { minutesToHHMM, formatMinutesDisplay } from "../../utils/timeUtils";
import ViewTicketDialog from "../ui/viewTicketDialog";

// ============================================
// MAIN COMPONENT
// ============================================

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function MyTickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewingTicket, setViewingTicket] = useState(null);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await timesheetService.getMyTickets();
      console.log("✅ My Tickets Response:", data);

      setTickets(Array.isArray(data) ? data : data?.tickets || []);
    } catch (error) {
      console.error("Failed to load tickets:", error);
      setError(error.response?.data?.error || "Failed to load tickets");
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  const handleViewTicket = (ticket) => {
    setViewingTicket(ticket);
    setShowViewDialog(true);
  };

  const filteredTickets = tickets.filter((t) => {
    const query = searchQuery.toLowerCase();
    const client = t.client_name?.toLowerCase() || "";
    const project = t.project_name?.toLowerCase() || "";
    const ticket = t.ticket_name?.toLowerCase() || "";
    const projectCode = t.project_code?.toLowerCase() || "";
    const ticketCode = t.ticket_code?.toLowerCase() || "";
    const description = t.description?.toLowerCase() || "";

    return (
      client.includes(query) ||
      project.includes(query) ||
      ticket.includes(query) ||
      projectCode.includes(query) ||
      ticketCode.includes(query) ||
      description.includes(query)
    );
  });

  const getPageTitle = () => {
    switch (user?.role) {
      case "MANAGER":
        return "My Tickets";
      case "EMPLOYEE":
        return "My Tickets";
      case "ADMIN":
        return "All Tickets";
      default:
        return "My Tickets";
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-96 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading your tickets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight">{getPageTitle()}</h1>
      </motion.div>

      {/* Main Card */}
      <motion.div variants={item}>
      <Card className="border-none shadow-soft bg-white dark:bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TicketIcon className="h-5 w-5" />
              Assigned Tickets
            </CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[18%]">Ticket</TableHead>
                  <TableHead className="w-[12%]">Ticket Code</TableHead>
                  <TableHead className="w-[25%]">Description</TableHead>
                  <TableHead className="w-[12%] text-center">
                    Assigned Hours
                  </TableHead>
                  <TableHead className="w-[12%] text-center">
                    Used Hours
                  </TableHead>
                  <TableHead className="w-[10%] text-center">Status</TableHead>
                  <TableHead className="w-[11%] text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center space-y-2">
                        <TicketIcon className="h-12 w-12 text-muted-foreground/50" />
                        <p className="text-muted-foreground font-medium">
                          {searchQuery
                            ? "No tickets found matching your search"
                            : "No tickets assigned yet"}
                        </p>
                        {!searchQuery && user?.role === "EMPLOYEE" && (
                          <p className="text-sm text-muted-foreground">
                            Contact your manager for ticket assignments
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTickets.map((t) => {
                    // ✅ FIXED: Values are already in minutes from backend
                    const budgetMinutes = Number(t.budget_minutes) || 0;
                    const usedMinutes = Number(t.used_minutes) || 0;
                    const isBudgetExceeded = usedMinutes > budgetMinutes;
                    const isInactive = t.ticket_is_active === false;

                    return (
                      <TableRow
                        key={t.assignment_id || t.ticket_id}
                        className={isInactive ? "opacity-50 bg-muted/30" : ""}
                      >
                        {/* Ticket Name */}
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span className="truncate">{t.ticket_name}</span>
                            {isInactive && (
                              <Badge
                                variant="outline"
                                className="text-xs flex-shrink-0"
                              >
                                Inactive
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Ticket Code */}
                        <TableCell>
                          {t.ticket_code ? (
                            <Badge className="text-xs font-normal">
                              {t.ticket_code}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              -
                            </span>
                          )}
                        </TableCell>

                        {/* Description Column */}
                        <TableCell>
                          <div className="max-w-xs">
                            {t.description ? (
                              <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                                {t.description}
                              </p>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">
                                No description
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* ✅ FIXED: Assigned Hours (Display HH:MM) */}
                        <TableCell className="text-center">
                          <span className="text-sm font-medium">
                            {minutesToHHMM(budgetMinutes)}
                          </span>
                        </TableCell>

                        {/* ✅ FIXED: Used Hours (Display HH:MM) */}
                        <TableCell className="text-center">
                          <span
                            className={`text-sm font-bold ${
                              isInactive
                                ? "text-muted-foreground"
                                : isBudgetExceeded
                                  ? "text-red-600"
                                  : usedMinutes > budgetMinutes * 0.9
                                    ? "text-yellow-600"
                                    : "text-green-600"
                            }`}
                          >
                            {minutesToHHMM(usedMinutes)}
                          </span>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="text-center">
                          <Badge
                            variant={isInactive ? "secondary" : "default"}
                            className={
                              isInactive
                                ? ""
                                : "bg-green-500 hover:bg-green-600"
                            }
                          >
                            {isInactive ? "Inactive" : "Active"}
                          </Badge>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-center">
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewTicket(t)}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4 text-blue-600" />
                            </Button>

                            {/* View Ticket Dialog (colocated with button) */}
                            <ViewTicketDialog
                              open={showViewDialog}
                              onOpenChange={setShowViewDialog}
                              ticket={viewingTicket}
                            />
                          </>
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
      </motion.div>
    </motion.div>
  );
}

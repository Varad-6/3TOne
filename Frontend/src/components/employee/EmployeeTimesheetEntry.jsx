// import React, { useEffect, useMemo, useState } from "react";
// import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
// import { Button } from "../ui/button";
// import { Input } from "../ui/input";
// import { Textarea } from "../ui/textarea";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "../ui/select";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogFooter,
// } from "../ui/dialog";
// import {
//   AlertDialog,
//   AlertDialogAction,
//   AlertDialogCancel,
//   AlertDialogContent,
//   AlertDialogDescription,
//   AlertDialogFooter,
//   AlertDialogHeader,
//   AlertDialogTitle,
// } from "../ui/alert-dialog";
// import { Badge } from "../ui/badge";
// import {
//   Plus,
//   Trash2,
//   Send,
//   Pencil,
//   AlertCircle,
//   CheckCircle,
//   ChevronRight,
//   ChevronLeft,
//   Clock,
//   XCircle,
// } from "lucide-react";
// import { toast } from "sonner";
// import timesheetService from "../../services/timesheetService";
// import projectService from "../../services/projectService";
// import ticketService from "../../services/ticketService";
// import taskService from "../../services/taskService";
// import { format, startOfWeek, addDays, isSameDay } from "date-fns";
// import { TimesheetCalendar } from "../ui/TimesheetCalendar";

// // ============================================
// // ✅ MINUTES-BASED TIME UTILITIES - ALIGNED WITH MANAGER
// // ============================================

// /**
//  * Convert HH:MM input to minutes for backend
//  */
// const hhmmToMinutes = (value) => {
//   if (!value) return null;
//   const str = String(value).trim();

//   if (!str.includes(":")) {
//     return null;
//   }

//   const [hStr, mStr] = str.split(":");
//   const hours = Number(hStr);
//   const minutes = Number(mStr);

//   if (isNaN(hours) || isNaN(minutes)) {
//     return null;
//   }

//   if (minutes < 0 || minutes >= 60) {
//     return null;
//   }

//   return hours * 60 + minutes;
// };

// /**
//  * Convert minutes from backend to HH:MM format for display
//  */
// const minutesToHHMM = (minutes) => {
//   if (minutes === null || minutes === undefined || isNaN(minutes)) {
//     return "0:00";
//   }

//   const totalMinutes = Math.round(Number(minutes));
//   const h = Math.floor(totalMinutes / 60);
//   const m = totalMinutes % 60;

//   return `${h}:${String(m).padStart(2, "0")}`;
// };

// /**
//  * Validate HH:MM time input
//  */
// const isValidHHMM = (value) => {
//   if (!value) return false;
//   const str = String(value).trim();

//   if (!str.includes(":")) {
//     return false;
//   }

//   const [hStr, mStr] = str.split(":");
//   const hours = Number(hStr);
//   const minutes = Number(mStr);

//   if (isNaN(hours) || isNaN(minutes)) {
//     return false;
//   }

//   if (hours < 0 || minutes < 0 || minutes >= 60) {
//     return false;
//   }

//   return true;
// };

// /**
//  * Get validation error message - ALIGNED with Manager
//  */
// const getHHMMError = (value, maxMinutes = 1440) => {
//   if (!value || value.trim() === "") {
//     return "Time is required";
//   }

//   const str = String(value).trim();

//   if (!str.includes(":")) {
//     return "Invalid format. Use HH:MM";
//   }

//   const [hStr, mStr] = str.split(":");
//   const hours = Number(hStr);
//   const minutes = Number(mStr);

//   if (isNaN(hours) || isNaN(minutes)) {
//     return "Invalid time format";
//   }

//   if (minutes < 0 || minutes >= 60) {
//     return "Minutes must be between 0 and 59";
//   }

//   if (hours < 0) {
//     return "Hours cannot be negative";
//   }

//   const totalMinutes = hours * 60 + minutes;

//   if (totalMinutes === 0) {
//     return "Time must be greater than 0";
//   }

//   if (totalMinutes > maxMinutes) {
//     return "Maximum 24h allowed";
//   }

//   return null;
// };

// const DAILY_LIMIT_MINUTES = 24 * 60; // 24 hours in minutes
// const SELECTED_DATE_KEY = "employee_timesheet_selected_date";

// const MIN_DAILY_MINUTES = 8 * 60;
// const MAX_DAILY_MINUTES = 24 * 60;

// // ✅ STATUS MAPPING - Maps status IDs to names
// const STATUS_MAP = {
//   1: "Draft",
//   2: "Submitted",
//   3: "Manager_Approved",
//   4: "Manager_Rejected",
//   5: "Admin_Approved",
//   6: "Admin_Rejected",
//   7: "Partially_Approved",
// };

// // ✅ Helper to get status name from ID or return as-is if already a string
// function getStatusName(status) {
//   if (typeof status === "string") return status;
//   if (typeof status === "number") return STATUS_MAP[status] || "Unknown";
//   return "Unknown";
// }

// // ✅ Helper to check if status matches a pattern
// function statusMatches(status, pattern) {
//   const statusName = getStatusName(status);
//   return statusName.includes(pattern);
// }

// function toIso(date) {
//   if (typeof date === "string") return date.split("T")[0];
//   const year = date.getFullYear();
//   const month = String(date.getMonth() + 1).padStart(2, "0");
//   const day = String(date.getDate()).padStart(2, "0");
//   return `${year}-${month}-${day}`;
// }

// function getWeekDatesFrom(date) {
//   const start = startOfWeek(date, { weekStartsOn: 1 });
//   const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
//   const end = addDays(start, 6);
//   return { start, end, dates };
// }

// const getUser = () => {
//   try {
//     const userData = localStorage.getItem("user");
//     if (userData) {
//       return JSON.parse(userData);
//     }
//   } catch (error) {
//     console.error("Failed to get user:", error);
//   }
//   return null;
// };

// // ✅ Helper function to check if date is in the future
// const isFutureDate = (date) => {
//   const todayIso = toIso(new Date());
//   const dateIso = toIso(date);
//   return dateIso > todayIso;
// };

// export function EmployeeTimesheetEntry() {
//   const [projects, setProjects] = useState([]);
//   const [tickets, setTickets] = useState([]);
//   const [tasks, setTasks] = useState([]);
//   const [entries, setEntries] = useState([]);
//   const [allEntries, setAllEntries] = useState([]); // ALL entries for calendar

//   const [selectedDay, setSelectedDay] = useState(() => {
//     const saved = sessionStorage.getItem(SELECTED_DATE_KEY);
//     return saved ? new Date(saved) : new Date();
//   });

//   const {
//     dates: weekDates,
//     start: weekStart,
//     end: weekEnd,
//   } = useMemo(() => getWeekDatesFrom(selectedDay), [selectedDay]);

//   const [loading, setLoading] = useState(false);
//   const [submitting, setSubmitting] = useState(false);
//   const [dialogOpen, setDialogOpen] = useState(false);
//   const [editingEntry, setEditingEntry] = useState(null);

//   const [form, setForm] = useState({
//     projectId: "",
//     ticketId: "",
//     taskId: "",
//     ticketNumber: "",
//     description: "",
//     hours: "", // HH:MM
//   });

//   const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
//   const user = getUser();
//   const [errors, setErrors] = useState({
//     projectId: "",
//     ticketId: "",
//     taskId: "",
//     hours: "",
//   });
//   useEffect(() => {
//     sessionStorage.setItem(SELECTED_DATE_KEY, selectedDay.toISOString());
//   }, [selectedDay]);

//   const weekKey = useMemo(
//     () => `${toIso(weekStart)}_${toIso(weekEnd)}`,
//     [weekStart, weekEnd],
//   );

//   const entriesForSelectedDay = useMemo(() => {
//     const dayIso = toIso(selectedDay);
//     return entries.filter(
//       (e) => (e.entry_date?.split("T")[0] || e.entry_date) === dayIso,
//     );
//   }, [entries, selectedDay]);

//   const weekTotalMinutes = useMemo(() => {
//     return entries.reduce((sum, e) => sum + Number(e.hours_logged || 0), 0);
//   }, [entries]);

//   const weeklyBillableMinutes = useMemo(() => {
//     return entries.reduce((sum, e) => sum + Number(e.billable_hours || 0), 0);
//   }, [entries]);

//   const weeklyNonBillableMinutes = useMemo(() => {
//     return entries.reduce(
//       (sum, e) => sum + Number(e.non_billable_hours || 0),
//       0,
//     );
//   }, [entries]);

//   const isWeekValidForSubmit = useMemo(() => {
//     if (entries.length === 0) return false;

//     const dailyTotals = {};
//     weekDates.forEach((d) => (dailyTotals[toIso(d)] = 0));

//     entries.forEach((e) => {
//       if (dailyTotals.hasOwnProperty(e.entry_date)) {
//         dailyTotals[e.entry_date] += Number(e.hours_logged || 0);
//       }
//     });

//     return weekDates.every((d) => {
//       const dayIso = toIso(d);
//       const total = dailyTotals[dayIso] || 0;
//       return total >= MIN_DAILY_MINUTES && total <= MAX_DAILY_MINUTES;
//     });
//   }, [entries, weekDates]);

//   const pendingEntries = entries.filter((e) => {
//     const statusName = getStatusName(e.status);
//     return ["Draft", "Manager_Rejected", "Admin_Rejected"].includes(statusName);
//   });

//   const getWeeklyStatus = () => {
//     if (entries.length === 0) return "No Entries";

//     const statusNames = entries.map((e) => getStatusName(e.status));
//     if (statusNames.some((s) => s.includes("Rejected"))) {
//       return "Partially Rejected";
//     }
//     if (statusNames.every((s) => s.includes("Approved"))) {
//       return "Approved";
//     }
//     if (statusNames.some((s) => s === "Partially_Approved")) {
//       return "Partially Approved";
//     }
//     if (statusNames.every((s) => s === "Submitted")) {
//       return "Submitted";
//     }
//     return "In Progress";
//   };

//   const weeklyStatus = getWeeklyStatus();
//   // const canSubmit = pendingEntries.length > 0;
//   const isResubmission = entries.some((e) =>
//     statusMatches(e.status, "Rejected"),
//   );

//   const future = isFutureDate(selectedDay);

//   // Fetch Tasks on mount
//   useEffect(() => {
//     async function fetchTasks() {
//       if (user && user.department && form.projectId) {
//         try {
//           const data = await taskService.getTasksByDepartmentAndProject(
//             user.department,
//             form.projectId,
//           );
//           setTasks(data.tasks || []);
//           console.log(
//             `✅ Loaded ${data.tasks?.length || 0} tasks` +
//               (data.projectType ? ` for ${data.projectType}` : "") +
//               (data.isDefaultProject ? " (including COMMON)" : ""),
//           );
//         } catch (error) {
//           console.error("Failed to fetch tasks:", error);
//           toast.error("Could not load department tasks.");
//           setTasks([]);
//         }
//       } else {
//         setTasks([]);
//       }
//     }
//     fetchTasks();
//   }, [form.projectId]);

//   const loadEntries = async () => {
//     setLoading(true);
//     try {
//       if (!user || !user.id) {
//         setLoading(false);
//         return;
//       }

//       const projData = await projectService.getAssignedProjectsForTimesheet(
//         user.id,
//       );
//       setProjects(projData.projects || []);

//       const entriesResp = await timesheetService.getEntriesByDateRange(
//         toIso(weekStart),
//         toIso(weekEnd),
//       );

//       let loadedEntries = entriesResp?.entries ?? [];
//       loadedEntries = loadedEntries.map((entry) => ({
//         ...entry,
//         entry_date: entry.entry_date.split("T")[0],
//         ticket_name: entry.ticket_name || entry.activity_name,
//         task_name: entry.task_name,
//         billable_hours: Number(entry.billable_hours || 0),
//         non_billable_hours: Number(entry.non_billable_hours || 0),
//       }));
//       setEntries(loadedEntries);

//       console.log("✅ Loaded entries:", loadedEntries);
//     } catch (err) {
//       console.error("❌ Load error:", err);
//       toast.error("Failed to load timesheet data");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ✅ Load ALL entries for calendar color coding
//   const loadAllEntriesForCalendar = async () => {
//     try {
//       if (!user || !user.id) return;

//       // Load entries for the last 3 months and next month (broad range for calendar)
//       const today = new Date();
//       const startDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
//       const endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);

//       const allEntriesResp = await timesheetService.getEntriesByDateRange(
//         toIso(startDate),
//         toIso(endDate),
//       );

//       let loadedAllEntries = allEntriesResp?.entries ?? [];
//       loadedAllEntries = loadedAllEntries.map((entry) => ({
//         ...entry,
//         entry_date: entry.entry_date.split("T")[0],
//         total_hours: Number(entry.hours_logged || 0),
//         billable_hours: Number(entry.billable_hours || 0),
//         non_billable_hours: Number(entry.non_billable_hours || 0),
//       }));
//       setAllEntries(loadedAllEntries);

//       console.log(
//         "✅ Loaded all entries for calendar:",
//         loadedAllEntries.length,
//       );
//     } catch (err) {
//       console.error("❌ Load all entries error:", err);
//     }
//   };

//   useEffect(() => {
//     loadEntries();
//   }, [weekKey]);

//   // Load all entries for calendar on mount
//   useEffect(() => {
//     loadAllEntriesForCalendar();
//   }, []);

//   useEffect(() => {
//     if (form.projectId) {
//       ticketService
//         .getAssignedTicketsForTimesheet(form.projectId, toIso(selectedDay))
//         .then((data) => setTickets(data.tickets || []))
//         .catch(() => setTickets([]));
//     }
//   }, [selectedDay, form.projectId]);

//   const handleProjectChange = async (projectId) => {
//     setForm((prev) => ({
//       ...prev,
//       projectId,
//       ticketId: "",
//       ticketNumber: "",
//       taskId: "",
//     }));
//     try {
//       if (projectId) {
//         const data = await ticketService.getAssignedTicketsForTimesheet(
//           projectId,
//           toIso(selectedDay),
//         );
//         setTickets(data.tickets || []);
//       } else {
//         setTickets([]);
//       }
//     } catch (error) {
//       console.error("Failed to load tickets:", error);
//       setTickets([]);
//     }
//   };

//   const handleTicketChange = (val) => {
//     const selectedTicket = tickets.find((t) => t.ticket_id === val);
//     setForm((prev) => ({
//       ...prev,
//       ticketId: val,
//       ticketNumber: selectedTicket?.zoho_crm_code || prev.ticketNumber || "",
//     }));
//   };

//   const openAddDialog = () => {
//     setEditingEntry(null);
//     setForm({
//       projectId: "",
//       ticketId: "",
//       taskId: "",
//       ticketNumber: "",
//       description: "",
//       hours: "",
//     });
//     setTickets([]);
//     setDialogOpen(true);
//   };

//   const openEditDialog = async (entry) => {
//     const statusName = getStatusName(entry.status);

//     if (!["Draft", "Manager_Rejected", "Admin_Rejected"].includes(statusName)) {
//       toast.error("Cannot edit entry pending approval or already approved.");
//       return;
//     }

//     setEditingEntry(entry);
//     if (entry.project_id) {
//       try {
//         const data = await ticketService.getAssignedTicketsForTimesheet(
//           entry.project_id,
//           toIso(selectedDay),
//         );
//         setTickets(data.tickets || []);
//       } catch (e) {
//         console.error("Failed to load tickets for edit:", e);
//         setTickets([]);
//       }
//     }
//     setForm({
//       projectId: entry.project_id ?? "",
//       ticketId: entry.ticket_id ?? entry.activity_id ?? "",
//       taskId: entry.task_id ?? "",
//       ticketNumber: entry.ticket_number ?? "",
//       description: entry.description ?? "",
//       hours: minutesToHHMM(entry.hours_logged),
//     });
//     setDialogOpen(true);
//   };

//   const saveEntry = async () => {
//     const { projectId, ticketId, taskId, hours, ticketNumber, description } =
//       form;

//     const todayIso = toIso(new Date());
//     const entryDateStr = toIso(selectedDay);

//     if (entryDateStr > todayIso) {
//       toast.error("You cannot add entries for future dates");
//       return;
//     }

//     if (!projectId || !ticketId || !taskId || !hours) {
//       toast.error("Project, Ticket, Task, and Hours are required");
//       return;
//     }

//     // ✅ ALIGNED: Use same validation as Manager
//     const error = getHHMMError(hours, MAX_DAILY_MINUTES);
//     if (error) {
//       toast.error(error);
//       return;
//     }

//     const minutes = hhmmToMinutes(hours);

//     const currentDailyTotal = entriesForSelectedDay.reduce(
//       (sum, e) => sum + Number(e.hours_logged || 0),
//       0,
//     );

//     let projectedTotal = currentDailyTotal;
//     if (editingEntry) {
//       const oldHours = Number(editingEntry.hours_logged || 0);
//       projectedTotal = currentDailyTotal - oldHours + minutes;
//     } else {
//       projectedTotal = currentDailyTotal + minutes;
//     }

//     if (projectedTotal > DAILY_LIMIT_MINUTES) {
//       toast.error("Daily limit (12h) exceeded.");
//       return;
//     }

//     setSubmitting(true);
//     try {
//       const payload = {
//         projectId,
//         ticketId,
//         taskId,
//         ticketNumber: ticketNumber || null,
//         hoursLogged: minutes,
//         description: description || null,
//       };

//       if (editingEntry) {
//         await timesheetService.updateTimesheetEntry(
//           editingEntry.entry_id,
//           payload,
//         );
//         toast.success("Entry updated successfully");
//       } else {
//         await timesheetService.createTimesheetEntry({
//           ...payload,
//           entryDate: entryDateStr,
//         });
//         toast.success("Entry created successfully");
//       }

//       await loadEntries();
//       await loadAllEntriesForCalendar(); // Refresh calendar data

//       setDialogOpen(false);
//       setEditingEntry(null);
//       setForm({
//         projectId: "",
//         ticketId: "",
//         taskId: "",
//         ticketNumber: "",
//         description: "",
//         hours: "",
//       });
//     } catch (err) {
//       console.error("Save entry error:", err);
//       toast.error(err.response?.data?.error || "Failed to save entry");
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const handleDeleteEntry = async (entryId) => {
//     const entry = entries.find((e) => e.entry_id === entryId);
//     const statusName = getStatusName(entry?.status);

//     if (
//       !entry ||
//       !["Draft", "Manager_Rejected", "Admin_Rejected"].includes(statusName)
//     ) {
//       toast.error("Cannot delete submitted/approved entry.");
//       return;
//     }

//     try {
//       await timesheetService.deleteTimesheetEntry(entryId);
//       toast.success("Entry deleted successfully");
//       await loadEntries();
//       await loadAllEntriesForCalendar(); // Refresh calendar data
//     } catch (err) {
//       console.error("Delete entry error:", err);
//       const errorMsg = err.response?.data?.error || "Failed to delete entry";
//       toast.error(errorMsg);
//     }
//   };

//   const handleSubmit = async () => {
//     setConfirmDialogOpen(false);
//     setSubmitting(true);
//     try {
//       if (!isWeekValidForSubmit) {
//         toast.error("All 7 days must have minimum 8 hours logged.");
//         return;
//       }

//       const result = await timesheetService.submitWeek(
//         toIso(weekStart),
//         toIso(weekEnd),
//       );
//       toast.success(result.message || "Timesheet submitted successfully");
//       await loadEntries();
//       await loadAllEntriesForCalendar(); // Refresh calendar data
//     } catch (err) {
//       console.error("❌ Submit error:", err);
//       toast.error(err.response?.data?.error || "Failed to submit timesheet");
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const StatusBadge = ({ status }) => {
//     const statusName = getStatusName(status);

//     let color = "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-zinc-800";
//     let icon = <Clock className="w-3 h-3 mr-1" />;

//     if (statusName === "Submitted") {
//       color = "bg-yellow-50 text-yellow-700 border-yellow-200";
//       icon = <AlertCircle className="w-3 h-3 mr-1" />;
//     } else if (statusName === "Partially_Approved") {
//       color = "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
//       icon = <Clock className="w-3 h-3 mr-1" />;
//     } else if (statusName.includes("Approved")) {
//       color = "bg-green-50 text-green-700 border-green-200";
//       icon = <CheckCircle className="w-3 h-3 mr-1" />;
//     } else if (statusName.includes("Rejected")) {
//       color = "bg-red-50 text-red-700 border-red-200";
//       icon = <XCircle className="w-3 h-3 mr-1" />;
//     }
//     return (
//       <span
//         className={`flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${color}`}
//       >
//         {icon} {statusName.replace(/_/g, " ")}
//       </span>
//     );
//   };
//   const handleHoursChange = (value) => {
//     setForm((prev) => ({ ...prev, hours: value }));

//     // Real-time validation
//     const error = getHHMMError(value, MAX_DAILY_MINUTES);

//     setErrors((prev) => ({
//       ...prev,
//       hours: error || "",
//     }));
//   };

//   const isWeekSubmitted = useMemo(() => {
//     if (entries.length === 0) return false;

//     const statusNames = entries.map((e) => getStatusName(e.status));

//     return statusNames.every(
//       (s) => !["Draft", "Manager_Rejected", "Admin_Rejected"].includes(s),
//     );
//   }, [entries]);

//   return (
//     <div className="space-y-6 p-1">
//       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg border shadow-sm">
//         <div>
//           <div className="flex items-center gap-2 mb-1">
//             <h2 className="text-xl font-semibold text-gray-800">
//               Weekly Timesheet
//             </h2>
//             <Badge
//               variant={
//                 weeklyStatus.includes("Rejected") ? "destructive" : "outline"
//               }
//             >
//               {weeklyStatus}
//             </Badge>
//           </div>
//           <p className="text-sm text-muted-foreground flex items-center gap-2">
//             <span className="font-medium text-gray-700 dark:text-gray-200">
//               {format(weekStart, "MMM d")}
//             </span>
//             <ChevronRight className="w-3 h-3" />
//             <span className="font-medium text-gray-700 dark:text-gray-200">
//               {format(weekEnd, "MMM d, yyyy")}
//             </span>
//           </p>
//         </div>

//         <div className="flex items-center gap-3">
//           <div className="flex items-center bg-gray-100 dark:bg-zinc-800 rounded-lg p-1">
//             <Button
//               variant="ghost"
//               size="sm"
//               onClick={() => setSelectedDay(addDays(selectedDay, -7))}
//               className="h-8 w-8 p-0 hover:bg-white dark:hover:bg-zinc-700 rounded-md"
//             >
//               <ChevronLeft className="h-4 w-4" />
//             </Button>
//             <TimesheetCalendar
//               selectedDate={selectedDay}
//               onDateSelect={setSelectedDay}
//               entries={allEntries}
//               getEntryDate={(entry) => entry.entry_date}
//             />
//             <Button
//               variant="ghost"
//               size="sm"
//               onClick={() => setSelectedDay(new Date())}
//               className="h-8 px-3 text-xs font-medium hover:bg-white dark:hover:bg-zinc-700 rounded-md"
//             >
//               Today
//             </Button>
//             <Button
//               variant="ghost"
//               size="sm"
//               onClick={() => setSelectedDay(addDays(selectedDay, 7))}
//               className="h-8 w-8 p-0 hover:bg-white dark:hover:bg-zinc-700 rounded-md"
//             >
//               <ChevronRight className="h-4 w-4" />
//             </Button>
//           </div>

//           <Button
//             onClick={openAddDialog}
//             className="gap-2 shadow-sm"
//             disabled={future || isWeekSubmitted === true}
//           >
//             <Plus className="h-4 w-4" /> Add Entry
//           </Button>
//         </div>
//       </div>

//       {/* Day Tabs */}
//       <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
//         {weekDates.map((d) => {
//           const isSelected = isSameDay(d, selectedDay);
//           const isToday = isSameDay(d, new Date());
//           const dayIso = toIso(d);
//           const dayHours = entries
//             .filter((e) => e.entry_date === dayIso)
//             .reduce((sum, e) => sum + Number(e.hours_logged || 0), 0);

//           return (
//             <button
//               key={dayIso}
//               onClick={() => setSelectedDay(d)}
//               className={`
//                 flex-1 min-w-[100px] p-3 rounded-lg border transition-all duration-200
//                 flex flex-col items-center justify-center gap-1
//                 ${
//                   isSelected
//                     ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ring-1 ring-blue-200"
//                     : "bg-white dark:bg-card border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
//                 }
//               `}
//             >
//               <span
//                 className={`text-xs font-medium uppercase ${
//                   isSelected ? "text-blue-600" : "text-gray-500"
//                 }`}
//               >
//                 {isToday ? "Today" : format(d, "EEE")}
//               </span>
//               <span
//                 className={`text-lg font-bold ${
//                   isSelected ? "text-blue-700 dark:text-blue-400" : "text-gray-700 dark:text-gray-200"
//                 }`}
//               >
//                 {format(d, "d")}
//               </span>
//               {dayHours > 0 && (
//                 <span className="text-[10px] font-medium px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-800 rounded-full text-gray-600 dark:text-gray-300 mt-1">
//                   {minutesToHHMM(dayHours)}
//                 </span>
//               )}
//             </button>
//           );
//         })}
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//         <Card className="lg:col-span-2 border-0 shadow-sm ring-1 ring-gray-200">
//           <CardHeader className="pb-3 border-b">
//             <CardTitle className="text-lg flex items-center justify-between">
//               <span>Entries for {format(selectedDay, "EEEE, MMM d")}</span>
//               <span className="text-sm font-normal text-muted-foreground">
//                 Total:{" "}
//                 {minutesToHHMM(
//                   entriesForSelectedDay.reduce(
//                     (acc, e) => acc + Number(e.hours_logged),
//                     0,
//                   ),
//                 )}
//               </span>
//             </CardTitle>
//           </CardHeader>
//           <CardContent className="p-0">
//             {loading ? (
//               <div className="p-8 text-center text-muted-foreground animate-pulse">
//                 Loading entries...
//               </div>
//             ) : entriesForSelectedDay.length === 0 ? (
//               <div className="p-12 text-center flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
//                 <button
//                   type="button"
//                   onClick={!future ? openAddDialog : undefined}
//                   disabled={future}
//                   aria-disabled={future}
//                   title={
//                     future
//                       ? "You cannot add entries for future dates"
//                       : "Add entry"
//                   }
//                   className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors
//                     ${
//                       future
//                         ? "bg-gray-100 dark:bg-zinc-800 text-gray-300 dark:text-gray-500 cursor-not-allowed opacity-50"
//                         : "bg-gray-200 text-gray-500 cursor-pointer hover:bg-gray-300"
//                     }
//                   `}
//                 >
//                   <Plus className="w-6 h-6" />
//                 </button>
//                 <p className="text-sm mb-2">No entries for this day</p>
//                 <Button
//                   variant="link"
//                   onClick={!future ? openAddDialog : undefined}
//                   disabled={future}
//                   className={future ? "opacity-50 cursor-not-allowed" : ""}
//                 >
//                   Log time now
//                 </Button>
//               </div>
//             ) : (
//               <div className="divide-y">
//                 {entriesForSelectedDay.map((entry) => {
//                   const statusName = getStatusName(entry.status);

//                   return (
//                     <div
//                       key={entry.entry_id}
//                       className="p-4 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors flex items-start gap-4 group"
//                     >
//                       <div className="flex-1 min-w-0">
//                         <div className="flex items-center gap-2 mb-1">
//                           <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
//                             {entry.project_name}
//                           </h4>
//                           <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
//                           <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
//                             {entry.ticket_name || "Untitled Ticket"}
//                           </span>
//                           <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
//                           <span className="text-xs px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium">
//                             {entry.task_name || "No Task"}
//                           </span>
//                         </div>
//                         {entry.description && (
//                           <p className="text-sm text-gray-500 line-clamp-2 mb-2">
//                             {entry.description}
//                           </p>
//                         )}

//                         <div className="flex flex-wrap items-center gap-2 mt-2">
//                           {entry.ticket_number && (
//                             <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-800 rounded border border-gray-200 dark:border-zinc-800 text-xs text-gray-600 dark:text-gray-300 font-mono">
//                               {entry.ticket_number}
//                             </span>
//                           )}
//                           <StatusBadge status={entry.status} />

//                           {entry.billable_hours > 0 && (
//                             <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-200">
//                               Billable: {minutesToHHMM(entry.billable_hours)}
//                             </span>
//                           )}
//                           {entry.non_billable_hours > 0 && (
//                             <span className="text-xs px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full border border-orange-200">
//                               Non-billable:{" "}
//                               {minutesToHHMM(entry.non_billable_hours)}
//                             </span>
//                           )}
//                         </div>

//                         {statusName.includes("Rejected") &&
//                           entry.rejection_reason && (
//                             <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">
//                               <strong>Feedback:</strong>{" "}
//                               {entry.rejection_reason}
//                             </div>
//                           )}
//                       </div>

//                       <div className="text-right flex flex-col items-end gap-2">
//                         <span className="text-lg font-bold text-gray-700 dark:text-gray-200 tabular-nums">
//                           {minutesToHHMM(entry.hours_logged)}
//                         </span>
//                         {[
//                           "Draft",
//                           "Manager_Rejected",
//                           "Admin_Rejected",
//                         ].includes(statusName) && (
//                           <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
//                             <Button
//                               variant="ghost"
//                               size="icon"
//                               className="h-7 w-7"
//                               onClick={() => openEditDialog(entry)}
//                             >
//                               <Pencil className="w-3.5 h-3.5 text-gray-500" />
//                             </Button>
//                             <Button
//                               variant="ghost"
//                               size="icon"
//                               className="h-7 w-7 hover:text-red-600"
//                               onClick={() => handleDeleteEntry(entry.entry_id)}
//                             >
//                               <Trash2 className="w-3.5 h-3.5" />
//                             </Button>
//                           </div>
//                         )}
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>
//             )}
//           </CardContent>
//         </Card>

//         {/* Statistics Badges - Modern Dashboard Style */}
//         <div className="space-y-4">
//           {/* Statistics Badges Row */}
//           <div className="grid grid-cols-2 gap-3">
//             {/* Total Hours Badge */}
//             <Card className="border-0 shadow-sm ring-1 ring-gray-200 bg-gradient-to-br from-blue-50 to-white">
//               <CardContent className="p-4">
//                 <div className="flex flex-col">
//                   <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
//                     Total Hours
//                   </span>
//                   <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
//                     {minutesToHHMM(weekTotalMinutes)}
//                   </span>
//                   {/* <span className="text-xs text-gray-500 mt-1">
//                     Min: {minutesToHHMM(REQUIRED_WEEK_MINUTES)}
//                   </span> */}
//                 </div>
//               </CardContent>
//             </Card>

//             {/* Days Logged Badge */}
//             <Card className="border-0 shadow-sm ring-1 ring-gray-200 bg-gradient-to-br from-green-50 to-white">
//               <CardContent className="p-4">
//                 <div className="flex flex-col">
//                   <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
//                     Days Logged
//                   </span>
//                   <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
//                     {new Set(entries.map((e) => e.entry_date)).size} / 7
//                   </span>
//                   <span className="text-xs text-gray-500 mt-1">
//                     {7 - new Set(entries.map((e) => e.entry_date)).size}{" "}
//                     remaining
//                   </span>
//                 </div>
//               </CardContent>
//             </Card>

//             {/* Billable Percentage Badge */}
//             <Card className="border-0 shadow-sm ring-1 ring-gray-200 bg-gradient-to-br from-purple-50 to-white">
//               <CardContent className="p-4">
//                 <div className="flex flex-col">
//                   <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
//                     Billable
//                   </span>
//                   <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
//                     {weekTotalMinutes > 0
//                       ? Math.round(
//                           (weeklyBillableMinutes / weekTotalMinutes) * 100,
//                         )
//                       : 0}
//                     %
//                   </span>
//                   <span className="text-xs text-gray-500 mt-1">
//                     {minutesToHHMM(weeklyBillableMinutes)}
//                   </span>
//                 </div>
//               </CardContent>
//             </Card>

//             {/* Status Badge */}
//             <Card
//               className={`border-0 shadow-sm ring-1 ring-gray-200 ${
//                 isWeekValidForSubmit
//                   ? "bg-gradient-to-br from-green-50 to-white"
//                   : weeklyStatus.includes("Rejected")
//                     ? "bg-gradient-to-br from-red-50 to-white"
//                     : "bg-gradient-to-br from-orange-50 to-white"
//               }`}
//             >
//               <CardContent className="p-4">
//                 <div className="flex flex-col">
//                   <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
//                     Status
//                   </span>
//                   <span
//                     className={`text-2xl font-bold ${
//                       isWeekValidForSubmit
//                         ? "text-green-600"
//                         : weeklyStatus.includes("Rejected")
//                           ? "text-red-600"
//                           : "text-orange-600"
//                     }`}
//                   >
//                     {isWeekValidForSubmit
//                       ? "✓"
//                       : weeklyStatus.includes("Rejected")
//                         ? "✗"
//                         : "○"}
//                   </span>
//                   <span className="text-xs text-gray-500 mt-1">
//                     {isWeekValidForSubmit
//                       ? "Ready"
//                       : weeklyStatus.includes("Rejected")
//                         ? "Rejected"
//                         : "In Progress"}
//                   </span>
//                 </div>
//               </CardContent>
//             </Card>
//           </div>

//           {/* Breakdown Section */}
//           <Card className="border-0 shadow-sm ring-1 ring-gray-200">
//             <CardContent className="p-4">
//               <div className="space-y-3">
//                 <div className="flex items-center justify-between text-sm">
//                   <span className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
//                     <span className="w-2 h-2 rounded-full bg-green-500"></span>
//                     Billable Hours
//                   </span>
//                   <span className="font-semibold text-gray-900 dark:text-gray-100">
//                     {minutesToHHMM(weeklyBillableMinutes)}
//                   </span>
//                 </div>
//                 <div className="flex items-center justify-between text-sm">
//                   <span className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
//                     <span className="w-2 h-2 rounded-full bg-orange-500"></span>
//                     Non-Billable Hours
//                   </span>
//                   <span className="font-semibold text-gray-900 dark:text-gray-100">
//                     {minutesToHHMM(weeklyNonBillableMinutes)}
//                   </span>
//                 </div>
//                 <div className="pt-2 border-t">
//                   <div className="flex items-center justify-between text-xs text-gray-500">
//                     <span>Pending entries</span>
//                     <span className="font-medium">{pendingEntries.length}</span>
//                   </div>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>

//           {/* Submit Button */}
//           <Button
//             className="w-full"
//             size="lg"
//             onClick={() => setConfirmDialogOpen(true)}
//             disabled={!isWeekValidForSubmit || isWeekSubmitted === true}
//           >
//             <Send className="w-4 h-4 mr-2" />
//             {isWeekSubmitted
//               ? "Submitted"
//               : isResubmission
//                 ? "Resubmit Rejected Entries"
//                 : "Submit Week"}
//           </Button>
//         </div>
//       </div>

//       {/* Submit Confirmation Dialog */}
//       <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
//         <AlertDialogContent>
//           <AlertDialogHeader>
//             <AlertDialogTitle>
//               {isResubmission
//                 ? "Resubmit Entries?"
//                 : "Submit Weekly Timesheet?"}
//             </AlertDialogTitle>
//             <AlertDialogDescription>
//               You are about to submit <strong>{pendingEntries.length}</strong>{" "}
//               pending entries for approval.
//               <br />
//               <br />
//               {isResubmission
//                 ? "Only the rejected or draft entries will be sent for re-approval. Approved entries remain approved."
//                 : "Once submitted, entries are locked for manager approval."}
//             </AlertDialogDescription>
//           </AlertDialogHeader>
//           <AlertDialogFooter>
//             <AlertDialogCancel>Cancel</AlertDialogCancel>
//             <AlertDialogAction
//               onClick={handleSubmit}
//               className="rounded default"
//             >
//               Confirm Submit
//             </AlertDialogAction>
//           </AlertDialogFooter>
//         </AlertDialogContent>
//       </AlertDialog>

//       {/* Add/Edit Entry Dialog */}
//       <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
//         <DialogContent className="sm:max-w-[500px]">
//           <DialogHeader>
//             <DialogTitle>
//               {editingEntry ? "Edit Entry" : "Log Time"}
//             </DialogTitle>
//           </DialogHeader>
//           <div className="space-y-4 py-2">
//             <div className="grid grid-cols-2 gap-4">
//               <div className="col-span-2">
//                 <label className="text-xs font-semibold text-black-500 uppercase mb-1.5 block">
//                   Project <span className="text-red-500">*</span>
//                 </label>
//                 <Select
//                   value={form.projectId}
//                   onValueChange={handleProjectChange}
//                 >
//                   <SelectTrigger>
//                     <SelectValue placeholder="Select Project" />
//                   </SelectTrigger>
//                   <SelectContent>
//                     {projects.map((p) => (
//                       <SelectItem key={p.project_id} value={p.project_id}>
//                         {p.project_name}
//                       </SelectItem>
//                     ))}
//                   </SelectContent>
//                 </Select>
//               </div>

//               <div className="col-span-2">
//                 <label className="text-xs font-semibold text-black-500 uppercase mb-1.5 block">
//                   Ticket <span className="text-red-500">*</span>
//                 </label>
//                 <Select
//                   value={form.ticketId}
//                   onValueChange={handleTicketChange}
//                   disabled={!form.projectId}
//                 >
//                   <SelectTrigger>
//                     <SelectValue placeholder="Select Ticket" />
//                   </SelectTrigger>
//                   <SelectContent>
//                     {tickets.map((t) => (
//                       <SelectItem key={t.ticket_id} value={t.ticket_id}>
//                         {t.ticket_name}
//                       </SelectItem>
//                     ))}
//                   </SelectContent>
//                 </Select>
//               </div>

//               <div className="col-span-2">
//                 <label className="text-xs font-semibold text-black-500 uppercase mb-1.5 block">
//                   Task ({user?.department || "General"}){" "}
//                   <span className="text-red-500">*</span>
//                 </label>
//                 <Select
//                   value={form.taskId}
//                   onValueChange={(val) => setForm({ ...form, taskId: val })}
//                   disabled={!form.projectId}
//                 >
//                   <SelectTrigger>
//                     <SelectValue placeholder="Select Task" />
//                   </SelectTrigger>
//                   <SelectContent className="max-h-[250px]" position="popper">
//                     {tasks.length > 0 ? (
//                       tasks.map((t) => (
//                         <SelectItem
//                           key={t.task_id}
//                           value={t.task_id}
//                           className="py-2 px-3 text-sm min-h-[36px]"
//                         >
//                           {t.task_name}
//                         </SelectItem>
//                       ))
//                     ) : (
//                       <div className="p-2 text-xs text-gray-500">
//                         No tasks found for your department.
//                       </div>
//                     )}
//                   </SelectContent>
//                 </Select>
//               </div>

//               <div>
//                 <label className="text-xs font-semibold text-black-500 uppercase mb-1.5 block">
//                   Hours Worked <span className="text-red-500">*</span>
//                 </label>
//                 <Input
//                   value={form.hours}
//                   onChange={(e) => handleHoursChange(e.target.value)}
//                   placeholder="HH:MM (e.g., 1:30, 0:45)"
//                   pattern="[0-9]+:[0-5][0-9]"
//                 />
//                 {errors.hours && (
//                   <p className="text-sm text-red-500 mt-1">{errors.hours}</p>
//                 )}
//               </div>
//               <div>
//                 <label className="text-xs font-semibold text-black-500 uppercase mb-1.5 block">
//                   Ticket Code
//                 </label>
//                 <Input
//                   value={form.ticketNumber}
//                   onChange={(e) =>
//                     setForm({ ...form, ticketNumber: e.target.value })
//                   }
//                   placeholder=""
//                   disabled
//                 />
//               </div>
//               <div className="col-span-2">
//                 <label className="text-xs font-semibold text-black-500 uppercase mb-1.5 block">
//                   Description <span className="text-red-500">*</span>
//                 </label>
//                 <Textarea
//                   value={form.description}
//                   onChange={(e) =>
//                     setForm({ ...form, description: e.target.value })
//                   }
//                   placeholder="Notes about this entry"
//                 />
//               </div>
//             </div>
//           </div>
//           <DialogFooter>
//             <Button variant="outline" onClick={() => setDialogOpen(false)}>
//               Cancel
//             </Button>
//             <Button onClick={saveEntry} disabled={submitting}>
//               {submitting ? "Saving..." : "Save Entry"}
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// }

// export default EmployeeTimesheetEntry;

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Badge } from "../ui/badge";
import {
  Plus,
  Trash2,
  Send,
  Pencil,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Clock,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import timesheetService from "../../services/timesheetService";
import projectService from "../../services/projectService";
import ticketService from "../../services/ticketService";
import taskService from "../../services/taskService";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { TimesheetCalendar } from "../ui/TimesheetCalendar";
import { motion } from "framer-motion";

// ============================================
// MINUTES-BASED TIME UTILITIES
// ============================================

const hhmmToMinutes = (value) => {
  if (!value) return null;
  const str = String(value).trim();
  if (!str.includes(":")) return null;
  const [hStr, mStr] = str.split(":");
  const hours = Number(hStr);
  const minutes = Number(mStr);
  if (isNaN(hours) || isNaN(minutes)) return null;
  if (minutes < 0 || minutes >= 60) return null;
  return hours * 60 + minutes;
};

const minutesToHHMM = (minutes) => {
  if (minutes === null || minutes === undefined || isNaN(minutes))
    return "0:00";
  const totalMinutes = Math.round(Number(minutes));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
};

const getHHMMError = (value, maxMinutes = 1440) => {
  if (!value || value.trim() === "") return "Time is required";
  const str = String(value).trim();
  if (!str.includes(":")) return "Invalid format. Use HH:MM";
  const [hStr, mStr] = str.split(":");
  const hours = Number(hStr);
  const minutes = Number(mStr);
  if (isNaN(hours) || isNaN(minutes)) return "Invalid time format";
  if (minutes < 0 || minutes >= 60) return "Minutes must be between 0 and 59";
  if (hours < 0) return "Hours cannot be negative";
  const totalMinutes = hours * 60 + minutes;
  if (totalMinutes === 0) return "Time must be greater than 0";
  if (totalMinutes > maxMinutes) return "Maximum 24h allowed";
  return null;
};

// ============================================
// CONSTANTS
// ============================================
const MAX_DAILY_MINUTES = 24 * 60;
const MAX_ENTRY_MINUTES = 24 * 60;
const MIN_DAILY_MINUTES = 8 * 60;
const SELECTED_DATE_KEY = "employee_timesheet_selected_date";

const STATUS_MAP = {
  1: "Draft",
  2: "Submitted",
  3: "Manager_Approved",
  4: "Manager_Rejected",
  5: "Locked",
  6: "Admin_Approved",
  7: "Admin_Rejected",
  8: "Partially_Approved",
};

function getStatusName(status) {
  if (typeof status === "string") return status;
  if (typeof status === "number") return STATUS_MAP[status] || "Unknown";
  return "Unknown";
}

function statusMatches(status, pattern) {
  return getStatusName(status).includes(pattern);
}

function toIso(date) {
  if (typeof date === "string") return date.split("T")[0];
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekDatesFrom(date) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const end = addDays(start, 6);
  return { start, end, dates };
}

const getUser = () => {
  try {
    const userData = localStorage.getItem("user");
    if (userData) return JSON.parse(userData);
  } catch (error) {
    console.error("Failed to get user:", error);
  }
  return null;
};

const isFutureDate = (date) => toIso(date) > toIso(new Date());
const isPastDate = (date) => toIso(date) < toIso(new Date());
const isLockedDate = (date) => isFutureDate(date) || isPastDate(date);

// ============================================
// MAIN COMPONENT
// ============================================

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export function EmployeeTimesheetEntry() {
  const [projects, setProjects] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [entries, setEntries] = useState([]);
  const [allEntries, setAllEntries] = useState([]);

  const [selectedDay, setSelectedDay] = useState(() => {
    const saved = sessionStorage.getItem(SELECTED_DATE_KEY);
    return saved ? new Date(saved) : new Date();
  });

  const {
    dates: weekDates,
    start: weekStart,
    end: weekEnd,
  } = useMemo(() => getWeekDatesFrom(selectedDay), [selectedDay]);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [form, setForm] = useState({
    projectId: "",
    ticketId: "",
    taskId: "",
    ticketNumber: "",
    description: "",
    hours: "",
  });
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [errors, setErrors] = useState({ hours: "" });

  const user = getUser();

  useEffect(() => {
    sessionStorage.setItem(SELECTED_DATE_KEY, selectedDay.toISOString());
  }, [selectedDay]);

  const weekKey = useMemo(
    () => `${toIso(weekStart)}_${toIso(weekEnd)}`,
    [weekStart, weekEnd],
  );

  // ─── Derived state ────────────────────────────────────────────────────────

  const entriesForSelectedDay = useMemo(() => {
    const dayIso = toIso(selectedDay);
    return entries.filter(
      (e) => (e.entry_date?.split("T")[0] || e.entry_date) === dayIso,
    );
  }, [entries, selectedDay]);

  // Employee backend aliases total_hours as hours_logged in the SELECT.
  // All time computations use hours_logged consistently throughout this component.
  const weekTotalMinutes = useMemo(
    () => entries.reduce((sum, e) => sum + Number(e.hours_logged || 0), 0),
    [entries],
  );

  const weeklyBillableMinutes = useMemo(
    () => entries.reduce((sum, e) => sum + Number(e.billable_hours || 0), 0),
    [entries],
  );

  const weeklyNonBillableMinutes = useMemo(
    () =>
      entries.reduce((sum, e) => sum + Number(e.non_billable_hours || 0), 0),
    [entries],
  );

  /**
   * Mon–Sat (6 days) mandatory with 8–24 hrs each.
   * Sunday optional — if logged, max 24 hrs; no minimum.
   *
   * FIX: previously used e.total_hours which is undefined for employee entries
   *      (the backend SELECTs it as hours_logged). Now correctly uses hours_logged.
   */
  const isWeekValidForSubmit = useMemo(() => {
    if (entries.length === 0) return false;

    const dailyTotals = {};
    weekDates.forEach((d) => {
      dailyTotals[toIso(d)] = 0;
    });
    entries.forEach((e) => {
      if (Object.prototype.hasOwnProperty.call(dailyTotals, e.entry_date)) {
        // ✅ FIX: hours_logged — not total_hours — is what the backend returns
        dailyTotals[e.entry_date] += Number(e.hours_logged || 0);
      }
    });

    // Mon–Sat: mandatory, 8–24 hrs each
    const weekdays = weekDates.filter((d) => d.getDay() !== 0);
    const weekdaysValid = weekdays.every((d) => {
      const minutes = dailyTotals[toIso(d)] || 0;
      return minutes >= MIN_DAILY_MINUTES && minutes <= MAX_DAILY_MINUTES;
    });
    if (!weekdaysValid) return false;

    // Sunday: optional — only enforce max if logged
    const sunday = weekDates.find((d) => d.getDay() === 0);
    if (sunday) {
      const sundayMinutes = dailyTotals[toIso(sunday)] || 0;
      if (sundayMinutes > MAX_DAILY_MINUTES) return false;
    }

    return true;
  }, [entries, weekDates]);

  /** Mon–Sat days with at least one entry (excludes Sunday). */
  const loggedDays = useMemo(
    () =>
      new Set(
        entries
          .filter((e) => new Date(e.entry_date).getDay() !== 0)
          .map((e) => e.entry_date),
      ).size,
    [entries],
  );

  const pendingEntries = entries.filter((e) => {
    const s = getStatusName(e.status);
    return ["Draft", "Locked", "Saved", "Manager_Rejected", "Admin_Rejected"].includes(s);
  });

  const getWeeklyStatus = () => {
    if (entries.length === 0) return "No Entries";
    const statusNames = entries.map((e) => getStatusName(e.status));
    if (statusNames.some((s) => s.includes("Rejected")))
      return "Partially Rejected";
    if (statusNames.every((s) => s.includes("Approved"))) return "Approved";
    if (statusNames.some((s) => s === "Partially_Approved"))
      return "Partially Approved";
    if (statusNames.every((s) => s === "Submitted")) return "Submitted";
    return "In Progress";
  };

  const weeklyStatus = getWeeklyStatus();
  const isResubmission = entries.some((e) =>
    statusMatches(e.status, "Rejected"),
  );

  /**
   * Week is submitted/locked when every entry is outside editable statuses.
   * Locked/Draft/Saved/Rejected entries allow week submission.
   */
  const isWeekSubmitted = useMemo(() => {
    if (entries.length === 0) return false;
    return entries
      .map((e) => getStatusName(e.status))
      .every(
        (s) => !["Draft", "Locked", "Saved", "Manager_Rejected", "Admin_Rejected"].includes(s),
      );
  }, [entries]);

  const future = isFutureDate(selectedDay);
  const past = isPastDate(selectedDay);
  const isLockedDay = future || past;

  /**
   * Single guard for all entry-creation surfaces:
   * true  → future or past date selected, OR week is submitted/locked
   * false → safe to add
   */
  const cannotAdd = isLockedDay || isWeekSubmitted;

  // ─── Data loading ─────────────────────────────────────────────────────────

  useEffect(() => {
    async function fetchTasks() {
      if (user && user.department && form.projectId) {
        try {
          const data = await taskService.getTasksByDepartmentAndProject(
            user.department,
            form.projectId,
          );
          setTasks(data.tasks || []);
        } catch (error) {
          console.error("Failed to fetch tasks:", error);
          toast.error("Could not load department tasks.");
          setTasks([]);
        }
      } else {
        setTasks([]);
      }
    }
    fetchTasks();
  }, [form.projectId]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      const projData = await projectService.getAssignedProjectsForTimesheet(
        user.id,
      );
      setProjects(projData.projects || []);

      const entriesResp = await timesheetService.getEntriesByDateRange(
        toIso(weekStart),
        toIso(weekEnd),
      );

      const loadedEntries = (entriesResp?.entries ?? []).map((entry) => ({
        ...entry,
        entry_date: entry.entry_date.split("T")[0],
        ticket_name: entry.ticket_name || entry.activity_name,
        task_name: entry.task_name,
        // hours_logged is the canonical time field — backend renames total_hours → hours_logged
        billable_hours: Number(entry.billable_hours || 0),
        non_billable_hours: Number(entry.non_billable_hours || 0),
      }));
      setEntries(loadedEntries);
    } catch (err) {
      console.error("❌ Load error:", err);
      toast.error("Failed to load timesheet data");
    } finally {
      setLoading(false);
    }
  };

  const loadAllEntriesForCalendar = async () => {
    try {
      if (!user?.id) return;
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
      const endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);

      const resp = await timesheetService.getEntriesByDateRange(
        toIso(startDate),
        toIso(endDate),
      );
      setAllEntries(
        (resp?.entries ?? []).map((entry) => ({
          ...entry,
          entry_date: entry.entry_date.split("T")[0],
          total_hours: Number(entry.hours_logged || 0),
          billable_hours: Number(entry.billable_hours || 0),
          non_billable_hours: Number(entry.non_billable_hours || 0),
        })),
      );
    } catch (err) {
      console.error("❌ Load all entries error:", err);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [weekKey]);
  useEffect(() => {
    loadAllEntriesForCalendar();
  }, []);

  useEffect(() => {
    if (form.projectId) {
      ticketService
        .getAssignedTicketsForTimesheet(form.projectId, toIso(selectedDay))
        .then((data) => setTickets(data.tickets || []))
        .catch(() => setTickets([]));
    }
  }, [selectedDay, form.projectId]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleProjectChange = async (projectId) => {
    setForm((prev) => ({
      ...prev,
      projectId,
      ticketId: "",
      ticketNumber: "",
      taskId: "",
    }));
    try {
      if (projectId) {
        const data = await ticketService.getAssignedTicketsForTimesheet(
          projectId,
          toIso(selectedDay),
        );
        setTickets(data.tickets || []);
      } else {
        setTickets([]);
      }
    } catch {
      setTickets([]);
    }
  };

  const handleTicketChange = (val) => {
    const selectedTicket = tickets.find((t) => t.ticket_id === val);
    setForm((prev) => ({
      ...prev,
      ticketId: val,
      ticketNumber: selectedTicket?.zoho_crm_code || prev.ticketNumber || "",
    }));
  };

  const openAddDialog = () => {
    setEditingEntry(null);
    setForm({
      projectId: "",
      ticketId: "",
      taskId: "",
      ticketNumber: "",
      description: "",
      hours: "",
    });
    setTickets([]);
    setDialogOpen(true);
  };

  const openEditDialog = async (entry) => {
    const statusName = getStatusName(entry.status);
    if (isLockedDay || statusName === "Locked") {
      toast.error("Timesheet entries for previous and future days are locked and cannot be edited.");
      return;
    }
    if (!["Draft", "Manager_Rejected", "Admin_Rejected"].includes(statusName)) {
      toast.error("Cannot edit entry pending approval or already approved.");
      return;
    }
    setEditingEntry(entry);
    if (entry.project_id) {
      try {
        const data = await ticketService.getAssignedTicketsForTimesheet(
          entry.project_id,
          toIso(selectedDay),
        );
        setTickets(data.tickets || []);
      } catch {
        setTickets([]);
      }
    }
    setForm({
      projectId: entry.project_id ?? "",
      ticketId: entry.ticket_id ?? entry.activity_id ?? "",
      taskId: entry.task_id ?? "",
      ticketNumber: entry.ticket_number ?? "",
      description: entry.description ?? "",
      hours: minutesToHHMM(entry.hours_logged),
    });
    setDialogOpen(true);
  };

  const saveEntry = async () => {
    const { projectId, ticketId, taskId, hours, ticketNumber, description } =
      form;

    if (toIso(selectedDay) > toIso(new Date())) {
      toast.error("You cannot add entries for future dates");
      return;
    }
    if (toIso(selectedDay) < toIso(new Date())) {
      toast.error("Timesheet entries for previous days are locked and cannot be added or modified");
      return;
    }
    if (!projectId || !ticketId || !taskId || !hours) {
      toast.error("Project, Ticket, Task, and Hours are required");
      return;
    }
    const error = getHHMMError(hours, MAX_ENTRY_MINUTES);
    if (error) {
      toast.error(error);
      return;
    }

    const minutes = hhmmToMinutes(hours);
    const currentDailyTotal = entriesForSelectedDay.reduce(
      (sum, e) => sum + Number(e.hours_logged || 0),
      0,
    );
    const projectedTotal = editingEntry
      ? currentDailyTotal - Number(editingEntry.hours_logged || 0) + minutes
      : currentDailyTotal + minutes;

    if (projectedTotal > MAX_DAILY_MINUTES) {
      toast.error(
        `Daily limit (${minutesToHHMM(MAX_DAILY_MINUTES)}) exceeded.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        projectId,
        ticketId,
        taskId,
        ticketNumber: ticketNumber || null,
        hoursLogged: minutes,
        description: description || null,
      };

      if (editingEntry) {
        await timesheetService.updateTimesheetEntry(
          editingEntry.entry_id,
          payload,
        );
        toast.success("Entry updated successfully");
      } else {
        await timesheetService.createTimesheetEntry({
          ...payload,
          entryDate: toIso(selectedDay),
        });
        toast.success("Entry created successfully");
      }

      await loadEntries();
      await loadAllEntriesForCalendar();
      setDialogOpen(false);
      setEditingEntry(null);
      setForm({
        projectId: "",
        ticketId: "",
        taskId: "",
        ticketNumber: "",
        description: "",
        hours: "",
      });
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save entry");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntry = async (entryId) => {
    const entry = entries.find((e) => e.entry_id === entryId);
    const statusName = getStatusName(entry?.status);
    if (isLockedDay || statusName === "Locked") {
      toast.error("Previous-day and future-day timesheet entries are locked and cannot be deleted.");
      return;
    }
    if (
      !entry ||
      !["Draft", "Manager_Rejected", "Admin_Rejected"].includes(statusName)
    ) {
      toast.error("Cannot delete submitted/approved entry.");
      return;
    }
    try {
      await timesheetService.deleteTimesheetEntry(entryId);
      toast.success("Entry deleted successfully");
      await loadEntries();
      await loadAllEntriesForCalendar();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete entry");
    }
  };

  const handleSubmit = async () => {
    setConfirmDialogOpen(false);

    const monSatEntriesSet = new Set(
      entries
        .filter((e) => new Date(e.entry_date).getDay() !== 0)
        .map((e) => e.entry_date),
    );
    if (monSatEntriesSet.size !== 6) {
      toast.error("Entries required for Monday to Saturday.");
      return;
    }

    for (const date of weekDates) {
      const dayIso = toIso(date);
      const isSunday = date.getDay() === 0;
      const dayMinutes = entries
        .filter((e) => e.entry_date === dayIso)
        .reduce((sum, e) => sum + Number(e.hours_logged || 0), 0);

      if (isSunday && dayMinutes === 0) continue;
      if (isSunday) {
        if (dayMinutes > MAX_DAILY_MINUTES) {
          toast.error(
            `${format(date, "EEEE")} exceeds ${minutesToHHMM(MAX_DAILY_MINUTES)}.`,
          );
          return;
        }
        continue;
      }
      if (dayMinutes < MIN_DAILY_MINUTES) {
        toast.error(
          `${format(date, "EEEE")} must have at least ${minutesToHHMM(MIN_DAILY_MINUTES)}.`,
        );
        return;
      }
      if (dayMinutes > MAX_DAILY_MINUTES) {
        toast.error(
          `${format(date, "EEEE")} exceeds ${minutesToHHMM(MAX_DAILY_MINUTES)}.`,
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const result = await timesheetService.submitWeek(
        toIso(weekStart),
        toIso(weekEnd),
      );
      toast.success(result.message || "Timesheet submitted successfully");
      await loadEntries();
      await loadAllEntriesForCalendar();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to submit timesheet");
    } finally {
      setSubmitting(false);
    }
  };

  const handleHoursChange = (value) => {
    setForm((prev) => ({ ...prev, hours: value }));
    setErrors((prev) => ({
      ...prev,
      hours: getHHMMError(value, MAX_ENTRY_MINUTES) || "",
    }));
  };

  // ─── Sub-components ───────────────────────────────────────────────────────

  const StatusBadge = ({ status }) => {
    const statusName = getStatusName(status);
    let color = "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-zinc-800";
    let icon = <Clock className="w-3 h-3 mr-1" />;
    if (statusName === "Locked") {
      color = "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-zinc-700";
      icon = <Clock className="w-3 h-3 mr-1" />;
    } else if (statusName === "Submitted") {
      color = "bg-yellow-50 text-yellow-700 border-yellow-200";
      icon = <AlertCircle className="w-3 h-3 mr-1" />;
    } else if (statusName === "Partially_Approved") {
      color = "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      icon = <Clock className="w-3 h-3 mr-1" />;
    } else if (statusName.includes("Approved")) {
      color = "bg-green-50 text-green-700 border-green-200";
      icon = <CheckCircle className="w-3 h-3 mr-1" />;
    } else if (statusName.includes("Rejected")) {
      color = "bg-red-50 text-red-700 border-red-200";
      icon = <XCircle className="w-3 h-3 mr-1" />;
    }
    return (
      <span
        className={`flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${color}`}
      >
        {icon} {statusName.replace(/_/g, " ")}
      </span>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 p-1">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg border-none shadow-soft dark:bg-card">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-gray-100">
              Weekly Timesheet
            </h1>
            <Badge
              variant={
                weeklyStatus.includes("Rejected") ? "destructive" : "outline"
              }
            >
              {weeklyStatus}
            </Badge>
            {/* ✅ Locked badge — shown when week is submitted/approved */}
            {isWeekSubmitted && (
              <Badge
                variant="secondary"
                className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
              >
                🔒 Locked
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <span className="font-medium text-gray-700 dark:text-gray-200">
              {format(weekStart, "MMM d")}
            </span>
            <ChevronRight className="w-3 h-3" />
            <span className="font-medium text-gray-700 dark:text-gray-200">
              {format(weekEnd, "MMM d, yyyy")}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-gray-100 dark:bg-zinc-800 rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDay(addDays(selectedDay, -7))}
              className="h-8 w-8 p-0 hover:bg-white dark:hover:bg-zinc-700 rounded-md"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <TimesheetCalendar
              selectedDate={selectedDay}
              onDateSelect={setSelectedDay}
              entries={allEntries}
              getEntryDate={(entry) => entry.entry_date}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDay(new Date())}
              className="h-8 px-3 text-xs font-medium hover:bg-white dark:hover:bg-zinc-700 rounded-md"
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDay(addDays(selectedDay, 7))}
              className="h-8 w-8 p-0 hover:bg-white dark:hover:bg-zinc-700 rounded-md"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/*
            ✅ FIX — cannotAdd covers both cases:
               1. Future date selected
               2. Week is submitted / approved (locked)
          */}
          <Button
            onClick={openAddDialog}
            className="gap-2 shadow-sm"
            disabled={cannotAdd}
          >
            <Plus className="h-4 w-4" /> Add Entry
          </Button>
        </div>
      </div>
      </motion.div>

      {/* ── Day Selector ───────────────────────────────────────────────────── */}
      <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
        {weekDates.map((d) => {
          const isSelected = isSameDay(d, selectedDay);
          const isToday = isSameDay(d, new Date());
          const isSunday = d.getDay() === 0;
          const dayIso = toIso(d);
          const dayMinutes = entries
            .filter((e) => e.entry_date === dayIso)
            .reduce((sum, e) => sum + Number(e.hours_logged || 0), 0);

          return (
            <button
              key={dayIso}
              onClick={() => setSelectedDay(d)}
              className={`flex-1 min-w-[100px] p-3 rounded-lg border transition-all duration-200
                flex flex-col items-center justify-center gap-1
                ${
                  isSelected
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ring-1 ring-blue-200"
                    : "bg-white dark:bg-card border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                }`}
            >
              <span
                className={`text-xs font-medium uppercase ${isSelected ? "text-blue-600" : "text-gray-500"}`}
              >
                {isToday ? "Today" : format(d, "EEE")}
                {isSunday && (
                  <span className="ml-1 text-[9px] text-gray-400 dark:text-gray-500 normal-case">
                    (opt)
                  </span>
                )}
              </span>
              <span
                className={`text-lg font-bold ${isSelected ? "text-blue-700 dark:text-blue-400" : "text-gray-700 dark:text-gray-200"}`}
              >
                {format(d, "d")}
              </span>
              {dayMinutes > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-800 rounded-full text-gray-600 dark:text-gray-300 mt-1">
                  {minutesToHHMM(dayMinutes)}
                </span>
              )}
              {dayMinutes === 0 && !isFutureDate(d) && (
                <span
                  className={`text-[10px] ${isSunday ? "text-gray-300 dark:text-gray-600" : "text-gray-400 dark:text-gray-500"}`}
                >
                  {isSunday ? "—" : "No entry"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Main Grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entries List */}
        <motion.div variants={item} className="lg:col-span-2">
        <Card className="border-none shadow-soft bg-white dark:bg-card">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Entries for {format(selectedDay, "EEEE, MMM d")}</span>
              <span className="text-sm font-normal text-muted-foreground">
                Total:{" "}
                {minutesToHHMM(
                  entriesForSelectedDay.reduce(
                    (acc, e) => acc + Number(e.hours_logged || 0),
                    0,
                  ),
                )}
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground animate-pulse">
                Loading entries...
              </div>
            ) : entriesForSelectedDay.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                {/*
                  ✅ FIX — empty-state + button: disabled when cannotAdd.
                  Previously only checked `future`; now also blocks when
                  the week is submitted/locked (isWeekSubmitted).
                */}
                <button
                  type="button"
                  onClick={!cannotAdd ? openAddDialog : undefined}
                  disabled={cannotAdd}
                  aria-disabled={cannotAdd}
                  title={
                    isWeekSubmitted
                      ? "Week is submitted — cannot add entries"
                      : future
                        ? "You cannot add entries for future dates"
                        : "Add entry"
                  }
                  className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors
                    ${
                      cannotAdd
                        ? "bg-gray-100 dark:bg-zinc-800 text-gray-300 dark:text-gray-500 cursor-not-allowed opacity-50"
                        : "bg-gray-200 text-gray-500 cursor-pointer hover:bg-gray-300"
                    }`}
                >
                  <Plus className="w-6 h-6" />
                </button>

                <p className="text-sm mb-2">
                  {isWeekSubmitted
                    ? "No entries for this day (Week locked)"
                    : past
                      ? "Previous-day entries are locked (Read-only)"
                      : future
                        ? "Future date — entries cannot be added yet"
                        : "No entries for this day"}
                </p>

                {isWeekSubmitted || isLockedDay ? (
                  <p className="text-xs text-gray-500">
                    {isWeekSubmitted
                      ? "Cannot add entries — timesheet is submitted/approved"
                      : past
                        ? "Previous-day timesheets are locked"
                        : "Future dates cannot be logged yet"}
                  </p>
                ) : (
                  /*
                    ✅ FIX — "Log time now" link: also disabled when cannotAdd.
                    Previously only checked `future`; same oversight as the + button.
                  */
                  <Button
                    variant="link"
                    onClick={!cannotAdd ? openAddDialog : undefined}
                    disabled={cannotAdd}
                    className={cannotAdd ? "opacity-50 cursor-not-allowed" : ""}
                  >
                    Log time now
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {entriesForSelectedDay.map((entry) => {
                  const statusName = getStatusName(entry.status);
                  return (
                    <div
                      key={entry.entry_id}
                      className="p-4 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors flex items-start gap-4 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {entry.project_name}
                          </h4>
                          <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
                          <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {entry.ticket_name || "Untitled Ticket"}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
                          <span className="text-xs px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium">
                            {entry.task_name || "No Task"}
                          </span>
                        </div>

                        {entry.description && (
                          <p className="text-sm text-gray-500 line-clamp-2 mb-2">
                            {entry.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {entry.ticket_number && (
                            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-800 rounded border border-gray-200 dark:border-zinc-800 text-xs text-gray-600 dark:text-gray-300 font-mono">
                              {entry.ticket_number}
                            </span>
                          )}
                          <StatusBadge status={entry.status} />
                          {entry.billable_hours > 0 && (
                            <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-200">
                              Billable: {minutesToHHMM(entry.billable_hours)}
                            </span>
                          )}
                          {entry.non_billable_hours > 0 && (
                            <span className="text-xs px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full border border-orange-200">
                              Non-billable:{" "}
                              {minutesToHHMM(entry.non_billable_hours)}
                            </span>
                          )}
                        </div>

                        {statusName.includes("Rejected") &&
                          entry.rejection_reason && (
                            <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">
                              <strong>Feedback:</strong>{" "}
                              {entry.rejection_reason}
                            </div>
                          )}
                      </div>

                      <div className="text-right flex flex-col items-end gap-2">
                        <span className="text-lg font-bold text-gray-700 dark:text-gray-200 tabular-nums">
                          {minutesToHHMM(entry.hours_logged)}
                        </span>
                        {[
                          "Draft",
                          "Manager_Rejected",
                          "Admin_Rejected",
                        ].includes(statusName) &&
                          !isLockedDay &&
                          statusName !== "Locked" && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEditDialog(entry)}
                              >
                                <Pencil className="w-3.5 h-3.5 text-gray-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:text-red-600"
                                onClick={() => handleDeleteEntry(entry.entry_id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        </motion.div>

        {/* Stats Panel */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <motion.div variants={item}>
            <Card className="border-none shadow-soft bg-white dark:bg-card">
              <CardContent className="p-4">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Total Hours
                  </span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {minutesToHHMM(weekTotalMinutes)}
                  </span>
                </div>
              </CardContent>
            </Card>
            </motion.div>

            {/* ✅ FIX: count Mon–Sat only (/6), remaining from 6 not 7 */}
            <motion.div variants={item}>
            <Card className="border-none shadow-soft bg-white dark:bg-card">
              <CardContent className="p-4">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Days Logged
                  </span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {loggedDays}{" "}
                    <span className="text-base font-normal text-gray-400">
                      / 6
                    </span>
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    {6 - loggedDays} remaining
                  </span>
                </div>
              </CardContent>
            </Card>
            </motion.div>

            <motion.div variants={item}>
            <Card className="border-none shadow-soft bg-white dark:bg-card">
              <CardContent className="p-4">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Billable
                  </span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {weekTotalMinutes > 0
                      ? Math.round(
                          (weeklyBillableMinutes / weekTotalMinutes) * 100,
                        )
                      : 0}
                    %
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    {minutesToHHMM(weeklyBillableMinutes)}
                  </span>
                </div>
              </CardContent>
            </Card>
            </motion.div>

            <motion.div variants={item}>
            <Card
              className={`border-none shadow-soft bg-white dark:bg-card`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Status
                  </span>
                  <span
                    className={`text-2xl font-bold ${
                      isWeekValidForSubmit
                        ? "text-green-600"
                        : weeklyStatus.includes("Rejected")
                          ? "text-red-600"
                          : "text-orange-600"
                    }`}
                  >
                    {isWeekValidForSubmit
                      ? "✓"
                      : weeklyStatus.includes("Rejected")
                        ? "✗"
                        : "○"}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    {isWeekValidForSubmit
                      ? "Ready"
                      : weeklyStatus.includes("Rejected")
                        ? "Rejected"
                        : "In Progress"}
                  </span>
                </div>
              </CardContent>
            </Card>
            </motion.div>
          </div>

          <motion.div variants={item}>
          <Card className="border-none shadow-soft bg-white dark:bg-card">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    Billable Hours
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {minutesToHHMM(weeklyBillableMinutes)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    Non-Billable Hours
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {minutesToHHMM(weeklyNonBillableMinutes)}
                  </span>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Pending entries</span>
                    <span className="font-medium">{pendingEntries.length}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          </motion.div>

          <Button
            className="w-full"
            size="lg"
            onClick={() => setConfirmDialogOpen(true)}
            disabled={isWeekSubmitted || !isWeekValidForSubmit}
          >
            <Send className="w-4 h-4 mr-2" />
            {isWeekSubmitted
              ? "Submitted"
              : isResubmission
                ? "Resubmit Rejected Entries"
                : "Submit Week"}
          </Button>
        </div>
      </div>

      {/* ── Confirm Submit Dialog ──────────────────────────────────────────── */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isResubmission
                ? "Resubmit Entries?"
                : "Submit Weekly Timesheet?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to submit <strong>{pendingEntries.length}</strong>{" "}
              pending entries for approval.
              <br />
              <br />
              {isResubmission
                ? "Only the rejected or draft entries will be sent for re-approval. Approved entries remain approved."
                : "Once submitted, entries are locked for manager approval."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmit}
              className="rounded default"
            >
              Confirm Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Add/Edit Entry Dialog ──────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Edit Entry" : "Log Time"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-semibold uppercase mb-1.5 block">
                  Project <span className="text-red-500">*</span>
                </label>
                <Select
                  value={form.projectId}
                  onValueChange={handleProjectChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.project_id} value={p.project_id}>
                        {p.project_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <label className="text-xs font-semibold uppercase mb-1.5 block">
                  Ticket <span className="text-red-500">*</span>
                </label>
                <Select
                  value={form.ticketId}
                  onValueChange={handleTicketChange}
                  disabled={!form.projectId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Ticket" />
                  </SelectTrigger>
                  <SelectContent>
                    {tickets.map((t) => (
                      <SelectItem key={t.ticket_id} value={t.ticket_id}>
                        {t.ticket_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <label className="text-xs font-semibold uppercase mb-1.5 block">
                  Task ({user?.department || "General"}){" "}
                  <span className="text-red-500">*</span>
                </label>
                <Select
                  value={form.taskId}
                  onValueChange={(val) => setForm({ ...form, taskId: val })}
                  disabled={!form.projectId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Task" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[250px]" position="popper">
                    {tasks.length > 0 ? (
                      tasks.map((t) => (
                        <SelectItem
                          key={t.task_id}
                          value={t.task_id}
                          className="py-2 px-3 text-sm min-h-[36px]"
                        >
                          {t.task_name}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-xs text-gray-500">
                        No tasks found for your department.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase mb-1.5 block">
                  Hours Worked <span className="text-red-500">*</span>
                </label>
                <Input
                  value={form.hours}
                  onChange={(e) => handleHoursChange(e.target.value)}
                  placeholder="HH:MM (e.g., 1:30, 0:45)"
                  pattern="[0-9]+:[0-5][0-9]"
                />
                {errors.hours && (
                  <p className="text-sm text-red-500 mt-1">{errors.hours}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold uppercase mb-1.5 block">
                  Ticket Code
                </label>
                <Input value={form.ticketNumber} disabled />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-semibold uppercase mb-1.5 block">
                  Description <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Notes about this entry"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEntry} disabled={submitting}>
              {submitting ? "Saving..." : "Save Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

export default EmployeeTimesheetEntry;

import React, { useEffect, useMemo, useState, useRef } from "react";
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
import { TimesheetCalendar } from "../ui/TimesheetCalendar.jsx";

// ============================================
// ✅ MINUTES-BASED TIME UTILITIES
// ============================================

/**
 * Convert HH:MM input to minutes for backend
 */
const hhmmToMinutes = (value) => {
  if (!value) return null;
  const str = String(value).trim();

  if (!str.includes(":")) {
    return null;
  }

  const [hStr, mStr] = str.split(":");
  const hours = Number(hStr);
  const minutes = Number(mStr);

  if (isNaN(hours) || isNaN(minutes)) {
    return null;
  }

  if (minutes < 0 || minutes >= 60) {
    return null;
  }

  return hours * 60 + minutes;
};

/**
 * Convert minutes from backend to HH:MM format for display
 */
const minutesToHHMM = (minutes) => {
  if (minutes === null || minutes === undefined || isNaN(minutes)) {
    return "0:00";
  }

  const totalMinutes = Math.round(Number(minutes));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  return `${h}:${String(m).padStart(2, "0")}`;
};

/**
 * Convert minutes to readable format (e.g., "1h 48m")
 */
const formatMinutesDisplay = (minutes) => {
  if (
    minutes === null ||
    minutes === undefined ||
    isNaN(minutes) ||
    minutes === 0
  ) {
    return "0m";
  }

  const totalMinutes = Math.round(Number(minutes));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

/**
 * Validate HH:MM time input
 */
const isValidHHMM = (value) => {
  if (!value) return false;
  const str = String(value).trim();

  if (!str.includes(":")) {
    return false;
  }

  const [hStr, mStr] = str.split(":");
  const hours = Number(hStr);
  const minutes = Number(mStr);

  if (isNaN(hours) || isNaN(minutes)) {
    return false;
  }

  if (hours < 0 || minutes < 0 || minutes >= 60) {
    return false;
  }

  return true;
};

/**
 * Get validation error message
 */
const getHHMMError = (value, maxMinutes = 1440) => {
  if (!value || value.trim() === "") {
    return "Time is required";
  }

  const str = String(value).trim();

  if (!str.includes(":")) {
    return "Invalid time format. Use HH:MM (e.g., 1:30)";
  }

  const [hStr, mStr] = str.split(":");
  const hours = Number(hStr);
  const minutes = Number(mStr);

  if (isNaN(hours) || isNaN(minutes)) {
    return "Invalid time format. Use HH:MM (e.g., 1:30)";
  }

  if (minutes < 0 || minutes >= 60) {
    return "Minutes must be between 0 and 59";
  }

  if (hours < 0) {
    return "Hours cannot be negative";
  }

  const totalMinutes = hours * 60 + minutes;

  if (totalMinutes === 0) {
    return "Time must be greater than 0";
  }

  if (totalMinutes > maxMinutes) {
    const maxHHMM = minutesToHHMM(maxMinutes);
    return `Maximum ${maxHHMM} allowed`;
  }

  return null;
};

// ============================================
// CONSTANTS
// ============================================
const MAX_DAILY_MINUTES = 24 * 60; // 1440 minutes = 24 hours
const MAX_ENTRY_MINUTES = 24 * 60; // 1440 minutes = 24 hours
const MIN_DAILY_MINUTES = 8 * 60; // 480 minutes
const SELECTED_DATE_KEY = "manager_timesheet_selected_date";

// ✅ STATUS MAPPING
const STATUS_MAP = {
  1: "Draft",
  2: "Submitted",
  3: "Manager_Approved",
  4: "Manager_Rejected",
  5: "Admin_Approved",
  6: "Admin_Rejected",
  7: "Partially_Approved",
};

function getStatusName(status) {
  if (typeof status === "string") return status;
  if (typeof status === "number") return STATUS_MAP[status] || "Unknown";
  return "Unknown";
}

function statusMatches(status, pattern) {
  const statusName = getStatusName(status);
  return statusName.includes(pattern);
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

const isFutureDate = (date) => {
  const todayIso = toIso(new Date());
  const dateIso = toIso(date);
  return dateIso > todayIso;
};

// ============================================
// MAIN COMPONENT
// ============================================

export function ManagerTimesheetEntry() {
  const [projects, setProjects] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [entries, setEntries] = useState([]); // Current week entries
  const [allEntries, setAllEntries] = useState([]); // ALL entries for calendar

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
  const user = getUser();

  const [errors, setErrors] = useState({
    projectId: "",
    ticketId: "",
    taskId: "",
    hours: "",
  });

  // Project
  const [projectSearch, setProjectSearch] = useState("");
  const [showProjectList, setShowProjectList] = useState(false);

  // Ticket
  const [ticketSearch, setTicketSearch] = useState("");
  const [showTicketList, setShowTicketList] = useState(false);

  // Task
  const [taskSearch, setTaskSearch] = useState("");
  const [showTaskList, setShowTaskList] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const projectRef = useRef(null);
  const ticketRef = useRef(null);
  const taskRef = useRef(null);
  const filteredProjects = useMemo(() => {
    if (!projectSearch) return projects;
    return projects.filter((p) =>
      p.project_name.toLowerCase().includes(projectSearch.toLowerCase()),
    );
  }, [projectSearch, projects]);

  const filteredTickets = useMemo(() => {
    if (!ticketSearch) return tickets;
    return tickets.filter((t) =>
      t.ticket_name.toLowerCase().includes(ticketSearch.toLowerCase()),
    );
  }, [ticketSearch, tickets]);

  const filteredTasks = useMemo(() => {
    if (!taskSearch) return tasks;
    return tasks.filter((t) =>
      t.task_name.toLowerCase().includes(taskSearch.toLowerCase()),
    );
  }, [taskSearch, tasks]);

  const weekKey = useMemo(
    () => `${toIso(weekStart)}_${toIso(weekEnd)}`,
    [weekStart, weekEnd],
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (projectRef.current && !projectRef.current.contains(event.target)) {
        setShowProjectList(false);
      }

      if (ticketRef.current && !ticketRef.current.contains(event.target)) {
        setShowTicketList(false);
      }

      if (taskRef.current && !taskRef.current.contains(event.target)) {
        setShowTaskList(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    sessionStorage.setItem(SELECTED_DATE_KEY, selectedDay.toISOString());
  }, [selectedDay]);

  const entriesForSelectedDay = useMemo(() => {
    const dayIso = toIso(selectedDay);
    return entries.filter(
      (e) => (e.entry_date?.split("T")[0] || e.entry_date) === dayIso,
    );
  }, [entries, selectedDay]);

  // ✅ FIXED: All calculations in minutes
  const weekTotalMinutes = useMemo(
    () => entries.reduce((sum, e) => sum + Number(e.total_hours || 0), 0),
    [entries],
  );

  const weeklyBillableMinutes = useMemo(() => {
    return entries.reduce((sum, e) => sum + Number(e.billable_hours || 0), 0);
  }, [entries]);

  const weeklyNonBillableMinutes = useMemo(() => {
    return entries.reduce(
      (sum, e) => sum + Number(e.non_billable_hours || 0),
      0,
    );
  }, [entries]);

  //7 days mandatory
  // const isWeekValidForSubmit = useMemo(() => {
  //   if (entries.length === 0) return false;

  //   // Build daily totals map
  //   const dailyTotals = {};

  //   weekDates.forEach((d) => {
  //     dailyTotals[toIso(d)] = 0;
  //   });

  //   entries.forEach((e) => {
  //     if (dailyTotals.hasOwnProperty(e.entry_date)) {
  //       dailyTotals[e.entry_date] += Number(e.total_hours || 0);
  //     }
  //   });

  //   // Must have exactly 7 days
  //   const hasSevenDays = Object.keys(dailyTotals).length === 7;

  //   if (!hasSevenDays) return false;

  //   // Every day must be between 8h and 12h
  //   return Object.values(dailyTotals).every(
  //     (minutes) => minutes >= MIN_DAILY_MINUTES && minutes <= MAX_DAILY_MINUTES,
  //   );
  // }, [entries, weekDates]);

  //6 days (Mon–Sat) mandatory, Sunday optional
  const isWeekValidForSubmit = useMemo(() => {
    if (entries.length === 0) return false;

    const dailyTotals = {};

    weekDates.forEach((d) => {
      const dayIso = toIso(d);
      dailyTotals[dayIso] = 0;
    });

    entries.forEach((e) => {
      if (dailyTotals.hasOwnProperty(e.entry_date)) {
        dailyTotals[e.entry_date] += Number(e.total_hours || 0);
      }
    });

    // ✅ Validate Monday–Saturday (mandatory)
    const weekdays = weekDates.filter((d) => d.getDay() !== 0);

    const weekdaysValid = weekdays.every((d) => {
      const minutes = dailyTotals[toIso(d)] || 0;
      return minutes >= MIN_DAILY_MINUTES && minutes <= MAX_DAILY_MINUTES;
    });

    if (!weekdaysValid) return false;

    // ✅ Validate Sunday (optional, only max)
    const sunday = weekDates.find((d) => d.getDay() === 0);
    if (sunday) {
      const sundayMinutes = dailyTotals[toIso(sunday)] || 0;
      if (sundayMinutes > MAX_DAILY_MINUTES) return false;
    }

    return true;
  }, [entries, weekDates]);

  const pendingEntries = entries.filter((e) => {
    const statusName = getStatusName(e.status);
    return ["Draft", "Manager_Rejected", "Admin_Rejected"].includes(statusName);
  });

  const getWeeklyStatus = () => {
    if (entries.length === 0) return "No Entries";

    const statusNames = entries.map((e) => getStatusName(e.status));
    if (statusNames.some((s) => s.includes("Rejected"))) {
      return "Partially Rejected";
    }
    if (statusNames.every((s) => s === "Approved")) {
      return "Approved";
    }
    if (statusNames.some((s) => s === "Partially_Approved")) {
      return "Partially Approved";
    }
    if (statusNames.every((s) => s === "Submitted")) {
      return "Submitted";
    }
    return "In Progress";
  };

  const weeklyStatus = getWeeklyStatus();
  const isResubmission = entries.some((e) =>
    statusMatches(e.status, "Rejected"),
  );

  const isWeekSubmitted = useMemo(() => {
    if (entries.length === 0) return false;

    const statusNames = entries.map((e) => getStatusName(e.status));

    // Week is locked if ALL entries are not Draft or Rejected
    return statusNames.every(
      (s) => !["Draft", "Manager_Rejected", "Admin_Rejected"].includes(s),
    );
  }, [entries]);

  // Load tasks by manager department
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

  // ✅ Load entries function
  const loadEntries = async () => {
    setLoading(true);
    try {
      if (!user || !user.id) {
        setLoading(false);
        return;
      }

      const projData = await projectService.getAssignedProjectsForTimesheet(
        user.id,
      );
      setProjects(projData.projects || []);

      // Load current week entries for display and editing
      const entriesResp = await timesheetService.getEntriesByDateRange(
        toIso(weekStart),
        toIso(weekEnd),
      );

      let loadedEntries = entriesResp?.entries ?? [];
      loadedEntries = loadedEntries.map((entry) => ({
        ...entry,
        entry_date: entry.entry_date.split("T")[0],
        ticket_name: entry.ticket_name || entry.activity_name,
        task_name: entry.task_name,
        // ✅ FIXED: Values are already in minutes from backend
        total_hours: Number(entry.total_hours || 0),
        billable_hours: Number(entry.billable_hours || 0),
        non_billable_hours: Number(entry.non_billable_hours || 0),
      }));
      setEntries(loadedEntries);

      console.log("✅ Loaded entries:", loadedEntries);
    } catch (err) {
      console.error("❌ Load error:", err);
      toast.error("Failed to load timesheet data");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Load ALL entries for calendar color coding
  const loadAllEntriesForCalendar = async () => {
    try {
      if (!user || !user.id) return;

      // Load entries for the last 3 months and next month (broad range for calendar)
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
      const endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);

      const allEntriesResp = await timesheetService.getEntriesByDateRange(
        toIso(startDate),
        toIso(endDate),
      );

      let loadedAllEntries = allEntriesResp?.entries ?? [];
      loadedAllEntries = loadedAllEntries.map((entry) => ({
        ...entry,
        entry_date: entry.entry_date.split("T")[0],
        total_hours: Number(entry.total_hours || 0),
        billable_hours: Number(entry.billable_hours || 0),
        non_billable_hours: Number(entry.non_billable_hours || 0),
      }));
      setAllEntries(loadedAllEntries);

      console.log(
        "✅ Loaded all entries for calendar:",
        loadedAllEntries.length,
      );
    } catch (err) {
      console.error("❌ Load all entries error:", err);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [weekKey]);

  // Load all entries for calendar on mount
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
  }, [selectedDay]);

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
      hours: minutesToHHMM(entry.total_hours), // ✅ Convert minutes to HH:MM
    });
    setDialogOpen(true);
  };

  const saveEntry = async () => {
    const { projectId, ticketId, taskId, hours, ticketNumber, description } =
      form;

    // Validate future date
    const todayIso = toIso(new Date());
    const entryDateStr = toIso(selectedDay);

    if (entryDateStr > todayIso) {
      toast.error("You cannot add entries for future dates");
      return;
    }

    if (!projectId || !ticketId || !taskId || !hours) {
      toast.error("Project, Ticket, Task, and Time are required");
      return;
    }

    // ✅ FIXED: Validate HH:MM format
    const error = getHHMMError(hours, MAX_ENTRY_MINUTES);
    if (error) {
      toast.error(error);
      return;
    }

    // ✅ FIXED: Convert to minutes
    const minutes = hhmmToMinutes(hours);

    // ✅ FIXED: Check daily limit in minutes
    const currentDailyMinutes = entriesForSelectedDay.reduce(
      (sum, e) => sum + Number(e.total_hours || 0),
      0,
    );

    let projectedMinutes = currentDailyMinutes;
    if (editingEntry) {
      const oldMinutes = Number(editingEntry.total_hours || 0);
      projectedMinutes = currentDailyMinutes - oldMinutes + minutes;
    } else {
      projectedMinutes = currentDailyMinutes + minutes;
    }

    if (projectedMinutes > MAX_DAILY_MINUTES) {
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
        hoursLogged: minutes, // ✅ Send minutes to backend
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
          entryDate: entryDateStr,
        });
        toast.success("Entry created successfully");
      }

      await loadEntries();
      await loadAllEntriesForCalendar(); // Refresh calendar data
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
      await loadAllEntriesForCalendar(); // Refresh calendar data
    } catch (err) {
      console.error("Delete entry error:", err);
      const errorMsg = err.response?.data?.error || "Failed to delete entry";
      toast.error(errorMsg);
    }
  };

  const handleSubmit = async () => {
    setConfirmDialogOpen(false);

    // 1️⃣ Ensure 7 days exist
    // const daysWithEntries = new Set(entries.map((e) => e.entry_date));

    // if (daysWithEntries.size !== 7) {
    //   toast.error("All 7 days must have entries before submitting.");
    //   return;
    // }

    // Only count Monday–Saturday
    const requiredDays = weekDates.filter((d) => d.getDay() !== 0);
    const daysWithEntries = new Set(
      entries
        .filter((e) => {
          const date = new Date(e.entry_date);
          return date.getDay() !== 0; // exclude Sunday
        })
        .map((e) => e.entry_date),
    );
    if (daysWithEntries.size !== 6) {
      toast.error("Entries required for Monday to Saturday.");
      return;
    }

    // 2️⃣ Validate each day min/max for 7 days
    // for (const date of weekDates) {
    //   const dayIso = toIso(date);

    //   const dayMinutes = entries
    //     .filter((e) => e.entry_date === dayIso)
    //     .reduce((sum, e) => sum + Number(e.total_hours || 0), 0);

    //   if (dayMinutes < MIN_DAILY_MINUTES) {
    //     toast.error(
    //       `${format(date, "EEEE")} must have at least ${minutesToHHMM(
    //         MIN_DAILY_MINUTES,
    //       )}.`,
    //     );
    //     return;
    //   }

    //   if (dayMinutes > MAX_DAILY_MINUTES) {
    //     toast.error(
    //       `${format(date, "EEEE")} exceeds ${minutesToHHMM(
    //         MAX_DAILY_MINUTES,
    //       )}.`,
    //     );
    //     return;
    //   }
    // }

    // 2️⃣ Validate each day min/max for 6 days sunday is optional
    for (const date of weekDates) {
      const dayIso = toIso(date);
      const isSunday = date.getDay() === 0;

      const dayMinutes = entries
        .filter((e) => e.entry_date === dayIso)
        .reduce((sum, e) => sum + Number(e.total_hours || 0), 0);

      // Skip if no Sunday entry
      if (isSunday && dayMinutes === 0) continue;

      // ✅ Sunday → ONLY max validation
      if (isSunday) {
        if (dayMinutes > MAX_DAILY_MINUTES) {
          toast.error(
            `${format(date, "EEEE")} exceeds ${minutesToHHMM(
              MAX_DAILY_MINUTES,
            )}.`,
          );
          return;
        }
        continue;
      }

      // ✅ Monday–Saturday → min + max validation
      if (dayMinutes < MIN_DAILY_MINUTES) {
        toast.error(
          `${format(date, "EEEE")} must have at least ${minutesToHHMM(
            MIN_DAILY_MINUTES,
          )}.`,
        );
        return;
      }

      if (dayMinutes > MAX_DAILY_MINUTES) {
        toast.error(
          `${format(date, "EEEE")} exceeds ${minutesToHHMM(
            MAX_DAILY_MINUTES,
          )}.`,
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
      await loadAllEntriesForCalendar(); // Refresh calendar data
    } catch (err) {
      console.error("❌ Submit error:", err);
      toast.error(err.response?.data?.error || "Failed to submit timesheet");
    } finally {
      setSubmitting(false);
    }
  };

  const StatusBadge = ({ status }) => {
    const statusName = getStatusName(status);

    let color = "bg-gray-100 text-gray-700 border-gray-200";
    let icon = <Clock className="w-3 h-3 mr-1" />;

    if (statusName === "Submitted" || statusName === "Pending_Admin") {
      color = "bg-yellow-50 text-yellow-700 border-yellow-200";
      icon = <AlertCircle className="w-3 h-3 mr-1" />;
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
        {icon} {statusName.replace("_", " ")}
      </span>
    );
  };

  const handleHoursChange = (value) => {
    setForm((prev) => ({ ...prev, hours: value }));

    // Real-time validation
    const error = getHHMMError(value, MAX_ENTRY_MINUTES);

    setErrors((prev) => ({
      ...prev,
      hours: error || "",
    }));
  };

  const loggedDays = new Set(
    entries
      .filter((e) => new Date(e.entry_date).getDay() !== 0)
      .map((e) => e.entry_date),
  ).size;

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg border shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-semibold text-gray-800">
              Weekly Timesheet
            </h2>
            <Badge
              variant={
                weeklyStatus.includes("Rejected") ? "destructive" : "outline"
              }
            >
              {weeklyStatus}
            </Badge>
            {isWeekSubmitted && (
              <Badge
                variant="secondary"
                className="bg-blue-50 text-blue-700 border-blue-200"
              >
                🔒 Locked
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <span className="font-medium text-gray-700">
              {format(weekStart, "MMM d")}
            </span>
            <ChevronRight className="w-3 h-3" />
            <span className="font-medium text-gray-700">
              {format(weekEnd, "MMM d, yyyy")}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDay(addDays(selectedDay, -7))}
              className="h-8 w-8 p-0 hover:bg-white rounded-md"
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
              className="h-8 px-3 text-xs font-medium hover:bg-white rounded-md"
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDay(addDays(selectedDay, 7))}
              className="h-8 w-8 p-0 hover:bg-white rounded-md"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            onClick={openAddDialog}
            className="gap-2 shadow-sm"
            disabled={isFutureDate(selectedDay) || isWeekSubmitted}
          >
            <Plus className="h-4 w-4" /> Add Entry
          </Button>
        </div>
      </div>

      {/* Day Selector */}
      <div className="flex overflow-x-auto p-1 gap-2 no-scrollbar ">
        {weekDates.map((d) => {
          const isSelected = isSameDay(d, selectedDay);
          const isToday = isSameDay(d, new Date());
          const dayIso = toIso(d);
          const dayMinutes = entries
            .filter((e) => e.entry_date === dayIso)
            .reduce((sum, e) => sum + Number(e.total_hours || 0), 0);

          return (
            <button
              key={dayIso}
              onClick={() => setSelectedDay(d)}
              className={`flex-1 min-w-[100px] p-3 rounded-lg border transition-all duration-200
                flex flex-col items-center justify-center gap-1
                ${
                  isSelected
                    ? "bg-blue-50 border-blue-200 ring-1 ring-blue-400"
                    : "bg-white border-gray-300 hover:border-gray-300 hover:bg-gray-100"
                }`}
            >
              <span
                className={`text-sm font-medium uppercase ${
                  isSelected ? "text-blue-600" : "text-black-500"
                }`}
              >
                {isToday ? "Today" : format(d, "EEE")}
              </span>
              <span
                className={`text-lg font-bold ${
                  isSelected ? "text-blue-700" : "text-gray-700"
                }`}
              >
                {format(d, "d")}
              </span>
              {/* Daily Hours Display */}
              {dayMinutes > 0 && (
                <span
                  className={`text-[13px] font-semibold ${
                    dayMinutes < MIN_DAILY_MINUTES
                      ? "text-red-500"
                      : dayMinutes > MAX_DAILY_MINUTES
                        ? "text-orange-500"
                        : "text-green-600"
                  }`}
                >
                  {formatMinutesDisplay(dayMinutes)}
                </span>
              )}

              {/* Missing Entry */}
              {dayMinutes === 0 && !isFutureDate(d) && (
                <span className="text-[13px] text-gray-400">No entry</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entries List */}
        <Card className="lg:col-span-2 border-0 shadow-sm ring-1 ring-gray-200">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Entries for {format(selectedDay, "EEEE, MMM d")}</span>
              <span className="text-sm font-normal text-muted-foreground">
                Total:{" "}
                {formatMinutesDisplay(
                  entriesForSelectedDay.reduce(
                    (acc, e) => acc + Number(e.total_hours || 0),
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
              <div className="p-12 text-center flex flex-col items-center justify-center text-gray-400">
                <button
                  type="button"
                  onClick={
                    !isFutureDate(selectedDay) && !isWeekSubmitted
                      ? openAddDialog
                      : undefined
                  }
                  disabled={isFutureDate(selectedDay) || isWeekSubmitted}
                  className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors
                    ${
                      isFutureDate(selectedDay) || isWeekSubmitted
                        ? "bg-gray-100 text-gray-300 cursor-not-allowed opacity-50"
                        : "bg-gray-200 text-gray-500 cursor-pointer hover:bg-gray-300"
                    }
                  `}
                >
                  <Plus className="w-6 h-6" />
                </button>
                <p className="text-sm mb-2">
                  {isWeekSubmitted
                    ? "No entries for this day (Week locked)"
                    : "No entries for this day"}
                </p>
                {isWeekSubmitted ? (
                  <p className="text-xs text-gray-500">
                    Cannot add entries - timesheet is submitted/approved
                  </p>
                ) : (
                  <Button
                    variant="link"
                    onClick={
                      !isFutureDate(selectedDay) && !isWeekSubmitted
                        ? openAddDialog
                        : undefined
                    }
                    disabled={isFutureDate(selectedDay) || isWeekSubmitted}
                    className={
                      isFutureDate(selectedDay) || isWeekSubmitted
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }
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
                      className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-4 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900 truncate">
                            {entry.project_name}
                          </h4>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-sm text-gray-600 truncate">
                            {entry.ticket_name || "Untitled Ticket"}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
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
                            <span className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-200 text-xs text-gray-600 font-mono">
                              {entry.ticket_number}
                            </span>
                          )}
                          <StatusBadge status={entry.status} />

                          {entry.billable_hours > 0 && (
                            <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-200">
                              Billable:{" "}
                              {formatMinutesDisplay(entry.billable_hours)}
                            </span>
                          )}
                          {entry.non_billable_hours > 0 && (
                            <span className="text-xs px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full border border-orange-200">
                              Non-billable:{" "}
                              {formatMinutesDisplay(entry.non_billable_hours)}
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
                        <span className="text-lg font-bold text-gray-700 tabular-nums">
                          {formatMinutesDisplay(Number(entry.total_hours))}
                        </span>
                        {[
                          "Draft",
                          "Manager_Rejected",
                          "Admin_Rejected",
                        ].includes(statusName) && (
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

        {/* Statistics Badges - Modern Dashboard Style */}
        <div className="space-y-4">
          {/* Statistics Badges Row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Total Hours Badge */}
            <Card className="border-0 shadow-sm ring-1 ring-gray-200 bg-gradient-to-br from-blue-50 to-white">
              <CardContent className="p-4">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Total Hours
                  </span>
                  <span className="text-2xl font-bold text-gray-900">
                    {formatMinutesDisplay(weekTotalMinutes)}
                  </span>
                  {/* <span className="text-xs text-gray-500 mt-1">
                    Target: 56h-84h
                  </span> */}
                </div>
              </CardContent>
            </Card>

            {/* Days Logged Badge */}
            <Card className="border-0 shadow-sm ring-1 ring-gray-200 bg-gradient-to-br from-green-50 to-white">
              <CardContent className="p-4">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Days Logged
                  </span>
                  <span className="text-2xl font-bold text-gray-900">
                    {/* {new Set(entries.map((e) => e.entry_date)).size} / 7 */}
                    {loggedDays}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    {7 - new Set(entries.map((e) => e.entry_date)).size}{" "}
                    remaining
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Billable Percentage Badge */}
            <Card className="border-0 shadow-sm ring-1 ring-gray-200 bg-gradient-to-br from-purple-50 to-white">
              <CardContent className="p-4">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Billable
                  </span>
                  <span className="text-2xl font-bold text-gray-900">
                    {weekTotalMinutes > 0
                      ? Math.round(
                          (weeklyBillableMinutes / weekTotalMinutes) * 100,
                        )
                      : 0}
                    %
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    {formatMinutesDisplay(weeklyBillableMinutes)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Status Badge */}
            <Card
              className={`border-0 shadow-sm ring-1 ring-gray-200 ${
                isWeekValidForSubmit
                  ? "bg-gradient-to-br from-green-50 to-white"
                  : weeklyStatus.includes("Rejected")
                    ? "bg-gradient-to-br from-red-50 to-white"
                    : "bg-gradient-to-br from-orange-50 to-white"
              }`}
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
          </div>

          {/* Breakdown Section */}
          <Card className="border-0 shadow-sm ring-1 ring-gray-200">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    Billable Hours
                  </span>
                  <span className="font-semibold text-gray-900">
                    {formatMinutesDisplay(weeklyBillableMinutes)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    Non-Billable Hours
                  </span>
                  <span className="font-semibold text-gray-900">
                    {formatMinutesDisplay(weeklyNonBillableMinutes)}
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

          {/* Submit Button */}
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
                : "Submit Week"}{" "}
          </Button>
        </div>
      </div>

      {/* Confirm Dialog */}
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
                : "Once submitted, entries are locked for admin approval."}
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

      {/* Entry Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Edit Entry" : "Log Time"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div ref={projectRef} className="col-span-2 relative">
                <label className="text-xs font-semibold uppercase mb-1.5 block">
                  Project <span className="text-red-500">*</span>
                </label>

                <Input
                  value={projectSearch}
                  onChange={(e) => {
                    setProjectSearch(e.target.value);
                    setShowProjectList(true);
                  }}
                  onClick={() => setShowProjectList(true)}
                  placeholder="Search Project"
                />

                {showProjectList && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border rounded-md shadow-md max-h-60 overflow-y-auto">
                    {filteredProjects.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        No project found
                      </div>
                    ) : (
                      filteredProjects.map((p) => (
                        <div
                          key={p.project_id}
                          className={`p-2 text-sm cursor-pointer hover:bg-gray-100 ${
                            form.projectId === p.project_id
                              ? "bg-gray-200 font-medium"
                              : ""
                          }`}
                          onClick={async () => {
                            setForm((prev) => ({
                              ...prev,
                              projectId: p.project_id,
                              ticketId: "",
                              taskId: "",
                            }));

                            setProjectSearch(p.project_name);
                            setShowProjectList(false);

                            await handleProjectChange(p.project_id);
                          }}
                        >
                          {p.project_name}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div ref={ticketRef} className="col-span-2 relative">
                <label className="text-xs font-semibold uppercase mb-1.5 block">
                  Ticket <span className="text-red-500">*</span>
                </label>

                <Input
                  value={ticketSearch}
                  onChange={(e) => {
                    setTicketSearch(e.target.value);
                    setShowTicketList(true);
                  }}
                  onFocus={() => form.projectId && setShowTicketList(true)}
                  placeholder="Search Ticket"
                  disabled={!form.projectId}
                />

                {showTicketList && form.projectId && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border rounded-md shadow-md max-h-60 overflow-y-auto">
                    {filteredTickets.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        No ticket found
                      </div>
                    ) : (
                      filteredTickets.map((t) => (
                        <div
                          key={t.ticket_id}
                          className={`p-2 text-sm cursor-pointer hover:bg-gray-100 ${
                            form.ticketId === t.ticket_id
                              ? "bg-gray-200 font-medium"
                              : ""
                          }`}
                          onClick={() => {
                            setForm((prev) => ({
                              ...prev,
                              ticketId: t.ticket_id,
                              ticketNumber: t.zoho_crm_code || "",
                            }));

                            setTicketSearch(t.ticket_name);
                            setShowTicketList(false);
                          }}
                        >
                          {t.ticket_name}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div ref={taskRef} className="col-span-2 relative">
                <label className="text-xs font-semibold uppercase mb-1.5 block">
                  Task ({user?.department || "General"}){" "}
                  <span className="text-red-500">*</span>
                </label>

                <Input
                  value={taskSearch}
                  onChange={(e) => {
                    setTaskSearch(e.target.value);
                    setShowTaskList(true);
                  }}
                  onFocus={() => form.projectId && setShowTaskList(true)}
                  placeholder="Search Task"
                  disabled={!form.projectId || tasks.length === 0}
                />

                {showTaskList && form.projectId && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border rounded-md shadow-md max-h-60 overflow-y-auto">
                    {filteredTasks.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        No task found
                      </div>
                    ) : (
                      filteredTasks.map((t) => (
                        <div
                          key={t.task_id}
                          className={`p-2 text-sm cursor-pointer hover:bg-gray-100 ${
                            form.taskId === t.task_id
                              ? "bg-gray-200 font-medium"
                              : ""
                          }`}
                          onClick={() => {
                            setForm((prev) => ({
                              ...prev,
                              taskId: t.task_id,
                            }));

                            setTaskSearch(t.task_name);
                            setShowTaskList(false);
                          }}
                        >
                          {t.task_name}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-black-500 uppercase mb-1.5 block">
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
                <label className="text-xs font-semibold text-black-500 uppercase mb-1.5 block">
                  Ticket Code <span className="text-red-500">*</span>
                </label>
                <Input
                  value={form.ticketNumber}
                  onChange={(e) =>
                    setForm({ ...form, ticketNumber: e.target.value })
                  }
                  placeholder=""
                  disabled
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-black-500 uppercase mb-1.5 block">
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
    </div>
  );
}

export default ManagerTimesheetEntry;

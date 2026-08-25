import { format, startOfWeek, endOfWeek, addDays, isWeekend } from "date-fns";

// Format a date to a string
export const formatDate = (date, formatStr = "yyyy-MM-dd") => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return format(dateObj, formatStr);
};

// Get start and end dates of the week (Monday to Sunday)
export const getWeekRange = (date = new Date()) => {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  const end = endOfWeek(date, { weekStartsOn: 1 }); // Sunday
  return { start, end };
};

// Get all dates in a week starting from startDate
export const getWeekDates = (startDate) => {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    dates.push(addDays(startDate, i));
  }
  return dates;
};

// Check if a date is a working day (optionally allow weekends)
export const isWorkingDay = (date, allowWeekends = false) => {
  if (allowWeekends) return true;
  return !isWeekend(date);
};

// Format a week range into a readable label
export const getWeekLabel = (startDate, endDate) => {
  return `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`;
};

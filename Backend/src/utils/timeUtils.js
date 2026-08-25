// utils/timeUtils.js

/**
 * Convert user input to minutes
 * Supported inputs:
 *  - "HH:MM"  → minutes
 *  - number   → treated as hours by default
 *
 * @param {string|number} value
 * @param {Object} options
 * @param {"hours"|"minutes"} options.assume - how to treat numeric values
 * @returns {number|null}
 */
export function toMinutes(value, { assume = "hours" } = {}) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  // HH:MM format
  if (typeof value === "string" && value.includes(":")) {
    const [h, m] = value.split(":").map(Number);

    if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || m < 0 || m >= 60) {
      return null;
    }

    return h * 60 + m;
  }

  const num = Number(value);
  if (Number.isNaN(num) || num < 0) {
    return null;
  }

  // Explicit intent
  if (assume === "minutes") {
    return Math.round(num);
  }

  // Default: decimal hours → minutes
  return Math.round(num * 60);
}

/**
 * Convert minutes to HH:MM string
 */
export function minutesToHHMM(minutes) {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) {
    return "0:00";
  }

  const totalMinutes = Math.max(0, Math.round(Number(minutes)));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  return `${h}:${String(m).padStart(2, "0")}`;
}

/**
 * Convert minutes to human readable string
 * Example: 125 → "2h 5m"
 */
export function minutesToReadable(minutes) {
  if (
    minutes === null ||
    minutes === undefined ||
    Number.isNaN(minutes) ||
    minutes <= 0
  ) {
    return "0m";
  }

  const totalMinutes = Math.round(Number(minutes));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Add HH:MM formatted fields to a timesheet entry
 * Keeps original minute values untouched
 */
export function formatEntryTimes(entry) {
  if (!entry) return entry;

  return {
    ...entry,

    // raw minutes (DB truth)
    total_hours: entry.total_hours,
    billable_hours: entry.billable_hours,
    non_billable_hours: entry.non_billable_hours,

    // formatted for UI
    total_hours_hhmm: minutesToHHMM(entry.total_hours),
    billable_hours_hhmm: minutesToHHMM(entry.billable_hours),
    non_billable_hours_hhmm: minutesToHHMM(entry.non_billable_hours),

    // backward compatibility aliases
    hours_logged: entry.total_hours,
    hours_logged_hhmm: minutesToHHMM(entry.total_hours),
  };
}

/**
 * Format array of entries safely
 */
export function formatEntriesArray(entries) {
  if (!Array.isArray(entries)) return entries;
  return entries.map(formatEntryTimes);
}

/**
 * Validate time input (HH:MM or numeric)
 */
export function isValidTimeInput(value) {
  const minutes = toMinutes(value);
  return minutes !== null && minutes > 0;
}

/**
 * Return user-friendly error for invalid time
 */
export function getTimeInputError(value, maxMinutes = null) {
  if (value === null || value === undefined || value === "") {
    return "Time is required";
  }

  if (typeof value === "string" && value.includes(":")) {
    const [h, m] = value.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) {
      return "Invalid time format. Use HH:MM (e.g., 1:30)";
    }
    if (m < 0 || m >= 60) {
      return "Minutes must be between 0 and 59";
    }
    if (h < 0) {
      return "Hours cannot be negative";
    }
  }

  const minutes = toMinutes(value);

  if (minutes === null) {
    return "Invalid time format. Use HH:MM (e.g., 1:30)";
  }

  if (minutes <= 0) {
    return "Time must be greater than 0";
  }

  if (maxMinutes && minutes > maxMinutes) {
    return `Maximum ${minutesToHHMM(maxMinutes)} allowed`;
  }

  return null;
}

/**
 * Centralized time rules
 */
export const TIME_CONSTANTS = Object.freeze({
  MINUTES_PER_HOUR: 60,

  MAX_DAILY_MINUTES: 12 * 60, // 12h
  MAX_ENTRY_MINUTES: 12 * 60, // 12h per entry
  REQUIRED_WEEK_MINUTES: 48 * 60, // 48h per week
});

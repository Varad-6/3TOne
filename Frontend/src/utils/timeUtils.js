// Minutes → HH:MM
export function minutesToHHMM(minutes) {
  const safeMinutes = Number(minutes);

  if (!Number.isFinite(safeMinutes) || safeMinutes < 0) {
    return "00:00";
  }

  const hrs = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;

  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

// HH:MM → Minutes
export const hhmmToMinutes = (value) => {
  if (!value || value === "") return null;

  const str = String(value).trim();

  // Handle HH:MM format (with colon)
  if (str.includes(":")) {
    const [hStr, mStr] = str.split(":");
    const hours = Number(hStr);
    const minutes = Number(mStr);

    if (isNaN(hours) || isNaN(minutes)) {
      return null;
    }

    if (hours < 0 || minutes < 0 || minutes >= 60) {
      return null;
    }

    return hours * 60 + minutes;
  }

  // ✅ NEW: Handle HH.MM format (with dot)
  if (str.includes(".")) {
    const [hStr, mStr] = str.split(".");
    const hours = Number(hStr);
    const minutes = Number(mStr);

    if (isNaN(hours) || isNaN(minutes)) {
      return null;
    }

    if (hours < 0 || minutes < 0 || minutes >= 60) {
      return null;
    }

    return hours * 60 + minutes;
  }

  // ✅ REMOVED: Don't treat plain numbers as minutes
  // This prevents confusion
  return null;
};

export const formatMinutesDisplay = (minutes) =>
  minutesToHHMM(Number(minutes) || 0);

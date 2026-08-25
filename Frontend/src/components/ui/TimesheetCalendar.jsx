import React, { useState, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";

export function TimesheetCalendar({
  selectedDate,
  onDateSelect,
  entries = [],
  getEntryDate = (entry) => entry.entry_date,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(selectedDate),
  );

  // Helper function to convert date to ISO format
  const toIso = (date) => {
    if (typeof date === "string") return date.split("T")[0];
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Calculate total hours per date (in minutes)
  const dailyHours = useMemo(() => {
    const hours = {};
    entries.forEach((entry) => {
      const dateStr = getEntryDate(entry);
      const dateIso = dateStr ? toIso(dateStr) : null;
      if (dateIso) {
        const totalMinutes = Number(entry.total_hours || 0);
        hours[dateIso] = (hours[dateIso] || 0) + totalMinutes;
      }
    });
    return hours;
  }, [entries, getEntryDate]);

  // Get all days to display in the calendar (including padding days)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Check if a date should be GREEN (8-12 hours = 480-720 minutes)
  const isGreen = (date) => {
    const dateIso = toIso(date);
    const totalMinutes = dailyHours[dateIso] || 0;
    return totalMinutes >= 480 && totalMinutes <= 720; // 8h to 12h
  };

  // Check if a date should be RED (<8 hours = <480 minutes)
  const isRed = (date) => {
    const dateIso = toIso(date);
    const totalMinutes = dailyHours[dateIso] || 0;
    return totalMinutes > 0 && totalMinutes < 480; // Less than 8h
  };

  // Check if date has any entries
  const hasEntries = (date) => {
    const dateIso = toIso(date);
    return (dailyHours[dateIso] || 0) > 0;
  };

  const handleDateClick = (date) => {
    onDateSelect(date);
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // const handleTodayClick = () => {
  //   const today = new Date();
  //   setCurrentMonth(today);
  //   onDateSelect(today);
  //   setIsOpen(false);
  // };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-white rounded-md"
          title="Open calendar"
        >
          <CalendarIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={handlePrevMonth}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-semibold">
              {format(currentMonth, "MMMM yyyy")}
            </div>
            <button
              onClick={handleNextMonth}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-gray-500 py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, idx) => {
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());
              const green = isGreen(day); // 8-12h
              const red = isRed(day); // <8h
              const hasEntry = hasEntries(day);

              return (
                <button
                  key={idx}
                  onClick={() => handleDateClick(day)}
                  disabled={!isCurrentMonth}
                  className={`
                    relative h-8 w-8 text-xs rounded-md transition-all
                    ${!isCurrentMonth ? "text-gray-300 cursor-not-allowed" : "text-gray-900"}
                    ${isSelected && !green && !red ? "bg-blue-500 text-white font-semibold hover:bg-blue-600" : ""}
                    ${!isSelected && isToday ? "ring-2 ring-blue-500 font-semibold" : ""}
                    ${!isSelected && !isToday && isCurrentMonth && !green && !red ? "hover:bg-gray-100" : ""}
                    ${green ? "bg-green-500 text-white font-semibold hover:bg-green-600" : ""}
                    ${red ? "bg-red-500 text-white font-semibold hover:bg-red-600" : ""}
                  `}
                >
                  {format(day, "d")}
                  {hasEntry &&
                    !green &&
                    !red &&
                    isCurrentMonth &&
                    !isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full" />
                    )}
                </button>
              );
            })}
          </div>

          {/* Footer with Legend and Today Button */}
          {/* <div className="mt-3 pt-3 border-t space-y-2">
            <div className="flex items-center justify-between text-[10px] text-gray-600">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span>8-12h (target)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-500" />
                <span>&lt;8h (underworked)</span>
              </div>
            </div>
            <div className="flex items-center justify-center text-[10px] text-gray-600">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded border-2 border-blue-500" />
                <span>Today</span>
              </div>
            </div>
            {/* <Button
              variant="outline"
              size="sm"
              onClick={handleTodayClick}
              className="w-full h-7 text-xs"
            >
              Go to Today
            </Button> 
          </div>*/}
        </div>
      </PopoverContent>
    </Popover>
  );
}

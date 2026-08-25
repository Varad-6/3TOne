"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import "react-day-picker/dist/style.css";

function Calendar({ className, classNames, showOutsideDays = true, ...props }) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      weekStartsOn={1} // Monday start week
      className={cn("p-3", className)}
      classNames={{
        caption: "flex justify-center py-2 mb-2",
        nav: "flex items-center justify-between",
        table: "w-full border-collapse",
        head_row: "grid grid-cols-7 text-center text-xs text-muted-foreground",
        row: "grid grid-cols-7 mt-2",
        cell: "relative p-0 text-center text-sm",
        day: cn(
          "h-9 w-9 p-0 font-normal",
          "hover:bg-accent hover:text-accent-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md",
        ),
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside: "text-muted-foreground/50",
        day_disabled: "text-muted-foreground opacity-50",
        ...classNames,
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };

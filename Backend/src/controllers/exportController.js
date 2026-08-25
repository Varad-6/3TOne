// src/controllers/exportController.js
// src/controllers/exportController.js

import pool from "../config/database.js";
import { createExcelExport } from "../services/exportServices.js";
import ExcelJS from "exceljs";

const VIEWS = {
  monthly_timesheet: {
    view: "vw_employee_feb_timesheet_excel",
    name: "TimesheetEntriesForFEB",
    prefix: "TimesheetEntriesForFEB",
  },
};

/**
 * Convert decimal hours (7.75) ? HH:MM (7:45)
 */
function decimalToTime(decimal) {
  if (decimal === null || decimal === undefined) return "";

  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);

  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

/**
 * Convert time fields inside a row
 */
function formatTimeFields(row) {
  const timeFields = [
    "billable_hours",
    "non_billable_hours",
    "self_learning_hours",
    "total_hours",
  ];

  timeFields.forEach((field) => {
    if (row[field] !== undefined && row[field] !== null) {
      row[field] = decimalToTime(row[field]);
    }
  });

  return row;
}

/**
 * Export single sheet
 */
export const exportData = async (req, res) => {
  try {
    const { type } = req.params;
    const config = VIEWS[type];

    if (!config) {
      return res.status(400).json({ error: "Invalid export type" });
    }

    const { buffer, fileName } = await createExcelExport(
      config.view,
      config.name,
      config.prefix
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    res.send(buffer);
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Export failed" });
  }
};

/**
 * Export all views to Excel
 */
export const exportAll = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();

    for (const [type, config] of Object.entries(VIEWS)) {
      const { rows } = await pool.query(
        `SELECT * FROM ${config.view} ORDER BY employee_code, entry_date`
      );

      const ws = workbook.addWorksheet(config.name);

      if (rows.length === 0) {
        ws.addRow(["No data"]);
        continue;
      }

      /**
       * Create columns dynamically
       */
      const columns = Object.keys(rows[0]).map((key) => ({
        header: key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()),
        key,
      }));

      ws.columns = columns;

      /**
       * Add rows with time formatting
       */
      rows.forEach((row) => {
        const formattedRow = formatTimeFields(row);
        ws.addRow(formattedRow);
      });

      /**
       * Excel styling improvements
       */

      // Freeze header row
      ws.views = [{ state: "frozen", ySplit: 1 }];

      // Add filter
      ws.autoFilter = {
        from: "A1",
        to: `${String.fromCharCode(64 + ws.columns.length)}1`,
      };

      // Auto column width
      ws.columns.forEach((column) => {
        let maxLength = 10;

        column.eachCell({ includeEmpty: true }, (cell) => {
          const length = cell.value ? cell.value.toString().length : 10;
          if (length > maxLength) maxLength = length;
        });

        column.width = maxLength + 2;
      });

      // Bold header
      ws.getRow(1).font = { bold: true };
    }

    const buffer = await workbook.xlsx.writeBuffer();

    const fileName = `TimeTrakPro_Complete_${new Date(
      new Date().setDate(new Date().getDate() - 1)
    )
      .toISOString()
      .slice(0, 10)}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    res.send(buffer);
  } catch (error) {
    console.error("Export all error:", error);
    res.status(500).json({ error: "Export all failed" });
  }
};




//import pool from "../config/database.js";
//import { createExcelExport } from "../services/exportServices.js";
//import ExcelJS from "exceljs";
//
//const VIEWS = {
//    monthly_timesheet: {
//    view: "vw_employee_feb_timesheet_excel",
//    name: "TimesheetEntriesForFEB",
//    prefix: "TimesheetEntriesForFEB",
//  },
////  timesheet_entries: {
////    view: "v_timesheet_with_entries",
////    name: "TimesheetEntries",
////    prefix: "TimesheetEntries",
////  },
////  timesheet_missing_entries: {
////    view: "v_timesheet_missing_entries",
////    name: "TimesheetMissingEntries",
////    prefix: "TimesheetMissingEntries",
////  },
//};
//
//export const exportData = async (req, res) => {
//  try {
//    const { type } = req.params;
//    const config = VIEWS[type];
//
//    if (!config) {
//      return res.status(400).json({ error: "Invalid export type" });
//    }
//
//    const { buffer, fileName } = await createExcelExport(
//      config.view,
//      config.name,
//      config.prefix,
//    );
//
//    res.setHeader(
//      "Content-Type",
//      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//    );
//    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
//    res.send(buffer);
//  } catch (error) {
//    console.error("Export error:", error);
//    res.status(500).json({ error: "Export failed" });
//  }
//};
//
//export const exportAll = async (req, res) => {
//  try {
//    const workbook = new ExcelJS.Workbook();
//
//    // Export all views to separate sheets
//    for (const [type, config] of Object.entries(VIEWS)) {
//      const { rows } = await pool.query(
//        `SELECT * FROM ${config.view} ORDER BY employee_code, entry_date`,
//      );
//
//      const ws = workbook.addWorksheet(config.name);
//
//      if (rows.length === 0) {
//        ws.addRow(["No data"]);
//        continue;
//      }
//
//      // Special formatting only for missing entries
//      if (
//        type === "timesheet_missing_entries" ||
//        type === "timesheet_entries"
//      ) {
//        // Get unique dates (weekly columns)
//        const dates = [...new Set(rows.map((r) => r.entry_date))].sort();
//
//        // Header row
//        ws.columns = [
//          { header: "Employee Code", key: "employee_code" },
//          { header: "Employee Name", key: "employee_name" },
//          { header: "Department", key: "department" },
//          ...dates.map((date) => ({
//            header: date,
//            key: date,
//          })),
//        ];
//
//        // Group by employee
//        const grouped = {};
//
//        rows.forEach((row) => {
//          const empKey = row.employee_code;
//
//          if (!grouped[empKey]) {
//            grouped[empKey] = {
//              employee_code: row.employee_code,
//              employee_name: row.employee_name,
//              department: row.department,
//            };
//          }
//
//          grouped[empKey][row.entry_date] = row.total_hours;
//        });
//
//        // Add rows
//        Object.values(grouped).forEach((emp) => {
//          ws.addRow(emp);
//        });
//      } else {
//        // Default behavior for other sheets
//        const columns = Object.keys(rows[0]).map((key) => ({
//          header: key
//            .replace(/_/g, " ")
//            .replace(/\b\w/g, (l) => l.toUpperCase()),
//          key,
//        }));
//
//        ws.columns = columns;
//        rows.forEach((row) => ws.addRow(row));
//      }
//    }
//
//    const buffer = await workbook.xlsx.writeBuffer();
//    const fileName = `TimeTrakPro_Complete_${new Date(
//      new Date().setDate(new Date().getDate() - 1),
//    )
//      .toISOString()
//      .slice(0, 10)}.xlsx`;
//
//    res.setHeader(
//      "Content-Type",
//      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//    );
//    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
//    res.send(buffer);
//  } catch (error) {
//    console.error("Export all error:", error);
//    res.status(500).json({ error: "Export all failed" });
//  }
//};

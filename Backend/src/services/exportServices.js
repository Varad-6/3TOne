// src/services/exportService.js
import ExcelJS from 'exceljs';
import pool from '../config/database.js';

export const createExcelExport = async (viewName, sheetName, fileNamePrefix) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TimeTrakPro';

  // Get data from view
  const { rows } = await pool.query(`SELECT * FROM ${viewName} ORDER BY 1`);
  
  if (rows.length === 0) {
    const ws = workbook.addWorksheet(sheetName);
    ws.addRow(['No data available']);
    return await workbook.xlsx.writeBuffer();
  }

  const ws = workbook.addWorksheet(sheetName);
  
  // Auto-generate columns from first row
  const columns = Object.keys(rows[0]).map(key => ({
    header: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    key,
    width: 20
  }));
  
  ws.columns = columns;
  
  // Style headers
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { 
    type: 'pattern', 
    pattern: 'solid', 
    fgColor: { argb: 'FF366092' } 
  };
  
  // Add data
  rows.forEach(row => ws.addRow(row));
  
  // Freeze header
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  
  const fileName = `${fileNamePrefix}_${new Date().toISOString().slice(0,10)}.xlsx`;
  
  return { buffer: await workbook.xlsx.writeBuffer(), fileName };
};

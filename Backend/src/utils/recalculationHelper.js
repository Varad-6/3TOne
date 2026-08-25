import pool from "../config/database.js";

/**
 * Recalculate billable/non-billable hours for all Draft/Submitted entries
 * @param {UUID} assignmentId - ticket_assignments_id or ticket_manager_scope.id
 * @param {string} assignmentType - 'employee' or 'manager'
 * @returns {Promise<number>} - Number of entries updated
 */
export const recalculateAssignmentEntries = async (
  assignmentId,
  assignmentType
) => {
  try {
    // 1. Get the new budget
    let budgetQuery;
    if (assignmentType === "employee") {
      budgetQuery = `SELECT billable_hours FROM ticket_assignments WHERE ticket_assignments_id = $1`;
    } else {
      budgetQuery = `SELECT billable_hours FROM ticket_manager_scope WHERE id = $1`;
    }

    const budgetResult = await pool.query(budgetQuery, [assignmentId]);
    if (budgetResult.rows.length === 0) {
      throw new Error(`Assignment ${assignmentId} not found`);
    }

    const newBudget = parseFloat(budgetResult.rows[0].billable_hours || 0);
    console.log(
      `📊 Recalculating with new budget: ${newBudget}h for ${assignmentType} assignment ${assignmentId}`
    );

    // 2. Get all Draft/Submitted entries for this assignment (in chronological order)
    let entriesQuery;
    if (assignmentType === "employee") {
      entriesQuery = `
        SELECT d.entry_id, d.total_hours, d.billable_hours as old_billable
        FROM daily_timesheet_entries d
        JOIN timesheet_status ts ON ts.id = d.status
        WHERE d.ticket_assign_id = $1
          AND ts.name IN ('Draft', 'Submitted')
        ORDER BY d.entry_date ASC, d.created_at ASC
      `;
    } else {
      entriesQuery = `
        SELECT d.entry_id, d.total_hours, d.billable_hours as old_billable
        FROM daily_timesheet_entries d
        JOIN timesheet_status ts ON ts.id = d.status
        WHERE d.ticket_manager_assign_id = $1
          AND ts.name IN ('Draft', 'Submitted')
        ORDER BY d.entry_date ASC, d.created_at ASC
      `;
    }

    const entriesResult = await pool.query(entriesQuery, [assignmentId]);
    const entries = entriesResult.rows;

    if (entries.length === 0) {
      console.log(
        `ℹ️  No Draft/Submitted entries found for assignment ${assignmentId}`
      );
      return 0;
    }

    console.log(`🔄 Found ${entries.length} entries to recalculate`);

    // 3. Recalculate billable/non-billable for each entry
    let runningTotal = 0;
    let updatedCount = 0;

    for (const entry of entries) {
      const totalHours = parseFloat(entry.total_hours);
      let newBillable = 0;
      let newNonBillable = 0;

      // Calculate how much billable budget is remaining
      const remaining = Math.max(0, newBudget - runningTotal);

      if (remaining >= totalHours) {
        // Full hours are billable
        newBillable = totalHours;
        newNonBillable = 0;
      } else if (remaining > 0) {
        // Partial billable
        newBillable = remaining;
        newNonBillable = totalHours - remaining;
      } else {
        // No billable budget left
        newBillable = 0;
        newNonBillable = totalHours;
      }

      // Update the entry
      await pool.query(
        `UPDATE daily_timesheet_entries
         SET billable_hours = $1,
             non_billable_hours = $2,
             updated_at = NOW()
         WHERE entry_id = $3`,
        [newBillable, newNonBillable, entry.entry_id]
      );

      console.log(
        `  ✓ Entry ${entry.entry_id}: ${entry.old_billable}h → ${newBillable}h billable (${newNonBillable}h non-billable)`
      );

      runningTotal += newBillable;
      updatedCount++;
    }

    console.log(`✅ Successfully recalculated ${updatedCount} entries`);
    return updatedCount;
  } catch (error) {
    console.error("❌ Recalculation error:", error);
    throw error;
  }
};

/**
 * Recalculate all entries for a specific ticket (all assignments)
 * @param {UUID} ticketId
 * @returns {Promise<Object>} - Summary of updates
 */
export const recalculateTicketEntries = async (ticketId) => {
  try {
    console.log(`🔄 Recalculating all entries for ticket: ${ticketId}`);

    const summary = {
      totalEntriesUpdated: 0,
      employeeAssignments: 0,
      managerAssignments: 0,
      details: [],
    };

    // 1. Recalculate all employee assignments
    const employeeAssignments = await pool.query(
      `SELECT ticket_assignments_id FROM ticket_assignments 
       WHERE ticket_id = $1 AND is_active = TRUE`,
      [ticketId]
    );

    for (const assignment of employeeAssignments.rows) {
      const updated = await recalculateAssignmentEntries(
        assignment.ticket_assignments_id,
        "employee"
      );
      if (updated > 0) {
        summary.totalEntriesUpdated += updated;
        summary.employeeAssignments++;
        summary.details.push({
          assignmentId: assignment.ticket_assignments_id,
          assignmentType: "employee",
          entriesUpdated: updated,
        });
      }
    }

    // 2. Recalculate all manager assignments
    const managerAssignments = await pool.query(
      `SELECT id FROM ticket_manager_scope 
       WHERE ticket_id = $1 AND is_active = TRUE`,
      [ticketId]
    );

    for (const assignment of managerAssignments.rows) {
      const updated = await recalculateAssignmentEntries(
        assignment.id,
        "manager"
      );
      if (updated > 0) {
        summary.totalEntriesUpdated += updated;
        summary.managerAssignments++;
        summary.details.push({
          assignmentId: assignment.id,
          assignmentType: "manager",
          entriesUpdated: updated,
        });
      }
    }

    console.log(
      `✅ Recalculated ${summary.totalEntriesUpdated} entries across ${
        summary.employeeAssignments + summary.managerAssignments
      } assignments`
    );

    return summary;
  } catch (error) {
    console.error("❌ Ticket recalculation error:", error);
    throw error;
  }
};

/**
 * Get affected entries summary before recalculation (for preview)
 * @param {UUID} assignmentId
 * @param {string} assignmentType
 * @returns {Promise<Object>}
 */
export const getAffectedEntriesSummary = async (
  assignmentId,
  assignmentType
) => {
  try {
    let query;
    if (assignmentType === "employee") {
      query = `
        SELECT 
          COUNT(*) as total_entries,
          SUM(d.total_hours) as total_hours,
          SUM(d.billable_hours) as current_billable,
          SUM(d.non_billable_hours) as current_non_billable
        FROM daily_timesheet_entries d
        JOIN timesheet_status ts ON ts.id = d.status
        WHERE d.ticket_assign_id = $1
          AND ts.name IN ('Draft', 'Submitted')
      `;
    } else {
      query = `
        SELECT 
          COUNT(*) as total_entries,
          SUM(d.total_hours) as total_hours,
          SUM(d.billable_hours) as current_billable,
          SUM(d.non_billable_hours) as current_non_billable
        FROM daily_timesheet_entries d
        JOIN timesheet_status ts ON ts.id = d.status
        WHERE d.ticket_manager_assign_id = $1
          AND ts.name IN ('Draft', 'Submitted')
      `;
    }

    const result = await pool.query(query, [assignmentId]);
    return {
      totalEntries: parseInt(result.rows[0].total_entries || 0),
      totalHours: parseFloat(result.rows[0].total_hours || 0),
      currentBillable: parseFloat(result.rows[0].current_billable || 0),
      currentNonBillable: parseFloat(result.rows[0].current_non_billable || 0),
    };
  } catch (error) {
    console.error("❌ Get affected entries error:", error);
    throw error;
  }
};

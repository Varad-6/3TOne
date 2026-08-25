import pool from "../config/database.js";

// ===============================================
// GET DEPARTMENTS (from departments table)
// ===============================================
export const getDepartments = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name FROM departments ORDER BY name ASC`
    );
    res.json({
      departments: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Get departments error:", error);
    res.status(500).json({ error: "Failed to fetch department list" });
  }
};

// ===============================================
// ✅ NEW: GET TASKS BY DEPARTMENT AND PROJECT
// Filters tasks based on user's department AND project type
// ===============================================
export const getTasksByDepartmentAndProject = async (req, res) => {
  try {
    const { departmentId, department, projectId } = req.query;
    const deptFilter = departmentId || department;

    if (!deptFilter) {
      return res
        .status(400)
        .json({ error: "departmentId or department name required" });
    }

    // =====================================================
    // STEP 0: Normalize department → department_id
    // =====================================================
    let departmentIdResolved;

    if (isNaN(Number(deptFilter))) {
      const deptRes = await pool.query(
        `SELECT id FROM departments WHERE name ILIKE $1`,
        [deptFilter],
      );

      if (!deptRes.rows.length) {
        return res.status(400).json({ error: "Invalid department" });
      }

      departmentIdResolved = deptRes.rows[0].id;
    } else {
      departmentIdResolved = Number(deptFilter);
    }

    // Resolve COMMON department ID (if exists)
    const commonDeptRes = await pool.query(
      `SELECT id FROM departments WHERE name = 'COMMON' LIMIT 1`,
    );
    const commonDeptId =
      commonDeptRes.rows.length > 0 ? commonDeptRes.rows[0].id : null;

    console.log(
      "🔍 Fetching tasks for departmentId:",
      departmentIdResolved,
      "projectId:",
      projectId,
    );

    // =====================================================
    // STEP 1: Determine project type
    // =====================================================
    let projectType = null;
    let isDefaultProject = false;

    if (projectId) {
      const projectResult = await pool.query(
        `SELECT project_name, zoho_crm_code 
         FROM project_master 
         WHERE project_id = $1`,
        [projectId],
      );

      if (projectResult.rows.length > 0) {
        const { project_name, zoho_crm_code } = projectResult.rows[0];

        if (zoho_crm_code === "AIS-INTERNAL-PROJECT") {
          isDefaultProject = true;
        } else {
          projectType = extractProjectType(project_name);
          console.log(
            `📋 Detected project type "${projectType}" from "${project_name}"`,
          );
        }
      }
    }

    // =====================================================
    // STEP 2: Build query
    // =====================================================
    let query;
    let params;

    // ---------------------------------------------
    // DEFAULT PROJECT (AIS Internal Billing)
    // → user department + COMMON
    // ---------------------------------------------
    if (isDefaultProject) {
      query = `
        SELECT 
          tm.task_id,
          tm.task,
          tm.task AS task_name,
          tm.internal_project,
          d.name AS department_name,
          d.id AS department_id
        FROM task_master tm
        JOIN departments d ON tm.department = d.id
        WHERE (
          d.id = $1
          ${commonDeptId ? "OR d.id = $2" : ""}
        )
          AND tm.internal_project ILIKE 'AIS Internal Billing'
          AND tm.is_active = TRUE
        ORDER BY 
          CASE WHEN d.id = $2 THEN 1 ELSE 0 END,
          tm.task ASC
      `;

      params = commonDeptId
        ? [departmentIdResolved, commonDeptId]
        : [departmentIdResolved];
    }

    // ---------------------------------------------
    // AMS / Implementation / Turnkey
    // → user department ONLY
    // ---------------------------------------------
    else if (projectType) {
      query = `
        SELECT 
          tm.task_id,
          tm.task,
          tm.task AS task_name,
          tm.internal_project,
          d.name AS department_name,
          d.id AS department_id
        FROM task_master tm
        JOIN departments d ON tm.department = d.id
        WHERE d.id = $1
          AND tm.internal_project ILIKE $2
          AND tm.is_active = TRUE
        ORDER BY tm.task ASC
      `;
      params = [departmentIdResolved, projectType];
    }

    // ---------------------------------------------
    // FALLBACK (no project selected)
    // → user department ONLY
    // ---------------------------------------------
    else {
      query = `
        SELECT 
          tm.task_id,
          tm.task,
          tm.task AS task_name,
          tm.internal_project,
          d.name AS department_name,
          d.id AS department_id
        FROM task_master tm
        JOIN departments d ON tm.department = d.id
        WHERE d.id = $1
          AND tm.is_active = TRUE
        ORDER BY tm.internal_project ASC, tm.task ASC
      `;
      params = [departmentIdResolved];
    }

    // =====================================================
    // STEP 3: Execute
    // =====================================================
    const result = await pool.query(query, params);

    console.log(
      `✅ Found ${result.rows.length} tasks` +
        (isDefaultProject ? " (AIS Internal Billing)" : "") +
        (projectType ? ` (${projectType})` : ""),
    );

    res.json({
      tasks: result.rows,
      count: result.rows.length,
      isDefaultProject,
      projectType,
    });
  } catch (err) {
    console.error("❌ getTasksByDepartmentAndProject error:", err);
    res.status(500).json({
      error: "Failed to fetch tasks",
      details: err.message,
    });
  }
};

// ===============================================
// ✅ HELPER: Extract project type from project name
// ===============================================
function extractProjectType(projectName) {
  if (!projectName) return null;

  const name = projectName.toUpperCase();

  // ✅ Map project name patterns to internal_project values in task_master
  // Priority order matters - check more specific patterns first

  if (name.includes("AMS") || name.startsWith("AMS_")) {
    return "AMS Support";
  }

  if (name.includes("IMPLEMENTATION") || name.startsWith("IMPLEMENTATION_")) {
    return "Implementation";
  }

  if (name.includes("TURNKEY") || name.startsWith("TURNKEY_")) {
    return "Turnkey Project";
  }

  // ✅ Add more mappings as needed based on your project naming conventions
  // Examples:
  // if (name.includes('SUPPORT')) return 'Support';
  // if (name.includes('MAINTENANCE')) return 'Maintenance';

  // ✅ Default: Try to extract first word before underscore or space
  const parts = projectName.split(/[_\s-]/);
  if (parts.length > 0) {
    const firstPart = parts[0].trim();

    // Check if it matches any known internal_project pattern
    const knownTypes = [
      "AMS Support",
      "Implementation",
      "Turnkey Project",
      "AIS Internal Billing",
    ];

    // Try to find a match
    for (const type of knownTypes) {
      if (type.toLowerCase().includes(firstPart.toLowerCase())) {
        return type;
      }
    }
  }

  // ✅ No match found - return null to show all department tasks
  return null;
}


// ===============================================
// LEGACY: GET TASKS BY DEPARTMENT (For backwards compatibility)
// ===============================================
export const getTasksByDepartment = async (req, res) => {
  try {
    const { departmentId, department } = req.query;
    const deptFilter = departmentId || department;

    if (!deptFilter) {
      return res
        .status(400)
        .json({ error: "departmentId or department name required" });
    }

    console.log("🔍 Fetching tasks for department:", deptFilter);

    const query = `
      SELECT 
        tm.task_id,
        tm.task,
        tm.task as task_name,
        tm.internal_project,
        d.name as department_name,
        d.id as department_id
      FROM task_master tm
      JOIN departments d ON tm.department = d.id
      WHERE (d.name ILIKE $1 OR d.id::text = $1)
        AND tm.is_active = TRUE
      ORDER BY tm.internal_project ASC, tm.task ASC
    `;

    const result = await pool.query(query, [deptFilter]);

    console.log(
      `✅ Found ${result.rows.length} tasks for department: ${deptFilter}`,
    );

    res.json({
      tasks: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    console.error("❌ getTasksByDepartment error:", err);
    res.status(500).json({
      error: "Failed to fetch tasks",
      details: err.message,
    });
  }
};

// ===============================================
// GET ALL TASKS (For Admin Management)
// ===============================================
export const getAllTasks = async (req, res) => {
  try {
    const query = `
      SELECT 
        tm.task_id,
        tm.task as task_name,
        tm.task,
        d.name as department,
        d.id as department_id,
        tm.internal_project,
        tm.is_active
      FROM task_master tm
      JOIN departments d ON tm.department = d.id
      ORDER BY d.name ASC, tm.internal_project ASC, tm.task ASC
    `;

    const result = await pool.query(query);

    res.json({
      tasks: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Get all tasks error:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
};

// ===============================================
// CREATE TASK
// ===============================================
export const createTask = async (req, res) => {
  const { department, internalProject, task } = req.body;

  // ✅ UPDATED: All 3 fields are now mandatory
  if (!department || !department.trim()) {
    return res.status(400).json({ error: "Department is required" });
  }
  if (!internalProject || !internalProject.trim()) {
    return res.status(400).json({ error: "Internal Project is required" });
  }
  if (!task || !task.trim()) {
    return res.status(400).json({ error: "Task Name is required" });
  }

  try {
    // Department can be either ID (number) or name (string)
    let deptId;

    if (isNaN(Number(department))) {
      // It's a name - check if exists, if not create new
      const deptResult = await pool.query(
        `SELECT id FROM departments WHERE name ILIKE $1`,
        [department.trim()]
      );

      if (deptResult.rows.length === 0) {
        // ✅ NEW: Create new department if it doesn't exist
        const newDept = await pool.query(
          `INSERT INTO departments (name) VALUES ($1) RETURNING id`,
          [department.trim()]
        );
        deptId = newDept.rows[0].id;
        console.log(`✅ Created new department: ${department.trim()}`);
      } else {
        deptId = deptResult.rows[0].id;
      }
    } else {
      // It's already an ID
      deptId = Number(department);
    }

    const query = `
      INSERT INTO task_master (department, internal_project, task, is_active)
      VALUES ($1, $2, $3, TRUE)
      RETURNING *
    `;

    const result = await pool.query(query, [
      deptId,
      internalProject.trim(), // ✅ Now mandatory, not NULL
      task.trim(),
    ]);

    console.log(`✅ Task created: ${task.trim()}`);

    res.status(201).json({
      message: "Task created successfully",
      task: result.rows[0],
    });
  } catch (error) {
    console.error("Create task error:", error);
    if (error.code === "23505") {
      return res.status(400).json({
        error: "Task already exists for this department/project",
      });
    }
    res.status(500).json({ error: "Failed to create task" });
  }
};

// ===============================================
// UPDATE TASK
// ===============================================
export const updateTask = async (req, res) => {
  const { id } = req.params;
  const { department, internalProject, task } = req.body;

  // ✅ UPDATED: All 3 fields are now mandatory
  if (!department || !department.trim()) {
    return res.status(400).json({ error: "Department is required" });
  }
  if (!internalProject || !internalProject.trim()) {
    return res.status(400).json({ error: "Internal Project is required" });
  }
  if (!task || !task.trim()) {
    return res.status(400).json({ error: "Task Name is required" });
  }

  try {
    // Department can be either ID (number) or name (string)
    let deptId;

    if (isNaN(Number(department))) {
      // It's a name, look up the ID
      const deptResult = await pool.query(
        `SELECT id FROM departments WHERE name ILIKE $1`,
        [department.trim()]
      );

      if (deptResult.rows.length === 0) {
        return res.status(400).json({ error: "Invalid department name" });
      }

      deptId = deptResult.rows[0].id;
    } else {
      // It's already an ID
      deptId = Number(department);
    }

    const query = `
      UPDATE task_master
      SET 
        department = $1,
        internal_project = $2,
        task = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE task_id = $4
      RETURNING *
    `;

    const result = await pool.query(query, [
      deptId,
      internalProject.trim(), // ✅ Now mandatory, not NULL
      task.trim(),
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    console.log(`✅ Task updated: ${task.trim()}`);

    res.json({
      message: "Task updated successfully",
      task: result.rows[0],
    });
  } catch (error) {
    console.error("Update task error:", error);
    if (error.code === "23505") {
      return res.status(400).json({
        error: "Duplicate task for this department/project",
      });
    }
    res.status(500).json({ error: "Failed to update task" });
  }
};

// ===============================================
// DELETE TASK
// ===============================================
export const deleteTask = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM task_master WHERE task_id = $1 RETURNING task_id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    console.log(`✅ Task deleted: ${id}`);

    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Delete task error:", error);
    if (error.code === "23503") {
      return res.status(400).json({
        error:
          "Cannot delete task because it has associated timesheet entries.",
      });
    }
    res.status(500).json({ error: "Failed to delete task" });
  }
};

// ===============================================
// ✅ NEW: REACTIVATE TASK
// PATCH /api/tasks/:id/reactivate
// ===============================================
export const reactivateTask = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if task exists
    const existingTask = await pool.query(
      "SELECT task_id, task, is_active FROM task_master WHERE task_id = $1",
      [id]
    );

    if (existingTask.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const task = existingTask.rows[0];

    // Check if already active
    if (task.is_active) {
      return res.status(400).json({
        error: "Task is already active",
        task: task,
      });
    }

    // Reactivate the task
    const result = await pool.query(
      `UPDATE task_master 
       SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP 
       WHERE task_id = $1 
       RETURNING 
         task_id,
         task,
         department,
         internal_project,
         is_active`,
      [id]
    );

    console.log(`✅ Task reactivated: ${task.task} (${id})`);

    res.json({
      message: "Task reactivated successfully",
      task: result.rows[0],
    });
  } catch (error) {
    console.error("❌ Reactivate task error:", error);
    res.status(500).json({
      error: "Failed to reactivate task",
      details: error.message,
    });
  }
};

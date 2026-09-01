DB Schemas
-- ============================================
-- Employees table
-- ============================================

CREATE TYPE user_role AS ENUM ('ADMIN', 'MANAGER', 'EMPLOYEE');

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL,
    department VARCHAR(100),
    designation VARCHAR(100),
    reporting_manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    doj DATE,
    is_active BOOLEAN DEFAULT TRUE,
    refresh_token TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
--------------------------------------------------------------------------------------------
-- Indexes for employees table
CREATE INDEX idx_employees_role ON employees(role) WHERE is_active = TRUE;
CREATE INDEX idx_employees_department ON employees(department) WHERE is_active = TRUE;
CREATE INDEX idx_employees_reporting_manager ON employees(reporting_manager_id) WHERE is_active = TRUE;
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_active ON employees(is_active);

-- Trigger for employees
CREATE TRIGGER trigger_update_employees_timestamp
BEFORE UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

---------------------------------------------------------------------------------------
INSERT INTO employees (employee_id, first_name, last_name, email, password_hash, role, department, designation, doj, is_active)
VALUES ('EMP001', 'System', 'Admin', 'admin@example.com', 'System@123', 'ADMIN', 'Administration', 'System Administrator', '2024-01-01', TRUE);

WITH admin AS (SELECT id FROM employees WHERE employee_id = 'EMP001'),
managers AS (
  INSERT INTO employees (employee_id, first_name, last_name, email, password_hash, role, department, designation, reporting_manager_id, doj, is_active)
  VALUES
    ('EMP002', 'John', 'Doe', 'john@example.com', 'John@123', 'MANAGER', 'Engineering', 'Engineering Manager', (SELECT id FROM admin), '2024-02-01', TRUE),
    ('EMP003', 'Sarah', 'Lee', 'sarah@example.com', 'Sarah@123', 'MANAGER', 'Product', 'Product Manager', (SELECT id FROM admin), '2024-02-01', TRUE)
  RETURNING id, employee_id
)
INSERT INTO employees (employee_id, first_name, last_name, email, password_hash, role, department, designation, reporting_manager_id, doj, is_active)
VALUES
  ('EMP004', 'Alice', 'Smith', 'alice@example.com', 'Alice@123', 'EMPLOYEE', 'Engineering', 'Software Developer', (SELECT id FROM managers WHERE employee_id = 'EMP002'), '2024-03-01', TRUE),
  ('EMP005', 'Bob', 'Brown', 'bob@example.com', 'Bob@123', 'EMPLOYEE', 'Engineering', 'Software Developer', (SELECT id FROM managers WHERE employee_id = 'EMP002'), '2024-03-01', TRUE),
  ('EMP006', 'Charlie', 'Davis', 'charlie@example.com', 'Charlie@123', 'EMPLOYEE', 'Engineering', 'Backend Developer', (SELECT id FROM managers WHERE employee_id = 'EMP002'), '2024-03-01', TRUE),
  ('EMP007', 'Diana', 'Williams', 'diana@example.com', 'Diana@123', 'EMPLOYEE', 'Engineering', 'Frontend Developer', (SELECT id FROM managers WHERE employee_id = 'EMP002'), '2024-03-01', TRUE),
  ('EMP008', 'Evan', 'Taylor', 'evan@example.com', 'Evan@123', 'EMPLOYEE', 'Engineering', 'QA Engineer', (SELECT id FROM managers WHERE employee_id = 'EMP002'), '2024-03-01', TRUE),
  ('EMP009', 'Fiona', 'Clark', 'fiona@example.com', 'Fiona@123', 'EMPLOYEE', 'Product', 'Product Analyst', (SELECT id FROM managers WHERE employee_id = 'EMP003'), '2024-03-01', TRUE),
  ('EMP010', 'George', 'Hall', 'george@example.com', 'George@123', 'EMPLOYEE', 'Product', 'UI/UX Designer', (SELECT id FROM managers WHERE employee_id = 'EMP003'), '2024-03-01', TRUE),
  ('EMP011', 'Hannah', 'Moore', 'hannah@example.com', 'Hannah@123', 'EMPLOYEE', 'Product', 'Business Analyst', (SELECT id FROM managers WHERE employee_id = 'EMP003'), '2024-03-01', TRUE),
  ('EMP012', 'Ian', 'Wright', 'ian@example.com', 'Ian@123', 'EMPLOYEE', 'Product', 'Scrum Associate', (SELECT id FROM managers WHERE employee_id = 'EMP003'), '2024-03-01', TRUE),
  ('EMP013', 'Julia', 'Adams', 'julia@example.com', 'Julia@123', 'EMPLOYEE', 'Product', 'Content Strategist', (SELECT id FROM managers WHERE employee_id = 'EMP003'), '2024-03-01', TRUE);
-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
-- 2.2: CLIENT_MASTER TABLE
CREATE TABLE client_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name VARCHAR(150) UNIQUE NOT NULL,
    client_code VARCHAR(50) UNIQUE NOT NULL,
    alias VARCHAR(100),
    client_spoc_first_name VARCHAR(50),
    client_spoc_last_name VARCHAR(50),
    client_spoc_phone VARCHAR(50),
    client_spoc_email VARCHAR(255),
    url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for client_master table
CREATE INDEX idx_client_master_code ON client_master(client_code);
CREATE INDEX idx_client_master_active ON client_master(is_active);
CREATE INDEX idx_client_master_name ON client_master(client_name);

-- Trigger for client_master
CREATE TRIGGER trigger_update_client_master_timestamp
BEFORE UPDATE ON client_master
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-----------------------------------------------------------------------------------------------------------
INSERT INTO client_master (client_name, client_code, alias, client_spoc_first_name, client_spoc_last_name, client_spoc_phone, client_spoc_email, url, is_active)
VALUES
  ('Innovatech Solutions', 'INNO-001', 'Innovatech', 'Alice', 'Johnson', '+1-202-555-0101', 'alice.j@innovatech.com', 'https://www.innovatech.com', TRUE),
  ('Quantum Dynamics', 'QUAN-002', 'Quantum', 'Bob', 'Williams', '+44 20 7946 0102', 'bob.w@quantumdynamics.io', 'https://www.quantumdynamics.io', TRUE),
  ('Apex Industries', 'APEX-003', 'Apex', 'Charlie', 'Brown', '+61 2 9268 0103', 'charlie.b@apexindustries.net', 'https://www.apexindustries.net', TRUE),
  ('Stellar Services', 'STLR-004', 'Stellar', 'Diana', 'Miller', '+49 30 123456-0104', 'diana.m@stellarserv.com', 'https://www.stellarserv.com', TRUE),
  ('Fusion Forward', 'FUSN-005', 'Fusion', 'Edward', 'Davis', '+81 3-1234-0105', 'ed.d@fusionforward.co', 'https://www.fusionforward.co', TRUE),
  ('Evergreen Logistics', 'EVRG-006', 'Evergreen', 'Fiona', 'Garcia', '+33 1 86 65 01 06', 'fiona.g@evergreenlog.com', 'https://www.evergreenlog.com', TRUE),
  ('BlueRidge Analytics', 'BLRD-007', 'BlueRidge', 'George', 'Rodriguez', '+91 22 6601 0107', 'george.r@blueridge.ai', 'https://www.blueridge.ai', TRUE),
  ('Pinnacle Group', 'PINN-008', 'Pinnacle', 'Hannah', 'Wilson', '+27 11 506 0108', 'hannah.w@pinnaclegroup.org', 'https://www.pinnaclegroup.org', TRUE),
  ('SilverLining Tech', 'SLVR-009', 'SilverLining', 'Ian', 'Martinez', '+86 10 8532 0109', 'ian.m@silverlining.tech', 'https://www.silverlining.tech', TRUE),
  ('Nexus Enterprises', 'NEXS-010', 'Nexus', 'Jane', 'Anderson', '+55 11 4302-0110', 'jane.a@nexus-ent.com', 'https://www.nexus-ent.com', FALSE);

-----------------------------------------------------------------------------------------------------------
-- 2.3: PROJECT_MASTER TABLE
CREATE TYPE project_status AS ENUM ('Planned', 'In Progress', 'Completed', 'On Hold', 'Cancelled');
CREATE TABLE project_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES client_master(id) ON DELETE RESTRICT,
    project_name VARCHAR(150) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    approved_days INT,
    estimated_days INT,
    status project_status NOT NULL DEFAULT 'Planned',
    spoc_name VARCHAR(100),
    spoc_email VARCHAR(255),
    spoc_phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT project_dates_check CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);
-- Indexes for project_master table
CREATE INDEX idx_project_master_client ON project_master(client_id) WHERE is_active = TRUE;
CREATE INDEX idx_project_master_status ON project_master(status) WHERE is_active = TRUE;
CREATE INDEX idx_project_master_dates ON project_master(start_date, end_date);
CREATE INDEX idx_project_master_active ON project_master(is_active);

-- Trigger for project_master
CREATE TRIGGER trigger_update_project_master_timestamp
BEFORE UPDATE ON project_master
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
-------------------------------------------------------------------------------------------------------

-- 2.4: ACTIVITY_MASTER TABLE
CREATE TYPE activity_status AS ENUM ('Planned', 'In Progress', 'Completed', 'On Hold', 'Cancelled');
CREATE TABLE activity_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES project_master(id) ON DELETE RESTRICT,
    activity_name VARCHAR(100) NOT NULL,
    description TEXT,
    status activity_status NOT NULL DEFAULT 'Planned',
    start_dt DATE,
    end_dt DATE,
    estimated_dt DATE,
    created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT activity_dates_check CHECK (start_dt IS NULL OR end_dt IS NULL OR start_dt <= end_dt)
);
-- Indexes for activity_master table
CREATE INDEX idx_activity_master_project ON activity_master(project_id) WHERE is_active = TRUE;
CREATE INDEX idx_activity_master_creator ON activity_master(created_by);
CREATE INDEX idx_activity_master_status ON activity_master(status) WHERE is_active = TRUE;
CREATE INDEX idx_activity_master_dates ON activity_master(start_dt, end_dt);
CREATE INDEX idx_activity_master_active ON activity_master(is_active);

-- Trigger for activity_master
CREATE TRIGGER trigger_update_activity_master_timestamp
BEFORE UPDATE ON activity_master
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
--------------------------------------------------------------------------------------------------

DROP TABLE IF EXISTS activity_assignments CASCADE;
DROP TABLE IF EXISTS activity_manager_scope CASCADE;
DROP TABLE IF EXISTS project_assignments CASCADE;


-- =================================================================
-- TABLE 1: PROJECT_ASSIGNMENTS
-- Purpose: Admin assigns projects to managers
-- =================================================================
CREATE TABLE project_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES project_master(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    assignment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    assignment_end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_project_manager UNIQUE(project_id, manager_id)
);

CREATE INDEX idx_project_assignments_manager ON project_assignments(manager_id) WHERE is_active = TRUE;
CREATE INDEX idx_project_assignments_project ON project_assignments(project_id) WHERE is_active = TRUE;
CREATE INDEX idx_project_assignments_active ON project_assignments(is_active);

COMMENT ON TABLE project_assignments IS 'Admin assigns projects to managers - one project can have multiple managers';


-- =================================================================
-- TABLE 2: ACTIVITY_MANAGER_SCOPE
-- Purpose: Admin assigns specific activities to managers within projects
-- =================================================================
CREATE TABLE activity_manager_scope (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES activity_master(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES project_master(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_activity_manager UNIQUE(activity_id, manager_id)
);

CREATE INDEX idx_activity_manager_scope_activity ON activity_manager_scope(activity_id) WHERE is_active = TRUE;
CREATE INDEX idx_activity_manager_scope_manager ON activity_manager_scope(manager_id) WHERE is_active = TRUE;
CREATE INDEX idx_activity_manager_scope_project ON activity_manager_scope(project_id) WHERE is_active = TRUE;
CREATE INDEX idx_activity_manager_scope_composite ON activity_manager_scope(manager_id, activity_id) WHERE is_active = TRUE;

COMMENT ON TABLE activity_manager_scope IS 'Admin assigns specific activities to managers - enables activity-level access control';


-- =================================================================
-- TABLE 3: ACTIVITY_ASSIGNMENTS
-- Purpose: Manager assigns activities to employees
-- =================================================================
CREATE TABLE activity_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES activity_master(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES project_master(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES client_master(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    assign_date DATE NOT NULL DEFAULT CURRENT_DATE,
    assign_end_date DATE,
    total_allocated_hours NUMERIC(6,2) CHECK (total_allocated_hours >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_activity_employee UNIQUE(activity_id, employee_id)
);

CREATE INDEX idx_activity_assignments_employee ON activity_assignments(employee_id) WHERE is_active = TRUE;
CREATE INDEX idx_activity_assignments_activity ON activity_assignments(activity_id) WHERE is_active = TRUE;
CREATE INDEX idx_activity_assignments_project ON activity_assignments(project_id) WHERE is_active = TRUE;
CREATE INDEX idx_activity_assignments_assigned_by ON activity_assignments(assigned_by);

COMMENT ON TABLE activity_assignments IS 'Manager assigns activities to employees - one activity can be assigned to multiple employees';


-- =================================================================
-- ATTACH UPDATE TIMESTAMP TRIGGERS
-- =================================================================
CREATE TRIGGER trigger_update_project_assignments_timestamp
BEFORE UPDATE ON project_assignments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_activity_manager_scope_timestamp
BEFORE UPDATE ON activity_manager_scope
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_activity_assignments_timestamp
BEFORE UPDATE ON activity_assignments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
-------------------------------------------------------------------------------------------------------
-- =================================================================
-- DROP EXISTING OBJECTS
-- =================================================================
DROP TABLE IF EXISTS timesheet_entry CASCADE;


-- =================================================================
-- CREATE TIMESHEET_ENTRY TABLE (UUID-Compatible)
-- =================================================================
CREATE TABLE timesheet_entry (
    -- Primary key (changed from SERIAL to UUID for consistency)
    entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Employee & Manager info (changed to UUID, with denormalized names for history)
    employee_id UUID NOT NULL,
    employee_name VARCHAR(255),
    manager_id UUID,
    manager_name VARCHAR(255),
    department VARCHAR(100),
    designation VARCHAR(100),
    
    -- Date tracking (week dates auto-calculated by trigger)
    entry_date DATE NOT NULL,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    
    -- Project/Activity/Client info (changed to UUID, IDs + denormalized names)
    project_id UUID NOT NULL,
    project_name VARCHAR(255),
    client_id UUID,
    client_name VARCHAR(255),
    activity_id UUID NOT NULL,
    activity_name VARCHAR(255),
    activity_assign_id UUID,
    
    -- Entry details
    ticket_number VARCHAR(50),
    hours_logged NUMERIC(5,2) CHECK (hours_logged >= 0) NOT NULL,
    description TEXT,
    
    -- Status workflow
    status VARCHAR(20) CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Rejected')) DEFAULT 'Draft',
    
    -- Submission tracking
    submitted_at TIMESTAMPTZ,
    
    -- Approval tracking
    approved_at TIMESTAMPTZ,
    approved_by UUID,
    approved_by_name VARCHAR(255),
    
    -- Rejection tracking
    rejected_at TIMESTAMPTZ,
    rejected_by UUID,
    rejected_by_name VARCHAR(255),
    rejection_reason TEXT,
    
    -- Soft delete (history preservation)
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    delete_reason VARCHAR(255),
    
    -- Archival (for old approved entries)
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys (SET NULL to preserve history when master data changes)
    CONSTRAINT fk_employee FOREIGN KEY (employee_id) 
        REFERENCES employees(id) ON DELETE SET NULL,
    CONSTRAINT fk_manager FOREIGN KEY (manager_id) 
        REFERENCES employees(id) ON DELETE SET NULL,
    CONSTRAINT fk_project FOREIGN KEY (project_id) 
        REFERENCES project_master(id) ON DELETE SET NULL,
    CONSTRAINT fk_client FOREIGN KEY (client_id) 
        REFERENCES client_master(id) ON DELETE SET NULL,
    CONSTRAINT fk_activity FOREIGN KEY (activity_id) 
        REFERENCES activity_master(id) ON DELETE SET NULL,
    CONSTRAINT fk_activity_assign FOREIGN KEY (activity_assign_id) 
        REFERENCES activity_assignments(id) ON DELETE SET NULL,
    CONSTRAINT fk_approved_by FOREIGN KEY (approved_by) 
        REFERENCES employees(id) ON DELETE SET NULL,
    CONSTRAINT fk_rejected_by FOREIGN KEY (rejected_by) 
        REFERENCES employees(id) ON DELETE SET NULL
);


-- =================================================================
-- CREATE INDEXES
-- =================================================================

-- Index for active entries queries
CREATE INDEX idx_timesheet_entry_employee 
ON timesheet_entry(employee_id) 
WHERE is_deleted = FALSE;

CREATE INDEX idx_timesheet_entry_date 
ON timesheet_entry(entry_date) 
WHERE is_deleted = FALSE;

CREATE INDEX idx_timesheet_entry_week 
ON timesheet_entry(employee_id, week_start_date, week_end_date) 
WHERE is_deleted = FALSE;

CREATE INDEX idx_timesheet_entry_status 
ON timesheet_entry(status) 
WHERE is_deleted = FALSE;

-- Index for history/deleted queries
CREATE INDEX idx_timesheet_entry_deleted 
ON timesheet_entry(is_deleted);

CREATE INDEX idx_timesheet_entry_archived 
ON timesheet_entry(is_archived);

-- Index for manager queries
CREATE INDEX idx_timesheet_entry_manager 
ON timesheet_entry(manager_id, status) 
WHERE is_deleted = FALSE;

-- Index for project/activity filtering
CREATE INDEX idx_timesheet_entry_project 
ON timesheet_entry(project_id) 
WHERE is_deleted = FALSE;

CREATE INDEX idx_timesheet_entry_activity 
ON timesheet_entry(activity_id) 
WHERE is_deleted = FALSE;


-- =================================================================
-- CREATE UNIQUE CONSTRAINT
-- =================================================================
-- Only allow one active entry per employee/project/activity/date
CREATE UNIQUE INDEX unique_entry_per_day
ON timesheet_entry(employee_id, project_id, activity_id, entry_date)
WHERE is_deleted = FALSE;


-- =================================================================
-- CREATE TRIGGER FUNCTIONS
-- =================================================================

-- Auto-update updated_at on every update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$function$;


-- Auto-calculate week_start_date and week_end_date (Sunday-Saturday)
CREATE OR REPLACE FUNCTION set_week_dates()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Sunday = start of week
    NEW.week_start_date := DATE_TRUNC('week', NEW.entry_date)::DATE;
    NEW.week_end_date := (DATE_TRUNC('week', NEW.entry_date) + INTERVAL '6 days')::DATE;
    RETURN NEW;
END;
$function$;


-- Auto-denormalize names from master tables (CORRECTED FOR UUID)
CREATE OR REPLACE FUNCTION denormalize_entry_names()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Get employee name, department, and designation
    IF NEW.employee_id IS NOT NULL AND NEW.employee_name IS NULL THEN
        SELECT 
            first_name || ' ' || last_name,
            department,
            designation,
            reporting_manager_id
        INTO 
            NEW.employee_name, 
            NEW.department,
            NEW.designation,
            NEW.manager_id
        FROM employees 
        WHERE id = NEW.employee_id;  -- Changed from employee_id to id
    END IF;
    
    -- Get manager name
    IF NEW.manager_id IS NOT NULL AND NEW.manager_name IS NULL THEN
        SELECT first_name || ' ' || last_name 
        INTO NEW.manager_name
        FROM employees 
        WHERE id = NEW.manager_id;  -- Changed from employee_id to id
    END IF;
    
    -- Get project name and client_id
    IF NEW.project_id IS NOT NULL AND NEW.project_name IS NULL THEN
        SELECT project_name, client_id
        INTO NEW.project_name, NEW.client_id
        FROM project_master 
        WHERE id = NEW.project_id;  -- Changed from project_id to id
    END IF;
    
    -- Get client name
    IF NEW.client_id IS NOT NULL AND NEW.client_name IS NULL THEN
        SELECT client_name 
        INTO NEW.client_name
        FROM client_master 
        WHERE id = NEW.client_id;  -- Changed from client_id to id
    END IF;
    
    -- Get activity name
    IF NEW.activity_id IS NOT NULL AND NEW.activity_name IS NULL THEN
        SELECT activity_name 
        INTO NEW.activity_name
        FROM activity_master 
        WHERE id = NEW.activity_id;  -- Changed from activity_id to id
    END IF;
    
    -- Get approved_by name
    IF NEW.approved_by IS NOT NULL AND NEW.approved_by_name IS NULL THEN
        SELECT first_name || ' ' || last_name 
        INTO NEW.approved_by_name
        FROM employees 
        WHERE id = NEW.approved_by;  -- Changed from employee_id to id
    END IF;
    
    -- Get rejected_by name
    IF NEW.rejected_by IS NOT NULL AND NEW.rejected_by_name IS NULL THEN
        SELECT first_name || ' ' || last_name 
        INTO NEW.rejected_by_name
        FROM employees 
        WHERE id = NEW.rejected_by;  -- Changed from employee_id to id
    END IF;
    
    RETURN NEW;
END;
$function$;


-- =================================================================
-- ATTACH TRIGGERS
-- =================================================================

CREATE TRIGGER trigger_update_timestamp
BEFORE UPDATE ON timesheet_entry
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_set_week_dates
BEFORE INSERT OR UPDATE ON timesheet_entry
FOR EACH ROW
WHEN (NEW.entry_date IS NOT NULL)
EXECUTE FUNCTION set_week_dates();

CREATE TRIGGER trigger_denormalize_names
BEFORE INSERT OR UPDATE ON timesheet_entry
FOR EACH ROW
EXECUTE FUNCTION denormalize_entry_names();


-- =================================================================
-- CREATE VIEWS
-- =================================================================

-- View for current/active entries only
CREATE OR REPLACE VIEW v_active_timesheet_entries AS
SELECT * FROM timesheet_entry
WHERE is_deleted = FALSE 
  AND is_archived = FALSE
  AND status IN ('Draft', 'Submitted', 'Rejected');


-- View for approved/historical entries
CREATE OR REPLACE VIEW v_timesheet_history AS
SELECT * FROM timesheet_entry
WHERE status = 'Approved' 
   OR is_deleted = TRUE 
   OR is_archived = TRUE;


-- View for manager's team entries pending approval (CORRECTED FOR UUID)
CREATE OR REPLACE VIEW v_pending_approvals AS
SELECT 
    te.*,
    e.first_name || ' ' || e.last_name as current_employee_name
FROM timesheet_entry te
LEFT JOIN employees e ON te.employee_id = e.id  -- Changed from employee_id to id
WHERE te.status = 'Submitted'
  AND te.is_deleted = FALSE
ORDER BY te.week_start_date DESC, te.employee_id, te.entry_date;


-- View for weekly summary by employee
CREATE OR REPLACE VIEW v_weekly_summary AS
SELECT 
    employee_id,
    employee_name,
    manager_id,
    manager_name,
    week_start_date,
    week_end_date,
    status,
    COUNT(*) as total_entries,
    SUM(hours_logged) as total_hours,
    COUNT(DISTINCT project_id) as projects_count,
    MIN(submitted_at) as submitted_date,
    MIN(approved_at) as approved_date,
    MIN(rejected_at) as rejected_date,
    MAX(rejected_by_name) as rejected_by_name
FROM timesheet_entry
WHERE is_deleted = FALSE
GROUP BY 
    employee_id, employee_name, manager_id, manager_name,
    week_start_date, week_end_date, status
ORDER BY week_start_date DESC, employee_id;


-- =================================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- =================================================================

COMMENT ON TABLE timesheet_entry IS 'Unified timesheet entry table with history preservation, soft deletes, and automatic denormalization';
COMMENT ON COLUMN timesheet_entry.employee_name IS 'Denormalized from employees table for history preservation';
COMMENT ON COLUMN timesheet_entry.week_start_date IS 'Auto-calculated by trigger based on entry_date (Sunday)';
COMMENT ON COLUMN timesheet_entry.is_deleted IS 'Soft delete flag - never physically delete entries';
COMMENT ON COLUMN timesheet_entry.status IS 'Draft: Editable, Submitted: Pending approval, Approved: Locked, Rejected: Needs correction';
COMMENT ON COLUMN timesheet_entry.rejected_at IS 'Timestamp when entry was rejected by manager';
COMMENT ON COLUMN timesheet_entry.rejected_by IS 'UUID of manager who rejected the entry';
COMMENT ON COLUMN timesheet_entry.rejected_by_name IS 'Denormalized name of manager who rejected (for history preservation)';

-- =================================================================
-- DROP EXISTING OBJECTS
-- =================================================================
DROP TABLE IF EXISTS employee_policy CASCADE;


-- =================================================================
-- CREATE EMPLOYEE_POLICY TABLE (UUID-Compatible)
-- Purpose: Store timesheet rules and working hour policies per employee
-- =================================================================
CREATE TABLE employee_policy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Working hours configuration
    working_hours_per_day NUMERIC(4,2) NOT NULL DEFAULT 8.00 CHECK (working_hours_per_day > 0),
    
    -- Weekend working configuration
    saturday_working BOOLEAN DEFAULT FALSE,
    sunday_working BOOLEAN DEFAULT FALSE,
    
    -- Timesheet entry rules
    allow_future_entries BOOLEAN DEFAULT FALSE,
    
    -- Soft delete
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT unique_employee_policy UNIQUE (employee_id)
);


-- =================================================================
-- CREATE INDEXES
-- =================================================================
CREATE INDEX idx_employee_policy_employee ON employee_policy(employee_id) WHERE is_active = TRUE;
CREATE INDEX idx_employee_policy_active ON employee_policy(is_active);


-- =================================================================
-- ATTACH TRIGGER FOR AUTO-UPDATE TIMESTAMP
-- =================================================================
CREATE TRIGGER trigger_update_employee_policy_timestamp
BEFORE UPDATE ON employee_policy
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- =================================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- =================================================================
COMMENT ON TABLE employee_policy IS 'Stores per-employee timesheet policies: working hours, weekend rules, entry restrictions';
COMMENT ON COLUMN employee_policy.working_hours_per_day IS 'Expected daily working hours for this employee (e.g., 8.00, 6.00)';
COMMENT ON COLUMN employee_policy.saturday_working IS 'Whether this employee is allowed to work on Saturdays';
COMMENT ON COLUMN employee_policy.sunday_working IS 'Whether this employee is allowed to work on Sundays';
COMMENT ON COLUMN employee_policy.allow_future_entries IS 'Whether this employee can log timesheets for future dates';
COMMENT ON COLUMN employee_policy.is_active IS 'Soft delete flag - allows policy history tracking';


-- =================================================================
-- CREATE VIEW FOR ACTIVE POLICIES
-- =================================================================
CREATE OR REPLACE VIEW v_active_employee_policies AS
SELECT 
    ep.*,
    e.employee_id as employee_code,
    e.first_name || ' ' || e.last_name as employee_name,
    e.department,
    e.designation,
    e.role
FROM employee_policy ep
JOIN employees e ON ep.employee_id = e.id
WHERE ep.is_active = TRUE;

COMMENT ON VIEW v_active_employee_policies IS 'Active employee policies with employee details for easy querying';

-- ============================================
-- Employees table
-- ============================================

CREATE TYPE user_role AS ENUM ('ADMIN', 'MANAGER', 'EMPLOYEE');

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL,
    department VARCHAR(100),
    designation VARCHAR(100),
    reporting_manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    doj DATE,
    is_active BOOLEAN DEFAULT TRUE,
    refresh_token TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
--------------------------------------------------------------------------------------------
-- Indexes for employees table
CREATE INDEX idx_employees_role ON employees(role) WHERE is_active = TRUE;
CREATE INDEX idx_employees_department ON employees(department) WHERE is_active = TRUE;
CREATE INDEX idx_employees_reporting_manager ON employees(reporting_manager_id) WHERE is_active = TRUE;
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_active ON employees(is_active);

-- Trigger for employees
CREATE TRIGGER trigger_update_employees_timestamp
BEFORE UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

---------------------------------------------------------------------------------------
INSERT INTO employees (employee_id, first_name, last_name, email, password_hash, role, department, designation, doj, is_active)
VALUES ('EMP001', 'System', 'Admin', 'admin@example.com', 'System@123', 'ADMIN', 'Administration', 'System Administrator', '2024-01-01', TRUE);

WITH admin AS (SELECT id FROM employees WHERE employee_id = 'EMP001'),
managers AS (
  INSERT INTO employees (employee_id, first_name, last_name, email, password_hash, role, department, designation, reporting_manager_id, doj, is_active)
  VALUES
    ('EMP002', 'John', 'Doe', 'john@example.com', 'John@123', 'MANAGER', 'Engineering', 'Engineering Manager', (SELECT id FROM admin), '2024-02-01', TRUE),
    ('EMP003', 'Sarah', 'Lee', 'sarah@example.com', 'Sarah@123', 'MANAGER', 'Product', 'Product Manager', (SELECT id FROM admin), '2024-02-01', TRUE)
  RETURNING id, employee_id
)
INSERT INTO employees (employee_id, first_name, last_name, email, password_hash, role, department, designation, reporting_manager_id, doj, is_active)
VALUES
  ('EMP004', 'Alice', 'Smith', 'alice@example.com', 'Alice@123', 'EMPLOYEE', 'Engineering', 'Software Developer', (SELECT id FROM managers WHERE employee_id = 'EMP002'), '2024-03-01', TRUE),
  ('EMP005', 'Bob', 'Brown', 'bob@example.com', 'Bob@123', 'EMPLOYEE', 'Engineering', 'Software Developer', (SELECT id FROM managers WHERE employee_id = 'EMP002'), '2024-03-01', TRUE),
  ('EMP006', 'Charlie', 'Davis', 'charlie@example.com', 'Charlie@123', 'EMPLOYEE', 'Engineering', 'Backend Developer', (SELECT id FROM managers WHERE employee_id = 'EMP002'), '2024-03-01', TRUE),
  ('EMP007', 'Diana', 'Williams', 'diana@example.com', 'Diana@123', 'EMPLOYEE', 'Engineering', 'Frontend Developer', (SELECT id FROM managers WHERE employee_id = 'EMP002'), '2024-03-01', TRUE),
  ('EMP008', 'Evan', 'Taylor', 'evan@example.com', 'Evan@123', 'EMPLOYEE', 'Engineering', 'QA Engineer', (SELECT id FROM managers WHERE employee_id = 'EMP002'), '2024-03-01', TRUE),
  ('EMP009', 'Fiona', 'Clark', 'fiona@example.com', 'Fiona@123', 'EMPLOYEE', 'Product', 'Product Analyst', (SELECT id FROM managers WHERE employee_id = 'EMP003'), '2024-03-01', TRUE),
  ('EMP010', 'George', 'Hall', 'george@example.com', 'George@123', 'EMPLOYEE', 'Product', 'UI/UX Designer', (SELECT id FROM managers WHERE employee_id = 'EMP003'), '2024-03-01', TRUE),
  ('EMP011', 'Hannah', 'Moore', 'hannah@example.com', 'Hannah@123', 'EMPLOYEE', 'Product', 'Business Analyst', (SELECT id FROM managers WHERE employee_id = 'EMP003'), '2024-03-01', TRUE),
  ('EMP012', 'Ian', 'Wright', 'ian@example.com', 'Ian@123', 'EMPLOYEE', 'Product', 'Scrum Associate', (SELECT id FROM managers WHERE employee_id = 'EMP003'), '2024-03-01', TRUE),
  ('EMP013', 'Julia', 'Adams', 'julia@example.com', 'Julia@123', 'EMPLOYEE', 'Product', 'Content Strategist', (SELECT id FROM managers WHERE employee_id = 'EMP003'), '2024-03-01', TRUE);
-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
-- 2.2: CLIENT_MASTER TABLE
CREATE TABLE client_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name VARCHAR(150) UNIQUE NOT NULL,
    client_code VARCHAR(50) UNIQUE NOT NULL,
    alias VARCHAR(100),
    client_spoc_first_name VARCHAR(50),
    client_spoc_last_name VARCHAR(50),
    client_spoc_phone VARCHAR(50),
    client_spoc_email VARCHAR(255),
    url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for client_master table
CREATE INDEX idx_client_master_code ON client_master(client_code);
CREATE INDEX idx_client_master_active ON client_master(is_active);
CREATE INDEX idx_client_master_name ON client_master(client_name);

-- Trigger for client_master
CREATE TRIGGER trigger_update_client_master_timestamp
BEFORE UPDATE ON client_master
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-----------------------------------------------------------------------------------------------------------
INSERT INTO client_master (client_name, client_code, alias, client_spoc_first_name, client_spoc_last_name, client_spoc_phone, client_spoc_email, url, is_active)
VALUES
  ('Innovatech Solutions', 'INNO-001', 'Innovatech', 'Alice', 'Johnson', '+1-202-555-0101', 'alice.j@innovatech.com', 'https://www.innovatech.com', TRUE),
  ('Quantum Dynamics', 'QUAN-002', 'Quantum', 'Bob', 'Williams', '+44 20 7946 0102', 'bob.w@quantumdynamics.io', 'https://www.quantumdynamics.io', TRUE),
  ('Apex Industries', 'APEX-003', 'Apex', 'Charlie', 'Brown', '+61 2 9268 0103', 'charlie.b@apexindustries.net', 'https://www.apexindustries.net', TRUE),
  ('Stellar Services', 'STLR-004', 'Stellar', 'Diana', 'Miller', '+49 30 123456-0104', 'diana.m@stellarserv.com', 'https://www.stellarserv.com', TRUE),
  ('Fusion Forward', 'FUSN-005', 'Fusion', 'Edward', 'Davis', '+81 3-1234-0105', 'ed.d@fusionforward.co', 'https://www.fusionforward.co', TRUE),
  ('Evergreen Logistics', 'EVRG-006', 'Evergreen', 'Fiona', 'Garcia', '+33 1 86 65 01 06', 'fiona.g@evergreenlog.com', 'https://www.evergreenlog.com', TRUE),
  ('BlueRidge Analytics', 'BLRD-007', 'BlueRidge', 'George', 'Rodriguez', '+91 22 6601 0107', 'george.r@blueridge.ai', 'https://www.blueridge.ai', TRUE),
  ('Pinnacle Group', 'PINN-008', 'Pinnacle', 'Hannah', 'Wilson', '+27 11 506 0108', 'hannah.w@pinnaclegroup.org', 'https://www.pinnaclegroup.org', TRUE),
  ('SilverLining Tech', 'SLVR-009', 'SilverLining', 'Ian', 'Martinez', '+86 10 8532 0109', 'ian.m@silverlining.tech', 'https://www.silverlining.tech', TRUE),
  ('Nexus Enterprises', 'NEXS-010', 'Nexus', 'Jane', 'Anderson', '+55 11 4302-0110', 'jane.a@nexus-ent.com', 'https://www.nexus-ent.com', FALSE);

-----------------------------------------------------------------------------------------------------------
-- 2.3: PROJECT_MASTER TABLE
CREATE TYPE project_status AS ENUM ('Planned', 'In Progress', 'Completed', 'On Hold', 'Cancelled');
CREATE TABLE project_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES client_master(id) ON DELETE RESTRICT,
    project_name VARCHAR(150) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    approved_days INT,
    estimated_days INT,
    status project_status NOT NULL DEFAULT 'Planned',
    spoc_name VARCHAR(100),
    spoc_email VARCHAR(255),
    spoc_phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT project_dates_check CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);
-- Indexes for project_master table
CREATE INDEX idx_project_master_client ON project_master(client_id) WHERE is_active = TRUE;
CREATE INDEX idx_project_master_status ON project_master(status) WHERE is_active = TRUE;
CREATE INDEX idx_project_master_dates ON project_master(start_date, end_date);
CREATE INDEX idx_project_master_active ON project_master(is_active);

-- Trigger for project_master
CREATE TRIGGER trigger_update_project_master_timestamp
BEFORE UPDATE ON project_master
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
-------------------------------------------------------------------------------------------------------

-- 2.4: ACTIVITY_MASTER TABLE
CREATE TYPE activity_status AS ENUM ('Planned', 'In Progress', 'Completed', 'On Hold', 'Cancelled');
CREATE TABLE activity_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES project_master(id) ON DELETE RESTRICT,
    activity_name VARCHAR(100) NOT NULL,
    description TEXT,
    status activity_status NOT NULL DEFAULT 'Planned',
    start_dt DATE,
    end_dt DATE,
    estimated_dt DATE,
    created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT activity_dates_check CHECK (start_dt IS NULL OR end_dt IS NULL OR start_dt <= end_dt)
);
-- Indexes for activity_master table
CREATE INDEX idx_activity_master_project ON activity_master(project_id) WHERE is_active = TRUE;
CREATE INDEX idx_activity_master_creator ON activity_master(created_by);
CREATE INDEX idx_activity_master_status ON activity_master(status) WHERE is_active = TRUE;
CREATE INDEX idx_activity_master_dates ON activity_master(start_dt, end_dt);
CREATE INDEX idx_activity_master_active ON activity_master(is_active);

-- Trigger for activity_master
CREATE TRIGGER trigger_update_activity_master_timestamp
BEFORE UPDATE ON activity_master
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
--------------------------------------------------------------------------------------------------

DROP TABLE IF EXISTS activity_assignments CASCADE;
DROP TABLE IF EXISTS activity_manager_scope CASCADE;
DROP TABLE IF EXISTS project_assignments CASCADE;


-- =================================================================
-- TABLE 1: PROJECT_ASSIGNMENTS
-- Purpose: Admin assigns projects to managers
-- =================================================================
CREATE TABLE project_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES project_master(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    assignment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    assignment_end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_project_manager UNIQUE(project_id, manager_id)
);

CREATE INDEX idx_project_assignments_manager ON project_assignments(manager_id) WHERE is_active = TRUE;
CREATE INDEX idx_project_assignments_project ON project_assignments(project_id) WHERE is_active = TRUE;
CREATE INDEX idx_project_assignments_active ON project_assignments(is_active);

COMMENT ON TABLE project_assignments IS 'Admin assigns projects to managers - one project can have multiple managers';


-- =================================================================
-- TABLE 2: ACTIVITY_MANAGER_SCOPE
-- Purpose: Admin assigns specific activities to managers within projects
-- =================================================================
CREATE TABLE activity_manager_scope (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES activity_master(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES project_master(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_activity_manager UNIQUE(activity_id, manager_id)
);

CREATE INDEX idx_activity_manager_scope_activity ON activity_manager_scope(activity_id) WHERE is_active = TRUE;
CREATE INDEX idx_activity_manager_scope_manager ON activity_manager_scope(manager_id) WHERE is_active = TRUE;
CREATE INDEX idx_activity_manager_scope_project ON activity_manager_scope(project_id) WHERE is_active = TRUE;
CREATE INDEX idx_activity_manager_scope_composite ON activity_manager_scope(manager_id, activity_id) WHERE is_active = TRUE;

COMMENT ON TABLE activity_manager_scope IS 'Admin assigns specific activities to managers - enables activity-level access control';


-- =================================================================
-- TABLE 3: ACTIVITY_ASSIGNMENTS
-- Purpose: Manager assigns activities to employees
-- =================================================================
CREATE TABLE activity_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES activity_master(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES project_master(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES client_master(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    assign_date DATE NOT NULL DEFAULT CURRENT_DATE,
    assign_end_date DATE,
    total_allocated_hours NUMERIC(6,2) CHECK (total_allocated_hours >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_activity_employee UNIQUE(activity_id, employee_id)
);

CREATE INDEX idx_activity_assignments_employee ON activity_assignments(employee_id) WHERE is_active = TRUE;
CREATE INDEX idx_activity_assignments_activity ON activity_assignments(activity_id) WHERE is_active = TRUE;
CREATE INDEX idx_activity_assignments_project ON activity_assignments(project_id) WHERE is_active = TRUE;
CREATE INDEX idx_activity_assignments_assigned_by ON activity_assignments(assigned_by);

COMMENT ON TABLE activity_assignments IS 'Manager assigns activities to employees - one activity can be assigned to multiple employees';


-- =================================================================
-- ATTACH UPDATE TIMESTAMP TRIGGERS
-- =================================================================
CREATE TRIGGER trigger_update_project_assignments_timestamp
BEFORE UPDATE ON project_assignments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_activity_manager_scope_timestamp
BEFORE UPDATE ON activity_manager_scope
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_activity_assignments_timestamp
BEFORE UPDATE ON activity_assignments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
-------------------------------------------------------------------------------------------------------
-- =================================================================
-- DROP EXISTING OBJECTS
-- =================================================================
DROP TABLE IF EXISTS timesheet_entry CASCADE;


-- =================================================================
-- CREATE TIMESHEET_ENTRY TABLE (UUID-Compatible)
-- =================================================================
CREATE TABLE timesheet_entry (
    -- Primary key (changed from SERIAL to UUID for consistency)
    entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Employee & Manager info (changed to UUID, with denormalized names for history)
    employee_id UUID NOT NULL,
    employee_name VARCHAR(255),
    manager_id UUID,
    manager_name VARCHAR(255),
    department VARCHAR(100),
    designation VARCHAR(100),
    
    -- Date tracking (week dates auto-calculated by trigger)
    entry_date DATE NOT NULL,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    
    -- Project/Activity/Client info (changed to UUID, IDs + denormalized names)
    project_id UUID NOT NULL,
    project_name VARCHAR(255),
    client_id UUID,
    client_name VARCHAR(255),
    activity_id UUID NOT NULL,
    activity_name VARCHAR(255),
    activity_assign_id UUID,
    
    -- Entry details
    ticket_number VARCHAR(50),
    hours_logged NUMERIC(5,2) CHECK (hours_logged >= 0) NOT NULL,
    description TEXT,
    
    -- Status workflow
    status VARCHAR(20) CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Rejected')) DEFAULT 'Draft',
    
    -- Submission tracking
    submitted_at TIMESTAMPTZ,
    
    -- Approval tracking
    approved_at TIMESTAMPTZ,
    approved_by UUID,
    approved_by_name VARCHAR(255),
    
    -- Rejection tracking
    rejected_at TIMESTAMPTZ,
    rejected_by UUID,
    rejected_by_name VARCHAR(255),
    rejection_reason TEXT,
    
    -- Soft delete (history preservation)
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    delete_reason VARCHAR(255),
    
    -- Archival (for old approved entries)
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys (SET NULL to preserve history when master data changes)
    CONSTRAINT fk_employee FOREIGN KEY (employee_id) 
        REFERENCES employees(id) ON DELETE SET NULL,
    CONSTRAINT fk_manager FOREIGN KEY (manager_id) 
        REFERENCES employees(id) ON DELETE SET NULL,
    CONSTRAINT fk_project FOREIGN KEY (project_id) 
        REFERENCES project_master(id) ON DELETE SET NULL,
    CONSTRAINT fk_client FOREIGN KEY (client_id) 
        REFERENCES client_master(id) ON DELETE SET NULL,
    CONSTRAINT fk_activity FOREIGN KEY (activity_id) 
        REFERENCES activity_master(id) ON DELETE SET NULL,
    CONSTRAINT fk_activity_assign FOREIGN KEY (activity_assign_id) 
        REFERENCES activity_assignments(id) ON DELETE SET NULL,
    CONSTRAINT fk_approved_by FOREIGN KEY (approved_by) 
        REFERENCES employees(id) ON DELETE SET NULL,
    CONSTRAINT fk_rejected_by FOREIGN KEY (rejected_by) 
        REFERENCES employees(id) ON DELETE SET NULL
);


-- =================================================================
-- CREATE INDEXES
-- =================================================================

-- Index for active entries queries
CREATE INDEX idx_timesheet_entry_employee 
ON timesheet_entry(employee_id) 
WHERE is_deleted = FALSE;

CREATE INDEX idx_timesheet_entry_date 
ON timesheet_entry(entry_date) 
WHERE is_deleted = FALSE;

CREATE INDEX idx_timesheet_entry_week 
ON timesheet_entry(employee_id, week_start_date, week_end_date) 
WHERE is_deleted = FALSE;

CREATE INDEX idx_timesheet_entry_status 
ON timesheet_entry(status) 
WHERE is_deleted = FALSE;

-- Index for history/deleted queries
CREATE INDEX idx_timesheet_entry_deleted 
ON timesheet_entry(is_deleted);

CREATE INDEX idx_timesheet_entry_archived 
ON timesheet_entry(is_archived);

-- Index for manager queries
CREATE INDEX idx_timesheet_entry_manager 
ON timesheet_entry(manager_id, status) 
WHERE is_deleted = FALSE;

-- Index for project/activity filtering
CREATE INDEX idx_timesheet_entry_project 
ON timesheet_entry(project_id) 
WHERE is_deleted = FALSE;

CREATE INDEX idx_timesheet_entry_activity 
ON timesheet_entry(activity_id) 
WHERE is_deleted = FALSE;


-- =================================================================
-- CREATE UNIQUE CONSTRAINT
-- =================================================================
-- Only allow one active entry per employee/project/activity/date
CREATE UNIQUE INDEX unique_entry_per_day
ON timesheet_entry(employee_id, project_id, activity_id, entry_date)
WHERE is_deleted = FALSE;


-- =================================================================
-- CREATE TRIGGER FUNCTIONS
-- =================================================================

-- Auto-update updated_at on every update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$function$;


-- Auto-calculate week_start_date and week_end_date (Sunday-Saturday)
CREATE OR REPLACE FUNCTION set_week_dates()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Sunday = start of week
    NEW.week_start_date := DATE_TRUNC('week', NEW.entry_date)::DATE;
    NEW.week_end_date := (DATE_TRUNC('week', NEW.entry_date) + INTERVAL '6 days')::DATE;
    RETURN NEW;
END;
$function$;


-- Auto-denormalize names from master tables (CORRECTED FOR UUID)
CREATE OR REPLACE FUNCTION denormalize_entry_names()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Get employee name, department, and designation
    IF NEW.employee_id IS NOT NULL AND NEW.employee_name IS NULL THEN
        SELECT 
            first_name || ' ' || last_name,
            department,
            designation,
            reporting_manager_id
        INTO 
            NEW.employee_name, 
            NEW.department,
            NEW.designation,
            NEW.manager_id
        FROM employees 
        WHERE id = NEW.employee_id;  -- Changed from employee_id to id
    END IF;
    
    -- Get manager name
    IF NEW.manager_id IS NOT NULL AND NEW.manager_name IS NULL THEN
        SELECT first_name || ' ' || last_name 
        INTO NEW.manager_name
        FROM employees 
        WHERE id = NEW.manager_id;  -- Changed from employee_id to id
    END IF;
    
    -- Get project name and client_id
    IF NEW.project_id IS NOT NULL AND NEW.project_name IS NULL THEN
        SELECT project_name, client_id
        INTO NEW.project_name, NEW.client_id
        FROM project_master 
        WHERE id = NEW.project_id;  -- Changed from project_id to id
    END IF;
    
    -- Get client name
    IF NEW.client_id IS NOT NULL AND NEW.client_name IS NULL THEN
        SELECT client_name 
        INTO NEW.client_name
        FROM client_master 
        WHERE id = NEW.client_id;  -- Changed from client_id to id
    END IF;
    
    -- Get activity name
    IF NEW.activity_id IS NOT NULL AND NEW.activity_name IS NULL THEN
        SELECT activity_name 
        INTO NEW.activity_name
        FROM activity_master 
        WHERE id = NEW.activity_id;  -- Changed from activity_id to id
    END IF;
    
    -- Get approved_by name
    IF NEW.approved_by IS NOT NULL AND NEW.approved_by_name IS NULL THEN
        SELECT first_name || ' ' || last_name 
        INTO NEW.approved_by_name
        FROM employees 
        WHERE id = NEW.approved_by;  -- Changed from employee_id to id
    END IF;
    
    -- Get rejected_by name
    IF NEW.rejected_by IS NOT NULL AND NEW.rejected_by_name IS NULL THEN
        SELECT first_name || ' ' || last_name 
        INTO NEW.rejected_by_name
        FROM employees 
        WHERE id = NEW.rejected_by;  -- Changed from employee_id to id
    END IF;
    
    RETURN NEW;
END;
$function$;


-- =================================================================
-- ATTACH TRIGGERS
-- =================================================================

CREATE TRIGGER trigger_update_timestamp
BEFORE UPDATE ON timesheet_entry
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_set_week_dates
BEFORE INSERT OR UPDATE ON timesheet_entry
FOR EACH ROW
WHEN (NEW.entry_date IS NOT NULL)
EXECUTE FUNCTION set_week_dates();

CREATE TRIGGER trigger_denormalize_names
BEFORE INSERT OR UPDATE ON timesheet_entry
FOR EACH ROW
EXECUTE FUNCTION denormalize_entry_names();


-- =================================================================
-- CREATE VIEWS
-- =================================================================

-- View for current/active entries only
CREATE OR REPLACE VIEW v_active_timesheet_entries AS
SELECT * FROM timesheet_entry
WHERE is_deleted = FALSE 
  AND is_archived = FALSE
  AND status IN ('Draft', 'Submitted', 'Rejected');


-- View for approved/historical entries
CREATE OR REPLACE VIEW v_timesheet_history AS
SELECT * FROM timesheet_entry
WHERE status = 'Approved' 
   OR is_deleted = TRUE 
   OR is_archived = TRUE;


-- View for manager's team entries pending approval (CORRECTED FOR UUID)
CREATE OR REPLACE VIEW v_pending_approvals AS
SELECT 
    te.*,
    e.first_name || ' ' || e.last_name as current_employee_name
FROM timesheet_entry te
LEFT JOIN employees e ON te.employee_id = e.id  -- Changed from employee_id to id
WHERE te.status = 'Submitted'
  AND te.is_deleted = FALSE
ORDER BY te.week_start_date DESC, te.employee_id, te.entry_date;


-- View for weekly summary by employee
CREATE OR REPLACE VIEW v_weekly_summary AS
SELECT 
    employee_id,
    employee_name,
    manager_id,
    manager_name,
    week_start_date,
    week_end_date,
    status,
    COUNT(*) as total_entries,
    SUM(hours_logged) as total_hours,
    COUNT(DISTINCT project_id) as projects_count,
    MIN(submitted_at) as submitted_date,
    MIN(approved_at) as approved_date,
    MIN(rejected_at) as rejected_date,
    MAX(rejected_by_name) as rejected_by_name
FROM timesheet_entry
WHERE is_deleted = FALSE
GROUP BY 
    employee_id, employee_name, manager_id, manager_name,
    week_start_date, week_end_date, status
ORDER BY week_start_date DESC, employee_id;


-- =================================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- =================================================================

COMMENT ON TABLE timesheet_entry IS 'Unified timesheet entry table with history preservation, soft deletes, and automatic denormalization';
COMMENT ON COLUMN timesheet_entry.employee_name IS 'Denormalized from employees table for history preservation';
COMMENT ON COLUMN timesheet_entry.week_start_date IS 'Auto-calculated by trigger based on entry_date (Sunday)';
COMMENT ON COLUMN timesheet_entry.is_deleted IS 'Soft delete flag - never physically delete entries';
COMMENT ON COLUMN timesheet_entry.status IS 'Draft: Editable, Submitted: Pending approval, Approved: Locked, Rejected: Needs correction';
COMMENT ON COLUMN timesheet_entry.rejected_at IS 'Timestamp when entry was rejected by manager';
COMMENT ON COLUMN timesheet_entry.rejected_by IS 'UUID of manager who rejected the entry';
COMMENT ON COLUMN timesheet_entry.rejected_by_name IS 'Denormalized name of manager who rejected (for history preservation)';

-- =================================================================
-- DROP EXISTING OBJECTS
-- =================================================================
DROP TABLE IF EXISTS employee_policy CASCADE;


-- =================================================================
-- CREATE EMPLOYEE_POLICY TABLE (UUID-Compatible)
-- Purpose: Store timesheet rules and working hour policies per employee
-- =================================================================
CREATE TABLE employee_policy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Working hours configuration
    working_hours_per_day NUMERIC(4,2) NOT NULL DEFAULT 8.00 CHECK (working_hours_per_day > 0),
    
    -- Weekend working configuration
    saturday_working BOOLEAN DEFAULT FALSE,
    sunday_working BOOLEAN DEFAULT FALSE,
    
    -- Timesheet entry rules
    allow_future_entries BOOLEAN DEFAULT FALSE,
    
    -- Soft delete
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT unique_employee_policy UNIQUE (employee_id)
);


-- =================================================================
-- CREATE INDEXES
-- =================================================================
CREATE INDEX idx_employee_policy_employee ON employee_policy(employee_id) WHERE is_active = TRUE;
CREATE INDEX idx_employee_policy_active ON employee_policy(is_active);


-- =================================================================
-- ATTACH TRIGGER FOR AUTO-UPDATE TIMESTAMP
-- =================================================================
CREATE TRIGGER trigger_update_employee_policy_timestamp
BEFORE UPDATE ON employee_policy
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- =================================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- =================================================================
COMMENT ON TABLE employee_policy IS 'Stores per-employee timesheet policies: working hours, weekend rules, entry restrictions';
COMMENT ON COLUMN employee_policy.working_hours_per_day IS 'Expected daily working hours for this employee (e.g., 8.00, 6.00)';
COMMENT ON COLUMN employee_policy.saturday_working IS 'Whether this employee is allowed to work on Saturdays';
COMMENT ON COLUMN employee_policy.sunday_working IS 'Whether this employee is allowed to work on Sundays';
COMMENT ON COLUMN employee_policy.allow_future_entries IS 'Whether this employee can log timesheets for future dates';
COMMENT ON COLUMN employee_policy.is_active IS 'Soft delete flag - allows policy history tracking';


-- =================================================================
-- CREATE VIEW FOR ACTIVE POLICIES
-- =================================================================
CREATE OR REPLACE VIEW v_active_employee_policies AS
SELECT 
    ep.*,
    e.employee_id as employee_code,
    e.first_name || ' ' || e.last_name as employee_name,
    e.department,
    e.designation,
    e.role
FROM employee_policy ep
JOIN employees e ON ep.employee_id = e.id
WHERE ep.is_active = TRUE;

COMMENT ON VIEW v_active_employee_policies IS 'Active employee policies with employee details for easy querying';

-- =================================================================
-- ADDITIONAL DATABASE COMPONENTS
-- Views, Triggers, Indexes, and Functions for Complete System
-- =================================================================


-- =================================================================
-- PART 1: ADDITIONAL INDEXES FOR MASTER TABLES
-- =================================================================

-- Indexes for employees table
CREATE INDEX idx_employees_role ON employees(role) WHERE is_active = TRUE;
CREATE INDEX idx_employees_department ON employees(department) WHERE is_active = TRUE;
CREATE INDEX idx_employees_reporting_manager ON employees(reporting_manager_id) WHERE is_active = TRUE;
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_active ON employees(is_active);

-- Indexes for client_master table
CREATE INDEX idx_client_master_code ON client_master(client_code);
CREATE INDEX idx_client_master_active ON client_master(is_active);
CREATE INDEX idx_client_master_name ON client_master(client_name);

-- Indexes for project_master table
CREATE INDEX idx_project_master_client ON project_master(client_id) WHERE is_active = TRUE;
CREATE INDEX idx_project_master_status ON project_master(status) WHERE is_active = TRUE;
CREATE INDEX idx_project_master_dates ON project_master(start_date, end_date);
CREATE INDEX idx_project_master_active ON project_master(is_active);

-- Indexes for activity_master table
CREATE INDEX idx_activity_master_project ON activity_master(project_id) WHERE is_active = TRUE;
CREATE INDEX idx_activity_master_creator ON activity_master(created_by);
CREATE INDEX idx_activity_master_status ON activity_master(status) WHERE is_active = TRUE;
CREATE INDEX idx_activity_master_dates ON activity_master(start_dt, end_dt);
CREATE INDEX idx_activity_master_active ON activity_master(is_active);


-- =================================================================
-- PART 2: ATTACH TRIGGERS TO MASTER TABLES
-- =================================================================

-- Trigger for employees
CREATE TRIGGER trigger_update_employees_timestamp
BEFORE UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for client_master
CREATE TRIGGER trigger_update_client_master_timestamp
BEFORE UPDATE ON client_master
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for project_master
CREATE TRIGGER trigger_update_project_master_timestamp
BEFORE UPDATE ON project_master
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for activity_master
CREATE TRIGGER trigger_update_activity_master_timestamp
BEFORE UPDATE ON activity_master
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- =================================================================
-- PART 3: COMPREHENSIVE VIEWS FOR BUSINESS LOGIC
-- =================================================================

-- ----------------------------------------------------------------
-- VIEW 1: Complete Employee Hierarchy
-- Shows org chart with manager details
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_employee_hierarchy AS
SELECT 
    e.id,
    e.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.email,
    e.role,
    e.department,
    e.designation,
    e.doj,
    e.is_active,
    mgr.id AS manager_uuid,
    mgr.employee_id AS manager_employee_id,
    mgr.first_name || ' ' || mgr.last_name AS manager_name,
    mgr.email AS manager_email,
    mgr.role AS manager_role
FROM employees e
LEFT JOIN employees mgr ON e.reporting_manager_id = mgr.id;

COMMENT ON VIEW v_employee_hierarchy IS 'Complete employee list with their manager details for org chart visualization';


-- ----------------------------------------------------------------
-- VIEW 2: Manager Dashboard - Projects & Team
-- Shows managers their assigned projects and team members
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_manager_dashboard AS
SELECT 
    mgr.id AS manager_uuid,
    mgr.employee_id AS manager_employee_id,
    mgr.first_name || ' ' || mgr.last_name AS manager_name,
    p.id AS project_uuid,
    p.project_name,
    p.status AS project_status,
    c.client_name,
    pa.assignment_date,
    COUNT(DISTINCT e.id) AS team_member_count,
    COUNT(DISTINCT aa.id) AS total_activity_assignments
FROM employees mgr
JOIN project_assignments pa ON mgr.id = pa.manager_id AND pa.is_active = TRUE
JOIN project_master p ON pa.project_id = p.id AND p.is_active = TRUE
LEFT JOIN client_master c ON p.client_id = c.id
LEFT JOIN employees e ON e.reporting_manager_id = mgr.id AND e.is_active = TRUE
LEFT JOIN activity_assignments aa ON e.id = aa.employee_id AND aa.is_active = TRUE
WHERE mgr.role = 'MANAGER' AND mgr.is_active = TRUE
GROUP BY mgr.id, mgr.employee_id, manager_name, p.id, p.project_name, p.status, c.client_name, pa.assignment_date;

COMMENT ON VIEW v_manager_dashboard IS 'Manager dashboard showing assigned projects and team statistics';


-- ----------------------------------------------------------------
-- VIEW 3: Employee Dashboard - Assigned Work
-- Shows employees their assigned projects and activities
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_employee_dashboard AS
SELECT 
    e.id AS employee_uuid,
    e.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    p.id AS project_uuid,
    p.project_name,
    c.client_name,
    a.id AS activity_uuid,
    a.activity_name,
    a.status AS activity_status,
    aa.assign_date,
    aa.total_allocated_hours,
    mgr.first_name || ' ' || mgr.last_name AS manager_name
FROM employees e
JOIN activity_assignments aa ON e.id = aa.employee_id AND aa.is_active = TRUE
JOIN activity_master a ON aa.activity_id = a.id AND a.is_active = TRUE
JOIN project_master p ON aa.project_id = p.id AND p.is_active = TRUE
LEFT JOIN client_master c ON aa.client_id = c.id
LEFT JOIN employees mgr ON e.reporting_manager_id = mgr.id
WHERE e.role = 'EMPLOYEE' AND e.is_active = TRUE;

COMMENT ON VIEW v_employee_dashboard IS 'Employee dashboard showing all assigned projects and activities';


-- ----------------------------------------------------------------
-- VIEW 4: Activity Assignment Summary
-- Shows which activities are assigned to which employees
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_activity_assignment_summary AS
SELECT 
    a.id AS activity_uuid,
    a.activity_name,
    p.project_name,
    c.client_name,
    a.status AS activity_status,
    COUNT(DISTINCT aa.employee_id) AS assigned_employee_count,
    STRING_AGG(DISTINCT e.first_name || ' ' || e.last_name, ', ') AS assigned_employees,
    SUM(aa.total_allocated_hours) AS total_allocated_hours,
    creator.first_name || ' ' || creator.last_name AS created_by_name
FROM activity_master a
JOIN project_master p ON a.project_id = p.id
LEFT JOIN client_master c ON p.client_id = c.id
LEFT JOIN activity_assignments aa ON a.id = aa.activity_id AND aa.is_active = TRUE
LEFT JOIN employees e ON aa.employee_id = e.id
LEFT JOIN employees creator ON a.created_by = creator.id
WHERE a.is_active = TRUE
GROUP BY a.id, a.activity_name, p.project_name, c.client_name, a.status, created_by_name;

COMMENT ON VIEW v_activity_assignment_summary IS 'Summary of activity assignments showing who is working on what';


-- ----------------------------------------------------------------
-- VIEW 5: Project Assignment Summary
-- Shows which projects are assigned to which managers
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_project_assignment_summary AS
SELECT 
    p.id AS project_uuid,
    p.project_name,
    c.client_name,
    p.status AS project_status,
    p.start_date,
    p.end_date,
    COUNT(DISTINCT pa.manager_id) AS assigned_manager_count,
    STRING_AGG(DISTINCT mgr.first_name || ' ' || mgr.last_name, ', ') AS assigned_managers,
    COUNT(DISTINCT a.id) AS total_activities,
    COUNT(DISTINCT aa.employee_id) AS total_assigned_employees
FROM project_master p
LEFT JOIN client_master c ON p.client_id = c.id
LEFT JOIN project_assignments pa ON p.id = pa.project_id AND pa.is_active = TRUE
LEFT JOIN employees mgr ON pa.manager_id = mgr.id
LEFT JOIN activity_master a ON p.id = a.project_id AND a.is_active = TRUE
LEFT JOIN activity_assignments aa ON a.id = aa.activity_id AND aa.is_active = TRUE
WHERE p.is_active = TRUE
GROUP BY p.id, p.project_name, c.client_name, p.status, p.start_date, p.end_date;

COMMENT ON VIEW v_project_assignment_summary IS 'Summary of project assignments showing managers and team allocation';


-- ----------------------------------------------------------------
-- VIEW 6: Timesheet Summary by Employee and Week
-- Shows weekly timesheet status and hours
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_timesheet_weekly_status AS
SELECT 
    e.id AS employee_uuid,
    e.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.department,
    mgr.first_name || ' ' || mgr.last_name AS manager_name,
    te.week_start_date,
    te.week_end_date,
    te.status,
    COUNT(DISTINCT te.entry_id) AS total_entries,
    SUM(te.hours_logged) AS total_hours_logged,
    COUNT(DISTINCT te.project_id) AS projects_worked_on,
    COUNT(DISTINCT te.activity_id) AS activities_worked_on,
    MIN(te.submitted_at) AS submitted_at,
    MIN(te.approved_at) AS approved_at
FROM employees e
LEFT JOIN timesheet_entry te ON e.id = te.employee_id AND te.is_deleted = FALSE
LEFT JOIN employees mgr ON e.reporting_manager_id = mgr.id
WHERE e.is_active = TRUE
GROUP BY 
    e.id, 
    e.employee_id, 
    e.first_name,           -- Added
    e.last_name,            -- Added
    e.department, 
    mgr.first_name,         -- Added
    mgr.last_name,          -- Added
    te.week_start_date, 
    te.week_end_date, 
    te.status;

COMMENT ON VIEW v_timesheet_weekly_status IS 'Weekly timesheet summary showing hours and status by employee';

-- ----------------------------------------------------------------
-- VIEW 7: Manager's Pending Timesheet Approvals
-- Shows all timesheets waiting for manager approval
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_manager_pending_approvals AS
SELECT 
    te.entry_id,
    te.employee_id,
    e.employee_id AS employee_code,
    e.first_name || ' ' || e.last_name AS employee_name,
    te.entry_date,
    te.week_start_date,
    te.week_end_date,
    p.project_name,
    a.activity_name,
    te.hours_logged,
    te.description,
    te.submitted_at,
    mgr.id AS manager_uuid,
    mgr.employee_id AS manager_employee_id,
    mgr.first_name || ' ' || mgr.last_name AS manager_name,
    CURRENT_DATE - te.entry_date AS days_pending
FROM timesheet_entry te
JOIN employees e ON te.employee_id = e.id
JOIN employees mgr ON e.reporting_manager_id = mgr.id
LEFT JOIN project_master p ON te.project_id = p.id
LEFT JOIN activity_master a ON te.activity_id = a.id
WHERE te.status = 'Submitted' 
  AND te.is_deleted = FALSE
ORDER BY te.week_start_date DESC, te.entry_date, e.employee_id;

COMMENT ON VIEW v_manager_pending_approvals IS 'All timesheets pending manager approval with employee and project details';


-- ----------------------------------------------------------------
-- VIEW 8: Project Hours Summary
-- Shows total hours logged per project
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_project_hours_summary AS
SELECT 
    p.id AS project_uuid,
    p.project_name,
    c.client_name,
    p.status AS project_status,
    COUNT(DISTINCT te.employee_id) AS employees_worked,
    COUNT(DISTINCT te.entry_id) AS total_timesheet_entries,
    SUM(CASE WHEN te.status = 'Approved' THEN te.hours_logged ELSE 0 END) AS approved_hours,
    SUM(CASE WHEN te.status = 'Submitted' THEN te.hours_logged ELSE 0 END) AS pending_hours,
    SUM(CASE WHEN te.status = 'Draft' THEN te.hours_logged ELSE 0 END) AS draft_hours,
    SUM(te.hours_logged) AS total_hours_logged,
    MIN(te.entry_date) AS first_entry_date,
    MAX(te.entry_date) AS last_entry_date
FROM project_master p
LEFT JOIN client_master c ON p.client_id = c.id
LEFT JOIN timesheet_entry te ON p.id = te.project_id AND te.is_deleted = FALSE
WHERE p.is_active = TRUE
GROUP BY p.id, p.project_name, c.client_name, p.status;

COMMENT ON VIEW v_project_hours_summary IS 'Summary of hours logged per project with status breakdown';


-- ----------------------------------------------------------------
-- VIEW 9: Employee Workload Summary
-- Shows current workload and pending approvals per employee
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_employee_workload AS
SELECT 
    e.id AS employee_uuid,
    e.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.department,
    e.designation,
    COUNT(DISTINCT aa.activity_id) AS assigned_activities_count,
    COUNT(DISTINCT aa.project_id) AS assigned_projects_count,
    SUM(aa.total_allocated_hours) AS total_allocated_hours,
    COUNT(DISTINCT CASE WHEN te.status = 'Draft' THEN te.entry_id END) AS draft_entries,
    COUNT(DISTINCT CASE WHEN te.status = 'Submitted' THEN te.entry_id END) AS submitted_entries,
    COUNT(DISTINCT CASE WHEN te.status = 'Approved' THEN te.entry_id END) AS approved_entries,
    SUM(CASE WHEN te.status = 'Approved' THEN te.hours_logged ELSE 0 END) AS approved_hours_total
FROM employees e
LEFT JOIN activity_assignments aa ON e.id = aa.employee_id AND aa.is_active = TRUE
LEFT JOIN timesheet_entry te ON e.id = te.employee_id AND te.is_deleted = FALSE
WHERE e.is_active = TRUE
GROUP BY e.id, e.employee_id, employee_name, e.department, e.designation;

COMMENT ON VIEW v_employee_workload IS 'Current workload summary showing assignments and timesheet status per employee';


-- =================================================================
-- PART 4: UTILITY FUNCTIONS FOR ROLE-BASED ACCESS CONTROL
-- =================================================================

-- ----------------------------------------------------------------
-- FUNCTION 1: Get Projects Visible to User
-- Returns projects based on user role (Admin sees all, Manager sees assigned)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_projects(
    p_user_id UUID,
    p_user_role VARCHAR
)
RETURNS TABLE (
    project_id UUID,
    project_name VARCHAR,
    client_name VARCHAR,
    status project_status,
    start_date DATE,
    end_date DATE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF UPPER(p_user_role) = 'ADMIN' THEN
        -- Admins see all active projects
        RETURN QUERY
        SELECT 
            p.id,
            p.project_name,
            c.client_name,
            p.status,
            p.start_date,
            p.end_date
        FROM project_master p
        LEFT JOIN client_master c ON p.client_id = c.id
        WHERE p.is_active = TRUE
        ORDER BY p.created_at DESC;
        
    ELSIF UPPER(p_user_role) = 'MANAGER' THEN
        -- Managers see only assigned projects
        RETURN QUERY
        SELECT 
            p.id,
            p.project_name,
            c.client_name,
            p.status,
            p.start_date,
            p.end_date
        FROM project_master p
        INNER JOIN project_assignments pa ON p.id = pa.project_id
        LEFT JOIN client_master c ON p.client_id = c.id
        WHERE pa.manager_id = p_user_id
          AND pa.is_active = TRUE
          AND p.is_active = TRUE
        ORDER BY p.created_at DESC;
        
    ELSIF UPPER(p_user_role) = 'EMPLOYEE' THEN
        -- Employees see projects they have activity assignments in
        RETURN QUERY
        SELECT DISTINCT
            p.id,
            p.project_name,
            c.client_name,
            p.status,
            p.start_date,
            p.end_date
        FROM project_master p
        INNER JOIN activity_assignments aa ON p.id = aa.project_id
        LEFT JOIN client_master c ON p.client_id = c.id
        WHERE aa.employee_id = p_user_id
          AND aa.is_active = TRUE
          AND p.is_active = TRUE
        ORDER BY p.created_at DESC;
    END IF;
END;
$$;

COMMENT ON FUNCTION get_user_projects IS 'Returns projects visible to user based on their role and assignments';


-- ----------------------------------------------------------------
-- FUNCTION 2: Get Activities Visible to User
-- Returns activities based on user role and scope
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_activities(
    p_user_id UUID,
    p_user_role VARCHAR,
    p_project_id UUID DEFAULT NULL
)
RETURNS TABLE (
    activity_id UUID,
    activity_name VARCHAR,
    project_id UUID,
    project_name VARCHAR,
    status activity_status,
    start_dt DATE,
    end_dt DATE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF UPPER(p_user_role) = 'ADMIN' THEN
        -- Admins see all activities
        RETURN QUERY
        SELECT 
            a.id,
            a.activity_name,
            a.project_id,
            p.project_name,
            a.status,
            a.start_dt,
            a.end_dt
        FROM activity_master a
        LEFT JOIN project_master p ON a.project_id = p.id
        WHERE (p_project_id IS NULL OR a.project_id = p_project_id)
          AND a.is_active = TRUE
        ORDER BY a.created_at DESC;
        
    ELSIF UPPER(p_user_role) = 'MANAGER' THEN
        -- Managers see only activities in their scope
        RETURN QUERY
        SELECT 
            a.id,
            a.activity_name,
            a.project_id,
            p.project_name,
            a.status,
            a.start_dt,
            a.end_dt
        FROM activity_master a
        INNER JOIN activity_manager_scope ams ON a.id = ams.activity_id
        LEFT JOIN project_master p ON a.project_id = p.id
        WHERE ams.manager_id = p_user_id
          AND ams.is_active = TRUE
          AND a.is_active = TRUE
          AND (p_project_id IS NULL OR a.project_id = p_project_id)
        ORDER BY a.created_at DESC;
        
    ELSIF UPPER(p_user_role) = 'EMPLOYEE' THEN
        -- Employees see only assigned activities
        RETURN QUERY
        SELECT 
            a.id,
            a.activity_name,
            a.project_id,
            p.project_name,
            a.status,
            a.start_dt,
            a.end_dt
        FROM activity_master a
        INNER JOIN activity_assignments aa ON a.id = aa.activity_id
        LEFT JOIN project_master p ON a.project_id = p.id
        WHERE aa.employee_id = p_user_id
          AND aa.is_active = TRUE
          AND a.is_active = TRUE
          AND (p_project_id IS NULL OR a.project_id = p_project_id)
        ORDER BY a.created_at DESC;
    END IF;
END;
$$;

COMMENT ON FUNCTION get_user_activities IS 'Returns activities visible to user based on their role and scope';


-- =================================================================
-- VERIFICATION QUERIES
-- =================================================================

-- Verify all views exist
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name LIKE 'v_%'
ORDER BY table_name;

-- Verify all triggers exist
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE event_object_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Verify all functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Verify all indexes exist
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

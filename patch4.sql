CREATE TABLE IF NOT EXISTS ticket_status (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE
);
INSERT INTO ticket_status (name) VALUES ('Open'), ('In Progress'), ('Resolved'), ('Closed') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS timesheet_status (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE
);
INSERT INTO timesheet_status (id, name) VALUES (1, 'Saved'), (2, 'Submitted'), (3, 'Approved'), (4, 'Rejected') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS ticket_master (
  ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_name VARCHAR(255),
  project_id UUID REFERENCES project_master(project_id),
  zoho_crm_code VARCHAR(100),
  description TEXT,
  status INTEGER REFERENCES ticket_status(id),
  start_date DATE,
  end_date DATE,
  estimated_date DATE,
  estimated_hours NUMERIC,
  approved_hours NUMERIC,
  billable_hours NUMERIC,
  created_by UUID REFERENCES employees(employee_id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ticket_manager_scope (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES ticket_master(ticket_id),
  manager_id UUID REFERENCES employees(employee_id),
  project_id UUID REFERENCES project_master(project_id),
  assigned_by UUID REFERENCES employees(employee_id),
  assigned_date DATE,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS ticket_assignments (
  ticket_assignments_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES ticket_master(ticket_id),
  employee_id UUID REFERENCES employees(employee_id),
  project_id UUID REFERENCES project_master(project_id),
  assigned_by UUID REFERENCES employees(employee_id),
  assigned_date DATE,
  is_active BOOLEAN DEFAULT TRUE
);

ALTER TABLE daily_timesheet_entries ADD COLUMN IF NOT EXISTS ticket_assign_id UUID;

DO $$
DECLARE
  v_admin_id UUID;
  v_project_id UUID;
  v_ticket_id UUID;
BEGIN
  SELECT employee_id INTO v_admin_id FROM employees WHERE email='admin@example.com' LIMIT 1;
  SELECT project_id INTO v_project_id FROM project_master LIMIT 1;
  
  IF v_admin_id IS NOT NULL AND v_project_id IS NOT NULL THEN
    INSERT INTO ticket_master (ticket_name, project_id, zoho_crm_code, status, created_by, is_active)
    VALUES ('Dummy Ticket 1', v_project_id, 'TKT-1', 1, v_admin_id, TRUE)
    RETURNING ticket_id INTO v_ticket_id;

    INSERT INTO ticket_manager_scope (ticket_id, manager_id, project_id, assigned_by, assigned_date, is_active)
    VALUES (v_ticket_id, v_admin_id, v_project_id, v_admin_id, CURRENT_DATE, TRUE);

    INSERT INTO ticket_assignments (ticket_id, employee_id, project_id, assigned_by, assigned_date, is_active)
    VALUES (v_ticket_id, v_admin_id, v_project_id, v_admin_id, CURRENT_DATE, TRUE);
    
    UPDATE daily_timesheet_entries SET ticket_id = v_ticket_id;
  END IF;
END $$;

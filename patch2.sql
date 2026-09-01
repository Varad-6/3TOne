-- 1. Create project_status table and migrate
CREATE TABLE project_status (id SERIAL PRIMARY KEY, name VARCHAR(50) UNIQUE);
INSERT INTO project_status (name) VALUES ('Planned'), ('In Progress'), ('Completed'), ('On Hold'), ('Cancelled');
ALTER TABLE project_master ADD COLUMN new_status INTEGER;
UPDATE project_master SET new_status = (SELECT id FROM project_status WHERE name = project_master.status::text);
ALTER TABLE project_master DROP COLUMN status CASCADE;
ALTER TABLE project_master RENAME COLUMN new_status TO status;

-- 2. Add columns to project_master
ALTER TABLE project_master ADD COLUMN description TEXT;
ALTER TABLE project_master ADD COLUMN spoc_name VARCHAR(100);
ALTER TABLE project_master ADD COLUMN spoc_email VARCHAR(100);
ALTER TABLE project_master ADD COLUMN spoc_phone VARCHAR(50);
ALTER TABLE project_master ADD COLUMN billable_hours NUMERIC DEFAULT 0;
ALTER TABLE project_master ADD COLUMN zoho_crm_code VARCHAR(100);

-- 3. Create project_manager_assignment table
CREATE TABLE project_manager_assignment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES project_master(project_id),
  manager_id UUID REFERENCES employees(employee_id),
  assignment_start_date DATE,
  assignment_end_date DATE,
  is_active BOOLEAN DEFAULT TRUE
);

-- 4. Create daily_timesheet_entries table
CREATE TABLE daily_timesheet_entries (
  entry_id SERIAL PRIMARY KEY,
  employee_id UUID REFERENCES employees(employee_id),
  project_id UUID REFERENCES project_master(project_id),
  ticket_id UUID,
  ticket_manager_assign_id UUID,
  manager_id UUID REFERENCES employees(employee_id),
  client_id UUID REFERENCES client_master(client_id),
  task_id UUID,
  entry_date DATE,
  week_start_date DATE,
  week_end_date DATE,
  total_hours NUMERIC,
  billable_hours NUMERIC,
  non_billable_hours NUMERIC,
  ticket_number VARCHAR(100),
  description TEXT,
  status INTEGER
);

-- 5. Add separation_date to employees
ALTER TABLE employees ADD COLUMN separation_date DATE;

-- 6. Insert dummy data for admin
INSERT INTO daily_timesheet_entries (
  employee_id, entry_date, week_start_date, week_end_date, total_hours, billable_hours, status
) VALUES 
  ((SELECT employee_id FROM employees WHERE email='admin@example.com'), CURRENT_DATE, CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '5 days', 8, 8, 2),
  ((SELECT employee_id FROM employees WHERE email='admin@example.com'), CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '5 days', 8, 8, 4);

-- Insert dummy data into project_master
INSERT INTO client_master (client_name, client_code, zoho_crm_code, is_active) VALUES ('Dummy Client', 'DUMMY', 'DUMMY', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO project_master (project_name, client_id, status, is_active) VALUES ('Dummy Project', (SELECT client_id FROM client_master WHERE client_code='DUMMY' LIMIT 1), 2, TRUE);

DROP TYPE IF EXISTS project_status CASCADE;
CREATE TABLE IF NOT EXISTS project_status (id SERIAL PRIMARY KEY, name VARCHAR(50) UNIQUE);
INSERT INTO project_status (name) VALUES ('Planned'), ('In Progress'), ('Completed'), ('On Hold'), ('Cancelled') ON CONFLICT DO NOTHING;

ALTER TABLE project_master ADD COLUMN IF NOT EXISTS status INTEGER;

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='project_master' AND column_name='id') THEN
    ALTER TABLE project_master RENAME COLUMN id TO project_id;
  END IF;
END $$;

ALTER TABLE project_master ADD COLUMN IF NOT EXISTS billable_hours NUMERIC DEFAULT 0;
ALTER TABLE project_master ADD COLUMN IF NOT EXISTS zoho_crm_code VARCHAR(100);

ALTER TABLE client_master ADD COLUMN IF NOT EXISTS zoho_crm_code VARCHAR(100);

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='client_master' AND column_name='id') THEN
    ALTER TABLE client_master RENAME COLUMN id TO client_id;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS project_manager_assignment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES project_master(project_id),
  manager_id UUID REFERENCES employees(employee_id),
  assignment_start_date DATE,
  assignment_end_date DATE,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS daily_timesheet_entries (
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

ALTER TABLE employees ADD COLUMN IF NOT EXISTS separation_date DATE;

INSERT INTO daily_timesheet_entries (
  employee_id, entry_date, week_start_date, week_end_date, total_hours, billable_hours, status
) VALUES 
  ((SELECT employee_id FROM employees WHERE email='admin@example.com'), CURRENT_DATE, CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '5 days', 8, 8, 2),
  ((SELECT employee_id FROM employees WHERE email='admin@example.com'), CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '5 days', 8, 8, 4);

INSERT INTO client_master (client_name, client_code, zoho_crm_code, is_active) VALUES ('Dummy Client', 'DUMMY', 'DUMMY', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO project_master (project_name, client_id, status, is_active) VALUES ('Dummy Project', (SELECT client_id FROM client_master WHERE client_code='DUMMY' LIMIT 1), 2, TRUE);

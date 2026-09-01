CREATE TABLE IF NOT EXISTS task_master (
  task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task VARCHAR(255),
  department INTEGER REFERENCES departments(id),
  internal_project BOOLEAN,
  is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO task_master (task, department, internal_project) 
VALUES ('Dummy Task', (SELECT id FROM departments LIMIT 1), FALSE);

UPDATE daily_timesheet_entries SET task_id = (SELECT task_id FROM task_master LIMIT 1);

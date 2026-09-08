-- ============================================
-- Patch 6: Ticket Assignment Unification & Timesheet Locking
-- ============================================

-- 1. Unify ticket assignments: copy existing manager assignments to ticket_assignments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'ticket_manager_scope' AND table_type = 'BASE TABLE'
  ) THEN
    INSERT INTO ticket_assignments (ticket_assignments_id, ticket_id, employee_id, project_id, assigned_by, assigned_date, is_active)
    SELECT id, ticket_id, manager_id, project_id, assigned_by, assigned_date, is_active
    FROM ticket_manager_scope
    ON CONFLICT (ticket_assignments_id) DO NOTHING;

    DROP TABLE ticket_manager_scope CASCADE;
  END IF;
END $$;

-- Replace ticket_manager_scope table with unified view over ticket_assignments
CREATE OR REPLACE VIEW ticket_manager_scope AS
SELECT 
  ticket_assignments_id AS id,
  ticket_id,
  employee_id AS manager_id,
  project_id,
  assigned_by,
  assigned_date,
  is_active
FROM ticket_assignments;

CREATE OR REPLACE RULE ticket_manager_scope_insert AS 
ON INSERT TO ticket_manager_scope 
DO INSTEAD 
INSERT INTO ticket_assignments (ticket_assignments_id, ticket_id, employee_id, project_id, assigned_by, assigned_date, is_active) 
VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.ticket_id, NEW.manager_id, NEW.project_id, NEW.assigned_by, NEW.assigned_date, COALESCE(NEW.is_active, TRUE));

CREATE OR REPLACE RULE ticket_manager_scope_update AS 
ON UPDATE TO ticket_manager_scope 
DO INSTEAD 
UPDATE ticket_assignments 
SET ticket_id = NEW.ticket_id, 
    employee_id = NEW.manager_id, 
    project_id = NEW.project_id, 
    assigned_by = NEW.assigned_by, 
    assigned_date = NEW.assigned_date, 
    is_active = NEW.is_active 
WHERE ticket_assignments_id = OLD.id;

CREATE OR REPLACE RULE ticket_manager_scope_delete AS 
ON DELETE TO ticket_manager_scope 
DO INSTEAD 
DELETE FROM ticket_assignments 
WHERE ticket_assignments_id = OLD.id;

-- 2. Add 'Locked' status to timesheet_status
INSERT INTO timesheet_status (id, name) VALUES (5, 'Locked') ON CONFLICT (id) DO NOTHING;

-- 3. Add missing audit/status columns to daily_timesheet_entries if not present
ALTER TABLE daily_timesheet_entries 
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;


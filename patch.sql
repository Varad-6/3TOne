CREATE TABLE user_roles (id SERIAL PRIMARY KEY, name VARCHAR(50) UNIQUE);
INSERT INTO user_roles (name) VALUES ('ADMIN'), ('MANAGER'), ('EMPLOYEE');

CREATE TABLE departments (id SERIAL PRIMARY KEY, name VARCHAR(100) UNIQUE);
INSERT INTO departments (name) VALUES ('Administration'), ('Engineering'), ('Product');

ALTER TABLE employees RENAME COLUMN employee_id TO employee_code;
ALTER TABLE employees RENAME COLUMN id TO employee_id;

ALTER TABLE employees ADD COLUMN new_role INTEGER;
UPDATE employees SET new_role = (SELECT id FROM user_roles WHERE name = employees.role::text);
ALTER TABLE employees DROP COLUMN role CASCADE;
ALTER TABLE employees RENAME COLUMN new_role TO role;

ALTER TABLE employees ADD COLUMN new_department INTEGER;
UPDATE employees SET new_department = (SELECT id FROM departments WHERE name = employees.department);
ALTER TABLE employees DROP COLUMN department CASCADE;
ALTER TABLE employees RENAME COLUMN new_department TO department;

ALTER TABLE employees RENAME COLUMN reporting_manager_id TO module_manager_id;

-- ─────────────────────────────────────────────
-- HR Phase 5: Indexes (Optimization)
-- ─────────────────────────────────────────────

-- SF-5: Missing DB indexes on HR query columns
CREATE INDEX IF NOT EXISTS idx_users_dept_id ON users(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance_records(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_emp_status ON leave_requests(employee_id, status);

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS hr_stats_snapshot CASCADE;

-- Materialized view: slow-changing HR aggregates (refresh nightly + on status change)
CREATE MATERIALIZED VIEW hr_stats_snapshot AS
SELECT
  1::int                                                                         AS id,
  COUNT(*)                                                                       AS total_employees,
  COUNT(*) FILTER (WHERE employee_status = 'active')                             AS active_employees,
  COUNT(*) FILTER (WHERE hired_date >= CURRENT_DATE - 120)                       AS probation_count,
  COUNT(*) FILTER (WHERE resignation_date >= date_trunc('month', CURRENT_DATE))  AS resigned_this_month,
  (
    SELECT json_agg(row_to_json(d))
    FROM (
      SELECT d.id, d.name_th, d.name_en, COUNT(u.id)::int AS count
      FROM departments d
      LEFT JOIN users u ON u.department_id = d.id AND u.is_active = TRUE
      GROUP BY d.id, d.name_th, d.name_en
      ORDER BY count DESC
    ) d
  ) AS dept_headcount,
  (
    SELECT row_to_json(pr)
    FROM (
      SELECT run_number, period_month, period_year, status, total_net
      FROM payroll_runs ORDER BY created_at DESC LIMIT 1
    ) pr
  ) AS latest_payroll
FROM users
WHERE role NOT IN ('admin', 'auditor');

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY (simple unique index on column)
CREATE UNIQUE INDEX IF NOT EXISTS hr_stats_snapshot_unique ON hr_stats_snapshot (id);

-- Composite indexes for HR real-time queries
CREATE INDEX IF NOT EXISTS idx_attendance_date_employee
  ON attendance_records(work_date DESC, employee_id);

CREATE INDEX IF NOT EXISTS idx_leave_status_created
  ON leave_requests(status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_leave_employee_dates
  ON leave_requests(employee_id, start_date, end_date)
  WHERE status = 'approved';

COMMIT;

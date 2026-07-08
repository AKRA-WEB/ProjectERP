import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query, queryOne } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { buildWarehouseScopeClause, type SessionUser } from '@/lib/authz';
import { canAccessProfile, canSeeSalary } from '@/lib/hr/employee-profile-access';
import type {
  HrEmployeeProfileResponse,
  HrAttendanceSummary,
} from '@/types';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  const { id } = await params;

  if (!canAccessProfile(u, id)) return apiError('Forbidden', 403);

  // For managers: enforce warehouse scope via user_warehouse_assignments
  if (u.role === 'manager') {
    const scope = buildWarehouseScopeClause(u, 'uwa.warehouse_id', 2);
    if (scope?.clause === 'FALSE') return apiError('Not found', 404);

    if (scope) {
      const inScope = await queryOne(
        `SELECT u.id FROM users u
         WHERE u.id = $1
           AND EXISTS (
             SELECT 1 FROM user_warehouse_assignments uwa
             WHERE uwa.user_id = u.id AND ${scope.clause}
           )`,
        [id, ...scope.params]
      );
      if (!inScope) return apiError('Not found', 404);
    }
  }

  const showSalary = canSeeSalary(u);

  const [employee, emergencyContacts, documents, leaveBalancesRaw, auditEventsRaw] =
    await Promise.all([
      queryOne<Record<string, unknown>>(`
        SELECT
          u.id, u.employee_id, u.name_th, u.name_en, u.email, u.phone, u.role,
          u.department_id, d.name_th AS department_name_th,
          u.position_id, p.name_th AS position_name_th,
          u.employment_type, u.employee_status, u.hired_date, u.resignation_date,
          ${showSalary ? 'u.base_salary, sg.name_th AS salary_grade_name' : 'NULL AS base_salary, NULL AS salary_grade_name'}
        FROM users u
        LEFT JOIN departments d ON d.id = u.department_id
        LEFT JOIN positions p ON p.id = u.position_id
        LEFT JOIN salary_grades sg ON sg.id = u.salary_grade_id
        WHERE u.id = $1
      `, [id]),

      query(`
        SELECT id, employee_id, contact_name, relationship, phone, alt_phone, address, is_primary, created_at, updated_at
        FROM employee_emergency_contacts
        WHERE employee_id = $1
        ORDER BY is_primary DESC, created_at ASC
      `, [id]),

      query(`
        SELECT id, employee_id, doc_type, filename, storage_url, issued_date, expiry_date,
               status, uploaded_by_user_id, verified_by_user_id, verified_at, rejected_reason, notes, created_at
        FROM employee_documents
        WHERE employee_id = $1
        ORDER BY created_at DESC
      `, [id]),

      query(`
        SELECT lb.id AS leave_balance_id, lb.leave_type_id, lt.name_th AS leave_type_name_th,
               lb.year, lb.days_entitled, lb.days_used,
               (lb.days_entitled - lb.days_used) AS days_remaining
        FROM leave_balances lb
        JOIN leave_types lt ON lt.id = lb.leave_type_id
        WHERE lb.employee_id = $1 AND lb.year = $2
        ORDER BY lt.name_th
      `, [id, new Date().getFullYear()]),

      query(`
        SELECT ae.id, ae.event_type, ae.event_payload_json, ae.created_at,
               u.name_th AS actor_name_th
        FROM hr_employee_audit_events ae
        LEFT JOIN users u ON u.id = ae.actor_user_id
        WHERE ae.employee_id = $1
        ORDER BY ae.created_at DESC
        LIMIT 30
      `, [id]),
    ]);

  if (!employee) return apiError('Not found', 404);

  // Attendance summary for current month
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const [attendanceStats, pendingAdj] = await Promise.all([
    queryOne<{
      present_days: string;
      late_days: string;
      absent_days: string;
      half_days: string;
      ot_hours: string;
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'present') AS present_days,
        COUNT(*) FILTER (WHERE status = 'late') AS late_days,
        COUNT(*) FILTER (WHERE status = 'absent') AS absent_days,
        COUNT(*) FILTER (WHERE status = 'half_day') AS half_days,
        COALESCE(SUM(ot_hours), 0) AS ot_hours
      FROM attendance_records
      WHERE employee_id = $1 AND work_date >= $2
    `, [id, monthStart]),

    queryOne<{ cnt: string }>(`
      SELECT COUNT(*) AS cnt FROM attendance_adjustment_requests
      WHERE employee_id = $1 AND status = 'submitted'
    `, [id]),
  ]);

  const attendanceSummary: HrAttendanceSummary = {
    month: monthStart.slice(0, 7),
    present_days: Number(attendanceStats?.present_days ?? 0),
    late_days: Number(attendanceStats?.late_days ?? 0),
    absent_days: Number(attendanceStats?.absent_days ?? 0),
    half_days: Number(attendanceStats?.half_days ?? 0),
    ot_hours: Number(attendanceStats?.ot_hours ?? 0),
    pending_adjustments: Number(pendingAdj?.cnt ?? 0),
  };

  // Payroll summary (latest run line for this employee)
  let payrollSummary = null;
  if (showSalary) {
    payrollSummary = await queryOne<{
      latest_run_id: string;
      latest_run_number: string;
      period_month: number;
      period_year: number;
      gross_pay: number;
      net_pay: number;
    }>(`
      SELECT pr.id AS latest_run_id, pr.run_number AS latest_run_number,
             pr.period_month, pr.period_year, pl.gross_pay, pl.net_pay
      FROM payroll_lines pl
      JOIN payroll_runs pr ON pr.id = pl.run_id
      WHERE pl.employee_id = $1 AND pr.status = 'approved'
      ORDER BY pr.period_year DESC, pr.period_month DESC
      LIMIT 1
    `, [id]);
  }

  const response: HrEmployeeProfileResponse = {
    employee: employee as unknown as HrEmployeeProfileResponse['employee'],
    emergency_contacts: emergencyContacts as HrEmployeeProfileResponse['emergency_contacts'],
    documents: documents as HrEmployeeProfileResponse['documents'],
    leave_balances: leaveBalancesRaw as HrEmployeeProfileResponse['leave_balances'],
    attendance_summary: attendanceSummary,
    payroll_summary: payrollSummary,
    audit_events: auditEventsRaw as HrEmployeeProfileResponse['audit_events'],
  };

  return apiSuccess(response);
}

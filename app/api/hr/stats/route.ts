import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query, queryOne } from '@/lib/db/client';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const today = new Date().toISOString().split('T')[0];

  const [[empStats], [deptStats], [leaveStats], [attendanceStats], latestPayroll] = await Promise.all([
    // 1. Employee Stats
    query<{ total: string; active: string }>(
      `SELECT 
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE employee_status = 'active') AS active
       FROM users WHERE role != 'admin' OR employee_status IS NOT NULL`,
      []
    ),
    // 2. Department count
    query<{ count: string }>(
      `SELECT COUNT(*) FROM departments WHERE is_active = TRUE`,
      []
    ),
    // 3. Pending Leave Requests
    query<{ pending: string }>(
      `SELECT COUNT(*) AS pending FROM leave_requests WHERE status = 'submitted'`,
      []
    ),
    // 4. Today's Attendance
    query<{ present: string; late: string; absent: string }>(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'present') AS present,
         COUNT(*) FILTER (WHERE status = 'late') AS late,
         COUNT(*) FILTER (WHERE status = 'absent') AS absent
       FROM attendance_records 
       WHERE work_date = $1`,
      [today]
    ),
    // 5. Latest Payroll Run
    queryOne<{ run_number: string; period_month: number; period_year: number; status: string }>(
      `SELECT run_number, period_month, period_year, status 
       FROM payroll_runs 
       ORDER BY created_at DESC LIMIT 1`,
      []
    )
  ]);

  return apiSuccess({
    employees: {
      total: parseInt(empStats.total),
      active: parseInt(empStats.active)
    },
    departments: parseInt(deptStats.count),
    leave: {
      pending: parseInt(leaveStats.pending)
    },
    attendance: {
      present: parseInt(attendanceStats.present),
      late: parseInt(attendanceStats.late),
      absent: parseInt(attendanceStats.absent)
    },
    payroll: latestPayroll || null
  });
}

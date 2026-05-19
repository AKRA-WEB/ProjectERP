import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query, queryOne } from '@/lib/db/client';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const DEPT_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

  const [
    empStats,
    deptStats,
    leaveStats,
    attendanceStats,
    latestPayroll,
    attendanceFeed,
    pendingLeaveQueue,
    deptHeadcount,
    upcomingEvents
  ] = await Promise.all([
    // 1. Employee Stats
    queryOne<{ total: string; active: string; probation: string; resigned_this_month: string }>(
      `SELECT 
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE employee_status = 'active') AS active,
         COUNT(*) FILTER (WHERE hired_date >= CURRENT_DATE - 120) AS probation,
         COUNT(*) FILTER (WHERE resignation_date >= date_trunc('month', CURRENT_DATE)) AS resigned_this_month
       FROM users WHERE role NOT IN ('admin', 'superadmin')`,
      []
    ),
    // 2. Department count
    queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM departments WHERE is_active = TRUE`,
      []
    ),
    // 3. Pending Leave Requests
    queryOne<{ pending: string }>(
      `SELECT COUNT(*) AS pending FROM leave_requests WHERE status = 'submitted'`,
      []
    ),
    // 4. Today's Attendance Stats
    queryOne<{ present: string; late: string; absent: string; on_leave: string }>(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'present') AS present,
         COUNT(*) FILTER (WHERE status = 'late') AS late,
         COUNT(*) FILTER (WHERE status = 'absent') AS absent,
         (SELECT COUNT(*) FROM leave_requests lr 
          WHERE lr.status = 'approved' AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date) AS on_leave
       FROM attendance_records 
       WHERE work_date = CURRENT_DATE`,
      []
    ),
    // 5. Latest Payroll Run
    queryOne<{ run_number: string; period_month: number; period_year: number; status: string; total_net: string }>(
      `SELECT run_number, period_month, period_year, status, total_net
       FROM payroll_runs 
       ORDER BY created_at DESC LIMIT 1`,
      []
    ),
    // 6. Attendance Feed
    query<any>(
      `SELECT
        u.id AS employee_id,
        u.name AS name_th,
        u.position,
        COALESCE(d.name_th, u.department) AS department_name_th,
        TO_CHAR(ar.clock_in AT TIME ZONE 'Asia/Bangkok', 'HH24:MI') AS clock_in,
        TO_CHAR(ar.clock_out AT TIME ZONE 'Asia/Bangkok', 'HH24:MI') AS clock_out,
        CASE
          WHEN lr.id IS NOT NULL THEN 'on_leave'
          WHEN ar.id IS NULL THEN 'absent'
          WHEN ar.status = 'late' THEN 'late'
          ELSE 'present'
        END AS status,
        CASE
          WHEN ar.status = 'late'
          THEN EXTRACT(EPOCH FROM (ar.clock_in::time - '09:00:00'::time)) / 60
          ELSE 0
        END::int AS late_minutes,
        'กะเช้า 09:00-18:00' AS shift_label,
        lt.name_th AS leave_type_name_th
      FROM users u
      LEFT JOIN attendance_records ar
        ON ar.employee_id = u.id AND ar.work_date = CURRENT_DATE
      LEFT JOIN leave_requests lr
        ON lr.employee_id = u.id
        AND lr.status = 'approved'
        AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
      LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.is_active = TRUE AND u.role NOT IN ('admin', 'superadmin')
      ORDER BY ar.clock_in ASC NULLS LAST
      LIMIT 10`,
      []
    ),
    // 7. Pending Leave Queue
    query<any>(
      `SELECT
        lr.id,
        u.name AS employee_name_th,
        u.employee_code,
        lt.name_th AS leave_type_name_th,
        lr.start_date::text,
        lr.end_date::text,
        lr.days_requested,
        COALESCE(lr.notes, '') AS reason,
        lr.created_at::text,
        (lr.start_date <= CURRENT_DATE + 1) AS is_urgent,
        COALESCE(approver.name, '') AS approver_name_th
      FROM leave_requests lr
      JOIN users u ON u.id = lr.employee_id
      JOIN leave_types lt ON lt.id = lr.leave_type_id
      LEFT JOIN users approver ON approver.id = lr.approved_by
      WHERE lr.status = 'submitted'
      ORDER BY lr.created_at ASC
      LIMIT 4`,
      []
    ),
    // 8. Headcount by Dept
    query<any>(
      `SELECT
        d.id AS department_id,
        d.name_th,
        d.name_en,
        COUNT(u.id)::int AS count
      FROM departments d
      LEFT JOIN users u ON u.department_id = d.id AND u.is_active = TRUE
      GROUP BY d.id, d.name_th, d.name_en
      ORDER BY count DESC`,
      []
    ),
    // 9. Upcoming Events
    query<any>(
      `SELECT
        u.id AS employee_id,
        u.name AS name_th,
        TO_CHAR(u.hired_date, 'MM-DD') AS event_date,
        'anniv' AS kind,
        'ครบรอบทำงาน' AS label,
        'ครบ ' || (EXTRACT(YEAR FROM AGE(u.hired_date))::int + 1) || ' ปี' AS sub
      FROM users u
      WHERE u.is_active = TRUE
        AND u.hired_date IS NOT NULL
        AND (
          TO_CHAR(u.hired_date, 'MM-DD') BETWEEN TO_CHAR(CURRENT_DATE, 'MM-DD') AND TO_CHAR(CURRENT_DATE + 7, 'MM-DD')
          OR (
            TO_CHAR(CURRENT_DATE, 'MM-DD') > TO_CHAR(CURRENT_DATE + 7, 'MM-DD')
            AND (TO_CHAR(u.hired_date, 'MM-DD') >= TO_CHAR(CURRENT_DATE, 'MM-DD') OR TO_CHAR(u.hired_date, 'MM-DD') <= TO_CHAR(CURRENT_DATE + 7, 'MM-DD'))
          )
        )
      ORDER BY TO_CHAR(u.hired_date, 'MM-DD') ASC
      LIMIT 10`,
      []
    )
  ]);

  const headcountByDept = deptHeadcount.map((d: any, i: number) => ({
    ...d,
    color: DEPT_COLORS[i % DEPT_COLORS.length]
  }));

  return apiSuccess({
    // KPI fields for redesigned dashboard
    totalEmployees: parseInt(empStats?.total || '0'),
    activeEmployees: parseInt(empStats?.active || '0'),
    probationCount: parseInt(empStats?.probation || '0'),
    resignedThisMonth: parseInt(empStats?.resigned_this_month || '0'),
    presentToday: parseInt(attendanceStats?.present || '0'),
    lateCount: parseInt(attendanceStats?.late || '0'),
    absentCount: parseInt(attendanceStats?.absent || '0'),
    onLeaveToday: parseInt(attendanceStats?.on_leave || '0'),
    pendingLeaveCount: parseInt(leaveStats?.pending || '0'),
    latestPayrollNet: latestPayroll ? parseFloat(latestPayroll.total_net) : null,
    latestPayrollDate: latestPayroll ? `${latestPayroll.period_month}/${latestPayroll.period_year}` : null,
    
    // Legacy fields (optional support)
    employees: {
      total: parseInt(empStats?.total || '0'),
      active: parseInt(empStats?.active || '0')
    },
    departments: parseInt(deptStats?.count || '0'),
    leave: {
      pending: parseInt(leaveStats?.pending || '0')
    },
    attendance: {
      present: parseInt(attendanceStats?.present || '0'),
      late: parseInt(attendanceStats?.late || '0'),
      absent: parseInt(attendanceStats?.absent || '0')
    },
    payroll: latestPayroll || null,

    // New arrays
    attendanceFeed,
    pendingLeaveQueue,
    headcountByDept,
    upcoming: upcomingEvents
  });
}

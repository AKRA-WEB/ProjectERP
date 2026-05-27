import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query, queryOne } from '@/lib/db/client';

interface AttendanceFeedRow {
  employee_id: string;
  name_th: string;
  position: string;
  department_name_th: string;
  clock_in: string | null;
  clock_out: string | null;
  status: string;
  late_minutes: number;
  shift_label: string;
  leave_type_name_th: string | null;
}

interface PendingLeaveRow {
  id: string;
  employee_name_th: string;
  employee_code: string;
  leave_type_name_th: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  created_at: string;
  is_urgent: boolean;
  approver_name_th: string;
}


interface UpcomingEventRow {
  employee_id: string;
  name_th: string;
  event_date: string;
  kind: string;
  label: string;
  sub: string;
}

interface HrStatsSnapshot {
  total_employees: string;
  active_employees: string;
  probation_count: string;
  resigned_this_month: string;
  dept_headcount: Array<{ id: string; name_th: string; name_en: string; count: number }> | null;
  latest_payroll: { run_number: string; period_month: number; period_year: number; status: string; total_net: string } | null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const DEPT_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

  const [
    snapshot,
    attendanceStats,
    pendingLeaveCount,
    attendanceFeed,
    pendingLeaveQueue,
    upcomingEvents
  ] = await Promise.all([
    // 1. Slow-changing stats from materialized view (refreshed nightly)
    queryOne<HrStatsSnapshot>(`SELECT * FROM hr_stats_snapshot`, []),

    // 2. Today's attendance (real-time — changes per clock-in/out)
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

    // 3. Total pending leave count (real-time — drives badge number, not capped)
    queryOne<{ pending: string }>(
      `SELECT COUNT(*) AS pending FROM leave_requests WHERE status = 'submitted'`,
      []
    ),

    // 4. Attendance feed (real-time — top 10 for dashboard)
    query<AttendanceFeedRow>(
      `SELECT
        u.id AS employee_id,
        u.name_th,
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
          THEN EXTRACT(EPOCH FROM (ar.clock_in::time - COALESCE(ws.shift_start, '08:00:00')::time)) / 60
          ELSE 0
        END::int AS late_minutes,
        COALESCE(ws.name_th, 'กะมาตรฐาน 08:00-17:00') AS shift_label,
        lt.name_th AS leave_type_name_th
      FROM users u
      LEFT JOIN work_schedules ws ON ws.id = u.work_schedule_id
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

    // 5. Pending leave queue (real-time — 4 rows for dashboard widget)
    query<PendingLeaveRow>(
      `SELECT
        lr.id,
        u.name_th AS employee_name_th,
        u.employee_id AS employee_code,
        lt.name_th AS leave_type_name_th,
        lr.start_date::text,
        lr.end_date::text,
        lr.days_requested,
        COALESCE(lr.notes, '') AS reason,
        lr.created_at::text,
        (lr.start_date <= CURRENT_DATE + 1) AS is_urgent,
        COALESCE(approver.name_th, '') AS approver_name_th
      FROM leave_requests lr
      JOIN users u ON u.id = lr.employee_id
      JOIN leave_types lt ON lt.id = lr.leave_type_id
      LEFT JOIN users approver ON approver.id = lr.approved_by
      WHERE lr.status = 'submitted'
      ORDER BY lr.created_at ASC
      LIMIT 4`,
      []
    ),

    // 6. Upcoming anniversary events
    query<UpcomingEventRow>(
      `SELECT
        u.id AS employee_id,
        u.name_th,
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

  const headcountByDept = (snapshot?.dept_headcount ?? []).map((d, i: number) => ({
    ...d,
    color: DEPT_COLORS[i % DEPT_COLORS.length]
  }));

  return apiSuccess({
    totalEmployees: parseInt(snapshot?.total_employees || '0'),
    activeEmployees: parseInt(snapshot?.active_employees || '0'),
    probationCount: parseInt(snapshot?.probation_count || '0'),
    probationDaysRemaining: null,
    resignedThisMonth: parseInt(snapshot?.resigned_this_month || '0'),
    presentToday: parseInt(attendanceStats?.present || '0'),
    lateCount: parseInt(attendanceStats?.late || '0'),
    absentCount: parseInt(attendanceStats?.absent || '0'),
    onLeaveToday: parseInt(attendanceStats?.on_leave || '0'),
    pendingLeaveCount: parseInt(pendingLeaveCount?.pending || '0'),
    latestPayrollNet: snapshot?.latest_payroll ? parseFloat(snapshot.latest_payroll.total_net) : null,
    latestPayrollDate: snapshot?.latest_payroll
      ? `${snapshot.latest_payroll.period_month}/${snapshot.latest_payroll.period_year}`
      : null,
    employees: {
      total: parseInt(snapshot?.total_employees || '0'),
      active: parseInt(snapshot?.active_employees || '0'),
    },
    departments: headcountByDept.length,
    leave: { pending: parseInt(pendingLeaveCount?.pending || '0') },
    attendance: {
      present: parseInt(attendanceStats?.present || '0'),
      late: parseInt(attendanceStats?.late || '0'),
      absent: parseInt(attendanceStats?.absent || '0'),
    },
    payroll: snapshot?.latest_payroll ?? null,
    attendanceFeed,
    pendingLeaveQueue,
    headcountByDept,
    upcoming: upcomingEvents,
  });
}

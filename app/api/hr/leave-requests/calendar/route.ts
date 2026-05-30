import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const month = req.nextUrl.searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  // month = 'YYYY-MM'
  const [year, mon] = month.split('-').map(Number);
  const monthStart = new Date(year, mon - 1, 1);
  const monthEnd = new Date(year, mon, 0); // last day of month

  // eslint-disable-next-line local-rules/no-hardcoded-thai
  const LEAVE_COLORS: Record<string, string> = {
    // eslint-disable-next-line local-rules/no-hardcoded-thai
    'ลาป่วย': '#ef4444', 'ลากิจ': '#f59e0b', 'ลาพักร้อน': '#10b981',
    // eslint-disable-next-line local-rules/no-hardcoded-thai
    'ลาคลอด': '#8b5cf6', 'ลาทหาร': '#06b6d4',
  };

  interface TeamRow {
    employee_id: string;
    name_th: string;
    department_name_en: string;
  }

  const teamRows = await query<TeamRow>(`
    SELECT DISTINCT u.id AS employee_id, u.name_th,
      COALESCE(d.name_en, u.department, 'HR') AS department_name_en
    FROM users u
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE u.is_active = TRUE AND u.role NOT IN ('admin', 'superadmin')
    ORDER BY u.name_th ASC
    LIMIT 30
  `, []);

  interface LeaveRow {
    employee_id: string;
    from_day: number;
    to_day: number;
    type: string;
  }

  const leaveRows = await query<LeaveRow>(`
    SELECT lr.employee_id,
      GREATEST(EXTRACT(DAY FROM lr.start_date)::int, 1) AS from_day,
      LEAST(EXTRACT(DAY FROM lr.end_date)::int, $3) AS to_day,
      lt.name_th AS type
    FROM leave_requests lr
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    WHERE lr.status IN ('approved', 'submitted')
      AND lr.start_date <= $2 AND lr.end_date >= $1
  `, [monthStart, monthEnd, monthEnd.getDate()]);

  const leaves = leaveRows.map((l) => ({
    ...l,
    color: LEAVE_COLORS[l.type] ?? '#6366f1',
  }));

  return apiSuccess({
    team: teamRows,
    leaves,
    month_days: monthEnd.getDate(),
    first_weekday: monthStart.getDay(),
  });
}

import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query, queryOne } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function POST() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const today = new Date().toISOString().split('T')[0];
  const existing = await queryOne(
    `SELECT id, clock_in FROM attendance_records WHERE employee_id = $1 AND work_date = $2`,
    [u.id, today]
  );
  if (existing && (existing as { clock_in: string | null }).clock_in) {
    return apiError('Already clocked in today', 400);
  }

  // Determine late status by comparing with work schedule
  const schedule = await queryOne<{ shift_start: string }>(
    `SELECT ws.shift_start FROM work_schedules ws
     JOIN users usr ON usr.work_schedule_id = ws.id
     WHERE usr.id = $1
     UNION ALL
     SELECT shift_start FROM work_schedules WHERE is_default = TRUE LIMIT 1`,
    [u.id]
  );
  const now = new Date();
  let status = 'present';
  if (schedule) {
    const [sh, sm] = (schedule as { shift_start: string }).shift_start.split(':').map(Number);
    const shiftStart = new Date(now);
    shiftStart.setHours(sh, sm + 15, 0); // 15 min grace
    if (now > shiftStart) status = 'late';
  }

  await query(`
    INSERT INTO attendance_records (employee_id, work_date, clock_in, status)
    VALUES ($1, $2, NOW(), $3)
    ON CONFLICT (employee_id, work_date)
    DO UPDATE SET clock_in = NOW(), status = $3
  `, [u.id, today, status]);

  return apiSuccess({ ok: true, status });
}

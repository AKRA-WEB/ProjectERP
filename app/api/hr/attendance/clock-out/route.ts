import { auth } from '@/auth';
import { pool, queryOne } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import type { SessionUser } from '@/lib/authz';

export async function POST() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const today = new Date().toISOString().split('T')[0];
  const rec = await queryOne<{ id: string; clock_in: string | null; clock_out: string | null }>(
    `SELECT id, clock_in, clock_out FROM attendance_records WHERE employee_id = $1 AND work_date = $2`,
    [u.id, today]
  );
  if (!rec || !rec.clock_in) return apiError('Must clock in first', 400);
  if (rec.clock_out) return apiError('Already clocked out', 400);

  // Compute OT hours
  const schedule = await queryOne<{ shift_end: string }>(
    `SELECT ws.shift_end FROM work_schedules ws
     JOIN users usr ON usr.work_schedule_id = ws.id
     WHERE usr.id = $1
     UNION ALL
     SELECT shift_end FROM work_schedules WHERE is_default = TRUE LIMIT 1`,
    [u.id]
  );

  const now = new Date();
  let otHours = 0;
  if (schedule) {
    const [eh, em] = (schedule as { shift_end: string }).shift_end.split(':').map(Number);
    const shiftEnd = new Date(now);
    shiftEnd.setHours(eh, em, 0);
    if (now > shiftEnd) {
      otHours = Math.round(((now.getTime() - shiftEnd.getTime()) / 3600000) * 2) / 2; // round to 0.5
    }
  }

  await pool.query(
    `UPDATE attendance_records SET clock_out = NOW(), ot_hours = $1 WHERE id = $2`,
    [otHours, rec.id]
  );
  return apiSuccess({ ok: true, ot_hours: otHours });
}

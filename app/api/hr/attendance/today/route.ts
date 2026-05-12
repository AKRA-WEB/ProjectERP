import { auth } from '@/auth';
import { queryOne } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import type { SessionUser } from '@/lib/authz';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const today = new Date().toISOString().split('T')[0];
  const row = await queryOne(
    `SELECT * FROM attendance_records WHERE employee_id = $1 AND work_date = $2`,
    [u.id, today]
  );
  return apiSuccess(row ?? null);
}

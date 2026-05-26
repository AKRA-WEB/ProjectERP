import { auth } from '@/auth';
import { SessionUser, FieldSalesCheckin } from '@/types';
import { apiSuccess, apiError } from '@/lib/api-response';
import { queryOne } from '@/lib/db/client';

export async function POST() {
  const session = await auth();
  if (!session) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    // Find active checkin
    const active = await queryOne<FieldSalesCheckin>(
      `SELECT id FROM field_sales_checkins
       WHERE agent_user_id = $1 AND ended_at IS NULL
       LIMIT 1`,
      [u.id]
    );

    if (!active) {
      return apiError('No active check-in found to check out from', 400);
    }

    const updated = await queryOne<FieldSalesCheckin>(
      `UPDATE field_sales_checkins
       SET ended_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [active.id]
    );

    return apiSuccess(updated);
  } catch (err) {
    console.error('Field sales check-out error:', err);
    return apiError('Failed to check out', 500);
  }
}

import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import pool from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  if (!['admin', 'manager', 'staff'].includes(u.role)) {
    return apiError('Forbidden', 403);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE pos_picking_slips 
       SET status = 'picked', picked_at = NOW(), picked_by = $1 
       WHERE id = $2 AND status = 'printed' 
       RETURNING id, draft_cart_id`,
      [u.id, id]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return apiError('Picking slip not found or not in printed state', 409);
    }

    await client.query('COMMIT');
    return apiSuccess({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error marking picking slip as picked:', err);
    return apiError('Failed to mark picking slip as picked', 500);
  } finally {
    client.release();
  }
}

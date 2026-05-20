import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import pool, { queryOne } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  if (!['warehouse_staff', 'manager', 'admin'].includes(u.role)) return apiError('Forbidden', 403);

  const { id } = await params;
  const grn = await queryOne<{ status: string; inbound_order_id: string | null; source_type: string }>(
    'SELECT status, inbound_order_id, source_type FROM goods_receipt_notes WHERE id = $1', [id]
  );
  if (!grn) return apiError('GRN not found', 404);
  if (grn.status !== 'rejected') return apiError('Only rejected GRNs can be resubmitted', 409);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE goods_receipt_notes
       SET status = 'received', rejected_by = NULL, rejected_at = NULL, rejection_notes = NULL, updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
    if (grn.source_type === 'inbound_order' && grn.inbound_order_id) {
      await client.query(
        `UPDATE inbound_orders SET status = 'pending_verification', updated_at = NOW() WHERE id = $1`,
        [grn.inbound_order_id]
      );
    }
    await client.query('COMMIT');
    return apiSuccess({ id, status: 'received' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[POST /api/grn/[id]/resubmit]', e);
    throw e;
  } finally {
    client.release();
  }
}

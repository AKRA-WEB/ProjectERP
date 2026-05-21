import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import pool, { queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const schema = z.object({ reason: z.string().min(1) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const grn = await queryOne<{ status: string; inbound_order_id: string | null; source_type: string }>(
    'SELECT status, inbound_order_id, source_type FROM goods_receipt_notes WHERE id = $1', [id]
  );
  if (!grn) return apiError('GRN not found', 404);
  if (grn.status !== 'received') return apiError('Only received GRNs can be rejected', 409);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE goods_receipt_notes
       SET status = 'rejected', rejected_by = $1, rejected_at = NOW(), rejection_notes = $2, updated_at = NOW()
       WHERE id = $3`,
      [u.id, parsed.data.reason, id]
    );
    if (grn.source_type === 'inbound_order' && grn.inbound_order_id) {
      await client.query(
        `UPDATE inbound_orders SET status = 'receiving', updated_at = NOW() WHERE id = $1`,
        [grn.inbound_order_id]
      );
    }
    await client.query('COMMIT');
    return apiSuccess({ id, status: 'rejected' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[POST /api/grn/[id]/reject]', e);
    throw e;
  } finally {
    client.release();
  }
}

import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { queryOne } from '@/lib/db/client';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;
  const grn = await queryOne<{ status: string }>('SELECT status FROM goods_receipt_notes WHERE id = $1', [id]);
  if (!grn) return apiError('GRN not found', 404);
  if (grn.status !== 'draft') return apiError('Only draft GRNs can be confirmed', 409);

  await queryOne(`UPDATE goods_receipt_notes SET status = 'received' WHERE id = $1`, [id]);

  const grnFull = await queryOne<{ inbound_order_id: string | null }>(
    'SELECT inbound_order_id FROM goods_receipt_notes WHERE id = $1', [id]
  );
  if (grnFull?.inbound_order_id) {
    await queryOne(
      "UPDATE inbound_orders SET status = 'pending_verification' WHERE id = $1 AND status = 'receiving'",
      [grnFull.inbound_order_id]
    );
  }

  return apiSuccess({ id, status: 'received' });
}

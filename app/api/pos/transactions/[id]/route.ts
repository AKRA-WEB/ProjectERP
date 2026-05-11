import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import pool, { queryOne, query } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'pos:view'); } catch { return apiError('Forbidden', 403); }
  const { id } = await params;

  const txn = await queryOne(
    `SELECT t.*, u.name_en AS cashier_name, v.name_en AS voided_by_name
     FROM pos_transactions t
     JOIN users u ON u.id = t.created_by
     LEFT JOIN users v ON v.id = t.voided_by
     WHERE t.id = $1`,
    [id]
  );
  if (!txn) return apiError('Transaction not found', 404);

  const lines = await query(
    `SELECT tl.*, p.sku, p.barcode, p.name_th, p.name_en
     FROM pos_transaction_lines tl
     JOIN products p ON p.id = tl.product_id
     WHERE tl.transaction_id = $1`,
    [id]
  );

  return apiSuccess({ ...txn, lines });
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('void'),
    void_reason: z.string().min(1),
  }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const txn = await client.query<{ status: string; warehouse_id: string }>(
      'SELECT status, warehouse_id FROM pos_transactions WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (!txn.rows[0]) { await client.query('ROLLBACK'); return apiError('Transaction not found', 404); }
    if (txn.rows[0].status !== 'completed') { await client.query('ROLLBACK'); return apiError('Only completed transactions can be voided', 409); }

    const { warehouse_id } = txn.rows[0];
    try { assertPermission(u, 'pos:void'); } catch { await client.query('ROLLBACK'); return apiError('Forbidden', 403); }

    // Update transaction status
    await client.query(
      `UPDATE pos_transactions 
       SET status = 'voided', 
           voided_by = $1, 
           voided_at = NOW(), 
           void_reason = $2, 
           updated_at = NOW()
       WHERE id = $3`,
      [u.id, parsed.data.void_reason, id]
    );

    // Restore stock and record ledger entries
    const lines = await client.query<{ product_id: string; qty: number }>(
      'SELECT product_id, qty FROM pos_transaction_lines WHERE transaction_id = $1',
      [id]
    );

    for (const line of lines.rows) {
      const balanceRes = await client.query<{ qty_on_hand: string }>(
        'SELECT qty_on_hand FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE',
        [warehouse_id, line.product_id]
      );
      const qtyAfter = Number(balanceRes.rows[0]?.qty_on_hand ?? 0) + Number(line.qty);

      await client.query(
        `INSERT INTO stock_ledger (warehouse_id, product_id, entry_type, reference_type, reference_id, qty_change, qty_after, created_by)
         VALUES ($1, $2, 'pos_void', 'pos_transaction', $3, $4, $5, $6)`,
        [warehouse_id, line.product_id, id, line.qty, qtyAfter, u.id]
      );
    }

    await client.query('COMMIT');
    return apiSuccess({ id, status: 'voided' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POS Void error:', err);
    return apiError('Failed to void transaction', 500);
  } finally {
    client.release();
  }
}

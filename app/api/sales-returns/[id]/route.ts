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

  try { assertPermission(u, 'sr:view'); } catch { return apiError('Forbidden', 403); }
  const { id } = await params;

  const sr = await queryOne(
    `SELECT sr.*, 
            so.so_number,
            c.name_th AS customer_name_th, 
            w.name_th AS warehouse_name_th,
            u_cr.name_en AS created_by_name
     FROM sales_returns sr
     LEFT JOIN sales_orders so ON so.id = sr.so_id
     JOIN customers c ON c.id = sr.customer_id
     JOIN warehouses w ON w.id = sr.warehouse_id
     JOIN users u_cr ON u_cr.id = sr.created_by
     WHERE sr.id = $1`,
    [id]
  );
  if (!sr) return apiError('Sales return not found', 404);

  const lines = await query(
    `SELECT li.*, p.sku, p.name_th, p.name_en
     FROM sr_line_items li
     JOIN products p ON p.id = li.product_id
     WHERE li.sr_id = $1
     ORDER BY li.line_number ASC`,
    [id]
  );

  return apiSuccess({ ...sr, lines });
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('receive') }),
  z.object({ action: z.literal('restock') }),
  z.object({ action: z.literal('dispose') }),
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

    const srRes = await client.query(
      'SELECT * FROM sales_returns WHERE id = $1 FOR UPDATE',
      [id]
    );
    const sr = srRes.rows[0];
    if (!sr) { await client.query('ROLLBACK'); return apiError('SR not found', 404); }

    const { action } = parsed.data;

    if (action === 'receive') {
      try { assertPermission(u, 'sr:create'); } catch { await client.query('ROLLBACK'); return apiError('Forbidden', 403); }
      if (sr.status !== 'open') { await client.query('ROLLBACK'); return apiError('Can only receive open SR', 409); }
      
      const updated = await client.query(
        `UPDATE sales_returns SET status = 'received', received_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      await client.query('COMMIT');
      return apiSuccess(updated.rows[0]);
    }

    if (action === 'restock') {
      try { assertPermission(u, 'sr:restock'); } catch { await client.query('ROLLBACK'); return apiError('Forbidden', 403); }
      if (sr.status !== 'received') { await client.query('ROLLBACK'); return apiError('Can only restock received SR', 409); }
      
      const linesRes = await client.query('SELECT product_id, qty_returned FROM sr_line_items WHERE sr_id = $1', [id]);
      
      for (const line of linesRes.rows) {
        const balanceRes = await client.query(
          'SELECT qty_on_hand FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE',
          [sr.warehouse_id, line.product_id]
        );
        const currentQty = balanceRes.rows[0]?.qty_on_hand ?? 0;
        const qtyAfter = Number(currentQty) + Number(line.qty_returned);

        await client.query(
          `INSERT INTO stock_ledger (warehouse_id, product_id, entry_type, reference_type, reference_id, qty_change, qty_after, created_by)
           VALUES ($1, $2, 'so_return', 'sales_return', $3, $4, $5, $6)`,
          [sr.warehouse_id, line.product_id, sr.id, line.qty_returned, qtyAfter, u.id]
        );
      }

      const updated = await client.query(
        `UPDATE sales_returns SET status = 'restocked', restocked_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      await client.query('COMMIT');
      return apiSuccess(updated.rows[0]);
    }

    if (action === 'dispose') {
      try { assertPermission(u, 'sr:restock'); } catch { await client.query('ROLLBACK'); return apiError('Forbidden', 403); }
      if (sr.status !== 'received') { await client.query('ROLLBACK'); return apiError('Can only dispose received SR', 409); }
      
      const updated = await client.query(
        `UPDATE sales_returns SET status = 'disposed', disposed_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      await client.query('COMMIT');
      return apiSuccess(updated.rows[0]);
    }

    await client.query('ROLLBACK');
    return apiError('Invalid action', 400);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Patch SR error:', err);
    return apiError('Failed to update sales return', 500);
  } finally {
    client.release();
  }
}

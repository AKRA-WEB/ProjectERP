import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import pool from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';
import { z } from 'zod';

const ReleaseSchema = z.object({
  session_id: z.string().uuid(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  if (!['admin', 'manager', 'staff'].includes(u.role)) {
    return apiError('Forbidden', 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const result = ReleaseSchema.safeParse(body);
  if (!result.success) return apiError('Invalid request body', 400);
  const { session_id } = result.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify session
    const dsRes = await client.query(
      `SELECT invoice_id, status FROM dispatch_sessions WHERE id = $1 FOR UPDATE`,
      [session_id]
    );
    if (dsRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return apiError('Session not found', 404);
    }
    const ds = dsRes.rows[0];
    if (ds.status !== 'open') {
      await client.query('ROLLBACK');
      return apiError('Session is not open', 409);
    }

    // 2. Check if all lines are matched
    const expectedLines = await client.query(
      `SELECT dli.product_id, SUM(dli.qty_to_deliver) as expected_qty
       FROM sales_invoices si
       JOIN do_line_items dli ON dli.do_id = si.delivery_order_id
       WHERE si.id = $1
       GROUP BY dli.product_id`,
      [ds.invoice_id]
    );

    const scannedLines = await client.query(
      `SELECT product_id, SUM(scanned_qty) as scanned_total
       FROM dispatch_check_log
       WHERE session_id = $1
       GROUP BY product_id`,
      [session_id]
    );

    const missing = [];
    for (const exp of expectedLines.rows) {
      const scn = scannedLines.rows.find((s: { product_id: string; scanned_total: number | string }) => s.product_id === exp.product_id);
      const scnTotal = Number(scn?.scanned_total || 0);
      if (scnTotal < Number(exp.expected_qty)) {
        missing.push({
          product_id: exp.product_id,
          expected: Number(exp.expected_qty),
          scanned: scnTotal
        });
      }
    }

    if (missing.length > 0) {
      await client.query('ROLLBACK');
      return apiError('Missing quantities', 409, { code: 'MISSING_QTY', missing });
    }

    // 3. Post stock_ledger entries
    const siRes = await client.query(
      `SELECT si.id, do.warehouse_id, si.delivery_order_id
       FROM sales_invoices si
       JOIN delivery_orders do ON do.id = si.delivery_order_id
       WHERE si.id = $1`,
      [ds.invoice_id]
    );
    const siInfo = siRes.rows[0];

    for (const line of expectedLines.rows) {
      const balanceRes = await client.query(
        `SELECT qty_on_hand FROM stock_balances 
         WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE`,
        [siInfo.warehouse_id, line.product_id]
      );
      const currentQty = Number(balanceRes.rows[0]?.qty_on_hand || 0);
      const qtyChange = -Number(line.expected_qty);
      const qtyAfter = currentQty + qtyChange;

      await client.query(
        `INSERT INTO stock_ledger (warehouse_id, product_id, entry_type, reference_type, reference_id, qty_change, qty_after, created_by)
         VALUES ($1, $2, 'dispatch_out', 'sales_invoices', $3, $4, $5, $6)`,
        [siInfo.warehouse_id, line.product_id, ds.invoice_id, qtyChange, qtyAfter, u.id]
      );
    }

    // 4. Update session status
    await client.query(
      `UPDATE dispatch_sessions SET status = 'released', released_at = NOW() WHERE id = $1`,
      [session_id]
    );

    await client.query('COMMIT');
    return apiSuccess({ released: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Release error:', err);
    return apiError('Failed to release session', 500);
  } finally {
    client.release();
  }
}

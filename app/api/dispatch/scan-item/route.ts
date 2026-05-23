import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import pool from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';
import { z } from 'zod';

const ScanItemSchema = z.object({
  session_id: z.string().uuid(),
  product_id: z.string().uuid(),
  lot_id: z.string().uuid().optional(),
  qty: z.number().positive(),
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
  const result = ScanItemSchema.safeParse(body);
  if (!result.success) return apiError('Invalid request body', 400);
  const { session_id, product_id, lot_id, qty } = result.data;

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

    // 2. Compute expected_qty
    const expectedRes = await client.query(
      `SELECT SUM(dli.qty_to_deliver) as expected_qty
       FROM sales_invoices si
       JOIN do_line_items dli ON dli.do_id = si.delivery_order_id
       WHERE si.id = $1 AND dli.product_id = $2`,
      [ds.invoice_id, product_id]
    );
    const expected_qty = Number(expectedRes.rows[0]?.expected_qty || 0);

    // 3. Get currently scanned total
    const scannedRes = await client.query(
      `SELECT SUM(scanned_qty) as scanned_total FROM dispatch_check_log 
       WHERE session_id = $1 AND product_id = $2`,
      [session_id, product_id]
    );
    const scanned_total = Number(scannedRes.rows[0]?.scanned_total || 0) + qty;

    const resultStatus = scanned_total === expected_qty ? 'matched' : 'mismatched';

    // 4. Insert log
    await client.query(
      `INSERT INTO dispatch_check_log (session_id, invoice_id, product_id, lot_id, scanned_qty, expected_qty, gate_user_id, result)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [session_id, ds.invoice_id, product_id, lot_id || null, qty, expected_qty, u.id, resultStatus]
    );

    await client.query('COMMIT');
    return apiSuccess({ 
      result: resultStatus, 
      scanned_total, 
      expected_qty 
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Scan item error:', err);
    return apiError('Failed to log scan', 500);
  } finally {
    client.release();
  }
}

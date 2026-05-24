import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import pool from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';
import { z } from 'zod';

const ReleaseSchema = z.object({
  session_id: z.string().uuid(),
  override_token: z.string().optional(),
  reason_code: z.string().optional(),
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
  const { session_id, override_token, reason_code } = result.data;

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

    const siRes = await client.query(
      `SELECT si.id, do.warehouse_id, si.delivery_order_id
       FROM sales_invoices si
       JOIN delivery_orders do ON do.id = si.delivery_order_id
       WHERE si.id = $1`,
      [ds.invoice_id]
    );
    const siInfo = siRes.rows[0];

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
    let totalShortage = 0;
    for (const exp of expectedLines.rows) {
      const scn = scannedLines.rows.find((s: { product_id: string; scanned_total: number | string }) => s.product_id === exp.product_id);
      const scnTotal = Number(scn?.scanned_total || 0);
      const expectedQty = Number(exp.expected_qty);
      if (scnTotal < expectedQty) {
        const shortage = expectedQty - scnTotal;
        totalShortage += shortage;
        missing.push({
          product_id: exp.product_id,
          expected: expectedQty,
          scanned: scnTotal,
          shortage,
        });
      }
    }

    if (missing.length > 0) {
      if (totalShortage === 1) {
        // Minor Shortage: Auto-adjust quantities
        for (const line of missing) {
          if (line.scanned === 0) {
            await client.query(
              `DELETE FROM do_line_items WHERE do_id = $1 AND product_id = $2`,
              [siInfo.delivery_order_id, line.product_id]
            );
          } else {
            await client.query(
              `UPDATE do_line_items SET qty_to_deliver = $1 WHERE do_id = $2 AND product_id = $3`,
              [line.scanned, siInfo.delivery_order_id, line.product_id]
            );
          }
          await client.query(
            `INSERT INTO dispatch_exception_logs (dispatch_id, event_name, sku, original_qty, picked_qty, resolved_by)
             VALUES ($1, 'SHORTAGE_AUTO_ADJUST', (SELECT sku FROM products WHERE id = $2), $3, $4, $5)`,
            [session_id, line.product_id, line.expected, line.scanned, u.id]
          );
        }

        // Recalc totals
        const recalc = await client.query(
          `SELECT COALESCE(SUM(line_total), 0) as subtotal FROM do_line_items WHERE do_id = $1`,
          [siInfo.delivery_order_id]
        );
        const subtotal = Number(recalc.rows[0].subtotal || 0);
        const vat = Math.round(subtotal * 0.07 * 100) / 100;
        const total = subtotal + vat;

        await client.query(
          `UPDATE sales_invoices SET subtotal=$1, vat_amount=$2, total_amount=$3, updated_at=NOW() WHERE id=$4`,
          [subtotal, vat, total, ds.invoice_id]
        );

        // Re-query expectedLines since we changed them!
        const reExpectedLines = await client.query(
          `SELECT dli.product_id, SUM(dli.qty_to_deliver) as expected_qty
           FROM sales_invoices si
           JOIN do_line_items dli ON dli.do_id = si.delivery_order_id
           WHERE si.id = $1
           GROUP BY dli.product_id`,
          [ds.invoice_id]
        );
        expectedLines.rows = reExpectedLines.rows;

      } else {
        // Major Shortage (>=2): Override token required
        if (!override_token) {
          await client.query('ROLLBACK');
          return apiError('Major shortage detected. Supervisor override required.', 409, {
            code: 'SHORTAGE_PIN_REQUIRED',
            total_shortage: totalShortage,
            missing,
          });
        }

        // Consume override token
        try {
          const { consumeOverrideToken } = await import('@/lib/auth/override-pin');
          await consumeOverrideToken(override_token, 'dispatch_override', {
            target_table: 'dispatch_sessions',
            target_id: session_id,
            reason_code: reason_code || 'SHORTAGE_OVERRIDE',
            original_value: missing.map(m => ({ product_id: m.product_id, expected: m.expected })),
            override_value: missing.map(m => ({ product_id: m.product_id, scanned: m.scanned })),
            user_id: u.id,
          });
        } catch (err: unknown) {
          await client.query('ROLLBACK');
          const msg = err instanceof Error ? err.message : 'Invalid override PIN token';
          return apiError(msg, 400);
        }

        // Log exception and update DO lines
        for (const line of missing) {
          await client.query(
            `INSERT INTO dispatch_exception_logs (dispatch_id, event_name, sku, original_qty, picked_qty, resolved_by)
             VALUES ($1, 'SHORTAGE_PIN_REQUIRED', (SELECT sku FROM products WHERE id = $2), $3, $4, $5)`,
            [session_id, line.product_id, line.expected, line.scanned, u.id]
          );

          if (line.scanned === 0) {
            await client.query(
              `DELETE FROM do_line_items WHERE do_id = $1 AND product_id = $2`,
              [siInfo.delivery_order_id, line.product_id]
            );
          } else {
            await client.query(
              `UPDATE do_line_items SET qty_to_deliver = $1 WHERE do_id = $2 AND product_id = $3`,
              [line.scanned, siInfo.delivery_order_id, line.product_id]
            );
          }
        }

        // Recalc totals
        const recalc = await client.query(
          `SELECT COALESCE(SUM(line_total), 0) as subtotal FROM do_line_items WHERE do_id = $1`,
          [siInfo.delivery_order_id]
        );
        const subtotal = Number(recalc.rows[0].subtotal || 0);
        const vat = Math.round(subtotal * 0.07 * 100) / 100;
        const total = subtotal + vat;

        await client.query(
          `UPDATE sales_invoices SET subtotal=$1, vat_amount=$2, total_amount=$3, updated_at=NOW() WHERE id=$4`,
          [subtotal, vat, total, ds.invoice_id]
        );

        // Re-query expectedLines since we changed them!
        const reExpectedLines = await client.query(
          `SELECT dli.product_id, SUM(dli.qty_to_deliver) as expected_qty
           FROM sales_invoices si
           JOIN do_line_items dli ON dli.do_id = si.delivery_order_id
           WHERE si.id = $1
           GROUP BY dli.product_id`,
          [ds.invoice_id]
        );
        expectedLines.rows = reExpectedLines.rows;
      }
    }

    // 3. Post stock_ledger entries
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

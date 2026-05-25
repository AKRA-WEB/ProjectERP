import { auth } from '@/auth';
import { readOnlyMiddleware } from '@/lib/auth/readOnlyMiddleware';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import pool, { queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';
import { bumpInvoiceVersion } from '@/lib/invoice/versioning';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'si:view'); } catch { return apiError('Forbidden', 403); }
  const { id } = await params;

  const si = await queryOne(
    `SELECT si.*, 
            so.so_number,
            do_.do_number,
            c.name_th AS customer_name_th, 
            u_cr.name_en AS created_by_name
     FROM sales_invoices si
     JOIN sales_orders so ON so.id = si.so_id
     LEFT JOIN delivery_orders do_ ON do_.id = si.delivery_order_id
     JOIN customers c ON c.id = si.customer_id
     JOIN users u_cr ON u_cr.id = si.created_by
     WHERE si.id = $1`,
    [id]
  );
  if (!si) return apiError('Sales invoice not found', 404);

  return apiSuccess(si);
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('issue') }),
  z.object({ action: z.literal('mark_paid') }),
  z.object({ action: z.literal('void'), void_reason: z.string().min(1) }),
  z.object({ 
    action: z.literal('update_totals'), 
    subtotal: z.number(), 
    vat_amount: z.number(), 
    total_amount: z.number() 
  }),
  z.object({
    action: z.literal('update_lines'),
    lines: z.array(z.object({
      id: z.string().uuid(),
      qty_to_deliver: z.number().positive(),
      unit_price: z.number().nonnegative(),
    }))
  }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = await readOnlyMiddleware(req);
  if (blocked) return blocked;

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

    const siRes = await client.query(
      'SELECT * FROM sales_invoices WHERE id = $1 FOR UPDATE',
      [id]
    );
    const si = siRes.rows[0];
    if (!si) { await client.query('ROLLBACK'); return apiError('SI not found', 404); }

    const { action } = parsed.data;

    if (action === 'update_totals' || action === 'update_lines') {
      try { assertPermission(u, 'si:create'); } catch { await client.query('ROLLBACK'); return apiError('Forbidden', 403); }
      if (si.status !== 'draft') { await client.query('ROLLBACK'); return apiError('Can only edit draft SI', 409); }

      let changeSummary = {};

      if (action === 'update_totals') {
        const { subtotal, vat_amount, total_amount } = parsed.data as { subtotal: number; vat_amount: number; total_amount: number };
        changeSummary = {
          type: 'totals_update',
          old_total: Number(si.total_amount),
          new_total: total_amount,
        };
        await client.query(
          `UPDATE sales_invoices SET subtotal=$1, vat_amount=$2, total_amount=$3, updated_at=NOW() WHERE id=$4`,
          [subtotal, vat_amount, total_amount, id]
        );
      }

      if (action === 'update_lines') {
        const { lines } = parsed.data as { lines: { id: string; qty_to_deliver: number; unit_price: number }[] };
        if (!si.delivery_order_id) {
          await client.query('ROLLBACK');
          return apiError('Cannot update lines on SI without DO', 400);
        }

        // 1. Get old lines for diff
        const oldLinesRes = await client.query(
          `SELECT id, product_id, qty_to_deliver, unit_price FROM do_line_items WHERE do_id = $1`,
          [si.delivery_order_id]
        );
        const oldLines = oldLinesRes.rows;

        // 2. Update lines
        for (const line of lines) {
          await client.query(
            `UPDATE do_line_items SET qty_to_deliver=$1, unit_price=$2 WHERE id=$3`,
            [line.qty_to_deliver, line.unit_price, line.id]
          );
        }

        // 3. Diff for changeSummary
        const newLinesRes = await client.query(
          `SELECT id, product_id, qty_to_deliver, unit_price FROM do_line_items WHERE do_id = $1`,
          [si.delivery_order_id]
        );
        const newLines = newLinesRes.rows;
        
        const lineChanges = [];
        for (const nl of newLines) {
          const ol = oldLines.find(o => o.id === nl.id);
          if (!ol) continue; // Should not happen with update_lines
          if (Number(ol.qty_to_deliver) !== Number(nl.qty_to_deliver) || Number(ol.unit_price) !== Number(nl.unit_price)) {
            lineChanges.push({
              product_id: nl.product_id,
              old_qty: Number(ol.qty_to_deliver),
              new_qty: Number(nl.qty_to_deliver),
              old_price: Number(ol.unit_price),
              new_price: Number(nl.unit_price)
            });
          }
        }
        changeSummary = { type: 'line_update', changes: lineChanges };

        // 4. Recalc totals
        const recalc = await client.query(
          `SELECT SUM(line_total) as subtotal FROM do_line_items WHERE do_id = $1`,
          [si.delivery_order_id]
        );
        const subtotal = Number(recalc.rows[0].subtotal || 0);
        const vat = Math.round(subtotal * 0.07 * 100) / 100;
        const total = subtotal + vat;

        await client.query(
          `UPDATE sales_invoices SET subtotal=$1, vat_amount=$2, total_amount=$3, updated_at=NOW() WHERE id=$4`,
          [subtotal, vat, total, id]
        );
      }

      // 5. Bump Version
      const version = await bumpInvoiceVersion(client, id, u.id, changeSummary);
      
      const finalSi = await client.query('SELECT * FROM sales_invoices WHERE id=$1', [id]);
      await client.query('COMMIT');
      return apiSuccess({ ...finalSi.rows[0], ...version });
    }

    if (action === 'issue') {
      try { assertPermission(u, 'si:create'); } catch { await client.query('ROLLBACK'); return apiError('Forbidden', 403); }
      if (si.status !== 'draft') { await client.query('ROLLBACK'); return apiError('Can only issue draft SI', 409); }
      
      const updated = await client.query(
        `UPDATE sales_invoices SET status = 'issued', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      await client.query('COMMIT');
      return apiSuccess(updated.rows[0]);
    }

    if (action === 'mark_paid') {
      try { assertPermission(u, 'si:mark_paid'); } catch { await client.query('ROLLBACK'); return apiError('Forbidden', 403); }
      if (si.status !== 'issued') { await client.query('ROLLBACK'); return apiError('Can only mark issued SI as paid', 409); }
      
      const updated = await client.query(
        `UPDATE sales_invoices SET status = 'paid', paid_at = NOW(), paid_by = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [u.id, id]
      );

      await client.query(`UPDATE sales_orders SET status = 'paid', updated_at = NOW() WHERE id = $1`, [si.so_id]);

      await client.query('COMMIT');
      return apiSuccess(updated.rows[0]);
    }

    if (action === 'void') {
      // Must be admin or manager. (Or checking 'si:create' and roles)
      if (u.role !== 'admin' && u.role !== 'manager') {
        await client.query('ROLLBACK'); return apiError('Only managers and admins can void invoices', 403);
      }
      if (['paid', 'void'].includes(si.status)) {
        await client.query('ROLLBACK'); return apiError(`Cannot void SI in status ${si.status}`, 409);
      }
      
      const updated = await client.query(
        `UPDATE sales_invoices SET status = 'void', voided_at = NOW(), voided_by = $1, void_reason = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
        [u.id, parsed.data.void_reason, id]
      );
      await client.query('COMMIT');
      return apiSuccess(updated.rows[0]);
    }

    await client.query('ROLLBACK');
    return apiError('Invalid action', 400);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Patch SI error:', err);
    return apiError('Failed to update sales invoice', 500);
  } finally {
    client.release();
  }
}

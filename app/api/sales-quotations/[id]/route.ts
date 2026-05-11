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

  try { assertPermission(u, 'sq:view'); } catch { return apiError('Forbidden', 403); }
  const { id } = await params;

  const sq = await queryOne(
    `SELECT sq.*, 
            c.name_th AS customer_name_th, 
            w.name_th AS warehouse_name_th,
            u_cr.name_en AS created_by_name
     FROM sales_quotations sq
     JOIN customers c ON c.id = sq.customer_id
     JOIN warehouses w ON w.id = sq.warehouse_id
     JOIN users u_cr ON u_cr.id = sq.created_by
     WHERE sq.id = $1`,
    [id]
  );
  if (!sq) return apiError('Sales quotation not found', 404);

  const lines = await query(
    `SELECT li.*, p.sku, p.name_th, p.name_en
     FROM sq_line_items li
     JOIN products p ON p.id = li.product_id
     WHERE li.sq_id = $1
     ORDER BY li.line_number ASC`,
    [id]
  );

  return apiSuccess({ ...sq, lines });
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('send') }),
  z.object({ action: z.literal('accept') }),
  z.object({ action: z.literal('reject') }),
  z.object({ action: z.literal('expire') }),
  z.object({ action: z.literal('convert_to_so') }),
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

    const sqRes = await client.query(
      'SELECT * FROM sales_quotations WHERE id = $1 FOR UPDATE',
      [id]
    );
    const sq = sqRes.rows[0];
    if (!sq) { await client.query('ROLLBACK'); return apiError('SQ not found', 404); }

    const { action } = parsed.data;

    if (action === 'send') {
      try { assertPermission(u, 'sq:send'); } catch { await client.query('ROLLBACK'); return apiError('Forbidden', 403); }
      if (sq.status !== 'draft') { await client.query('ROLLBACK'); return apiError('Can only send draft SQ', 409); }
      
      const updated = await client.query(
        `UPDATE sales_quotations SET status = 'sent', sent_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      await client.query('COMMIT');
      return apiSuccess(updated.rows[0]);
    }

    if (action === 'accept') {
      try { assertPermission(u, 'sq:accept'); } catch { await client.query('ROLLBACK'); return apiError('Forbidden', 403); }
      if (sq.status !== 'sent') { await client.query('ROLLBACK'); return apiError('Can only accept sent SQ', 409); }
      
      const updated = await client.query(
        `UPDATE sales_quotations SET status = 'accepted', accepted_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      await client.query('COMMIT');
      return apiSuccess(updated.rows[0]);
    }

    if (action === 'reject') {
      try { assertPermission(u, 'sq:reject'); } catch { await client.query('ROLLBACK'); return apiError('Forbidden', 403); }
      if (sq.status !== 'sent') { await client.query('ROLLBACK'); return apiError('Can only reject sent SQ', 409); }
      
      const updated = await client.query(
        `UPDATE sales_quotations SET status = 'rejected', rejected_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      await client.query('COMMIT');
      return apiSuccess(updated.rows[0]);
    }

    if (action === 'expire') {
      try { assertPermission(u, 'sq:send'); } catch { await client.query('ROLLBACK'); return apiError('Forbidden', 403); }
      if (sq.status !== 'sent') { await client.query('ROLLBACK'); return apiError('Can only expire sent SQ', 409); }
      
      const updated = await client.query(
        `UPDATE sales_quotations SET status = 'expired', expired_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      await client.query('COMMIT');
      return apiSuccess(updated.rows[0]);
    }

    if (action === 'convert_to_so') {
      try { assertPermission(u, 'so:create'); } catch { await client.query('ROLLBACK'); return apiError('Forbidden', 403); }
      if (sq.status !== 'accepted') { await client.query('ROLLBACK'); return apiError('Can only convert accepted SQ', 409); }

      // Get payment terms from customer
      const custRes = await client.query('SELECT payment_terms_days FROM customers WHERE id = $1', [sq.customer_id]);
      const paymentTerms = custRes.rows[0]?.payment_terms_days ?? 30;

      // 1. Create SO Header
      const soRes = await client.query(
        `INSERT INTO sales_orders (
          customer_id, warehouse_id, payment_terms_days, subtotal, vat_amount, total_amount, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [sq.customer_id, sq.warehouse_id, paymentTerms, sq.subtotal, sq.vat_amount, sq.total_amount, u.id]
      );
      const so = soRes.rows[0];

      // 2. Link SQ to SO
      await client.query('INSERT INTO so_sq_links (so_id, sq_id) VALUES ($1, $2)', [so.id, sq.id]);

      // 3. Create SO Lines
      const linesRes = await client.query('SELECT * FROM sq_line_items WHERE sq_id = $1 ORDER BY line_number', [sq.id]);
      for (const line of linesRes.rows) {
        await client.query(
          `INSERT INTO so_line_items (
            so_id, product_id, sq_line_item_id, qty_ordered, unit_price, discount_amount, line_number
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [so.id, line.product_id, line.id, line.qty, line.unit_price, line.discount_amount, line.line_number]
        );
      }

      // 4. Update SQ status
      await client.query(
        `UPDATE sales_quotations SET status = 'converted_to_so', updated_at = NOW() WHERE id = $1`,
        [sq.id]
      );

      await client.query('COMMIT');
      return apiSuccess({ so_id: so.id });
    }

    await client.query('ROLLBACK');
    return apiError('Invalid action', 400);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Patch SQ error:', err);
    return apiError('Failed to update sales quotation', 500);
  } finally {
    client.release();
  }
}

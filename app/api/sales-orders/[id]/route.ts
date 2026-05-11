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

  try { assertPermission(u, 'so:view'); } catch { return apiError('Forbidden', 403); }
  const { id } = await params;

  const so = await queryOne(
    `SELECT so.*, 
            c.name_th AS customer_name_th, 
            w.name_th AS warehouse_name_th,
            u_cr.name_en AS created_by_name
     FROM sales_orders so
     JOIN customers c ON c.id = so.customer_id
     JOIN warehouses w ON w.id = so.warehouse_id
     JOIN users u_cr ON u_cr.id = so.created_by
     WHERE so.id = $1`,
    [id]
  );
  if (!so) return apiError('Sales order not found', 404);

  const lines = await query(
    `SELECT li.*, p.sku, p.name_th, p.name_en
     FROM so_line_items li
     JOIN products p ON p.id = li.product_id
     WHERE li.so_id = $1
     ORDER BY li.line_number ASC`,
    [id]
  );

  const delivery_orders = await query(
    `SELECT id, do_number, status, shipped_at, created_at 
     FROM delivery_orders WHERE so_id = $1 ORDER BY created_at DESC`,
    [id]
  );

  return apiSuccess({ ...so, lines, delivery_orders });
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('confirm') }),
  z.object({ action: z.literal('cancel'), cancellation_reason: z.string().min(1) }),
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

    const soRes = await client.query(
      'SELECT status, customer_id, total_amount FROM sales_orders WHERE id = $1 FOR UPDATE',
      [id]
    );
    const so = soRes.rows[0];
    if (!so) { await client.query('ROLLBACK'); return apiError('SO not found', 404); }

    const { action } = parsed.data;

    if (action === 'confirm') {
      try { assertPermission(u, 'so:confirm'); } catch { await client.query('ROLLBACK'); return apiError('Forbidden', 403); }
      if (so.status !== 'draft') { await client.query('ROLLBACK'); return apiError('Can only confirm draft SO', 409); }

      // Check credit limit
      const custRes = await client.query('SELECT credit_limit FROM customers WHERE id = $1', [so.customer_id]);
      const creditLimit = Number(custRes.rows[0]?.credit_limit || 0);
      
      const outstandingRes = await client.query(
        `SELECT SUM(total_amount) as outstanding FROM sales_orders 
         WHERE customer_id = $1 AND status IN ('confirmed', 'partially_delivered', 'fully_delivered')`,
        [so.customer_id]
      );
      const outstanding = Number(outstandingRes.rows[0]?.outstanding || 0) + Number(so.total_amount);
      const credit_limit_warning = creditLimit > 0 && outstanding > creditLimit;

      const updated = await client.query(
        `UPDATE sales_orders SET status = 'confirmed', confirmed_by = $1, confirmed_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`,
        [u.id, id]
      );
      await client.query('COMMIT');
      return apiSuccess({ ...updated.rows[0], credit_limit_warning });
    }

    if (action === 'cancel') {
      try { assertPermission(u, 'so:cancel'); } catch { await client.query('ROLLBACK'); return apiError('Forbidden', 403); }
      if (['invoiced', 'paid', 'closed', 'cancelled'].includes(so.status)) {
        await client.query('ROLLBACK'); return apiError(`Cannot cancel SO in status ${so.status}`, 409);
      }
      
      const updated = await client.query(
        `UPDATE sales_orders SET status = 'cancelled', cancelled_by = $1, cancelled_at = NOW(), cancellation_reason = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
        [u.id, parsed.data.cancellation_reason, id]
      );
      await client.query('COMMIT');
      return apiSuccess(updated.rows[0]);
    }

    await client.query('ROLLBACK');
    return apiError('Invalid action', 400);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Patch SO error:', err);
    return apiError('Failed to update sales order', 500);
  } finally {
    client.release();
  }
}

import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import pool, { queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

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

    const siRes = await client.query(
      'SELECT * FROM sales_invoices WHERE id = $1 FOR UPDATE',
      [id]
    );
    const si = siRes.rows[0];
    if (!si) { await client.query('ROLLBACK'); return apiError('SI not found', 404); }

    const { action } = parsed.data;

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

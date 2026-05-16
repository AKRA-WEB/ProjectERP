import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { queryOne } from '@/lib/db/client';
import pool from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body?.po_id || !body?.warehouse_id) return apiError('po_id and warehouse_id are required', 400);

  const po = await queryOne<{ id: string }>(
    "SELECT id FROM purchase_orders WHERE id = $1 AND status IN ('sent', 'partially_received')",
    [body.po_id]
  );
  if (!po) return apiError('PO not found or invalid status', 404);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const grnRes = await client.query<{ id: string; grn_number: string }>(
      `INSERT INTO goods_receipt_notes (po_id, warehouse_id, received_by, status)
       VALUES ($1, $2, $3, 'draft')
       RETURNING id, grn_number`,
      [po.id, body.warehouse_id, u.id]
    );
    const grnId = grnRes.rows[0].id;

    const poLines = await client.query<{ id: string; product_id: string; qty_ordered: number; qty_received: number }>(
      `SELECT id, product_id, qty_ordered, COALESCE(qty_received, 0) AS qty_received
       FROM po_line_items WHERE po_id = $1`,
      [po.id]
    );

    for (let i = 0; i < poLines.rows.length; i++) {
      const pl = poLines.rows[i];
      const remaining = Number(pl.qty_ordered) - Number(pl.qty_received);
      if (remaining <= 0) continue;

      await client.query(
        `INSERT INTO grn_line_items
           (grn_id, po_line_item_id, product_id, qty_received, qty_expected, line_number)
         VALUES ($1, $2, $3, 0, $4, $5)`,
        [grnId, pl.id, pl.product_id, remaining, i + 1]
      );
    }

    await client.query('COMMIT');
    return apiSuccess({ id: grnId, grn_number: grnRes.rows[0].grn_number }, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return apiError('Failed to create GRN template', 500);
  } finally {
    client.release();
  }
}

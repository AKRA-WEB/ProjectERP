import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import pool, { query, queryOne } from '@/lib/db/client';
import { assertRole } from '@/lib/authz';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;

  const [grn, lines, bonusItems] = await Promise.all([
    queryOne(
      `SELECT g.*, po.po_number, io.io_number, w.code AS warehouse_code, w.name_th AS warehouse_name,
              u1.name_en AS received_by_name, u2.name_en AS qc_reviewed_by_name, u3.name_en AS stocked_by_name
       FROM goods_receipt_notes g
       LEFT JOIN purchase_orders po ON po.id = g.po_id
       LEFT JOIN inbound_orders io ON io.id = g.inbound_order_id
       JOIN warehouses w ON w.id = g.warehouse_id
       JOIN users u1 ON u1.id = g.received_by
       LEFT JOIN users u2 ON u2.id = g.qc_reviewed_by
       LEFT JOIN users u3 ON u3.id = g.stocked_by
       WHERE g.id = $1`,
      [id]
    ),
    query(
      `SELECT li.*, p.sku, p.name_th, p.name_en, p.is_lot_tracked, p.is_serial_tracked, u.code AS uom_code,
              COALESCE(sb.qty_on_hand, 0) AS stock_on_hand
       FROM grn_line_items li
       JOIN products p ON p.id = li.product_id
       JOIN units_of_measure u ON u.id = p.uom_id
       JOIN goods_receipt_notes g ON g.id = li.grn_id
       LEFT JOIN stock_balances sb ON sb.product_id = li.product_id AND sb.warehouse_id = g.warehouse_id
       WHERE li.grn_id = $1
       ORDER BY li.line_number`,
      [id]
    ),
    query(
      `SELECT id, product_id, product_name, qty, unit, expiry_date, notes, line_number
       FROM grn_bonus_items
       WHERE grn_id = $1
       ORDER BY line_number`,
      [id]
    )
  ]);

  if (!grn) return apiError('GRN not found', 404);

  return apiSuccess({ ...grn, lines, bonus_items: bonusItems });
}

const PatchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('send_qc') }),
  z.object({ action: z.literal('qc_approve'), qc_notes: z.string().optional() }),
  z.object({ action: z.literal('qc_reject'), qc_notes: z.string().optional() }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { id } = await params;
  const grn = await queryOne<{ status: string }>('SELECT status FROM goods_receipt_notes WHERE id = $1', [id]);
  if (!grn) return apiError('GRN not found', 404);

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return apiError('Invalid request data', 400);

  const data = parsed.data;

  if (data.action === 'send_qc') {
    if (grn.status !== 'received') return apiError('GRN status must be received to send to QC', 409);
    await query("UPDATE goods_receipt_notes SET status = 'qc_pending' WHERE id = $1", [id]);
    return apiSuccess({ status: 'qc_pending' });
  }

  if (data.action === 'qc_approve' || data.action === 'qc_reject') {
    try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
    if (grn.status !== 'qc_pending') return apiError('GRN status must be qc_pending for QC review', 409);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const isApprove = data.action === 'qc_approve';
      const newStatus = isApprove ? 'qc_passed' : 'qc_failed';

      // Update line items
      await client.query(
        isApprove
          ? `UPDATE grn_line_items 
             SET qty_accepted = qty_received, qty_rejected = 0, qc_status = 'pass' 
             WHERE grn_id = $1`
          : `UPDATE grn_line_items 
             SET qty_accepted = 0, qty_rejected = qty_received, qc_status = 'fail' 
             WHERE grn_id = $1`,
        [id]
      );

      // Update GRN header
      await client.query(
        `UPDATE goods_receipt_notes 
         SET status = $1, qc_reviewed_by = $2, qc_notes = $3, qc_reviewed_at = NOW() 
         WHERE id = $4`,
        [newStatus, u.id, data.qc_notes ?? null, id]
      );

      await client.query('COMMIT');
      return apiSuccess({ status: newStatus });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('QC update failed:', err);
      return apiError('QC update failed', 500);
    } finally {
      client.release();
    }
  }

  return apiError('Invalid action', 400);
}

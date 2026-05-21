import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import pool from '@/lib/db/client';
import { z } from 'zod';
import { VAT_RATE } from '@/lib/constants';
import type { SessionUser, PurchaseOrder, POLineItem } from '@/types';

const PatchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('update_header'),
    bill_discount: z.number().min(0).optional(),
    non_vat_amount: z.number().min(0).optional(),
    include_vat: z.boolean().optional(),
    doc_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).nullable().optional(),
    expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).nullable().optional(),
    delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).nullable().optional(),
    from_address: z.string().nullable().optional(),
    to_address: z.string().nullable().optional(),
    reference: z.string().nullable().optional(),
    expected_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).nullable().optional(),
    payment_terms_days: z.number().int().nonnegative().optional(),
    notes: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal('update_lines'),
    lines: z.array(z.object({
      product_id: z.string().uuid(),
      pr_line_item_id: z.string().uuid().optional(),
      qty_ordered: z.number().positive(),
      unit_price: z.number().nonnegative(),
      line_discount: z.number().min(0).default(0),
    })).min(1),
  }),
  z.object({
    action: z.literal('update_status'),
    status: z.enum(['draft', 'sent', 'confirmed', 'cancelled', 'closed']),
  }),
]);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;

  const [po, lines, grns, invoices] = await Promise.all([
    queryOne<PurchaseOrder & { created_by_name: string, approved_by_name: string | null }>(
      `SELECT po.*, v.code AS vendor_code, v.name_th AS vendor_name, v.name_en AS vendor_name_en,
              w.code AS warehouse_code, w.name_th AS warehouse_name,
              u.name_en AS created_by_name,
              ua.name_en AS approved_by_name
       FROM purchase_orders po
       JOIN vendors v ON v.id = po.vendor_id
       JOIN warehouses w ON w.id = po.warehouse_id
       JOIN users u ON u.id = po.created_by
       LEFT JOIN users ua ON ua.id = po.approved_by
       WHERE po.id = $1`,
      [id]
    ),
    query<POLineItem & { sku: string, name_th: string, name_en: string, uom_code: string, is_lot_tracked: boolean, is_serial_tracked: boolean, qty_on_hand: number, qty_available: number }>(
      `SELECT li.*, p.sku, p.name_th, p.name_en, u.code AS uom_code,
              p.is_lot_tracked, p.is_serial_tracked,
              COALESCE(sb.qty_on_hand, 0) AS qty_on_hand,
              COALESCE(sb.qty_available, 0) AS qty_available
       FROM po_line_items li
       JOIN products p ON p.id = li.product_id
       JOIN units_of_measure u ON u.id = p.uom_id
       JOIN purchase_orders po_sub ON po_sub.id = li.po_id
       LEFT JOIN stock_balances sb ON sb.product_id = li.product_id AND sb.warehouse_id = po_sub.warehouse_id
       WHERE li.po_id = $1
       ORDER BY li.line_number`,
      [id]
    ),
    query(
      'SELECT id, grn_number, status, received_date FROM goods_receipt_notes WHERE po_id = $1 ORDER BY created_at DESC',
      [id]
    ),
    query(
      'SELECT * FROM po_invoices WHERE po_id = $1 ORDER BY invoice_date',
      [id]
    )
  ]);

  if (!po) return apiError('PO not found', 404);

  return apiSuccess({ ...po, lines, grns, invoices });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const currentPO = await queryOne<PurchaseOrder>(
    'SELECT status, subtotal, bill_discount, non_vat_amount, include_vat FROM purchase_orders WHERE id = $1',
    [id]
  );
  if (!currentPO) return apiError('PO not found', 404);

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  // Status guard: only status update is allowed for non-draft POs
  if (currentPO.status !== 'draft' && parsed.data.action !== 'update_status') {
    return apiError('Only draft POs can be edited', 409);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (parsed.data.action === 'update_status') {
      await client.query('UPDATE purchase_orders SET status = $1 WHERE id = $2', [parsed.data.status, id]);
    } else if (parsed.data.action === 'update_header') {
      const updates: string[] = [];
      const vals: unknown[] = [];
      let idx = 1;
      const fields = [
        'bill_discount', 'non_vat_amount', 'include_vat', 'doc_date', 'expiry_date',
        'delivery_date', 'from_address', 'to_address', 'reference', 'expected_date',
        'payment_terms_days', 'notes'
      ] as const;

      for (const f of fields) {
        if (parsed.data[f] !== undefined) {
          updates.push(`${f} = $${idx++}`);
          vals.push(parsed.data[f] === '' ? null : parsed.data[f]);
        }
      }

      if (updates.length) {
        vals.push(id);
        await client.query(`UPDATE purchase_orders SET ${updates.join(', ')} WHERE id = $${idx}`, vals);
      }
    } else if (parsed.data.action === 'update_lines') {
      // Validate line_discount
      for (const line of parsed.data.lines) {
        if (line.line_discount > line.qty_ordered * line.unit_price) {
          throw new Error(`Line discount for product ${line.product_id} exceeds line total`);
        }
      }

      await client.query('DELETE FROM po_line_items WHERE po_id = $1', [id]);
      const lineValues = parsed.data.lines
        .map((_, i) => `($1, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5}, $${i * 5 + 6}, ${i + 1})`)
        .join(', ');
      const lineParams: unknown[] = [id];
      for (const l of parsed.data.lines) {
        lineParams.push(l.product_id, l.pr_line_item_id ?? null, l.qty_ordered, l.unit_price, l.line_discount);
      }
      await client.query(
        `INSERT INTO po_line_items (po_id, product_id, pr_line_item_id, qty_ordered, unit_price, line_discount, line_number)
         VALUES ${lineValues}`,
        lineParams
      );
    }

    // Financial recalculation if needed
    const needsRecalc = parsed.data.action === 'update_lines' || 
                       (parsed.data.action === 'update_header' && 
                        (parsed.data.bill_discount !== undefined || parsed.data.non_vat_amount !== undefined || parsed.data.include_vat !== undefined));

    if (needsRecalc) {
      const lineData = await client.query<{ qty_ordered: number, unit_price: number, line_discount: number }>(
        'SELECT qty_ordered, unit_price, line_discount FROM po_line_items WHERE po_id = $1',
        [id]
      );
      
      // Get current header values after potential update above
      const headerData = await client.query<PurchaseOrder>(
        'SELECT bill_discount, non_vat_amount, include_vat FROM purchase_orders WHERE id = $1',
        [id]
      );
      const h = headerData.rows[0];

      const subtotal = lineData.rows.reduce((s, l) => s + Number(l.qty_ordered) * Number(l.unit_price), 0);
      const totalLineDiscount = lineData.rows.reduce((s, l) => s + Number(l.line_discount || 0), 0);
      const afterLineDiscount = subtotal - totalLineDiscount;
      const preVatAmount = afterLineDiscount - Number(h.bill_discount) - Number(h.non_vat_amount);
      const vatAmount = h.include_vat ? 0 : Math.round(preVatAmount * VAT_RATE * 100) / 100;
      const netTotal = preVatAmount + vatAmount + Number(h.non_vat_amount);

      await client.query(
        `UPDATE purchase_orders SET subtotal = $1, pre_vat_amount = $2, vat_amount = $3, total_amount = $4 WHERE id = $5`,
        [subtotal, preVatAmount, vatAmount, netTotal, id]
      );
    }

    await client.query('COMMIT');
    return apiSuccess({ id, updated: true });
  } catch (err) {
    await client.query('ROLLBACK');
    return apiError(err instanceof Error ? err.message : 'Update failed', 500);
  } finally {
    client.release();
  }
}

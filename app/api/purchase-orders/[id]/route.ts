import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import { VAT_RATE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const updateSchema = z.object({
  expected_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  payment_terms_days: z.number().int().nonnegative().optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(z.object({
    product_id: z.string().uuid(),
    pr_line_item_id: z.string().uuid().optional(),
    qty_ordered: z.number().positive(),
    unit_price: z.number().nonnegative(),
  })).min(1).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;
  const po = await queryOne(
    `SELECT po.*, v.code AS vendor_code, v.name_th AS vendor_name, v.name_en AS vendor_name_en,
            w.code AS warehouse_code, w.name_th AS warehouse_name,
            u.name_en AS created_by_name
     FROM purchase_orders po
     JOIN vendors v ON v.id = po.vendor_id
     JOIN warehouses w ON w.id = po.warehouse_id
     JOIN users u ON u.id = po.created_by
     WHERE po.id = $1`,
    [id]
  );
  if (!po) return apiError('PO not found', 404);

  const lines = await query(
    `SELECT li.*, p.sku, p.name_th, p.name_en, u.code AS uom_code,
            p.is_lot_tracked, p.is_serial_tracked,
            COALESCE(sb.qty_on_hand, 0) AS qty_on_hand,
            COALESCE(sb.qty_available, 0) AS qty_available
     FROM po_line_items li
     JOIN products p ON p.id = li.product_id
     JOIN units_of_measure u ON u.id = p.uom_id
     LEFT JOIN stock_balances sb ON sb.product_id = li.product_id AND sb.warehouse_id = $2
     WHERE li.po_id = $1
     ORDER BY li.line_number`,
    [id, (po as { warehouse_id: string }).warehouse_id]
  );

  const invoices = await query(
    'SELECT * FROM po_invoices WHERE po_id = $1 ORDER BY invoice_date',
    [id]
  );

  return apiSuccess({ ...po, lines, invoices });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const po = await queryOne<{ status: string }>('SELECT status FROM purchase_orders WHERE id = $1', [id]);
  if (!po) return apiError('PO not found', 404);
  if (po.status !== 'draft') return apiError('Only draft POs can be edited', 409);

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const updates: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (parsed.data.expected_date !== undefined) { updates.push(`expected_date = $${idx++}`); vals.push(parsed.data.expected_date); }
  if (parsed.data.payment_terms_days !== undefined) { updates.push(`payment_terms_days = $${idx++}`); vals.push(parsed.data.payment_terms_days); }
  if (parsed.data.notes !== undefined) { updates.push(`notes = $${idx++}`); vals.push(parsed.data.notes); }

  if (parsed.data.lines) {
    await query('DELETE FROM po_line_items WHERE po_id = $1', [id]);
    const lineValues = parsed.data.lines
      .map((_, i) => `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5}, ${i + 1})`)
      .join(', ');
    const lineParams: unknown[] = [id];
    for (const l of parsed.data.lines) {
      lineParams.push(l.product_id, l.pr_line_item_id ?? null, l.qty_ordered, l.unit_price);
    }
    await query(
      `INSERT INTO po_line_items (po_id, product_id, pr_line_item_id, qty_ordered, unit_price, line_number) VALUES ${lineValues}`,
      lineParams
    );

    const subtotal = parsed.data.lines.reduce((s, l) => s + l.qty_ordered * l.unit_price, 0);
    const vat = Math.round(subtotal * VAT_RATE * 100) / 100;
    updates.push(`subtotal = $${idx++}`, `vat_amount = $${idx++}`, `total_amount = $${idx++}`);
    vals.push(subtotal, vat, Math.round((subtotal + vat) * 100) / 100);
  }

  if (updates.length) {
    vals.push(id);
    await queryOne(`UPDATE purchase_orders SET ${updates.join(', ')} WHERE id = $${idx}`, vals);
  }

  return apiSuccess({ id, updated: true });
}

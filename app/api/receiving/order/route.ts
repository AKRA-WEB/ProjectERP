import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { queryOne } from '@/lib/db/client';
import pool from '@/lib/db/client';
import { z } from 'zod';
import { VAT_RATE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const lineSchema = z.object({
  product_id: z.string().uuid(),
  qty_ordered: z.number().positive(),
  unit_price: z.number().nonnegative(),
});

const schema = z.object({
  vendor_id:   z.string().uuid(),
  warehouse_id: z.string().uuid(),
  expected_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:       z.string().optional(),
  lines:       z.array(lineSchema).min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const vendor = await queryOne('SELECT id FROM vendors WHERE id = $1 AND is_active = TRUE', [parsed.data.vendor_id]);
  if (!vendor) return apiError('Vendor not found', 404);

  const subtotal = parsed.data.lines.reduce((s, l) => s + l.qty_ordered * l.unit_price, 0);
  const vat      = Math.round(subtotal * VAT_RATE * 100) / 100;
  const total    = Math.round((subtotal + vat) * 100) / 100;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create PO
    const poRes = await client.query<{ id: string; po_number: string }>(
      `INSERT INTO purchase_orders
         (vendor_id, warehouse_id, expected_date, payment_terms_days, notes,
          subtotal, vat_amount, total_amount, status, created_by)
       VALUES ($1,$2,$3,30,$4,$5,$6,$7,'sent',$8)
       RETURNING id, po_number`,
      [
        parsed.data.vendor_id, parsed.data.warehouse_id,
        parsed.data.expected_date ?? null, parsed.data.notes ?? null,
        subtotal, vat, total, u.id,
      ]
    );
    const poId = poRes.rows[0].id;

    // 2. Create PO lines + collect po_line ids for GRN
    const poLineIds: { poLineId: string; productId: string; qty: number; unitPrice: number }[] = [];
    for (let i = 0; i < parsed.data.lines.length; i++) {
      const l = parsed.data.lines[i];
      const poLine = await client.query<{ id: string }>(
        `INSERT INTO po_line_items (po_id, product_id, qty_ordered, unit_price, line_number)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id`,
        [poId, l.product_id, l.qty_ordered, l.unit_price, i + 1]
      );
      poLineIds.push({ poLineId: poLine.rows[0].id, productId: l.product_id, qty: l.qty_ordered, unitPrice: l.unit_price });
    }

    // 3. Upsert vendor_products — record which vendor supplies each product
    for (const l of parsed.data.lines) {
      await client.query(
        `INSERT INTO vendor_products (vendor_id, product_id, unit_price)
         VALUES ($1,$2,$3)
         ON CONFLICT (vendor_id, product_id) DO UPDATE SET
           unit_price = EXCLUDED.unit_price,
           updated_at = NOW()`,
        [parsed.data.vendor_id, l.product_id, l.unit_price]
      );
    }

    // 4. Create GRN work card template (qty_received = 0 per line)
    const grnRes = await client.query<{ id: string; grn_number: string }>(
      `INSERT INTO goods_receipt_notes (po_id, warehouse_id, vendor_id, source_type, received_by, notes, status)
       VALUES ($1, $2, $3, 'po', $4, $5, 'draft')
       RETURNING id, grn_number`,
      [poId, parsed.data.warehouse_id, parsed.data.vendor_id, u.id, parsed.data.notes ?? null]
    );
    const grnId = grnRes.rows[0].id;

    for (let i = 0; i < poLineIds.length; i++) {
      const pl = poLineIds[i];
      await client.query(
        `INSERT INTO grn_line_items
           (grn_id, po_line_item_id, product_id, qty_received, qty_expected, unit_cost, line_number, source_type)
         VALUES ($1, $2, $3, 0, $4, $5, $6, 'po')`,
        [grnId, pl.poLineId, pl.productId, pl.qty, pl.unitPrice, i + 1]
      );
    }

    await client.query('COMMIT');
    return apiSuccess({
      po_id: poId,
      po_number: poRes.rows[0].po_number,
      grn_id: grnId,
      grn_number: grnRes.rows[0].grn_number,
    }, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return apiError('Failed to create receiving order', 500);
  } finally {
    client.release();
  }
}

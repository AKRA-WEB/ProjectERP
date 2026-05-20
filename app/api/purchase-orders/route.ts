import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole, buildWarehouseScopeClause } from '@/lib/authz';
import pool, { query } from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, VAT_RATE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const lineSchema = z.object({
  product_id: z.string().uuid(),
  pr_line_item_id: z.string().uuid().optional(),
  qty_ordered: z.number().positive(),
  unit_price: z.number().nonnegative(),
  line_discount: z.number().min(0).default(0),
  transaction_uom_id: z.string().uuid().optional(),
  transaction_qty: z.number().positive().optional(),
});

const createSchema = z.object({
  vendor_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  bill_discount: z.number().min(0).default(0),
  non_vat_amount: z.number().min(0).default(0),
  include_vat: z.boolean().default(false),
  doc_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).optional(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).optional(),
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).optional(),
  from_address: z.string().optional(),
  to_address: z.string().optional(),
  reference: z.string().optional(),
  expected_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).optional(),
  payment_terms_days: z.number().int().nonnegative().default(30),
  notes: z.string().optional(),
  pr_ids: z.array(z.string().uuid()).optional(),
  io_ids: z.array(z.string().uuid()).optional(),
  lines: z.array(lineSchema).min(1),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const status = searchParams.get('status');
  const warehouseId = searchParams.get('warehouse_id');
  const vendorId = searchParams.get('vendor_id');
  const search = searchParams.get('search');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const scope = buildWarehouseScopeClause(u, 'po.warehouse_id', idx);
  if (scope) { conditions.push(scope.clause); params.push(...scope.params); idx += scope.params.length; }

  if (status) { conditions.push(`po.status = $${idx++}`); params.push(status); }
  if (warehouseId) { conditions.push(`po.warehouse_id = $${idx++}`); params.push(warehouseId); }
  if (vendorId) { conditions.push(`po.vendor_id = $${idx++}`); params.push(vendorId); }
  if (search) { conditions.push(`po.po_number ILIKE $${idx++}`); params.push(`%${search}%`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [total] = await query<{ count: string }>(`SELECT COUNT(*) FROM purchase_orders po ${where}`, params);

  const rows = await query(
    `SELECT po.id, po.po_number, po.status, po.expected_date, po.total_amount, po.created_at,
            v.code AS vendor_code, v.name_th AS vendor_name,
            w.code AS warehouse_code, w.name_th AS warehouse_name,
            u2.name_en AS created_by_name
     FROM purchase_orders po
     JOIN vendors v ON v.id = po.vendor_id
     JOIN warehouses w ON w.id = po.warehouse_id
     JOIN users u2 ON u2.id = po.created_by
     ${where}
     ORDER BY po.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({
    data: rows,
    total: Number(total.count),
    page,
    limit,
    total_pages: Math.ceil(Number(total.count) / limit),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    console.error('[POST /api/purchase-orders] validation error', parsed.error.flatten());
    return apiValidationError(parsed.error);
  }

  // F-004: Validate line_discount upper bound
  for (const line of parsed.data.lines) {
    if (line.line_discount > line.qty_ordered * line.unit_price) {
      return apiError(`Line discount for product ${line.product_id} exceeds line total`, 400);
    }
  }

  // MF-1: Verify all linked PRs are admin_approved
  if (parsed.data.pr_ids?.length) {
    const prs = await query<{ id: string, status: string }>(
      'SELECT id, status FROM purchase_requisitions WHERE id = ANY($1::uuid[])',
      [parsed.data.pr_ids]
    );
    if (prs.length !== parsed.data.pr_ids.length) {
      return apiError('One or more purchase requests not found', 404);
    }
    const invalidPrs = prs.filter(pr => pr.status !== 'admin_approved');
    if (invalidPrs.length > 0) {
      return apiError('All purchase requests must be in admin_approved status to convert to PO', 422);
    }
  }

  // Authoritative Calculation Formula
  const subtotal = parsed.data.lines.reduce((sum, l) => sum + l.qty_ordered * l.unit_price, 0);
  const totalLineDiscount = parsed.data.lines.reduce((sum, l) => sum + (l.line_discount || 0), 0);
  const afterLineDiscount = subtotal - totalLineDiscount;
  const preVatAmount = afterLineDiscount - parsed.data.bill_discount - parsed.data.non_vat_amount;
  const vatAmount = parsed.data.include_vat ? 0 : Math.round(preVatAmount * VAT_RATE * 100) / 100;
  const netTotal = preVatAmount + vatAmount + parsed.data.non_vat_amount;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const poResult = await client.query<{ id: string; po_number: string; status: string }>(
      `INSERT INTO purchase_orders (
        vendor_id, warehouse_id, bill_discount, non_vat_amount, pre_vat_amount, include_vat,
        doc_date, expiry_date, delivery_date, from_address, to_address, reference,
        expected_date, payment_terms_days, notes, subtotal, vat_amount, total_amount, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING id, po_number, status`,
      [
        parsed.data.vendor_id, parsed.data.warehouse_id, parsed.data.bill_discount,
        parsed.data.non_vat_amount, preVatAmount, parsed.data.include_vat,
        parsed.data.doc_date || null, parsed.data.expiry_date || null, parsed.data.delivery_date || null,
        parsed.data.from_address ?? null, parsed.data.to_address ?? null, parsed.data.reference ?? null,
        parsed.data.expected_date || null, parsed.data.payment_terms_days,
        parsed.data.notes ?? null, subtotal, vatAmount, netTotal, u.id,
      ]
    );
    const poRow = poResult.rows[0];
    if (!poRow) throw new Error('Failed to create PO');

    const lineValues = parsed.data.lines
      .map((_, i) => `($1, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7}, $${i * 7 + 8}, ${i + 1})`)
      .join(', ');
    const lineParams: unknown[] = [poRow.id];
    for (const l of parsed.data.lines) {
      lineParams.push(
        l.product_id,
        l.pr_line_item_id ?? null,
        l.qty_ordered,
        l.unit_price,
        l.line_discount,
        l.transaction_uom_id ?? null,
        l.transaction_qty ?? null,
      );
    }
    await client.query(
      `INSERT INTO po_line_items (po_id, product_id, pr_line_item_id, qty_ordered, unit_price, line_discount, transaction_uom_id, transaction_qty, line_number)
       VALUES ${lineValues}`,
      lineParams
    );

    if (parsed.data.pr_ids?.length) {
      const linkValues = parsed.data.pr_ids.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
      const linkParams: unknown[] = [];
      for (const prId of parsed.data.pr_ids) { linkParams.push(prId, poRow.id); }
      await client.query(`INSERT INTO pr_po_links (pr_id, po_id) VALUES ${linkValues} ON CONFLICT DO NOTHING`, linkParams);
      await client.query(
        `UPDATE purchase_requisitions SET status = 'converted_to_po' WHERE id = ANY($1::uuid[])`,
        [parsed.data.pr_ids]
      );
    }

    if (parsed.data.io_ids?.length) {
      const ios = await client.query<{ id: string; vendor_id: string; status: string }>(
        'SELECT id, vendor_id, status FROM inbound_orders WHERE id = ANY($1::uuid[])',
        [parsed.data.io_ids]
      );
      const notVerified = ios.rows.filter((io) => io.status !== 'verified');
      if (notVerified.length > 0) throw new Error('All IOs must be verified before creating PO');

      for (const ioId of parsed.data.io_ids) {
        await client.query(
          'INSERT INTO io_po_links (io_id, po_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [ioId, poRow.id]
        );
      }
      await client.query(
        `UPDATE inbound_orders SET status = 'converted_to_po', updated_at = NOW()
         WHERE id = ANY($1::uuid[])`,
        [parsed.data.io_ids]
      );
      // Update unit_cost on GRN lines so stock cost is correct
      for (const line of parsed.data.lines) {
        await client.query(
          `UPDATE grn_line_items gli
           SET unit_cost = $1
           FROM goods_receipt_notes g
           JOIN io_po_links ipl ON ipl.io_id = g.inbound_order_id
           WHERE gli.grn_id = g.id
             AND gli.product_id = $2
             AND ipl.po_id = $3`,
          [line.unit_price, line.product_id, poRow.id]
        );
      }
    }

    await client.query('COMMIT');
    return apiSuccess(poRow, 201);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[POST /api/purchase-orders] transaction error', e);
    throw e;
  } finally {
    client.release();
  }
}


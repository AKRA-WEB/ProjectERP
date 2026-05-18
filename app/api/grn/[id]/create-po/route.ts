import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import pool, { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import { VAT_RATE } from '@/lib/constants';
import type { SessionUser } from '@/types';

const createPOFromGRNSchema = z.object({
  vendor_id: z.string().uuid(),
  payment_terms_days: z.number().int().nonnegative().optional().default(0),
  notes: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['manager', 'admin']);
  } catch (e) {
    const error = e as Error & { status?: number };
    return apiError(error.message, error.status || 403);
  }

  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const parsed = createPOFromGRNSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const grn = await queryOne<{
    id: string;
    status: string;
    po_id: string | null;
    source_type: string;
    warehouse_id: string;
    vendor_id: string | null;
  }>(
    'SELECT id, status, po_id, source_type, warehouse_id, vendor_id FROM goods_receipt_notes WHERE id = $1',
    [id]
  );

  if (!grn) return apiError('GRN not found', 404);
  if (grn.status !== 'stocked') return apiError('GRN must be stocked', 422);
  if (grn.po_id) return apiError('GRN already linked to a PO', 409);
  if (['po', 'inbound_order'].includes(grn.source_type)) {
    return apiError('Cannot create retrospective PO from PO-sourced GRN', 422);
  }

  const grnLines = await query<{
    product_id: string;
    qty_received: number;
    unit_cost: number;
    line_total: number;
  }>(
    'SELECT product_id, qty_received, unit_cost, line_total FROM grn_line_items WHERE grn_id = $1 ORDER BY line_number',
    [id]
  );

  if (grnLines.length === 0) return apiError('GRN has no lines', 422);

  const subtotal = grnLines.reduce((sum, line) => sum + Number(line.line_total), 0);
  const vat = subtotal * VAT_RATE;
  const total = subtotal + vat;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const poResult = await client.query(
      `INSERT INTO purchase_orders (
        po_number, vendor_id, warehouse_id, status, source_grn_id,
        subtotal, vat_amount, total_amount, payment_terms_days, notes, created_by
      ) VALUES (
        next_doc_number('PO', 'seq_po'), $1, $2, 'fully_received', $3,
        $4, $5, $6, $7, $8, $9
      ) RETURNING id, po_number`,
      [
        parsed.data.vendor_id || grn.vendor_id,
        grn.warehouse_id,
        grn.id,
        subtotal,
        vat,
        total,
        parsed.data.payment_terms_days,
        parsed.data.notes ?? null,
        u.id
      ]
    );
    const po = poResult.rows[0];

    for (let i = 0; i < grnLines.length; i++) {
      const line = grnLines[i];
      await client.query(
        `INSERT INTO po_line_items (
          po_id, product_id, qty_ordered, qty_received, unit_price, line_number
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [po.id, line.product_id, line.qty_received, line.qty_received, line.unit_cost, i + 1]
      );
    }

    // Link GRN back to the new PO
    await client.query(
      'UPDATE goods_receipt_notes SET po_id = $1 WHERE id = $2',
      [po.id, grn.id]
    );

    await client.query('COMMIT');
    return apiSuccess({ po_id: po.id, po_number: po.po_number });
  } catch (e) {
    await client.query('ROLLBACK');
    const error = e as Error;
    console.error('Create PO from GRN Error:', error);
    return apiError(error.message || 'Failed to create retrospective PO', 500);
  } finally {
    client.release();
  }
}

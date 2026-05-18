import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import pool, { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/types';

const prReceiveSchema = z.object({
  vendor_id: z.string().uuid().optional(),
  notes: z.string().optional(),
  lines: z.array(z.object({
    pr_line_item_id: z.string().uuid(),
    qty_received: z.number().positive(),
    unit_cost: z.number().positive(),
  })).min(1),
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
  const parsed = prReceiveSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const pr = await queryOne<{
    id: string;
    status: string;
    warehouse_id: string;
  }>(
    'SELECT id, status, warehouse_id FROM purchase_requisitions WHERE id = $1',
    [id]
  );

  if (!pr) return apiError('PR not found', 404);
  if (pr.status !== 'admin_approved') return apiError('PR must be admin_approved', 422);

  const prLines = await query<{
    id: string;
    product_id: string;
  }>(
    'SELECT id, product_id FROM pr_line_items WHERE pr_id = $1',
    [id]
  );

  const prLineMap = new Map(prLines.map(l => [l.id, l.product_id]));

  for (const line of parsed.data.lines) {
    if (!prLineMap.has(line.pr_line_item_id)) {
      return apiError(`PR line ${line.pr_line_item_id} does not belong to this PR`, 422);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const grnResult = await client.query(
      `INSERT INTO goods_receipt_notes (
        grn_number, warehouse_id, vendor_id, source_type, status, pr_id,
        received_by, received_date, notes
      ) VALUES (
        next_doc_number('GRN', 'seq_grn'), $1, $2, 'pr_direct', 'stocked', $3,
        $4, CURRENT_DATE, $5
      ) RETURNING id, grn_number`,
      [
        pr.warehouse_id,
        parsed.data.vendor_id ?? null,
        pr.id,
        u.id,
        parsed.data.notes ?? null
      ]
    );
    const grn = grnResult.rows[0];

    for (let i = 0; i < parsed.data.lines.length; i++) {
      const l = parsed.data.lines[i];
      const productId = prLineMap.get(l.pr_line_item_id);

      await client.query(
        `INSERT INTO grn_line_items (
          grn_id, product_id, qty_received, unit_cost, source_type,
          pr_line_item_id, line_number
        ) VALUES ($1, $2, $3, $4, 'pr_direct', $5, $6)`,
        [grn.id, productId, l.qty_received, l.unit_cost, l.pr_line_item_id, i + 1]
      );

      await client.query(
        `INSERT INTO stock_ledger (
          product_id, warehouse_id, direction, qty, unit_cost,
          reference_type, reference_id, created_by
        ) VALUES ($1, $2, 'in', $3, $4, 'grn', $5, $6)`,
        [productId, pr.warehouse_id, l.qty_received, l.unit_cost, grn.id, u.id]
      );
    }

    // Update PR status
    await client.query(
      "UPDATE purchase_requisitions SET status = 'received' WHERE id = $1",
      [pr.id]
    );

    await client.query('COMMIT');
    return apiSuccess({ grn_id: grn.id, grn_number: grn.grn_number });
  } catch (e) {
    await client.query('ROLLBACK');
    const error = e as Error;
    console.error('PR Direct Receipt Error:', error);
    return apiError(error.message || 'Failed to receive PR', 500);
  } finally {
    client.release();
  }
}

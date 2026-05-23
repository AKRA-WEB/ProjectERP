import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import pool, { queryOne, query } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';
import { z } from 'zod';

const PatchBRSchema = z.object({
  status: z.enum(['draft', 'submitted']).optional(),
  notes: z.string().optional(),
  lines: z.array(z.object({
    id: z.string().uuid().optional(),
    product_id: z.string().uuid(),
    qty_counted: z.number().nonnegative(),
    notes: z.string().optional(),
  })).optional(),
});

interface BRRecord {
  id: string;
  po_id: string;
  br_number: string;
  po_number: string;
  warehouse_name: string;
}

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const br = await queryOne<BRRecord>(
    `SELECT br.*, po.po_number, w.name_th as warehouse_name
     FROM blind_receipts br
     JOIN purchase_orders po ON po.id = br.po_id
     JOIN warehouses w ON w.id = br.warehouse_id
     WHERE br.id = $1`,
    [id]
  );
  if (!br) return apiError('Blind receipt not found', 404);

  // Security: Staff cannot see ordered quantities
  const lines = await query(
    `SELECT brl.*, p.name_th as product_name, p.sku as product_sku
     ${u.role !== 'staff' ? ', pli.qty_ordered as expected_qty' : ''}
     FROM blind_receipt_lines brl
     JOIN products p ON p.id = brl.product_id
     ${u.role !== 'staff' ? 'LEFT JOIN po_line_items pli ON pli.po_id = $2 AND pli.product_id = brl.product_id' : ''}
     WHERE brl.blind_receipt_id = $1
     ORDER BY brl.line_number`,
    [id, br.po_id]
  );

  return apiSuccess({ ...br, lines });
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const result = PatchBRSchema.safeParse(body);
  if (!result.success) return apiError('Invalid request body', 400);
  const { status, notes, lines } = result.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const brRes = await client.query(
      `SELECT status FROM blind_receipts WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (brRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return apiError('Blind receipt not found', 404);
    }
    if (brRes.rows[0].status === 'submitted') {
      await client.query('ROLLBACK');
      return apiError('Cannot modify a submitted blind receipt', 409);
    }

    // 1. Update header
    if (status || notes !== undefined) {
      await client.query(
        `UPDATE blind_receipts SET 
           status = COALESCE($1, status),
           notes = COALESCE($2, notes),
           updated_at = NOW()
         WHERE id = $3`,
        [status || null, notes ?? null, id]
      );
    }

    // 2. Update lines
    if (lines) {
      // Simplest: delete and recreate or upsert
      // We'll use the line_number to maintain order
      await client.query(`DELETE FROM blind_receipt_lines WHERE blind_receipt_id = $1`, [id]);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        await client.query(
          `INSERT INTO blind_receipt_lines (blind_receipt_id, product_id, qty_counted, notes, line_number)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, line.product_id, line.qty_counted, line.notes || null, i + 1]
        );
      }
    }

    await client.query('COMMIT');
    return apiSuccess({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Patch BR error:', err);
    return apiError('Failed to update blind receipt', 500);
  } finally {
    client.release();
  }
}

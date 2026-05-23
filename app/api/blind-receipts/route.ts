import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { buildWarehouseScopeClause } from '@/lib/authz';
import pool, { query } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';
import { z } from 'zod';

const CreateBRSchema = z.object({
  po_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  notes: z.string().optional(),
  lines: z.array(z.object({
    product_id: z.string().uuid(),
    qty_counted: z.number().nonnegative(),
    notes: z.string().optional(),
  })).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const result = CreateBRSchema.safeParse(body);
  if (!result.success) return apiError('Invalid request body', 400);
  const { po_id, warehouse_id, notes, lines } = result.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create BR
    const brRes = await client.query(
      `INSERT INTO blind_receipts (po_id, warehouse_id, counted_by, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING id, br_number`,
      [po_id, warehouse_id, u.id, notes || null]
    );
    const brId = brRes.rows[0].id;

    // 2. Create lines if provided
    if (lines && lines.length > 0) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        await client.query(
          `INSERT INTO blind_receipt_lines (blind_receipt_id, product_id, qty_counted, notes, line_number)
           VALUES ($1, $2, $3, $4, $5)`,
          [brId, line.product_id, line.qty_counted, line.notes || null, i + 1]
        );
      }
    }

    await client.query('COMMIT');
    return apiSuccess(brRes.rows[0], 201);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create BR error:', err);
    return apiError('Failed to create blind receipt', 500);
  } finally {
    client.release();
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { searchParams } = new URL(req.url);
  const poId = searchParams.get('po_id');

  const conditions = [];
  const params = [];
  let idx = 1;

  if (poId) {
    conditions.push(`br.po_id = $${idx++}`);
    params.push(poId);
  }


  // Role scoping
  if (u.role === 'staff') {
    conditions.push(`br.counted_by = $${idx++}`);
    params.push(u.id);
  } else {
    const scope = buildWarehouseScopeClause(u, 'br.warehouse_id', idx);
    if (scope) {
      conditions.push(scope.clause);
      params.push(...scope.params);
      idx += scope.params.length;
    }
  }


  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const brs = await query(
    `SELECT br.*, u.name_th as counted_by_name, w.name_th as warehouse_name
     FROM blind_receipts br
     JOIN users u ON u.id = br.counted_by
     JOIN warehouses w ON w.id = br.warehouse_id
     ${where}
     ORDER BY br.created_at DESC`,
    params
  );

  return apiSuccess(brs);
}

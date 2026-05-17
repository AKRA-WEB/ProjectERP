import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission, buildWarehouseScopeClause } from '@/lib/authz';
import pool, { query } from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const createSchema = z.object({
  customer_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  valid_until: z.string().optional().nullable(), // YYYY-MM-DD
  notes: z.string().optional().nullable(),
  lines: z.array(z.object({
    product_id: z.string().uuid(),
    qty: z.number().positive(),
    unit_price: z.number().min(0),
    discount_amount: z.number().min(0).default(0),
  })).min(1),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'sq:view'); } catch { return apiError('Forbidden', 403); }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const status = searchParams.get('status');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const scope = buildWarehouseScopeClause(u, 'sq.warehouse_id', idx);
  if (scope) {
    conditions.push(scope.clause);
    params.push(...scope.params);
    idx += scope.params.length;
  }

  if (status) {
    conditions.push(`sq.status = $${idx++}`);
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [totalRes] = await query<{ count: string }>(`SELECT COUNT(*) FROM sales_quotations sq ${where}`, params);

  const sqs = await query(
    `SELECT sq.*, 
            c.name_th AS customer_name_th, 
            w.name_th AS warehouse_name_th,
            u_cr.name_en AS created_by_name
     FROM sales_quotations sq
     JOIN customers c ON c.id = sq.customer_id
     JOIN warehouses w ON w.id = sq.warehouse_id
     JOIN users u_cr ON u_cr.id = sq.created_by
     ${where}
     ORDER BY sq.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({
    data: sqs,
    total: Number(totalRes.count),
    page,
    limit,
    total_pages: Math.ceil(Number(totalRes.count) / limit),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'sq:create'); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const { customer_id, warehouse_id, valid_until, notes, lines } = parsed.data;

  let subtotal = 0;
  const lineData = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineTotal = (line.qty * line.unit_price) - line.discount_amount;
    subtotal += lineTotal;
    lineData.push({ ...line, line_total: lineTotal, line_number: i + 1 });
  }

  const vatAmount = Math.round(subtotal * 0.07 * 100) / 100;
  const totalAmount = subtotal + vatAmount;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch next doc number
    const docRes = await client.query("SELECT next_doc_number('SQ', 'seq_sq') AS doc_number");
    const docNumber = docRes.rows[0].doc_number;

    // 1. Insert Header
    const sqRes = await client.query(
      `INSERT INTO sales_quotations (
        sq_number, customer_id, warehouse_id, valid_until, subtotal, vat_amount, total_amount, notes, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [docNumber, customer_id, warehouse_id, valid_until || null, subtotal, vatAmount, totalAmount, notes || null, u.id]
    );
    const sq = sqRes.rows[0];

    // 2. Insert Lines
    for (const line of lineData) {
      await client.query(
        `INSERT INTO sq_line_items (
          sq_id, product_id, qty, unit_price, discount_amount, line_number
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [sq.id, line.product_id, line.qty, line.unit_price, line.discount_amount, line.line_number]
      );
    }

    await client.query('COMMIT');
    return apiSuccess(sq, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create SQ error:', err);
    return apiError('Failed to create sales quotation', 500);
  } finally {
    client.release();
  }
}

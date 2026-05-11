import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import pool, { query } from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const createSchema = z.object({
  so_id: z.string().uuid(),
  delivery_order_id: z.string().uuid().optional().nullable(),
  invoice_date: z.string().optional(), // YYYY-MM-DD
  notes: z.string().optional().nullable(),
  payment_terms_days: z.number().int().min(0).optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'si:view'); } catch { return apiError('Forbidden', 403); }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const status = searchParams.get('status');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  // Invoice doesn't have warehouse_id directly, we could scope by customer or join SO.
  // For simplicity and matching the plan, we just list them. If warehouse scope is strict, we should join SO.
  if (status) {
    conditions.push(`si.status = $${idx++}`);
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [totalRes] = await query<{ count: string }>(`SELECT COUNT(*) FROM sales_invoices si ${where}`, params);

  const sis = await query(
    `SELECT si.*, 
            so.so_number,
            do_.do_number,
            c.name_th AS customer_name_th, 
            u_cr.name_en AS created_by_name
     FROM sales_invoices si
     JOIN sales_orders so ON so.id = si.so_id
     LEFT JOIN delivery_orders do_ ON do_.id = si.delivery_order_id
     JOIN customers c ON c.id = si.customer_id
     JOIN users u_cr ON u_cr.id = si.created_by
     ${where}
     ORDER BY si.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({
    data: sis,
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

  try { assertPermission(u, 'si:create'); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const { so_id, delivery_order_id, invoice_date, notes, payment_terms_days } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch SO
    const soRes = await client.query(
      'SELECT customer_id, payment_terms_days, status, subtotal, vat_amount, total_amount FROM sales_orders WHERE id = $1 FOR SHARE',
      [so_id]
    );
    const so = soRes.rows[0];
    if (!so) { await client.query('ROLLBACK'); return apiError('SO not found', 404); }

    let subtotal = 0;
    let vatAmount = 0;
    let totalAmount = 0;

    // 2. Compute amounts (From SO or DO)
    if (delivery_order_id) {
      const doRes = await client.query('SELECT status FROM delivery_orders WHERE id = $1', [delivery_order_id]);
      if (!doRes.rows[0]) { await client.query('ROLLBACK'); return apiError('DO not found', 404); }
      
      const doLines = await client.query('SELECT line_total FROM do_line_items WHERE do_id = $1', [delivery_order_id]);
      subtotal = doLines.rows.reduce((sum, line) => sum + Number(line.line_total), 0);
      vatAmount = Math.round(subtotal * 0.07 * 100) / 100;
      totalAmount = subtotal + vatAmount;
    } else {
      // Invoice whole SO
      subtotal = Number(so.subtotal);
      vatAmount = Number(so.vat_amount);
      totalAmount = Number(so.total_amount);
    }

    const invDate = invoice_date ? new Date(invoice_date) : new Date();
    const terms = payment_terms_days ?? so.payment_terms_days;
    const dueDate = new Date(invDate);
    dueDate.setDate(dueDate.getDate() + terms);

    // 3. Create SI
    const siRes = await client.query(
      `INSERT INTO sales_invoices (
        so_id, delivery_order_id, customer_id, invoice_date, due_date, subtotal, vat_amount, total_amount, notes, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [so_id, delivery_order_id || null, so.customer_id, invDate, dueDate, subtotal, vatAmount, totalAmount, notes || null, u.id]
    );
    const si = siRes.rows[0];

    // 4. Update SO status if fully delivered and now invoiced (simplification: if invoiced, mark invoiced)
    if (so.status === 'fully_delivered') {
      await client.query(`UPDATE sales_orders SET status = 'invoiced', updated_at = NOW() WHERE id = $1`, [so_id]);
    }

    await client.query('COMMIT');
    return apiSuccess(si, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create SI error:', err);
    return apiError('Failed to create sales invoice', 500);
  } finally {
    client.release();
  }
}

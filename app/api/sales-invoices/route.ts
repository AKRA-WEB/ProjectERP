import { auth } from '@/auth';
import { readOnlyMiddleware } from '@/lib/auth/readOnlyMiddleware';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission, buildWarehouseScopeClause } from '@/lib/authz';
import pool, { query } from '@/lib/db/client';
import { enforceMinPrice, MinPriceViolationError } from '@/lib/pricing/enforce-min-price';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const createSchema = z.object({
  so_id: z.string().uuid(),
  delivery_order_id: z.string().uuid().optional().nullable(),
  invoice_date: z.string().optional(), // YYYY-MM-DD
  notes: z.string().optional().nullable(),
  payment_terms_days: z.number().int().min(0).optional(),
  override_token: z.string().optional(),
  reason_code: z.string().optional(),
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
  const channel = searchParams.get('channel');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const scope = buildWarehouseScopeClause(u, 'so.warehouse_id', idx);
  if (scope) {
    conditions.push(scope.clause);
    params.push(...scope.params);
    idx += scope.params.length;
  }

  if (status) {
    conditions.push(`si.status = $${idx++}`);
    params.push(status);
  }

  if (channel) {
    conditions.push(`si.channel = $${idx++}`);
    params.push(channel);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [totalRes] = await query<{ count: string }>(`SELECT COUNT(*) FROM sales_invoices si JOIN sales_orders so ON so.id = si.so_id ${where}`, params);

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
     JOIN users u_cr ON u_cr.id = so.created_by
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
  const blocked = await readOnlyMiddleware(req);
  if (blocked) return blocked;

  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'si:create'); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const { so_id, delivery_order_id, invoice_date, notes, payment_terms_days, override_token, reason_code } = parsed.data;

  const siId = crypto.randomUUID();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch SO
    const soRes = await client.query(
      'SELECT customer_id, warehouse_id, payment_terms_days, status, subtotal, vat_amount, total_amount, channel FROM sales_orders WHERE id = $1 FOR SHARE',
      [so_id]
    );
    const so = soRes.rows[0];
    if (!so) { await client.query('ROLLBACK'); return apiError('SO not found', 404); }

    // Fetch warehouse code to determine if it is clearance
    const whRes = await client.query('SELECT code FROM warehouses WHERE id = $1', [so.warehouse_id]);
    const isClearance = whRes.rows[0]?.code === 'V-CLR';

    // Fetch lines for min price enforcement
    let invoiceLines: { product_id: string; unit_price: number }[] = [];
    if (delivery_order_id) {
      const doRes = await client.query('SELECT status FROM delivery_orders WHERE id = $1', [delivery_order_id]);
      if (!doRes.rows[0]) { await client.query('ROLLBACK'); return apiError('DO not found', 404); }
      
      const lineRes = await client.query<{ product_id: string; unit_price: string }>(
        'SELECT product_id, unit_price FROM do_line_items WHERE do_id = $1',
        [delivery_order_id]
      );
      invoiceLines = lineRes.rows.map(r => ({ product_id: r.product_id, unit_price: Number(r.unit_price) }));
    } else {
      const lineRes = await client.query<{ product_id: string; unit_price: string }>(
        'SELECT product_id, unit_price FROM so_line_items WHERE so_id = $1',
        [so_id]
      );
      invoiceLines = lineRes.rows.map(r => ({ product_id: r.product_id, unit_price: Number(r.unit_price) }));
    }

    // Enforce min price check
    try {
      for (const line of invoiceLines) {
        await enforceMinPrice({
          product_id: line.product_id,
          unit_price: line.unit_price,
          is_clearance: isClearance,
          override_token,
          user_id: u.id,
          target_table: 'sales_invoices',
          target_id: siId,
          reason_code,
        });
      }
    } catch (err: unknown) {
      await client.query('ROLLBACK');
      if (err instanceof MinPriceViolationError) {
        return apiError(err.message, err.status, err.details);
      }
      const errWithStatus = err as { status?: number; message?: string };
      if (errWithStatus.status) {
        return apiError(errWithStatus.message || 'Validation failed', errWithStatus.status);
      }
      console.error('Invoice create min price check error:', err);
      return apiError('Failed to validate min price', 500);
    }

    let subtotal = 0;
    let vatAmount = 0;
    let totalAmount = 0;

    // 2. Compute amounts (From SO or DO)
    if (delivery_order_id) {
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

    // 3. Create SI using pre-generated UUID
    const siRes = await client.query(
      `INSERT INTO sales_invoices (
        id, so_id, delivery_order_id, customer_id, invoice_date, due_date, subtotal, vat_amount, total_amount, notes, created_by, channel
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [siId, so_id, delivery_order_id || null, so.customer_id, invDate, dueDate, subtotal, vatAmount, totalAmount, notes || null, u.id, so.channel]
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

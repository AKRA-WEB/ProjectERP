import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission, buildWarehouseScopeClause } from '@/lib/authz';
import pool, { query } from '@/lib/db/client';
import { enforceMinPrice, MinPriceViolationError } from '@/lib/pricing/enforce-min-price';
import { checkCreditStatus } from '@/lib/credit/check-credit-status';
import { consumeOverrideToken } from '@/lib/auth/override-pin';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const createSchema = z.object({
  customer_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  expected_delivery: z.string().optional().nullable(),
  payment_terms_days: z.number().int().min(0).default(30),
  notes: z.string().optional().nullable(),
  override_token: z.string().optional(),
  reason_code: z.string().optional(),
  credit_release_token: z.string().optional(),
  lines: z.array(z.object({
    product_id: z.string().uuid(),
    qty_ordered: z.number().positive(),
    unit_price: z.number().min(0),
    discount_amount: z.number().min(0).default(0),
    transaction_uom_id: z.string().uuid().optional(),
    transaction_qty: z.number().positive().optional(),
  })).min(1),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'so:view'); } catch { return apiError('Forbidden', 403); }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const status = searchParams.get('status');

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
    conditions.push(`so.status = $${idx++}`);
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [totalRes] = await query<{ count: string }>(`SELECT COUNT(*) FROM sales_orders so ${where}`, params);

  const sos = await query(
    `SELECT so.*, 
            c.name_th AS customer_name_th, 
            w.name_th AS warehouse_name_th,
            u_cr.name_en AS created_by_name
     FROM sales_orders so
     JOIN customers c ON c.id = so.customer_id
     JOIN warehouses w ON w.id = so.warehouse_id
     JOIN users u_cr ON u_cr.id = so.created_by
     ${where}
     ORDER BY so.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({
    data: sos,
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

  try { assertPermission(u, 'so:create'); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const { customer_id, warehouse_id, expected_delivery, payment_terms_days, notes, lines, override_token, reason_code, credit_release_token } = parsed.data;

  // Generate sales order ID upfront so it can be passed to enforceMinPrice
  const soId = crypto.randomUUID();

  // Determine if this is a clearance warehouse
  const whRes = await pool.query('SELECT code FROM warehouses WHERE id = $1', [warehouse_id]);
  const isClearance = whRes.rows[0]?.code === 'V-CLR';

  // 1. Enforce min price check before doing database operations
  try {
    for (const line of lines) {
      await enforceMinPrice({
        product_id: line.product_id,
        unit_price: line.unit_price,
        is_clearance: isClearance,
        override_token,
        user_id: u.id,
        target_table: 'sales_orders',
        target_id: soId,
        reason_code,
      });
    }
  } catch (err: unknown) {
    if (err instanceof MinPriceViolationError) {
      return apiError(err.message, err.status, err.details);
    }
    const errWithStatus = err as { status?: number; message?: string };
    if (errWithStatus.status) {
      return apiError(errWithStatus.message || 'Validation failed', errWithStatus.status);
    }
    console.error('Create SO min price check error:', err);
    return apiError('Failed to validate min price', 500);
  }

  // 2. Credit hold check
  const creditStatus = await checkCreditStatus(customer_id);
  if (creditStatus.on_hold) {
    if (!credit_release_token) {
      return apiError('Credit hold', 412, {
        code: 'CREDIT_HOLD',
        outstanding: creditStatus.outstanding,
        max_aging_days: creditStatus.max_aging_days,
        reason: creditStatus.reason,
      });
    }
    try {
      await consumeOverrideToken(credit_release_token, 'credit_release', {
        user_id: u.id,
        target_table: 'sales_orders',
        target_id: soId,
        original_value: { on_hold: true },
        override_value: { on_hold: false },
        reason_code: 'inline_order_override',
      });
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      return apiError(e.message ?? 'Invalid credit release token', e.status ?? 401);
    }
  }

  let subtotal = 0;
  const lineData: (z.infer<typeof createSchema>['lines'][0] & { line_total: number; line_number: number })[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const unitPrice = line.unit_price;
    const lineTotal = (line.qty_ordered * unitPrice) - line.discount_amount;
    subtotal += lineTotal;
    lineData.push({ 
      ...line, 
      unit_price: unitPrice, 
      line_total: lineTotal, 
      line_number: i + 1 
    });
  }

  const vatAmount = Math.round(subtotal * 0.07 * 100) / 100;
  const totalAmount = subtotal + vatAmount;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert Header
    const soRes = await client.query(
      `INSERT INTO sales_orders (
        id, customer_id, warehouse_id, expected_delivery, payment_terms_days, subtotal, vat_amount, total_amount, notes, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [soId, customer_id, warehouse_id, expected_delivery || null, payment_terms_days, subtotal, vatAmount, totalAmount, notes || null, u.id]
    );
    const so = soRes.rows[0];

    // 2. Insert Lines
    for (const line of lineData) {
      await client.query(
        `INSERT INTO so_line_items (
          so_id, product_id, qty_ordered, unit_price, discount_amount, transaction_uom_id, transaction_qty, line_number
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          so.id, line.product_id, line.qty_ordered, line.unit_price, line.discount_amount,
          line.transaction_uom_id ?? null, line.transaction_qty ?? null, line.line_number
        ]
      );
    }

    await client.query('COMMIT');
    return apiSuccess(so, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create SO error:', err);
    return apiError('Failed to create sales order', 500);
  } finally {
    client.release();
  }
}

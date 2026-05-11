import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission, assertWarehouseAccess, buildWarehouseScopeClause } from '@/lib/authz';
import pool, { query } from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const createSchema = z.object({
  session_id: z.string().uuid(),
  lines: z.array(z.object({
    product_id: z.string().uuid(),
    qty: z.number().positive(),
    unit_price: z.number().min(0),
    discount_amount: z.number().min(0).default(0),
  })).min(1),
  payment_method: z.enum(['cash', 'card', 'mixed']),
  cash_tendered: z.number().min(0).optional(),
  card_amount: z.number().min(0).optional(),
  discount_amount: z.number().min(0).default(0), // order-level discount
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'pos:view'); } catch { return apiError('Forbidden', 403); }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const sessionId = searchParams.get('session_id');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const scope = buildWarehouseScopeClause(u, 't.warehouse_id', idx);
  if (scope) {
    conditions.push(scope.clause);
    params.push(...scope.params);
    idx += scope.params.length;
  }

  if (sessionId) {
    conditions.push(`t.session_id = $${idx++}`);
    params.push(sessionId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [totalRes] = await query<{ count: string }>(`SELECT COUNT(*) FROM pos_transactions t ${where}`, params);

  const transactions = await query(
    `SELECT t.*, u.name_en AS cashier_name
     FROM pos_transactions t
     JOIN users u ON u.id = t.created_by
     ${where}
     ORDER BY t.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({
    data: transactions,
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

  try { assertPermission(u, 'pos:cashier'); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const { session_id, lines, payment_method, cash_tendered = 0, card_amount = 0, discount_amount: orderDiscount = 0 } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validate session
    const sessionRow = await client.query<{ status: string; warehouse_id: string }>(
      'SELECT status, warehouse_id FROM pos_sessions WHERE id = $1 FOR SHARE',
      [session_id]
    );
    if (!sessionRow.rows[0]) { await client.query('ROLLBACK'); return apiError('Session not found', 404); }
    if (sessionRow.rows[0].status !== 'open') { await client.query('ROLLBACK'); return apiError('Session is closed', 409); }
    const { warehouse_id } = sessionRow.rows[0];

    try { assertWarehouseAccess(u, warehouse_id); } catch { await client.query('ROLLBACK'); return apiError('No access to this warehouse', 403); }

    // 2. Validate stock and compute totals
    let subtotalBeforeOrderDiscount = 0;
    const lineData = [];

    for (const line of lines) {
      // Lock stock balance
      const balanceRes = await client.query<{ qty_available: string; qty_on_hand: string }>(
        'SELECT qty_available, qty_on_hand FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE',
        [warehouse_id, line.product_id]
      );
      if (!balanceRes.rows[0]) { await client.query('ROLLBACK'); return apiError(`Stock record not found for product ${line.product_id}`, 422); }
      if (Number(balanceRes.rows[0].qty_available) < line.qty) {
        await client.query('ROLLBACK');
        return apiError(`Insufficient stock for product ${line.product_id} (Available: ${balanceRes.rows[0].qty_available})`, 422);
      }

      const lineTotal = (line.unit_price * line.qty) - line.discount_amount;
      subtotalBeforeOrderDiscount += lineTotal;
      lineData.push({ ...line, line_total: lineTotal, qty_after: Number(balanceRes.rows[0].qty_on_hand) - line.qty });
    }

    const total = subtotalBeforeOrderDiscount - orderDiscount;
    const vatAmount = Math.round(total * 7 / 107 * 100) / 100;
    const subtotal = total; // Plan says total is subtotal because price is VAT-inclusive

    // 3. Validate payment
    if (payment_method === 'cash' && cash_tendered < total) { await client.query('ROLLBACK'); return apiError('Cash tendered is less than total', 422); }
    if (payment_method === 'card' && card_amount < total) { await client.query('ROLLBACK'); return apiError('Card amount is less than total', 422); }
    if (payment_method === 'mixed' && (cash_tendered + card_amount) < total) { await client.query('ROLLBACK'); return apiError('Total tendered is less than total', 422); }

    const changeGiven = payment_method === 'card' ? 0 : Math.max(0, (cash_tendered + card_amount) - total);

    // 4. Create transaction
    const txn = await client.query<{ id: string; receipt_number: string }>(
      `INSERT INTO pos_transactions (session_id, warehouse_id, subtotal, discount_amount, vat_amount, total, payment_method, cash_tendered, card_amount, change_given, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, receipt_number`,
      [session_id, warehouse_id, subtotal, orderDiscount, vatAmount, total, payment_method, cash_tendered || null, card_amount || null, changeGiven, u.id]
    );
    const txnId = txn.rows[0].id;

    // 5. Create lines and ledger entries
    for (const line of lineData) {
      await client.query(
        `INSERT INTO pos_transaction_lines (transaction_id, product_id, qty, unit_price, discount_amount, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [txnId, line.product_id, line.qty, line.unit_price, line.discount_amount, line.line_total]
      );

      await client.query(
        `INSERT INTO stock_ledger (warehouse_id, product_id, entry_type, reference_type, reference_id, qty_change, qty_after, created_by)
         VALUES ($1, $2, 'pos_sale', 'pos_transaction', $3, $4, $5, $6)`,
        [warehouse_id, line.product_id, txnId, -line.qty, line.qty_after, u.id]
      );
    }

    await client.query('COMMIT');
    return apiSuccess(txn.rows[0], 201);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POS Checkout error:', err);
    return apiError('Failed to process transaction', 500);
  } finally {
    client.release();
  }
}

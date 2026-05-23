import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission, assertWarehouseAccess, buildWarehouseScopeClause } from '@/lib/authz';
import pool, { query } from '@/lib/db/client';
import { resolvePrice } from '@/lib/pricing/resolve';
import { enforceMinPrice, MinPriceViolationError } from '@/lib/pricing/enforce-min-price';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, VAT_RATE } from '@/lib/constants';
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
  member_id: z.string().uuid().optional().nullable(),
  override_token: z.string().optional(),
  reason_code: z.string().optional(),
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
    `SELECT t.*, u.name_en AS cashier_name, m.name_th AS member_name
     FROM pos_transactions t
     JOIN users u ON u.id = t.created_by
     LEFT JOIN pos_members m ON m.id = t.member_id
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

  const { session_id, lines, payment_method, cash_tendered = 0, card_amount = 0, discount_amount: orderDiscount = 0, member_id, override_token, reason_code } = parsed.data;

  const txnId = crypto.randomUUID();

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

    // Fetch warehouse code to determine if it is clearance
    const whRes = await client.query('SELECT code FROM warehouses WHERE id = $1', [warehouse_id]);
    const isClearance = whRes.rows[0]?.code === 'V-CLR';

    // 1a. Enforce min price check
    try {
      for (const line of lines) {
        await enforceMinPrice({
          product_id: line.product_id,
          unit_price: line.unit_price,
          is_clearance: isClearance,
          override_token,
          user_id: u.id,
          target_table: 'pos_transactions',
          target_id: txnId,
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
      console.error('POS Checkout min price check error:', err);
      return apiError('Failed to validate min price', 500);
    }

    // 2. Validate stock and compute totals
    let subtotalBeforeOrderDiscount_acc = 0;
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

      // Resolve dynamic price
      const resolution = await resolvePrice({
        channel: 'TRD',
        customer_id: member_id ?? null,
        product_id: line.product_id,
        qty: line.qty,
      });
      if (!resolution) {
        await client.query('ROLLBACK');
        return apiError(`No price configured for product ${line.product_id} on channel TRD`, 422);
      }

      const unitPrice = line.unit_price;
      const lineTotal = (unitPrice * line.qty) - line.discount_amount;
      subtotalBeforeOrderDiscount_acc += lineTotal;
      lineData.push({ 
        ...line, 
        unit_price: unitPrice, 
        line_total: lineTotal, 
        qty_after: Number(balanceRes.rows[0].qty_on_hand) - line.qty 
      });
    }

    // 1b. Validate Member & Discount (R-001)
    if (member_id) {
      const memberRow = await client.query<{ discount_rate: string; is_active: boolean }>(
        'SELECT discount_rate, is_active FROM pos_members WHERE id = $1 FOR SHARE',
        [member_id]
      );
      if (!memberRow.rows[0]) { await client.query('ROLLBACK'); return apiError('Member not found', 404); }
      if (!memberRow.rows[0].is_active) { await client.query('ROLLBACK'); return apiError('Member is inactive', 400); }
      
      const allowedDiscount = subtotalBeforeOrderDiscount_acc * Number(memberRow.rows[0].discount_rate);
      // Allow 0.01 tolerance for floating point
      if (orderDiscount > allowedDiscount + 0.01) {
        await client.query('ROLLBACK');
        return apiError(`Discount exceeds member tier limit (${allowedDiscount.toFixed(2)})`, 400);
      }
    } else if (orderDiscount > 0) {
      await client.query('ROLLBACK');
      return apiError('Order discount requires a member or manager override', 400);
    }

    // Recalculate with accurate subtotal if needed, but here they should match
    const total = Math.round((subtotalBeforeOrderDiscount_acc - orderDiscount) * 100) / 100;
    const vatAmount = Math.round(total * VAT_RATE / (1 + VAT_RATE) * 100) / 100;
    const subtotal = total; 

    // Points logic: 1 point per 20 baht
    const pointsEarned = Math.floor(total / 20);

    // 3. Validate payment
    if (payment_method === 'cash' && cash_tendered < total - 0.01) { await client.query('ROLLBACK'); return apiError('Cash tendered is less than total', 422); }
    if (payment_method === 'card' && card_amount < total - 0.01) { await client.query('ROLLBACK'); return apiError('Card amount is less than total', 422); }
    if (payment_method === 'mixed' && (cash_tendered + card_amount) < total - 0.01) { await client.query('ROLLBACK'); return apiError('Total tendered is less than total', 422); }

    const changeGiven = payment_method === 'card' ? 0 : Math.max(0, (cash_tendered + card_amount) - total);

    // 4. Create transaction using pre-generated UUID
    const txn = await client.query<{ id: string; receipt_number: string }>(
      `INSERT INTO pos_transactions (id, session_id, warehouse_id, subtotal, discount_amount, vat_amount, total, payment_method, cash_tendered, card_amount, change_given, member_id, points_earned, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id, receipt_number`,
      [txnId, session_id, warehouse_id, subtotal, orderDiscount, vatAmount, total, payment_method, cash_tendered || null, card_amount || null, changeGiven, member_id ?? null, pointsEarned, u.id]
    );

    // Update member points if applicable (R-002)
    if (member_id && pointsEarned > 0) {
      await client.query(
        'UPDATE pos_members SET point_balance = point_balance + $1, updated_at = NOW() WHERE id = $2',
        [pointsEarned, member_id]
      );
    }

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

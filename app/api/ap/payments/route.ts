import { auth } from '@/auth';
import { readOnlyMiddleware } from '@/lib/auth/readOnlyMiddleware';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import pool, { query } from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const allocationSchema = z.object({
  invoice_id: z.string().uuid(),
  allocated_amount: z.number().positive(),
});

const postSchema = z.object({
  vendor_id: z.string().uuid(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bank_ref: z.string().optional(),
  notes: z.string().optional(),
  allocations: z.array(allocationSchema).min(1),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const vendorId = searchParams.get('vendor_id');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (vendorId) {
    conditions.push(`p.vendor_id = $${idx++}`);
    params.push(vendorId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [totalResult] = await query<{ count: string }>(`SELECT COUNT(*) FROM ap_payments p ${where}`, params);
  const total = parseInt(totalResult.count);

  const rows = await query(
    `SELECT p.*, v.name_th AS vendor_name_th, u.name_en AS paid_by_name
     FROM ap_payments p
     JOIN vendors v ON v.id = p.vendor_id
     JOIN users u ON u.id = p.paid_by
     ${where}
     ORDER BY p.payment_date DESC, p.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({
    payments: rows,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit)
  });
}

export async function POST(req: Request) {
  const blocked = await readOnlyMiddleware(req);
  if (blocked) return blocked;

  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const { vendor_id, payment_date, bank_ref, notes, allocations } = parsed.data;
  const total_amount = allocations.reduce((sum, a) => sum + a.allocated_amount, 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validate allocations against invoices
    for (const alloc of allocations) {
      const invoice = await client.query<{ vendor_id: string; amount: number; paid_amount: number; is_paid: boolean }>(
        'SELECT vendor_id, amount, paid_amount, is_paid FROM po_invoices WHERE id = $1 FOR UPDATE',
        [alloc.invoice_id]
      );
      if (invoice.rows.length === 0) {
        await client.query('ROLLBACK');
        return apiError(`Invoice ${alloc.invoice_id} not found`, 404);
      }
      const inv = invoice.rows[0];
      if (inv.vendor_id !== vendor_id) {
        await client.query('ROLLBACK');
        return apiError(`Invoice ${alloc.invoice_id} does not belong to the selected vendor`, 400);
      }
      const outstanding = Number(inv.amount) - Number(inv.paid_amount);
      if (alloc.allocated_amount > outstanding + 0.01) { // small tolerance for floating point
        await client.query('ROLLBACK');
        return apiError(`Allocated amount ${alloc.allocated_amount} exceeds outstanding ${outstanding} for invoice ${alloc.invoice_id}`, 400);
      }
    }

    // Resolve vendor WHT details
    const vendorRes = await client.query<{ default_wht_rate: string | null; code: string; name_th: string }>(
      'SELECT default_wht_rate, code, name_th FROM vendors WHERE id = $1',
      [vendor_id]
    );
    const vendorDetails = vendorRes.rows[0];
    if (!vendorDetails) {
      await client.query('ROLLBACK');
      return apiError('Vendor not found', 404);
    }
    const defaultWhtRate = vendorDetails.default_wht_rate ? parseFloat(vendorDetails.default_wht_rate) : null;
    const whtAmount = defaultWhtRate !== null ? Math.round(total_amount * (defaultWhtRate / 100) * 100) / 100 : 0;

    // 2. INSERT ap_payments
    const pmtResult = await client.query<{ id: string; payment_number: string }>(
      `INSERT INTO ap_payments (vendor_id, payment_date, total_amount, bank_ref, notes, paid_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, payment_number`,
      [vendor_id, payment_date, total_amount, bank_ref ?? null, notes ?? null, u.id]
    );
    const paymentId = pmtResult.rows[0].id;
    const paymentNumber = pmtResult.rows[0].payment_number;

    // 3. Process allocations
    for (const alloc of allocations) {
      await client.query(
        'INSERT INTO ap_payment_allocations (payment_id, invoice_id, allocated_amount) VALUES ($1, $2, $3)',
        [paymentId, alloc.invoice_id, alloc.allocated_amount]
      );
      await client.query(
        'UPDATE po_invoices SET paid_amount = paid_amount + $1 WHERE id = $2',
        [alloc.allocated_amount, alloc.invoice_id]
      );
    }

    // 4. Create WHT Certificate if rate is set and WHT amount is positive
    if (defaultWhtRate !== null && whtAmount > 0) {
      const docNoRes = await client.query<{ doc_no: string }>(
        `SELECT next_doc_number('WHT', 'wht_certificates_seq') AS doc_no`
      );
      const docNo = docNoRes.rows[0].doc_no;

      await client.query(
        `INSERT INTO wht_certificates (vendor_id, payment_id, wht_rate, wht_amount, doc_no, issued_at, issued_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [vendor_id, paymentId, defaultWhtRate, whtAmount, docNo, payment_date, u.id]
      );
    }

    // 5. Create Accounting Journal Entry for the payment
    const periodRes = await client.query<{ id: string }>(
      `SELECT id FROM fiscal_periods WHERE status = 'open' AND $1::DATE BETWEEN start_date AND end_date LIMIT 1`,
      [payment_date]
    );
    const fiscalPeriodId = periodRes.rows[0]?.id;
    if (!fiscalPeriodId) {
      await client.query('ROLLBACK');
      return apiError(`No open fiscal period found for payment date ${payment_date}`, 400);
    }

    const accounts = await client.query<{ id: string; account_code: string }>(
      `SELECT id, account_code FROM accounts WHERE account_code IN ('2100', '1110', '1100', '2310')`
    );
    const apAcc = accounts.rows.find(r => r.account_code === '2100')?.id;
    const bankAcc = accounts.rows.find(r => r.account_code === '1110')?.id;
    const cashAcc = accounts.rows.find(r => r.account_code === '1100')?.id;
    const whtAcc = accounts.rows.find(r => r.account_code === '2310')?.id;

    if (!apAcc || !bankAcc || !cashAcc) {
      await client.query('ROLLBACK');
      return apiError('Required accounts (2100 Accounts Payable, 1110 Bank, or 1100 Cash) not configured in Chart of Accounts', 500);
    }

    // Insert JE Header
    const jeRes = await client.query<{ id: string }>(
      `INSERT INTO journal_entries (
        fiscal_period_id, entry_date, entry_type, status, 
        reference_type, reference_id, description, created_by, posted_by, posted_at
      )
      VALUES ($1, $2, 'payment', 'posted', 'ap_payments', $3, $4, $5, $5, NOW())
      RETURNING id`,
      [fiscalPeriodId, payment_date, paymentId, `AP Payment ${paymentNumber} to ${vendorDetails.code} - ${vendorDetails.name_th}`, u.id]
    );
    const jeId = jeRes.rows[0].id;

    // JE Line 1: Debit Accounts Payable (Clear Liability)
    await client.query(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, line_number, description)
       VALUES ($1, $2, $3, 0, 1, $4)`,
      [jeId, apAcc, total_amount, `Debit AP: Clear outstanding vendor invoice for payment ${paymentNumber}`]
    );

    // JE Line 2: Credit Cash/Bank (Net cash leg reduced by WHT amount)
    const cashBankAcc = bank_ref ? bankAcc : cashAcc;
    const netAmount = total_amount - whtAmount;
    await client.query(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, line_number, description)
       VALUES ($1, $2, 0, $3, 2, $4)`,
      [jeId, cashBankAcc, netAmount, `Credit Cash/Bank: Payment outflow net of WHT`]
    );

    // JE Line 3: Credit WHT Payable (Tax Withheld)
    if (whtAmount > 0) {
      if (!whtAcc) {
        await client.query('ROLLBACK');
        return apiError('Withholding Tax Payable account 2310 not configured in Chart of Accounts', 500);
      }
      await client.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, line_number, description)
         VALUES ($1, $2, 0, $3, 3, $4)`,
        [jeId, whtAcc, whtAmount, `Credit WHT: Withheld tax at ${defaultWhtRate}%`]
      );
    }

    await client.query('COMMIT');
    return apiSuccess(pmtResult.rows[0], 201);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('AP payment error:', err);
    return apiError('Failed to record AP payment', 500);
  } finally {
    client.release();
  }
}

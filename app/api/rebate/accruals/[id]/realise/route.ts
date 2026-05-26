import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { SessionUser } from '@/types';
import { apiSuccess, apiError } from '@/lib/api-response';
import pool from '@/lib/db/client';

interface AccrualRow {
  id: string;
  vendor_id: string;
  contract_id: string;
  period_label: string;
  eligible_purchases: string | number;
  accrued_rebate: string | number;
  status: 'pending' | 'accrued' | 'realised' | 'expired';
  posted_je_id: string | null;
  created_at: string;
  vendor_code: string;
  vendor_name_en: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  // Assert admin or manager role
  if (u.role !== 'admin' && u.role !== 'manager') {
    return apiError('Forbidden', 403);
  }

  const { id } = await params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch accrual details
    const accrualRes = await client.query<AccrualRow>(
      `SELECT a.*, v.name_en AS vendor_name_en, v.code AS vendor_code
       FROM vendor_rebate_accruals a
       LEFT JOIN vendors v ON a.vendor_id = v.id
       WHERE a.id = $1`,
      [id]
    );

    const accrual = accrualRes.rows[0];
    if (!accrual) {
      await client.query('ROLLBACK');
      return apiError('Rebate accrual record not found', 404);
    }

    if (accrual.status !== 'accrued') {
      await client.query('ROLLBACK');
      return apiError(`Rebate accrual must be in "accrued" status to be realised. Current status is "${accrual.status}"`, 400);
    }

    // 2. Parse credit account choice (default to 4300 Rebate Income, allows override to 5100 COGS)
    let creditAccountCode = '4300';
    try {
      const body = await req.json().catch(() => ({}));
      if (body?.credit_account_code === '5100') {
        creditAccountCode = '5100';
      }
    } catch {
      // Body not provided, use default
    }

    // 3. Resolve account database IDs
    const accountsRes = await client.query<{ id: string; account_code: string }>(
      `SELECT id, account_code FROM accounts WHERE account_code IN ('1220', $1)`,
      [creditAccountCode]
    );

    const accountsMap = new Map(accountsRes.rows.map(r => [r.account_code, r.id]));
    const drAccId = accountsMap.get('1220');
    const crAccId = accountsMap.get(creditAccountCode);

    if (!drAccId || !crAccId) {
      await client.query('ROLLBACK');
      return apiError(`Required Chart of Accounts entries (1220 or ${creditAccountCode}) not configured.`, 500);
    }

    // 4. Resolve current open fiscal period
    const fpRes = await client.query<{ id: string }>(
      `SELECT id FROM fiscal_periods
       WHERE status = 'open'
         AND CURRENT_DATE BETWEEN start_date AND end_date
       LIMIT 1`
    );
    const fiscalPeriodId = fpRes.rows[0]?.id;

    if (!fiscalPeriodId) {
      await client.query('ROLLBACK');
      return apiError('No open fiscal period found for the current date. Cannot post double-entry journal.', 400);
    }

    const rebateAmount = Number(accrual.accrued_rebate);
    if (rebateAmount <= 0) {
      await client.query('ROLLBACK');
      return apiError('Accrued rebate amount must be greater than zero to post journal.', 400);
    }

    // 5. Post Journal Entry
    const description = `Rebate Realisation: Vendor ${accrual.vendor_code} (${accrual.period_label})`;
    const jeRes = await client.query<{ id: string }>(
      `INSERT INTO journal_entries (
        fiscal_period_id,
        entry_date,
        entry_type,
        status,
        reference_type,
        reference_id,
        description,
        created_by,
        posted_by,
        posted_at
      ) VALUES ($1, CURRENT_DATE, 'inventory_adjustment', 'posted', 'vendor_rebate_accruals', $2, $3, $4, $4, NOW())
      RETURNING id`,
      [fiscalPeriodId, id, description, u.id]
    );
    const jeId = jeRes.rows[0].id;

    // Line 1: DR 1220 (Rebate Receivable)
    await client.query(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, line_number, description)
       VALUES ($1, $2, $3, 0, 1, 'Rebate Receivable earned from vendor volume-tier')`,
      [jeId, drAccId, rebateAmount]
    );

    // Line 2: CR 4300 or 5100 (Rebate Income / COGS Reduction)
    const line2Desc = creditAccountCode === '5100'
      ? 'COGS reduction from vendor rebate'
      : 'Vendor rebate income';
    await client.query(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, line_number, description)
       VALUES ($1, $2, 0, $3, 2, $4)`,
      [jeId, crAccId, rebateAmount, line2Desc]
    );

    // 6. Update Accrual Row Status & posted_je_id
    const updatedRes = await client.query(
      `UPDATE vendor_rebate_accruals
       SET status = 'realised', posted_je_id = $1
       WHERE id = $2
       RETURNING *`,
      [jeId, id]
    );

    await client.query('COMMIT');
    return apiSuccess({
      accrual: updatedRes.rows[0],
      je_id: jeId
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to realise rebate accrual:', err);
    return apiError('Failed to realise rebate accrual', 500);
  } finally {
    client.release();
  }
}

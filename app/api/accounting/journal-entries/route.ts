import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import pool, { query } from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const createSchema = z.object({
  fiscal_period_id: z.string().uuid(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entry_type: z.enum(['manual', 'ap_payment', 'ar_receipt', 'pos_sale', 'so_delivery', 'grn_receipt', 'inventory_adjustment', 'opening_balance']).optional().default('manual'),
  description: z.string().min(1),
  reference_type: z.string().optional().nullable(),
  reference_id: z.string().uuid().optional().nullable(),
  lines: z.array(z.object({
    account_id: z.string().uuid(),
    description: z.string().optional().nullable(),
    debit_amount: z.number().min(0),
    credit_amount: z.number().min(0),
  })).min(2),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'accounting:view'); } catch { return apiError('Forbidden', 403); }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  
  const fiscalPeriodId = searchParams.get('fiscal_period_id');
  const status = searchParams.get('status');
  const entryType = searchParams.get('entry_type');
  const fromDate = searchParams.get('from_date');
  const toDate = searchParams.get('to_date');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (fiscalPeriodId) { conditions.push(`je.fiscal_period_id = $${idx++}`); params.push(fiscalPeriodId); }
  if (status) { conditions.push(`je.status = $${idx++}`); params.push(status); }
  if (entryType) { conditions.push(`je.entry_type = $${idx++}`); params.push(entryType); }
  if (fromDate) { conditions.push(`je.entry_date >= $${idx++}`); params.push(fromDate); }
  if (toDate) { conditions.push(`je.entry_date <= $${idx++}`); params.push(toDate); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [totalRes] = await query<{ count: string }>(`SELECT COUNT(*) FROM journal_entries je ${where}`, params);
  
  const entries = await query(
    `SELECT je.*, fp.name AS period_name, u_cr.name_en AS created_by_name,
            (SELECT SUM(debit_amount) FROM journal_entry_lines jel WHERE jel.journal_entry_id = je.id) AS total_debit,
            (SELECT SUM(credit_amount) FROM journal_entry_lines jel WHERE jel.journal_entry_id = je.id) AS total_credit
     FROM journal_entries je
     JOIN fiscal_periods fp ON fp.id = je.fiscal_period_id
     JOIN users u_cr ON u_cr.id = je.created_by
     ${where}
     ORDER BY je.entry_date DESC, je.entry_number DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({
    data: entries,
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

  try { assertPermission(u, 'accounting:create'); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const { lines } = parsed.data;

  // 1. Validate balance
  let sumDebit = 0;
  let sumCredit = 0;
  for (const line of lines) {
    if (line.debit_amount > 0 && line.credit_amount > 0) return apiError('Each line must be either debit or credit, not both', 400);
    sumDebit += line.debit_amount;
    sumCredit += line.credit_amount;
  }
  if (Math.abs(sumDebit - sumCredit) > 0.001) {
    return apiError(`Entry is not balanced. Total Debit: ${sumDebit}, Total Credit: ${sumCredit}`, 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 2. Validate Fiscal Period
    const period = await client.query('SELECT status FROM fiscal_periods WHERE id = $1', [parsed.data.fiscal_period_id]);
    if (period.rows.length === 0) { await client.query('ROLLBACK'); return apiError('Fiscal period not found', 404); }
    if (period.rows[0].status !== 'open') { await client.query('ROLLBACK'); return apiError('Can only create entries in open fiscal periods', 400); }

    // 3. Validate Accounts
    for (const line of lines) {
      const acc = await client.query('SELECT allows_direct_posting, is_active FROM accounts WHERE id = $1', [line.account_id]);
      if (acc.rows.length === 0) { await client.query('ROLLBACK'); return apiError(`Account ${line.account_id} not found`, 404); }
      if (!acc.rows[0].is_active) { await client.query('ROLLBACK'); return apiError(`Account ${line.account_id} is inactive`, 400); }
      if (!acc.rows[0].allows_direct_posting) { await client.query('ROLLBACK'); return apiError(`Account ${line.account_id} does not allow direct posting`, 400); }
    }

    // 4. Insert Header
    const jeRes = await client.query(
      `INSERT INTO journal_entries (
        fiscal_period_id, entry_date, entry_type, description, reference_type, reference_id, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        parsed.data.fiscal_period_id, parsed.data.entry_date, parsed.data.entry_type,
        parsed.data.description, parsed.data.reference_type || null, parsed.data.reference_id || null,
        u.id
      ]
    );
    const je = jeRes.rows[0];

    // 5. Insert Lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      await client.query(
        `INSERT INTO journal_entry_lines (
          journal_entry_id, account_id, description, debit_amount, credit_amount, line_number
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [je.id, line.account_id, line.description || null, line.debit_amount, line.credit_amount, i + 1]
      );
    }

    await client.query('COMMIT');
    return apiSuccess(je, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create JE error:', err);
    return apiError('Failed to create journal entry', 500);
  } finally {
    client.release();
  }
}

import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/types';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  // Enforce role guard
  if (!['admin', 'manager', 'auditor'].includes(u.role)) {
    return apiError('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(250, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;

  const accountId = searchParams.get('account_id');
  const fromDate = searchParams.get('from_date');
  const toDate = searchParams.get('to_date');

  const conditions: string[] = ["je.status = 'posted'"];
  const params: unknown[] = [];
  let idx = 1;

  if (accountId) {
    conditions.push(`jel.account_id = $${idx++}`);
    params.push(accountId);
  }
  if (fromDate) {
    conditions.push(`je.entry_date >= $${idx++}`);
    params.push(fromDate);
  }
  if (toDate) {
    conditions.push(`je.entry_date <= $${idx++}`);
    params.push(toDate);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [totalRes] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id ${where}`,
    params
  );
  const total = parseInt(totalRes?.count ?? '0');

  const rows = await query(
    `SELECT jel.*, 
            je.entry_number, je.entry_date, je.description AS entry_description, je.entry_type,
            a.account_code, a.name_th AS account_name_th, a.name_en AS account_name_en
     FROM journal_entry_lines jel
     JOIN journal_entries je ON je.id = jel.journal_entry_id
     JOIN accounts a ON a.id = jel.account_id
     ${where}
     ORDER BY je.entry_date DESC, je.entry_number DESC, jel.line_number ASC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({
    ledger_lines: rows,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit)
  });
}

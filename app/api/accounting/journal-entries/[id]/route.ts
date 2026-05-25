import { auth } from '@/auth';
import { readOnlyMiddleware } from '@/lib/auth/readOnlyMiddleware';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import pool, { queryOne, query } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'accounting:view'); } catch { return apiError('Forbidden', 403); }
  const { id } = await params;

  const je = await queryOne(
    `SELECT je.*, fp.name AS period_name, u_cr.name_en AS created_by_name,
            u_p.name_en AS posted_by_name, u_v.name_en AS voided_by_name,
            (SELECT SUM(debit_amount) FROM journal_entry_lines jel WHERE jel.journal_entry_id = je.id) AS total_debit,
            (SELECT SUM(credit_amount) FROM journal_entry_lines jel WHERE jel.journal_entry_id = je.id) AS total_credit
     FROM journal_entries je
     JOIN fiscal_periods fp ON fp.id = je.fiscal_period_id
     JOIN users u_cr ON u_cr.id = je.created_by
     LEFT JOIN users u_p ON u_p.id = je.posted_by
     LEFT JOIN users u_v ON u_v.id = je.voided_by
     WHERE je.id = $1`,
    [id]
  );
  if (!je) return apiError('Journal entry not found', 404);

  const lines = await query(
    `SELECT jel.*, a.account_code, a.name_th AS account_name_th, a.name_en AS account_name_en
     FROM journal_entry_lines jel
     JOIN accounts a ON a.id = jel.account_id
     WHERE jel.journal_entry_id = $1
     ORDER BY jel.line_number ASC`,
    [id]
  );

  return apiSuccess({ ...je, lines });
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('post') }),
  z.object({ action: z.literal('void'), void_reason: z.string().min(1) }),
  z.object({ action: z.literal('unpost') }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = await readOnlyMiddleware(req);
  if (blocked) return blocked;

  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const jeRes = await client.query(
      `SELECT je.*, fp.status AS period_status 
       FROM journal_entries je 
       JOIN fiscal_periods fp ON fp.id = je.fiscal_period_id 
       WHERE je.id = $1 FOR UPDATE`,
      [id]
    );
    const je = jeRes.rows[0];
    if (!je) { await client.query('ROLLBACK'); return apiError('Journal entry not found', 404); }

    const { action } = parsed.data;

    if (action === 'post') {
      try { assertPermission(u, 'accounting:post'); } catch { await client.query('ROLLBACK'); return apiError('Forbidden', 403); }
      if (je.status !== 'draft') { await client.query('ROLLBACK'); return apiError('Can only post draft entries', 409); }
      if (je.period_status !== 'open') { await client.query('ROLLBACK'); return apiError('Fiscal period is not open', 400); }

      // Re-validate balance
      const lines = await client.query('SELECT SUM(debit_amount) as dr, SUM(credit_amount) as cr FROM journal_entry_lines WHERE journal_entry_id = $1', [id]);
      const { dr, cr } = lines.rows[0];
      if (Math.abs(Number(dr) - Number(cr)) > 0.001) { await client.query('ROLLBACK'); return apiError('Entry is not balanced', 400); }

      const updated = await client.query(
        `UPDATE journal_entries SET status = 'posted', posted_by = $1, posted_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`,
        [u.id, id]
      );
      await client.query('COMMIT');
      return apiSuccess(updated.rows[0]);
    }

    if (action === 'void') {
      try { assertPermission(u, 'accounting:void'); } catch { await client.query('ROLLBACK'); return apiError('Forbidden', 403); }
      if (je.status !== 'posted') { await client.query('ROLLBACK'); return apiError('Can only void posted entries', 409); }
      if (je.period_status !== 'open') { await client.query('ROLLBACK'); return apiError('Fiscal period is not open', 400); }

      const updated = await client.query(
        `UPDATE journal_entries SET status = 'void', voided_by = $1, voided_at = NOW(), void_reason = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
        [u.id, parsed.data.void_reason, id]
      );
      await client.query('COMMIT');
      return apiSuccess(updated.rows[0]);
    }

    if (action === 'unpost') {
      if (u.role !== 'admin') { await client.query('ROLLBACK'); return apiError('Only admins can unpost', 403); }
      if (je.status !== 'posted') { await client.query('ROLLBACK'); return apiError('Can only unpost posted entries', 409); }
      if (je.period_status !== 'open') { await client.query('ROLLBACK'); return apiError('Fiscal period is not open', 400); }

      const updated = await client.query(
        `UPDATE journal_entries SET status = 'draft', posted_by = NULL, posted_at = NULL, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      await client.query('COMMIT');
      return apiSuccess(updated.rows[0]);
    }

    await client.query('ROLLBACK');
    return apiError('Invalid action', 400);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Patch JE error:', err);
    return apiError('Failed to update journal entry', 500);
  } finally {
    client.release();
  }
}

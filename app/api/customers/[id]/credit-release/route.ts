import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import pool from '@/lib/db/client';
import { consumeOverrideToken } from '@/lib/auth/override-pin';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const releaseSchema = z.object({
  override_token: z.string(),
  released_reason: z.string().min(3),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = releaseSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const { override_token, released_reason } = parsed.data;
  const { id } = await params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await consumeOverrideToken(override_token, 'credit_release', {
      user_id: u.id,
      target_table: 'customers',
      target_id: id,
      original_value: { on_hold: true },
      override_value: { on_hold: false },
      reason_code: 'manual_release',
    });

    await client.query(
      `UPDATE customer_credit_holds
       SET released_at = NOW(), released_by = $1, released_reason = $2
       WHERE customer_id = $3 AND released_at IS NULL`,
      [u.id, released_reason, id]
    );

    await client.query('UPDATE customers SET on_hold = FALSE WHERE id = $1', [id]);

    await client.query('COMMIT');
    return apiSuccess({ released: true });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    const e = err as { status?: number; message?: string };
    if (e.status) return apiError(e.message ?? 'Override failed', e.status);
    console.error('Credit release error:', err);
    return apiError('Failed to release credit hold', 500);
  } finally {
    client.release();
  }
}

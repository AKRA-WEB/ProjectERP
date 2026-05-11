import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import { queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'fiscal_periods:view'); } catch { return apiError('Forbidden', 403); }
  const { id } = await params;

  const period = await queryOne('SELECT * FROM fiscal_periods WHERE id = $1', [id]);
  if (!period) return apiError('Fiscal period not found', 404);

  return apiSuccess(period);
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('close') }),
  z.object({ action: z.literal('reopen') }),
  z.object({ action: z.literal('lock') }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const current = await queryOne<{ status: string }>('SELECT status FROM fiscal_periods WHERE id = $1', [id]);
  if (!current) return apiError('Fiscal period not found', 404);

  const { action } = parsed.data;

  if (action === 'close') {
    try { assertPermission(u, 'fiscal_periods:manage'); } catch { return apiError('Forbidden', 403); }
    if (current.status !== 'open') return apiError('Can only close open periods', 409);

    const updated = await queryOne(
      `UPDATE fiscal_periods 
       SET status = 'closed', closed_at = NOW(), closed_by = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [u.id, id]
    );
    return apiSuccess(updated);
  }

  if (action === 'reopen') {
    if (u.role !== 'admin') return apiError('Only admins can reopen periods', 403);
    if (current.status !== 'closed') return apiError('Can only reopen closed periods', 409);

    const updated = await queryOne(
      `UPDATE fiscal_periods SET status = 'open', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return apiSuccess(updated);
  }

  if (action === 'lock') {
    if (u.role !== 'admin') return apiError('Only admins can lock periods', 403);
    if (current.status !== 'closed') return apiError('Can only lock closed periods', 409);

    const updated = await queryOne(
      `UPDATE fiscal_periods 
       SET status = 'locked', locked_at = NOW(), locked_by = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [u.id, id]
    );
    return apiSuccess(updated);
  }

  return apiError('Invalid action', 400);
}

import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const schema = z.object({ reason: z.string().min(1) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  if (!['manager', 'admin'].includes(u.role)) return apiError('Forbidden', 403);

  const { id } = await params;
  const pr = await queryOne<{ status: string }>(
    'SELECT status FROM purchase_requisitions WHERE id = $1',
    [id]
  );
  if (!pr) return apiError('PR not found', 404);
  if (!['submitted', 'manager_approved'].includes(pr.status)) {
    return apiError('PR cannot be rejected at current status', 409);
  }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  await queryOne(
    `UPDATE purchase_requisitions SET status = 'rejected', rejected_by = $1, rejected_at = NOW(), rejection_reason = $2 WHERE id = $3`,
    [u.id, parsed.data.reason, id]
  );
  return apiSuccess({ id, status: 'rejected' });
}

import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { queryOne } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { id } = await params;
  const pr = await queryOne<{ status: string; requested_by: string }>(
    'SELECT status, requested_by FROM purchase_requisitions WHERE id = $1',
    [id]
  );
  if (!pr) return apiError('PR not found', 404);
  if (pr.status !== 'draft') return apiError('Only draft PRs can be submitted', 409);
  if (u.role === 'staff' && pr.requested_by !== u.id) return apiError('Forbidden', 403);

  await queryOne('UPDATE purchase_requisitions SET status = $1 WHERE id = $2', ['submitted', id]);
  return apiSuccess({ id, status: 'submitted' });
}

import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { queryOne } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  if (pr.status === 'submitted' && ['manager', 'admin'].includes(u.role)) {
    await queryOne(
      `UPDATE purchase_requisitions SET status = 'manager_approved', manager_approved_by = $1, manager_approved_at = NOW() WHERE id = $2`,
      [u.id, id]
    );
    return apiSuccess({ id, status: 'manager_approved' });
  }

  if (pr.status === 'manager_approved' && u.role === 'admin') {
    await queryOne(
      `UPDATE purchase_requisitions SET status = 'admin_approved', admin_approved_by = $1, admin_approved_at = NOW() WHERE id = $2`,
      [u.id, id]
    );
    return apiSuccess({ id, status: 'admin_approved' });
  }

  return apiError('PR cannot be approved at current status with your role', 409);
}

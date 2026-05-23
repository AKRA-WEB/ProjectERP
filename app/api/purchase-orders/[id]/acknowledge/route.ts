import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { queryOne } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  if (!['admin', 'manager', 'staff'].includes(u.role)) {
    return apiError('Forbidden', 403);
  }

  const result = await queryOne(
    `UPDATE purchase_orders 
     SET status = 'pending_delivery', updated_at = NOW() 
     WHERE id = $1 AND status = 'opened' 
     RETURNING id`,
    [id]
  );

  if (!result) return apiError('PO not found or not in opened state', 409);

  return apiSuccess({ acknowledged: true });
}

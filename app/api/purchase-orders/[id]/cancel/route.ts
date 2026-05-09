import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { queryOne } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const po = await queryOne<{ status: string }>('SELECT status FROM purchase_orders WHERE id = $1', [id]);
  if (!po) return apiError('PO not found', 404);
  if (!['draft', 'sent'].includes(po.status)) return apiError('PO cannot be cancelled at current status', 409);

  await queryOne(`UPDATE purchase_orders SET status = 'cancelled' WHERE id = $1`, [id]);
  return apiSuccess({ id, status: 'cancelled' });
}

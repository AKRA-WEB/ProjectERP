import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { queryOne } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const deleted = await queryOne('DELETE FROM uom_conversions WHERE id = $1 RETURNING id', [id]);
  if (!deleted) return apiError('Conversion not found', 404);
  return apiSuccess({ id });
}

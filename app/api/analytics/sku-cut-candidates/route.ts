import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole, type SessionUser } from '@/lib/authz';
import { getSkuCutCandidates } from '@/lib/queries/analytics';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin', 'manager']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';

  try {
    const rows = await getSkuCutCandidates(search);
    return apiSuccess(rows);
  } catch (err) {
    console.error('Failed to fetch SKU cut candidates:', err);
    return apiError('Internal Server Error', 500);
  }
}

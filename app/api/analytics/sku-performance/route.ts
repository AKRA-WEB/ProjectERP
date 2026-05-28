import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole, type SessionUser } from '@/lib/authz';
import { getSkuPerformance } from '@/lib/queries/analytics';

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
  const bucket = searchParams.get('bucket') || '';
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  try {
    const result = await getSkuPerformance({ search, bucket, limit, offset });
    return apiSuccess({ rows: result.rows, total: result.total, limit, offset });
  } catch (err) {
    console.error('Failed to fetch SKU performance snapshot:', err);
    return apiError('Internal Server Error', 500);
  }
}

import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole, type SessionUser } from '@/lib/authz';
import { runSkuPerformanceRefreshJob } from '@/lib/jobs/sku-refresh';

export async function POST() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin', 'manager']);
  } catch {
    return apiError('Forbidden', 403);
  }

  try {
    const result = await runSkuPerformanceRefreshJob();
    return apiSuccess(result);
  } catch (err) {
    console.error('Failed to trigger manual SKU performance refresh:', err);
    return apiError('Internal Server Error', 500);
  }
}

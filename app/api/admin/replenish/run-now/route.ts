
import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { runReplenishmentJob } from '@/lib/jobs/replenish-w1';
import { assertRole } from '@/lib/authz';
import type { SessionUser } from '@/types';

export async function POST() {
  const session = await auth();
  if (!session) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin']);
  } catch {
    return apiError('Forbidden', 403);
  }

  try {
    const result = await runReplenishmentJob();
    return apiSuccess({
      message: 'Job completed successfully',
      createdCount: result.createdCount,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Job execution failed';
    return apiError(msg, 500);
  }
}

import { auth } from '@/auth';
import { SessionUser } from '@/types';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import { runHrzoftSync } from '@/lib/jobs/hrzoft-sync';

export async function POST() {
  const session = await auth();
  if (!session) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertPermission(u, 'admin:hrzoft_sync');
  } catch {
    return apiError('Forbidden', 403);
  }

  try {
    const result = await runHrzoftSync();
    return apiSuccess({
      message: 'Sync completed successfully',
      result
    });
  } catch (err: unknown) {
    console.error('Error executing manual Hrzoft sync:', err);
    const errorMessage = err instanceof Error ? err.message : 'Manual Hrzoft sync failed';
    return apiError(errorMessage, 500);
  }
}

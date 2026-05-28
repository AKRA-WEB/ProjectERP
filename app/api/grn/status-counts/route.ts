import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { getGRNStatusCounts } from '@/lib/queries/grn';
import type { SessionUser } from '@/lib/authz';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const counts = await getGRNStatusCounts(u);
  return apiSuccess(counts);
}

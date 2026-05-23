import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { checkCreditStatus } from '@/lib/credit/check-credit-status';
import type { SessionUser } from '@/lib/authz';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertRole(u, ['admin', 'manager', 'staff', 'auditor']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const status = await checkCreditStatus(id);
  return apiSuccess({ status });
}

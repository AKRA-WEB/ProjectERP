import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';
import type { BusinessUnit } from '@/types';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try {
    assertRole(u, ['admin', 'manager', 'auditor']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const rows = await query<BusinessUnit>(
    'SELECT id, code, name_th, name_en, created_at FROM business_units ORDER BY code ASC'
  );

  return apiSuccess(rows);
}

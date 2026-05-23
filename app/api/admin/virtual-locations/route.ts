import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  // Let managers, admins, and auditors read virtual locations
  try {
    assertRole(u, ['admin', 'manager', 'auditor']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const locations = await query(
    `SELECT id, code, purpose, is_sellable, visible_channels, created_at
     FROM virtual_locations
     ORDER BY code ASC`
  );

  return apiSuccess(locations);
}

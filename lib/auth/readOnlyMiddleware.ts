import { auth } from '@/auth';
import { apiError } from '@/lib/api-response';
import type { SessionUser } from '@/types';

/**
 * Middleware that rejects non-GET requests for users with role 'auditor'.
 * Returns a NextResponse (via apiError) if blocked, otherwise returns null.
 */
export async function readOnlyMiddleware(req: Request) {
  const session = await auth();
  if (!session?.user) return null; // Let the endpoint's standard auth check handle 401
  const u = session.user as unknown as SessionUser;
  
  if (u.role === 'auditor' && req.method !== 'GET') {
    return apiError('Forbidden: Read-only auditor role cannot perform write operations', 403);
  }
  return null;
}

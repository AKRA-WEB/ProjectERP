import { auth } from '@/auth';
import { SessionUser } from '@/types';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query, queryOne } from '@/lib/db/client';
import { assertPermission } from '@/lib/authz';

export async function GET() {
  const session = await auth();
  if (!session) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertPermission(u, 'admin:hrzoft_sync');
  } catch {
    return apiError('Forbidden', 403);
  }

  try {
    // 1. Fetch latest run log
    const lastRun = await queryOne<Record<string, unknown>>(
      `SELECT * FROM hrzoft_sync_runs ORDER BY started_at DESC LIMIT 1`
    );

    // 2. Fetch mapped employees with their conflict details or active statuses
    // Limit to 100 for performance with pagination possibilities (or simple premium dashboard preview)
    const mappings = await query<Record<string, unknown>>(
      `SELECT eus.*, 
              u.email, 
              u.name_th, 
              u.name_en, 
              u.position, 
              u.department, 
              u.is_active AS local_active
       FROM external_user_sync eus
       LEFT JOIN users u ON eus.local_user_id = u.id
       ORDER BY 
         CASE WHEN eus.status = 'orphan' THEN 1 
              WHEN eus.conflict_notes IS NOT NULL THEN 2 
              ELSE 3 
         END, 
         eus.last_synced_at DESC
       LIMIT 100`
    );

    return apiSuccess({
      lastRun,
      mappings
    });
  } catch (err) {
    console.error('Error fetching Hrzoft last run info:', err);
    return apiError('Failed to fetch Hrzoft last run info', 500);
  }
}

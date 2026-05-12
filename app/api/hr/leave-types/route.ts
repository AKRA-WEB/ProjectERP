import { auth } from '@/auth';
import { query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const rows = await query(`SELECT * FROM leave_types WHERE is_active = TRUE ORDER BY name_th`, []);
  return apiSuccess(rows);
}

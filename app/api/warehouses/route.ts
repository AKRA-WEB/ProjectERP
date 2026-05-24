import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const rows = await query<{ id: string; code: string; name_th: string }>(
    "SELECT id, code, name_th FROM warehouses WHERE is_active = true AND code NOT LIKE 'V-%' ORDER BY code",
    []
  );
  return apiSuccess(rows);
}

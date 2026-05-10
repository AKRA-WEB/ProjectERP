import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { queryOne } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const user = await queryOne(
    `SELECT u.id, u.email, u.name_th, u.name_en, u.role, u.is_active,
            array_agg(uwa.warehouse_id) FILTER (WHERE uwa.warehouse_id IS NOT NULL) AS assigned_warehouse_ids,
            array_agg(w.name_en) FILTER (WHERE w.name_en IS NOT NULL) AS warehouse_names
     FROM users u
     LEFT JOIN user_warehouse_assignments uwa ON uwa.user_id = u.id
     LEFT JOIN warehouses w ON w.id = uwa.warehouse_id
     WHERE u.id = $1
     GROUP BY u.id`,
    [u.id]
  );

  return apiSuccess(user);
}

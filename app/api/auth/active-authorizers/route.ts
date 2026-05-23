import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import pool from '@/lib/db/client';
import type { SessionUser } from '@/types';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    // Fetch active managers and admins for authorizing overrides.
    // Partition by business unit if the system enforces it, or return all active authorizers.
    // Let's scope it to the requesting user's business unit if businessUnitId is present!
    let queryStr = `
      SELECT id, name_th, name_en, email, role
      FROM users
      WHERE role IN ('manager', 'admin') AND is_active = true
    `;
    const params: unknown[] = [];

    if (u.businessUnitId) {
      queryStr += ` AND (business_unit_id = $1 OR business_unit_id IS NULL)`;
      params.push(u.businessUnitId);
    }

    queryStr += ` ORDER BY role ASC, name_en ASC`;

    const res = await pool.query(queryStr, params);
    return apiSuccess(res.rows);
  } catch (err: unknown) {
    console.error('Error fetching active authorizers:', err);
    return apiError('Internal Server Error', 500);
  }
}

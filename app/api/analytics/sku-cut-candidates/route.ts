import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';
import { assertRole, type SessionUser } from '@/lib/authz';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin', 'manager']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';

  let where = '1=1';
  const params: unknown[] = [];
  if (search) {
    where += ` AND (sku ILIKE $1 OR name_th ILIKE $1 OR name_en ILIKE $1)`;
    params.push(`%${search}%`);
  }

  try {
    const rows = await query(`
      SELECT * FROM sku_cut_candidates
      WHERE ${where}
      ORDER BY score ASC, sku ASC
    `, params);

    return apiSuccess(rows);
  } catch (err) {
    console.error('Failed to fetch SKU cut candidates:', err);
    return apiError('Internal Server Error', 500);
  }
}

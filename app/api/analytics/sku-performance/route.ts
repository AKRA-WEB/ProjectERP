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
  const bucket = searchParams.get('bucket') || '';
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  let where = '1=1';
  const params: unknown[] = [];
  let paramIndex = 1;

  if (search) {
    where += ` AND (sku ILIKE $${paramIndex} OR name_th ILIKE $${paramIndex} OR name_en ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }
  if (bucket) {
    where += ` AND velocity_bucket = $${paramIndex}`;
    params.push(bucket);
    paramIndex++;
  }

  try {
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*) FROM sku_performance_snapshot WHERE ${where}`,
      params
    );
    const total = parseInt(countRes[0]?.count || '0', 10);

    params.push(limit, offset);
    const rows = await query(
      `SELECT * FROM sku_performance_snapshot 
       WHERE ${where}
       ORDER BY qty_sold_30d DESC, sku ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return apiSuccess({ rows, total, limit, offset });
  } catch (err) {
    console.error('Failed to fetch SKU performance snapshot:', err);
    return apiError('Internal Server Error', 500);
  }
}

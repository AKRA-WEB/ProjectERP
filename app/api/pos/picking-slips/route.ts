import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  // WMS staff or POS cashier can view
  if (!['admin', 'manager', 'staff'].includes(u.role)) {
    return apiError('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  const conditions = [];
  const params = [];

  if (status) {
    conditions.push(`status = $${params.length + 1}`);
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const slips = await query(
    `SELECT * FROM pos_picking_slips ${where} ORDER BY created_at DESC`,
    params
  );

  return apiSuccess(slips);
}

import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { buildWarehouseScopeClause } from '@/lib/authz';
import { query } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const params: unknown[] = [];
  let idx = 1;
  const scope = buildWarehouseScopeClause(u, 'g.warehouse_id', idx);
  const where = scope ? `WHERE ${scope.clause}` : '';
  if (scope) { params.push(...scope.params); }

  const rows = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) AS count
     FROM goods_receipt_notes g ${where}
     GROUP BY status`,
    params
  );

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = Number(r.count);
  return apiSuccess(counts);
}

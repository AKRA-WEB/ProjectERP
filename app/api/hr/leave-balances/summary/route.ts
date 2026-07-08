import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole, buildWarehouseScopeClause, type SessionUser } from '@/lib/authz';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const sp = new URL(req.url).searchParams;
  const year = parseInt(sp.get('year') ?? String(new Date().getFullYear()));
  const search = sp.get('search') ?? '';
  const departmentId = sp.get('department_id') ?? '';
  const page = Math.max(1, parseInt(sp.get('page') ?? '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') ?? '20')));
  const offset = (page - 1) * pageSize;

  const conditions: string[] = ['lb.year = $1'];
  const vals: unknown[] = [year];
  let idx = 2;

  if (search) {
    conditions.push(`(u.name_th ILIKE $${idx} OR u.name_en ILIKE $${idx} OR u.employee_id ILIKE $${idx})`);
    vals.push(`%${search}%`); idx++;
  }
  if (departmentId) {
    conditions.push(`u.department_id = $${idx++}`);
    vals.push(departmentId);
  }

  const scope = buildWarehouseScopeClause(u, 'uwa.warehouse_id', idx);
  if (scope?.clause === 'FALSE') return apiSuccess({ data: [], total: 0, page, limit: pageSize });
  if (scope) {
    conditions.push(
      `EXISTS (SELECT 1 FROM user_warehouse_assignments uwa WHERE uwa.user_id = u.id AND ${scope.clause})`
    );
    vals.push(...scope.params);
    idx += scope.params.length;
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const [rows, countResult] = await Promise.all([
    query<{
      employee_id: string;
      user_id: string;
      name_th: string;
      name_en: string;
      department_name_th: string | null;
      leave_type_id: string;
      leave_type_name_th: string;
      days_entitled: string;
      days_used: string;
      days_remaining: string;
      year: number;
    }>(`
      SELECT
        u.employee_id, u.id AS user_id, u.name_th, u.name_en,
        d.name_th AS department_name_th,
        lb.leave_type_id, lt.name_th AS leave_type_name_th,
        lb.days_entitled, lb.days_used,
        (lb.days_entitled - lb.days_used) AS days_remaining,
        lb.year
      FROM leave_balances lb
      JOIN users u ON u.id = lb.employee_id
      JOIN leave_types lt ON lt.id = lb.leave_type_id
      LEFT JOIN departments d ON d.id = u.department_id
      ${where}
      ORDER BY u.name_en, lt.name_th
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...vals, pageSize, offset]),
    query<{ count: string }>(`
      SELECT COUNT(*) FROM leave_balances lb
      JOIN users u ON u.id = lb.employee_id
      LEFT JOIN departments d ON d.id = u.department_id
      ${where}
    `, vals),
  ]);

  return apiSuccess({
    data: rows,
    total: parseInt(countResult[0]?.count ?? '0'),
    page,
    limit: pageSize,
  });
}

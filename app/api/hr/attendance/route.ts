import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { buildWarehouseScopeClause, SessionUser } from '@/lib/authz';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { searchParams } = new URL(req.url);
  const empId = searchParams.get('employee_id') ?? (u.role === 'staff' ? u.id : '');
  const month = searchParams.get('month'); // YYYY-MM
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('pageSize') ?? '50');
  const offset = (page - 1) * limit;

  if (!month) return apiError('month required (YYYY-MM)', 400);

  const conditions = [`ar.work_date >= $1`, `ar.work_date <= $2`];
  const params: unknown[] = [`${month}-01`, `${month}-31`];
  let idx = 3;

  if (empId) { conditions.push(`ar.employee_id = $${idx++}`); params.push(empId); }

  const scope = buildWarehouseScopeClause(u, 'uwa.warehouse_id', idx);
  if (scope) {
    conditions.push(`EXISTS (SELECT 1 FROM user_warehouse_assignments uwa WHERE uwa.user_id = ar.employee_id AND ${scope.clause})`);
    params.push(...scope.params);
    idx += scope.params.length;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query(`
    SELECT ar.*, u.name_th AS employee_name_th, u.name_en AS employee_name_en, u.employee_id AS employee_code
    FROM attendance_records ar
    JOIN users u ON u.id = ar.employee_id
    ${where}
    ORDER BY ar.work_date DESC, u.name_en ASC
    LIMIT $${idx} OFFSET $${idx + 1}
  `, [...params, limit, offset]);

  const [{ count }] = await query<{ count: string }>(`
    SELECT COUNT(*) FROM attendance_records ar ${where}
  `, params);

  return apiSuccess({ data: rows, total: parseInt(count), page, limit });
}

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
  const search = searchParams.get('search') ?? '';
  const dept = searchParams.get('department_id') ?? '';
  const status = searchParams.get('employee_status') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('pageSize') ?? '20');
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (search) {
    conditions.push(`(u.name_th ILIKE $${idx} OR u.name_en ILIKE $${idx} OR u.employee_id ILIKE $${idx} OR u.email ILIKE $${idx})`);
    params.push(`%${search}%`); idx++;
  }
  if (dept) { conditions.push(`u.department_id = $${idx++}`); params.push(dept); }
  if (status) { conditions.push(`u.employee_status = $${idx++}`); params.push(status); }

  const scope = buildWarehouseScopeClause(u, 'uwa.warehouse_id', idx);
  if (scope) {
    conditions.push(`EXISTS (SELECT 1 FROM user_warehouse_assignments uwa WHERE uwa.user_id = u.id AND ${scope.clause})`);
    params.push(...scope.params);
    idx += scope.params.length;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows, [{ count }]] = await Promise.all([
    query(`
      SELECT
        u.id, u.employee_id, u.name_th, u.name_en, u.email, u.role,
        u.department_id, d.name_th AS department_name_th, d.name_en AS department_name_en,
        u.position_id, p.name_th AS position_name_th, p.name_en AS position_name_en,
        u.salary_grade_id, sg.name_th AS salary_grade_name,
        u.base_salary, u.employment_type, u.employee_status,
        u.hired_date, u.resignation_date, u.phone, u.created_at
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN positions p ON p.id = u.position_id
      LEFT JOIN salary_grades sg ON sg.id = u.salary_grade_id
      ${where}
      ORDER BY u.name_en
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]),
    query<{ count: string }>(`
      SELECT COUNT(*) FROM users u ${where}
    `, params)
  ]);

  return apiSuccess({ data: rows, total: parseInt(count), page, limit });
}

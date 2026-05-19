import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query, queryOne } from '@/lib/db/client';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { buildWarehouseScopeClause, assertRole, SessionUser } from '@/lib/authz';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '@/lib/constants';

const CreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name_th: z.string().min(1),
  name_en: z.string().min(1),
  role: z.enum(['admin', 'manager', 'staff']),
  employee_id: z.string().optional(),
  department_id: z.string().uuid().nullable().optional(),
  position_id: z.string().uuid().nullable().optional(),
  salary_grade_id: z.string().uuid().nullable().optional(),
  base_salary: z.number().min(0).nullable().optional(),
  employment_type: z.enum(['full_time', 'part_time', 'contract']).optional(),
  employee_status: z.enum(['active', 'inactive', 'resigned']).optional(),
  hired_date: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
});

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
        u.hired_date, u.resignation_date, u.phone, u.created_at,
        (SELECT w.name FROM user_warehouse_assignments uwa JOIN warehouses w ON w.id = uwa.warehouse_id 
         WHERE uwa.user_id = u.id AND uwa.is_active = TRUE LIMIT 1) AS branch_name
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

  const canSeeSalary = u.role === 'admin' || u.role === 'manager';
  const data = rows.map((r: any) => ({
    ...r,
    base_salary: canSeeSalary ? r.base_salary : null,
    hire_date: r.hired_date
  }));

  return apiSuccess({ data, total: parseInt(count), page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);
  const d = parsed.data;

  // Check unique constraints
  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [d.email]);
  if (existing) return apiError('Email already in use', 409);

  if (d.employee_id) {
    const existingEmp = await queryOne('SELECT id FROM users WHERE employee_id = $1', [d.employee_id]);
    if (existingEmp) return apiError('Employee ID already in use', 409);
  }

  const password_hash = await bcrypt.hash(d.password, BCRYPT_ROUNDS);

  const user = await queryOne(
    `INSERT INTO users (
      email, password_hash, name_th, name_en, role,
      employee_id, department_id, position_id, salary_grade_id,
      base_salary, employment_type, employee_status, hired_date, phone
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING id, email, name_en, name_th, role, employee_id, created_at`,
    [
      d.email, password_hash, d.name_th, d.name_en, d.role,
      d.employee_id || null, d.department_id || null, d.position_id || null, d.salary_grade_id || null,
      d.base_salary || null, d.employment_type || 'full_time', d.employee_status || 'active',
      d.hired_date || null, d.phone || null
    ]
  );

  return apiSuccess(user, 201);
}

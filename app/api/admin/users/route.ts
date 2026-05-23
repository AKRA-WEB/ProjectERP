import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS, DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const createUserSchema = z.object({
  email: z.string().email(),
  name_en: z.string().min(1).max(255),
  name_th: z.string().max(255).optional(),
  role: z.enum(['admin', 'manager', 'staff', 'auditor']),
  password: z.string().min(8),
  employee_id: z.string().max(50).optional(),
  position: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  hired_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  business_unit_id: z.string().uuid().nullable().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const role = searchParams.get('role');
  const isActive = searchParams.get('is_active');
  const search = searchParams.get('search');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (role) { conditions.push(`u.role = $${idx++}`); params.push(role); }
  if (isActive !== null) { conditions.push(`u.is_active = $${idx++}`); params.push(isActive === 'true'); }
  if (search) {
    conditions.push(`(u.email ILIKE $${idx} OR u.name_en ILIKE $${idx} OR u.name_th ILIKE $${idx} OR u.employee_id ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [total] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM users u ${where}`,
    params
  );

  const users = await query(
    `SELECT u.id, u.email, u.name_th, u.name_en, u.role, u.is_active, u.created_at,
            u.employee_id, u.position, u.department, u.phone, u.hired_date, u.business_unit_id, u.override_pin_hash,
            COUNT(uwa.warehouse_id) AS warehouse_count
     FROM users u
     LEFT JOIN user_warehouse_assignments uwa ON uwa.user_id = u.id
     ${where}
     GROUP BY u.id
     ORDER BY u.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({
    data: users,
    total: Number(total.count),
    page,
    limit,
    total_pages: Math.ceil(Number(total.count) / limit),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const { email, name_en, name_th, role, password, employee_id, position, department, phone, hired_date, business_unit_id } = parsed.data;

  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
  if (existing) return apiError('Email already in use', 409);

  if (employee_id) {
    const existingEmp = await queryOne('SELECT id FROM users WHERE employee_id = $1', [employee_id]);
    if (existingEmp) return apiError('Employee ID already in use', 409);
  }

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await queryOne(
    `INSERT INTO users (email, password_hash, name_en, name_th, role, employee_id, position, department, phone, hired_date, business_unit_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, email, name_en, name_th, role, is_active, employee_id, business_unit_id, created_at`,
    [email, password_hash, name_en, name_th ?? null, role, employee_id ?? null, position ?? null, department ?? null, phone ?? null, hired_date ?? null, business_unit_id ?? null]
  );

  return apiSuccess(user, 201);
}

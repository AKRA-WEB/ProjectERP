import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const createSchema = z.object({
  code: z.string().min(2).max(50).regex(/^[a-z0-9_]+$/),
  name_th: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  description: z.string().optional(),
  permission_ids: z.array(z.string()).min(1),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const rows = await query(
    `SELECT er.id, er.code, er.name_th, er.name_en, er.description, er.is_system, er.created_at,
            COUNT(DISTINCT erp.permission_id) AS permission_count,
            COUNT(DISTINCT ura.user_id) AS user_count
     FROM employee_roles er
     LEFT JOIN employee_role_permissions erp ON erp.role_id = er.id
     LEFT JOIN user_role_assignments ura ON ura.role_id = er.id
     GROUP BY er.id
     ORDER BY er.is_system DESC, er.name_en`
  );

  return apiSuccess(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  // Check unique code
  const existing = await queryOne('SELECT id FROM employee_roles WHERE code = $1', [parsed.data.code]);
  if (existing) return apiError('Role code already exists', 409);

  const role = await queryOne<{ id: string }>(
    `INSERT INTO employee_roles (code, name_th, name_en, description, is_system)
     VALUES ($1, $2, $3, $4, FALSE)
     RETURNING id`,
    [parsed.data.code, parsed.data.name_th, parsed.data.name_en, parsed.data.description ?? null]
  );

  if (!role) return apiError('Failed to create role', 500);

  const permValues = parsed.data.permission_ids.map((_, i) => `($1, $${i + 2})`).join(', ');
  await query(
    `INSERT INTO employee_role_permissions (role_id, permission_id) VALUES ${permValues}`,
    [role.id, ...parsed.data.permission_ids]
  );

  return apiSuccess(role, 201);
}

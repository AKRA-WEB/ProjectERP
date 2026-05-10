import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const assignSchema = z.object({
  role_id: z.string().uuid(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { id } = await params;

  const rows = await query(
    `SELECT er.id, er.code, er.name_th, er.name_en, ura.assigned_at, u.name_en AS assigned_by_name
     FROM user_role_assignments ura
     JOIN employee_roles er ON er.id = ura.role_id
     LEFT JOIN users u ON u.id = ura.assigned_by
     WHERE ura.user_id = $1
     ORDER BY ura.assigned_at DESC`,
    [id]
  );

  return apiSuccess(rows);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const role = await queryOne('SELECT id FROM employee_roles WHERE id = $1', [parsed.data.role_id]);
  if (!role) return apiError('Role not found', 404);

  await query(
    `INSERT INTO user_role_assignments (user_id, role_id, assigned_by)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [id, parsed.data.role_id, u.id]
  );

  return apiSuccess({ success: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  await query(
    'DELETE FROM user_role_assignments WHERE user_id = $1 AND role_id = $2',
    [id, parsed.data.role_id]
  );

  return apiSuccess({ success: true });
}

import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const updateSchema = z.object({
  name_th: z.string().min(1).max(255).optional(),
  name_en: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  permission_ids: z.array(z.string()).optional(),
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

  const role = await queryOne(
    `SELECT er.*, COALESCE(array_agg(erp.permission_id) FILTER (WHERE erp.permission_id IS NOT NULL), '{}') AS permission_ids
     FROM employee_roles er
     LEFT JOIN employee_role_permissions erp ON erp.role_id = er.id
     WHERE er.id = $1
     GROUP BY er.id`,
    [id]
  );

  if (!role) return apiError('Role not found', 404);

  return apiSuccess(role);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const role = await queryOne<{ is_system: boolean }>(
    'SELECT is_system FROM employee_roles WHERE id = $1',
    [id]
  );
  if (!role) return apiError('Role not found', 404);

  const updates: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (parsed.data.name_th) { updates.push(`name_th = $${idx++}`); vals.push(parsed.data.name_th); }
  if (parsed.data.name_en) { updates.push(`name_en = $${idx++}`); vals.push(parsed.data.name_en); }
  if (parsed.data.description !== undefined) { updates.push(`description = $${idx++}`); vals.push(parsed.data.description); }

  if (updates.length) {
    vals.push(id);
    await query(`UPDATE employee_roles SET ${updates.join(', ')} WHERE id = $${idx}`, vals);
  }

  if (parsed.data.permission_ids) {
    await query('DELETE FROM employee_role_permissions WHERE role_id = $1', [id]);
    if (parsed.data.permission_ids.length) {
      const permValues = parsed.data.permission_ids.map((_, i) => `($1, $${i + 2})`).join(', ');
      await query(
        `INSERT INTO employee_role_permissions (role_id, permission_id) VALUES ${permValues}`,
        [id, ...parsed.data.permission_ids]
      );
    }
  }

  return apiSuccess({ id, updated: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { id } = await params;

  const role = await queryOne<{ is_system: boolean }>(
    'SELECT is_system FROM employee_roles WHERE id = $1',
    [id]
  );
  if (!role) return apiError('Role not found', 404);
  if (role.is_system) return apiError('System roles cannot be deleted', 409);

  const userCount = await queryOne<{ count: string }>(
    'SELECT COUNT(*) FROM user_role_assignments WHERE role_id = $1',
    [id]
  );
  if (userCount && Number(userCount.count) > 0) {
    return apiError('Role has assigned users and cannot be deleted', 409);
  }

  await query('DELETE FROM employee_roles WHERE id = $1', [id]);

  return apiSuccess({ id, deleted: true });
}

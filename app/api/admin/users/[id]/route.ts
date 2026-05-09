import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const updateSchema = z.object({
  name_en: z.string().min(1).max(255).optional(),
  name_th: z.string().max(255).nullable().optional(),
  role: z.enum(['admin', 'manager', 'staff']).optional(),
  is_active: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const user = await queryOne(
    `SELECT u.id, u.email, u.name_th, u.name_en, u.role, u.is_active, u.created_at,
            array_agg(uwa.warehouse_id) FILTER (WHERE uwa.warehouse_id IS NOT NULL) AS assigned_warehouse_ids
     FROM users u
     LEFT JOIN user_warehouse_assignments uwa ON uwa.user_id = u.id
     WHERE u.id = $1
     GROUP BY u.id`,
    [id]
  );
  if (!user) return apiError('User not found', 404);
  return apiSuccess(user);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const updates: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (parsed.data.name_en !== undefined) { updates.push(`name_en = $${idx++}`); vals.push(parsed.data.name_en); }
  if (parsed.data.name_th !== undefined) { updates.push(`name_th = $${idx++}`); vals.push(parsed.data.name_th); }
  if (parsed.data.role !== undefined) { updates.push(`role = $${idx++}`); vals.push(parsed.data.role); }
  if (parsed.data.is_active !== undefined) { updates.push(`is_active = $${idx++}`); vals.push(parsed.data.is_active); }

  if (!updates.length) return apiError('No fields to update', 400);
  vals.push(id);

  const user = await queryOne(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}
     RETURNING id, email, name_en, name_th, role, is_active, updated_at`,
    vals
  );
  if (!user) return apiError('User not found', 404);
  return apiSuccess(user);
}

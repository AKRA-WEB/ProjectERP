import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { queryOne } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const UpdateSchema = z.object({
  name_th: z.string().min(1).max(255).optional(),
  name_en: z.string().min(1).max(255).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  manager_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const { id } = await params;

  const row = await queryOne<object>(`
    SELECT d.*, u.name AS manager_name
    FROM departments d
    LEFT JOIN users u ON u.id = d.manager_id
    WHERE d.id = $1
  `, [id]);
  if (!row) return apiError('Not found', 404);
  return apiSuccess(row);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  if (!['admin', 'manager'].includes(u.role)) return apiError('Forbidden', 403);
  const { id } = await params;

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);
  const d = parsed.data;

  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  if (d.name_th !== undefined) { sets.push(`name_th = $${idx++}`); vals.push(d.name_th); }
  if (d.name_en !== undefined) { sets.push(`name_en = $${idx++}`); vals.push(d.name_en); }
  if (d.parent_id !== undefined) { sets.push(`parent_id = $${idx++}`); vals.push(d.parent_id); }
  if (d.manager_id !== undefined) { sets.push(`manager_id = $${idx++}`); vals.push(d.manager_id); }
  if (d.is_active !== undefined) { sets.push(`is_active = $${idx++}`); vals.push(d.is_active); }
  if (sets.length === 0) return apiError('No fields to update', 400);

  vals.push(id);
  await queryOne(`UPDATE departments SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
  return apiSuccess({ ok: true });
}

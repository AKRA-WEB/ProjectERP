import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const updateSchema = z.object({
  name_th: z.string().min(1).max(255).optional(),
  name_en: z.string().min(1).max(255).optional(),
  address_th: z.string().nullable().optional(),
  address_en: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;
  const wh = await queryOne('SELECT * FROM warehouses WHERE id = $1', [id]);
  if (!wh) return apiError('Warehouse not found', 404);
  return apiSuccess(wh);
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

  if (parsed.data.name_th !== undefined) { updates.push(`name_th = $${idx++}`); vals.push(parsed.data.name_th); }
  if (parsed.data.name_en !== undefined) { updates.push(`name_en = $${idx++}`); vals.push(parsed.data.name_en); }
  if (parsed.data.address_th !== undefined) { updates.push(`address_th = $${idx++}`); vals.push(parsed.data.address_th); }
  if (parsed.data.address_en !== undefined) { updates.push(`address_en = $${idx++}`); vals.push(parsed.data.address_en); }
  if (parsed.data.is_active !== undefined) { updates.push(`is_active = $${idx++}`); vals.push(parsed.data.is_active); }

  if (!updates.length) return apiError('No fields to update', 400);
  vals.push(id);

  const wh = await queryOne(
    `UPDATE warehouses SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    vals
  );
  if (!wh) return apiError('Warehouse not found', 404);
  return apiSuccess(wh);
}

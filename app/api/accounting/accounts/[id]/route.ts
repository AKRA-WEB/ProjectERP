import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import { queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'accounts:view'); } catch { return apiError('Forbidden', 403); }
  const { id } = await params;

  const account = await queryOne(
    `SELECT a.*, p.account_code AS parent_code, p.name_th AS parent_name_th
     FROM accounts a
     LEFT JOIN accounts p ON p.id = a.parent_id
     WHERE a.id = $1`,
    [id]
  );
  if (!account) return apiError('Account not found', 404);

  return apiSuccess(account);
}

const updateSchema = z.object({
  name_th: z.string().min(1).max(255).optional(),
  name_en: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'accounts:manage'); } catch { return apiError('Forbidden', 403); }
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const updates: string[] = [];
  const queryParams: unknown[] = [id];
  let idx = 2;

  const data = parsed.data;
  if (data.name_th !== undefined) { updates.push(`name_th = $${idx++}`); queryParams.push(data.name_th); }
  if (data.name_en !== undefined) { updates.push(`name_en = $${idx++}`); queryParams.push(data.name_en); }
  if (data.description !== undefined) { updates.push(`description = $${idx++}`); queryParams.push(data.description); }
  if (data.is_active !== undefined) { updates.push(`is_active = $${idx++}`); queryParams.push(data.is_active); }

  if (updates.length === 0) return apiError('No fields to update', 400);

  const account = await queryOne(
    `UPDATE accounts SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    queryParams
  );

  if (!account) return apiError('Account not found', 404);

  return apiSuccess(account);
}

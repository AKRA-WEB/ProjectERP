import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import { query } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';
import { z } from 'zod';

const updateSchema = z.object({
  tier: z.string().optional(),
  discount_rate: z.number().min(0).max(1).optional(),
  is_active: z.boolean().optional(),
  point_balance: z.number().int().min(0).optional(),
});

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'pos:cashier'); } catch { return apiError('Forbidden', 403); }

  const member = await query('SELECT * FROM pos_members WHERE id = $1', [id]);
  if (member.length === 0) return apiError('Member not found', 404);

  return apiSuccess(member[0]);
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'pos:members'); } catch { return apiError('Forbidden', 403); }

  try {
    const body = await req.json();
    const data = updateSchema.parse(body);

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${key} = $${idx}`);
        values.push(value);
        idx++;
      }
    });

    if (updates.length === 0) return apiError('No fields to update', 400);

    const result = await query(
      `UPDATE pos_members 
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${idx}
       RETURNING *`,
      [...values, id]
    );

    if (result.length === 0) return apiError('Member not found', 404);
    return apiSuccess(result[0]);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return apiError(err.errors[0].message, 400);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return apiError(msg, 500);
  }
}

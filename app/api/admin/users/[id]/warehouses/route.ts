import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const assignSchema = z.object({
  warehouse_ids: z.array(z.string().uuid()),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const user = await queryOne('SELECT id FROM users WHERE id = $1', [id]);
  if (!user) return apiError('User not found', 404);

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  await query('DELETE FROM user_warehouse_assignments WHERE user_id = $1', [id]);

  if (parsed.data.warehouse_ids.length > 0) {
    const rows = parsed.data.warehouse_ids
      .map((_, i) => `($1, $${i + 2}, $${parsed.data.warehouse_ids.length + 2})`)
      .join(', ');
    await query(
      `INSERT INTO user_warehouse_assignments (user_id, warehouse_id, assigned_by) VALUES ${rows}`,
      [id, ...parsed.data.warehouse_ids, u.id]
    );
  }

  const assignments = await query(
    `SELECT w.id, w.code, w.name_en, w.name_th FROM warehouses w
     JOIN user_warehouse_assignments uwa ON uwa.warehouse_id = w.id
     WHERE uwa.user_id = $1`,
    [id]
  );
  return apiSuccess(assignments);
}

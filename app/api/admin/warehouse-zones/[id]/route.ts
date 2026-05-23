import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { queryOne, query } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const updateSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  thermal_type: z.enum(['ambient', 'sensitive', 'chilled', 'frozen']).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  // Only admin/manager can modify warehouse zones
  try {
    assertRole(u, ['admin', 'manager']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const existingZone = await queryOne<{ id: string; warehouse_id: string }>(
    `SELECT id, warehouse_id FROM warehouse_zones WHERE id = $1`,
    [id]
  );
  if (!existingZone) return apiError('Warehouse zone not found', 404);

  if (parsed.data.code) {
    // Check if code is already used in this physical warehouse (excluding this zone)
    const duplicate = await queryOne(
      `SELECT id FROM warehouse_zones WHERE warehouse_id = $1 AND code = $2 AND id != $3`,
      [existingZone.warehouse_id, parsed.data.code, id]
    );
    if (duplicate) {
      return apiError('Zone code already exists in this warehouse', 409);
    }
  }

  const updates: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (parsed.data.code !== undefined) {
    updates.push(`code = $${idx++}`);
    vals.push(parsed.data.code);
  }
  if (parsed.data.thermal_type !== undefined) {
    updates.push(`thermal_type = $${idx++}`);
    vals.push(parsed.data.thermal_type);
  }

  if (!updates.length) return apiError('No fields to update', 400);
  vals.push(id);

  const zone = await queryOne(
    `UPDATE warehouse_zones
     SET ${updates.join(', ')}
     WHERE id = $${idx}
     RETURNING *`,
    vals
  );

  return apiSuccess(zone);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  // Only admin/manager can delete warehouse zones
  try {
    assertRole(u, ['admin', 'manager']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { id } = await params;

  const result = await query(
    `DELETE FROM warehouse_zones WHERE id = $1 RETURNING id`,
    [id]
  );
  if (!result.length) return apiError('Warehouse zone not found', 404);

  return apiSuccess({ deleted: true });
}

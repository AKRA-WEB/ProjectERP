import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { queryOne, query } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const patchSchema = z.object({
  qty_picked: z.number().min(0).optional(),
  storage_location: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { id: pickListId, lineId } = await params;

  const pickList = await queryOne<{ status: string; assigned_to: string }>(
    'SELECT status, assigned_to FROM pick_lists WHERE id = $1',
    [pickListId]
  );
  if (!pickList) return apiError('Pick List not found', 404);

  const isAuthorized = u.role === 'admin' || u.role === 'manager' || u.id === pickList.assigned_to;
  if (!isAuthorized) return apiError('Forbidden', 403);

  if (pickList.status !== 'picking') return apiError('Lines can only be updated when picking is in progress', 422);

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const line = await queryOne<{ qty_requested: number }>(
    'SELECT qty_requested FROM pick_list_lines WHERE id = $1 AND pick_list_id = $2',
    [lineId, pickListId]
  );
  if (!line) return apiError('Pick List Line not found', 404);

  if (parsed.data.qty_picked !== undefined && parsed.data.qty_picked > Number(line.qty_requested)) {
    return apiError('qty_picked cannot exceed qty_requested', 422);
  }

  const updatedLine = await queryOne(
    `UPDATE pick_list_lines
     SET qty_picked = COALESCE($1, qty_picked),
         storage_location = COALESCE($2, storage_location),
         updated_at = NOW()
     WHERE id = $3 AND pick_list_id = $4
     RETURNING *`,
    [
      parsed.data.qty_picked ?? null,
      parsed.data.storage_location ?? null,
      lineId,
      pickListId
    ]
  );

  return apiSuccess(updatedLine);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const { id: pickListId, lineId } = await params;

  const pickList = await queryOne<{ status: string }>(
    'SELECT status FROM pick_lists WHERE id = $1',
    [pickListId]
  );
  if (!pickList) return apiError('Pick List not found', 404);
  if (pickList.status !== 'draft') return apiError('Lines can only be deleted from draft pick lists', 422);

  const deleteRes = await query(
    'DELETE FROM pick_list_lines WHERE id = $1 AND pick_list_id = $2 RETURNING id',
    [lineId, pickListId]
  );

  if (deleteRes.length === 0) return apiError('Pick List Line not found', 404);

  return apiSuccess({ deleted: true });
}

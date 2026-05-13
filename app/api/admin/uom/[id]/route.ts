import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const patchSchema = z.object({
  name_th:         z.string().min(1).max(100).optional(),
  name_en:         z.string().min(1).max(100).optional(),
  is_integer_unit: z.boolean().optional(),
  barcode_label:   z.string().max(100).nullable().optional(),
  sort_order:      z.number().int().optional(),
}).strict();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const uom = await queryOne('SELECT id FROM units_of_measure WHERE id = $1', [id]);
  if (!uom) return apiError('UoM not found', 404);

  const f = parsed.data;
  const updates: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  if (f.name_th !== undefined)         { updates.push(`name_th = $${idx++}`);         vals.push(f.name_th); }
  if (f.name_en !== undefined)         { updates.push(`name_en = $${idx++}`);         vals.push(f.name_en); }
  if (f.is_integer_unit !== undefined) { updates.push(`is_integer_unit = $${idx++}`); vals.push(f.is_integer_unit); }
  if (f.barcode_label !== undefined)   { updates.push(`barcode_label = $${idx++}`);   vals.push(f.barcode_label); }
  if (f.sort_order !== undefined)      { updates.push(`sort_order = $${idx++}`);      vals.push(f.sort_order); }
  if (!updates.length) return apiError('No fields to update', 400);

  vals.push(id);
  const updated = await queryOne(
    `UPDATE units_of_measure SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    vals
  );
  return apiSuccess(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;

  const inConversion = await queryOne(
    'SELECT id FROM uom_conversions WHERE uom_id = $1 OR base_uom_id = $1',
    [id]
  );
  if (inConversion) return apiError('UoM is referenced in a conversion rule — delete the conversion first', 409);

  const inProductUom = await queryOne('SELECT id FROM product_uom WHERE uom_id = $1 LIMIT 1', [id]);
  if (inProductUom) return apiError('UoM is assigned to one or more products', 409);

  const deleted = await queryOne('DELETE FROM units_of_measure WHERE id = $1 RETURNING id', [id]);
  if (!deleted) return apiError('UoM not found', 404);
  return apiSuccess({ id });
}

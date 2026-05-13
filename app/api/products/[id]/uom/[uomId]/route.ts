import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query, queryOne } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { PatchProductUomSchema } from '@/lib/validations/bom';
import { SessionUser } from '@/lib/authz';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string, uomId: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const user = session.user as unknown as SessionUser;
  const { id, uomId } = await params;

  if (!['admin', 'manager'].includes(user.role)) {
    return apiError('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const result = PatchProductUomSchema.safeParse(body);
    if (!result.success) {
      return apiError(result.error.errors[0].message, 400);
    }
    const d = result.data;

    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    if (d.uom_type !== undefined)     { sets.push(`uom_type = $${idx++}`);     vals.push(d.uom_type); }
    if (d.is_active !== undefined)    { sets.push(`is_active = $${idx++}`);    vals.push(d.is_active); }
    if (d.barcode_label !== undefined){ sets.push(`barcode_label = $${idx++}`); vals.push(d.barcode_label); }

    if (sets.length === 0) return apiError('No fields to update', 400);

    vals.push(id, uomId);
    await query(`
      UPDATE product_uom 
      SET ${sets.join(', ')} 
      WHERE product_id = $${idx} AND uom_id = $${idx + 1}
    `, vals);

    return apiSuccess({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update product UOM';
    return apiError(msg, 500);
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string, uomId: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const user = session.user as unknown as SessionUser;
  const { id, uomId } = await params;

  if (!['admin', 'manager'].includes(user.role)) {
    return apiError('Forbidden', 403);
  }

  // Check if referenced in active BOMs
  const { count } = await queryOne<{ count: string }>(`
    SELECT COUNT(*) FROM bom_lines bl
    JOIN bom_headers bh ON bh.id = bl.bom_id
    WHERE bl.component_id = $1 AND bl.uom_id = $2 AND bh.is_active = TRUE
  `, [id, uomId]);

  if (parseInt(count) > 0) {
    return apiError('Cannot remove UOM: referenced in active BOM(s)', 400);
  }

  await query('DELETE FROM product_uom WHERE product_id = $1 AND uom_id = $2', [id, uomId]);
  return apiSuccess({ ok: true });
}

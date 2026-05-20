import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const updateSchema = z.object({
  name_th: z.string().min(1).max(500).optional(),
  name_en: z.string().min(1).max(500).optional(),
  description_th: z.string().nullable().optional(),
  description_en: z.string().nullable().optional(),
  barcode: z.string().max(100).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  uom_id: z.string().uuid().optional(),
  unit_cost: z.number().nonnegative().optional(),
  reorder_point: z.number().int().nonnegative().optional(),
  is_lot_tracked: z.boolean().optional(),
  is_serial_tracked: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;
  const product = await queryOne(
    `SELECT p.*, u.code AS uom_code, u.name_en AS uom_name, c.name_en AS category_name,
            (SELECT gli.unit_cost FROM grn_line_items gli 
             JOIN goods_receipt_notes grn ON grn.id = gli.grn_id
             WHERE gli.product_id = p.id AND grn.status = 'stocked'
             ORDER BY grn.created_at DESC LIMIT 1) AS last_cost,
            json_agg(json_build_object(
              'warehouse_id', sb.warehouse_id, 'qty_on_hand', sb.qty_on_hand,
              'qty_available', sb.qty_available, 'warehouse_name', w.name_en
            )) FILTER (WHERE sb.warehouse_id IS NOT NULL) AS stock_by_warehouse
     FROM products p
     LEFT JOIN units_of_measure u ON u.id = p.uom_id
     LEFT JOIN product_categories c ON c.id = p.category_id
     LEFT JOIN stock_balances sb ON sb.product_id = p.id
     LEFT JOIN warehouses w ON w.id = sb.warehouse_id
     WHERE p.id = $1
     GROUP BY p.id, u.code, u.name_en, c.name_en`,
    [id]
  );
  if (!product) return apiError('Product not found', 404);
  return apiSuccess(product);
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

  if (parsed.data.barcode) {
    const barcodeExists = await queryOne(
      'SELECT id FROM products WHERE barcode = $1 AND id != $2',
      [parsed.data.barcode, id]
    );
    if (barcodeExists) return apiError('Barcode already in use', 409);
  }

  const updates: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  const fields = [
    'name_th', 'name_en', 'description_th', 'description_en', 'barcode',
    'category_id', 'uom_id', 'unit_cost', 'reorder_point',
    'is_lot_tracked', 'is_serial_tracked', 'is_active',
  ] as const;

  for (const f of fields) {
    if (parsed.data[f] !== undefined) {
      updates.push(`${f} = $${idx++}`);
      vals.push(parsed.data[f]);
    }
  }

  if (!updates.length) return apiError('No fields to update', 400);
  vals.push(id);

  const product = await queryOne(
    `UPDATE products SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    vals
  );
  if (!product) return apiError('Product not found', 404);
  return apiSuccess(product);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const product = await queryOne(
    'UPDATE products SET is_active = FALSE WHERE id = $1 RETURNING id',
    [id]
  );
  if (!product) return apiError('Product not found', 404);
  return apiSuccess({ id });
}

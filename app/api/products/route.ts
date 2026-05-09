import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const createSchema = z.object({
  sku: z.string().min(1).max(100),
  barcode: z.string().max(100).nullable().optional(),
  name_th: z.string().min(1).max(500),
  name_en: z.string().min(1).max(500),
  description_th: z.string().nullable().optional(),
  description_en: z.string().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  uom_id: z.string().uuid(),
  unit_cost: z.number().nonnegative(),
  reorder_point: z.number().int().nonnegative().default(0),
  is_lot_tracked: z.boolean().default(false),
  is_serial_tracked: z.boolean().default(false),
}).refine(d => !(d.is_lot_tracked && d.is_serial_tracked), {
  message: 'Product cannot be both lot-tracked and serial-tracked',
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(200, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const search = searchParams.get('search');
  const categoryId = searchParams.get('category_id');
  const showInactive = searchParams.get('show_inactive') === 'true';

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (!showInactive) { conditions.push('p.is_active = TRUE'); }
  if (search) { conditions.push(`(p.sku ILIKE $${idx} OR p.name_en ILIKE $${idx} OR p.name_th ILIKE $${idx})`); params.push(`%${search}%`); idx++; }
  if (categoryId) { conditions.push(`p.category_id = $${idx++}`); params.push(categoryId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [total] = await query<{ count: string }>(`SELECT COUNT(*) FROM products p ${where}`, params);

  const products = await query(
    `SELECT p.*, u.code AS uom_code, u.name_en AS uom_name,
            c.name_en AS category_name
     FROM products p
     LEFT JOIN units_of_measure u ON u.id = p.uom_id
     LEFT JOIN product_categories c ON c.id = p.category_id
     ${where}
     ORDER BY p.sku
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({
    data: products,
    total: Number(total.count),
    page,
    limit,
    total_pages: Math.ceil(Number(total.count) / limit),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const existing = await queryOne('SELECT id FROM products WHERE sku = $1', [parsed.data.sku]);
  if (existing) return apiError('SKU already exists', 409);

  if (parsed.data.barcode) {
    const barcodeExists = await queryOne('SELECT id FROM products WHERE barcode = $1', [parsed.data.barcode]);
    if (barcodeExists) return apiError('Barcode already in use', 409);
  }

  const product = await queryOne(
    `INSERT INTO products (sku, barcode, name_th, name_en, description_th, description_en,
      category_id, uom_id, unit_cost, reorder_point, is_lot_tracked, is_serial_tracked, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      parsed.data.sku, parsed.data.barcode ?? null, parsed.data.name_th, parsed.data.name_en,
      parsed.data.description_th ?? null, parsed.data.description_en ?? null,
      parsed.data.category_id ?? null, parsed.data.uom_id, parsed.data.unit_cost,
      parsed.data.reorder_point, parsed.data.is_lot_tracked, parsed.data.is_serial_tracked, u.id,
    ]
  );
  return apiSuccess(product, 201);
}

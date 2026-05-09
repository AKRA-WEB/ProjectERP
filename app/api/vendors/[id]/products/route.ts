import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const upsertSchema = z.object({
  product_id: z.string().uuid(),
  vendor_sku: z.string().max(100).nullable().optional(),
  unit_price: z.number().nonnegative(),
  lead_days: z.number().int().nonnegative().default(0),
  is_preferred: z.boolean().default(false),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const vendor = await queryOne('SELECT id FROM vendors WHERE id = $1', [id]);
  if (!vendor) return apiError('Vendor not found', 404);

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const vp = await queryOne(
    `INSERT INTO vendor_products (vendor_id, product_id, vendor_sku, unit_price, lead_days, is_preferred)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (vendor_id, product_id) DO UPDATE SET
       vendor_sku = EXCLUDED.vendor_sku,
       unit_price = EXCLUDED.unit_price,
       lead_days = EXCLUDED.lead_days,
       is_preferred = EXCLUDED.is_preferred,
       updated_at = NOW()
     RETURNING *`,
    [id, parsed.data.product_id, parsed.data.vendor_sku ?? null, parsed.data.unit_price, parsed.data.lead_days, parsed.data.is_preferred]
  );
  return apiSuccess(vp);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('product_id');
  if (!productId) return apiError('product_id required', 400);

  await query('DELETE FROM vendor_products WHERE vendor_id = $1 AND product_id = $2', [id, productId]);
  return apiSuccess({ deleted: true });
}

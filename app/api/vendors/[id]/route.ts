import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const updateSchema = z.object({
  name_th: z.string().min(1).max(500).optional(),
  name_en: z.string().min(1).max(500).optional(),
  contact_name: z.string().max(255).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  address_th: z.string().nullable().optional(),
  address_en: z.string().nullable().optional(),
  tax_id: z.string().max(50).nullable().optional(),
  payment_terms_days: z.number().int().nonnegative().optional(),
  bank_name: z.string().max(255).nullable().optional(),
  bank_account_number: z.string().max(100).nullable().optional(),
  bank_account_name: z.string().max(255).nullable().optional(),
  is_active: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;
  const vendor = await queryOne(
    `SELECT v.*,
            json_agg(json_build_object(
              'id', vp.id, 'product_id', vp.product_id, 'vendor_sku', vp.vendor_sku,
              'unit_price', vp.unit_price, 'lead_days', vp.lead_days, 'is_preferred', vp.is_preferred,
              'product_sku', p.sku, 'product_name_en', p.name_en
            )) FILTER (WHERE vp.id IS NOT NULL) AS catalog
     FROM vendors v
     LEFT JOIN vendor_products vp ON vp.vendor_id = v.id
     LEFT JOIN products p ON p.id = vp.product_id
     WHERE v.id = $1
     GROUP BY v.id`,
    [id]
  );
  if (!vendor) return apiError('Vendor not found', 404);
  return apiSuccess(vendor);
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

  const updates: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  const fields = ['name_th', 'name_en', 'contact_name', 'email', 'phone', 'address_th', 'address_en', 'tax_id', 'payment_terms_days', 'bank_name', 'bank_account_number', 'bank_account_name', 'is_active'] as const;
  for (const f of fields) {
    if (parsed.data[f] !== undefined) { updates.push(`${f} = $${idx++}`); vals.push(parsed.data[f]); }
  }
  if (!updates.length) return apiError('No fields to update', 400);
  vals.push(id);

  const vendor = await queryOne(
    `UPDATE vendors SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    vals
  );
  if (!vendor) return apiError('Vendor not found', 404);
  return apiSuccess(vendor);
}

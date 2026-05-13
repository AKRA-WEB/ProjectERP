import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;
  const rows = await query(
    `SELECT vp.id, vp.vendor_id, vp.vendor_sku, vp.unit_price, vp.lead_days,
            vp.is_preferred, vp.updated_at,
            v.code AS vendor_code, v.name_th AS vendor_name_th, v.name_en AS vendor_name_en,
            v.payment_terms_days
     FROM vendor_products vp
     JOIN vendors v ON v.id = vp.vendor_id
     WHERE vp.product_id = $1
     ORDER BY vp.is_preferred DESC, v.code`,
    [id]
  );
  return apiSuccess(rows);
}

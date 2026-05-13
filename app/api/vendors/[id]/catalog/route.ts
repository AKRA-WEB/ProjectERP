import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;
  const rows = await query(
    `SELECT product_id, unit_price, lead_days, is_preferred, vendor_sku
     FROM vendor_products WHERE vendor_id = $1`,
    [id]
  );
  return apiSuccess(rows);
}

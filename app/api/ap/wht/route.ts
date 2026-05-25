import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  
  const vendorId = searchParams.get('vendor_id');
  const monthStr = searchParams.get('month'); // YYYY-MM

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (vendorId) {
    conditions.push(`wc.vendor_id = $${idx++}`);
    params.push(vendorId);
  }

  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    conditions.push(`TO_CHAR(wc.issued_at, 'YYYY-MM') = $${idx++}`);
    params.push(monthStr);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const [totalResult] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM wht_certificates wc ${where}`,
    params
  );
  const total = parseInt(totalResult?.count ?? '0');

  const rows = await query(
    `SELECT wc.*, 
            v.name_th AS vendor_name_th, 
            v.name_en AS vendor_name_en, 
            v.code AS vendor_code,
            v.tax_id AS vendor_tax_id,
            p.payment_number,
            u.name_en AS issued_by_name
     FROM wht_certificates wc
     JOIN vendors v ON v.id = wc.vendor_id
     JOIN ap_payments p ON p.id = wc.payment_id
     LEFT JOIN users u ON u.id = wc.issued_by
     ${where}
     ORDER BY wc.issued_at DESC, wc.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({
    wht_certificates: rows,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit)
  });
}

import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import type { SessionUser } from '@/lib/authz';
import { query } from '@/lib/db/client';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin', 'manager', 'auditor']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;

  try {
    const [totalResult] = await query<{ count: string }>(
      `SELECT COUNT(*) FROM po_invoices WHERE match_status = 'mismatched'`
    );
    const total = parseInt(totalResult.count);

    const rows = await query(
      `SELECT 
        pi.*, 
        po.po_number, 
        v.name_th AS vendor_name,
        v.code AS vendor_code,
        mv.po_value,
        mv.gr_value,
        mv.invoice_value,
        mv.variance_type
      FROM po_invoices pi
      JOIN purchase_orders po ON po.id = pi.po_id
      LEFT JOIN vendors v ON v.id = pi.vendor_id
      LEFT JOIN LATERAL (
        SELECT po_value, gr_value, invoice_value, variance_type
        FROM po_invoice_match_variances
        WHERE po_invoice_id = pi.id
        ORDER BY created_at DESC
        LIMIT 1
      ) mv ON TRUE
      WHERE pi.match_status = 'mismatched'
      ORDER BY pi.created_at DESC
      LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return apiSuccess({
      data: rows,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Failed to query match queue:', err);
    return apiError('Failed to query match queue', 500);
  }
}

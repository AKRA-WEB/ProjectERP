import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole, type SessionUser } from '@/lib/authz';
import { query } from '@/lib/db/client';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin', 'manager']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';

  let where = '1=1';
  const params: unknown[] = [];
  let paramIndex = 1;

  if (status) {
    where += ` AND nt.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }
  if (search) {
    where += ` AND (p.sku ILIKE $${paramIndex} OR p.name_th ILIKE $${paramIndex} OR p.name_en ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  try {
    const rows = await query<{
      id: string;
      product_id: string;
      start_date: string;
      end_date: string;
      status: string;
      decision_at: string | null;
      decision_by: string | null;
      decision_notes: string | null;
      sku: string;
      name_th: string;
      name_en: string;
      is_npd_trial: boolean;
      score: string | number;
      qty_sold_30d: string | number;
      sell_through_30d: string | number;
      gross_margin_pct: string | number;
    }>(
      `SELECT nt.*, p.sku, p.name_th, p.name_en, p.is_npd_trial,
             COALESCE(sps.score, 0.0)::double precision AS score,
             COALESCE(sps.qty_sold_30d, 0.0)::double precision AS qty_sold_30d,
             COALESCE(sps.sell_through_30d, 0.0)::double precision AS sell_through_30d,
             COALESCE(sps.gross_margin_pct, 0.0)::double precision AS gross_margin_pct
      FROM npd_trials nt
      JOIN products p ON p.id = nt.product_id
      LEFT JOIN (
        SELECT product_id,
               ((sell_through_30d * 0.3) + (LEAST(GREATEST(gross_margin_pct, 0), 100) * 0.3) + (LEAST(qty_sold_30d, 100.0) / 100.0 * 40.0))::NUMERIC(15,2) AS score,
               qty_sold_30d, sell_through_30d, gross_margin_pct
        FROM sku_performance_snapshot
      ) sps ON sps.product_id = nt.product_id
      WHERE ${where}
      ORDER BY nt.end_date ASC, p.sku ASC`,
      params
    );

    return apiSuccess(rows);
  } catch (err) {
    console.error('Failed to query all NPD trials:', err);
    return apiError('Internal Server Error', 500);
  }
}

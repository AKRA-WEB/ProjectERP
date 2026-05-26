import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole, type SessionUser } from '@/lib/authz';
import { query } from '@/lib/db/client';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin', 'manager']);
  } catch {
    return apiError('Forbidden', 403);
  }

  try {
    // Select active trials whose end_date is <= CURRENT_DATE
    const rows = await query<{
      trial_id: string;
      product_id: string;
      start_date: string;
      end_date: string;
      status: string;
      sku: string;
      name_th: string;
      name_en: string;
      score: string | number;
      qty_sold_30d: string | number;
      sell_through_30d: string | number;
      gross_margin_pct: string | number;
      qty_on_hand: string | number;
      suggested_decision: 'graduate' | 'cut';
    }>(
      `SELECT nt.id AS trial_id, nt.product_id, nt.start_date, nt.end_date, nt.status,
             p.sku, p.name_th, p.name_en,
             COALESCE(sps.score, 0.0)::double precision AS score,
             COALESCE(sps.qty_sold_30d, 0.0)::double precision AS qty_sold_30d,
             COALESCE(sps.sell_through_30d, 0.0)::double precision AS sell_through_30d,
             COALESCE(sps.gross_margin_pct, 0.0)::double precision AS gross_margin_pct,
             COALESCE(sps.qty_on_hand, 0.0)::double precision AS qty_on_hand,
             CASE 
               WHEN COALESCE(sps.score, 0.0) >= 40.0 THEN 'graduate'
               ELSE 'cut'
             END::varchar(50) AS suggested_decision
      FROM npd_trials nt
      JOIN products p ON p.id = nt.product_id
      LEFT JOIN (
        SELECT product_id,
               ((sell_through_30d * 0.3) + (LEAST(GREATEST(gross_margin_pct, 0), 100) * 0.3) + (LEAST(qty_sold_30d, 100.0) / 100.0 * 40.0))::NUMERIC(15,2) AS score,
               qty_sold_30d, sell_through_30d, gross_margin_pct, qty_on_hand
        FROM sku_performance_snapshot
      ) sps ON sps.product_id = nt.product_id
      WHERE nt.status = 'active' AND nt.end_date <= CURRENT_DATE
      ORDER BY nt.end_date ASC, p.sku ASC`
    );

    return apiSuccess(rows);
  } catch (err) {
    console.error('Failed to query pending NPD decisions:', err);
    return apiError('Internal Server Error', 500);
  }
}

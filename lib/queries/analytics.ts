import { query } from '@/lib/db/client';

export interface Candidate {
  product_id: string;
  sku: string;
  name_th: string;
  name_en: string;
  qty_on_hand: string | number;
  qty_sold_30d: string | number;
  qty_sold_365d: string | number;
  revenue_30d: string | number;
  gross_margin_30d: string | number;
  gross_margin_pct: string | number;
  sell_through_30d: string | number;
  days_on_hand: string | number;
  velocity_bucket: 'FAST' | 'MEDIUM' | 'SLOW' | 'STAGNANT';
  score: string | number;
  reasons: string[];
}

export interface PerformanceSku {
  product_id: string;
  sku: string;
  name_th: string;
  name_en: string;
  qty_on_hand: string | number;
  qty_sold_30d: string | number;
  qty_sold_365d: string | number;
  revenue_30d: string | number;
  cogs_30d: string | number;
  gross_margin_30d: string | number;
  gross_margin_pct: string | number;
  sell_through_30d: string | number;
  days_on_hand: string | number;
  velocity_bucket: 'FAST' | 'MEDIUM' | 'SLOW' | 'STAGNANT';
  moving_avg_cost: string | number;
  last_updated: string;
}

export async function getSkuCutCandidates(search?: string): Promise<Candidate[]> {
  let where = '1=1';
  const params: unknown[] = [];
  if (search) {
    where += ` AND (sku ILIKE $1 OR name_th ILIKE $1 OR name_en ILIKE $1)`;
    params.push(`%${search}%`);
  }
  return query<Candidate>(`
    SELECT * FROM sku_cut_candidates
    WHERE ${where}
    ORDER BY score ASC, sku ASC
  `, params);
}

export async function getSkuPerformance(
  params: { search?: string; bucket?: string; limit?: number; offset?: number }
): Promise<{ rows: PerformanceSku[]; total: number }> {
  const limit = Math.min(200, params.limit ?? 50);
  const offset = Math.max(0, params.offset ?? 0);

  let where = '1=1';
  const qParams: unknown[] = [];
  let paramIndex = 1;

  if (params.search) {
    where += ` AND (sku ILIKE $${paramIndex} OR name_th ILIKE $${paramIndex} OR name_en ILIKE $${paramIndex})`;
    qParams.push(`%${params.search}%`);
    paramIndex++;
  }
  if (params.bucket) {
    where += ` AND velocity_bucket = $${paramIndex}`;
    qParams.push(params.bucket);
    paramIndex++;
  }

  const [countRes, rows] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*) FROM sku_performance_snapshot WHERE ${where}`,
      qParams
    ),
    query<PerformanceSku>(
      `SELECT * FROM sku_performance_snapshot 
       WHERE ${where}
       ORDER BY qty_sold_30d DESC, sku ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...qParams, limit, offset]
    ),
  ]);

  const total = parseInt(countRes[0]?.count || '0', 10);
  return { rows, total };
}

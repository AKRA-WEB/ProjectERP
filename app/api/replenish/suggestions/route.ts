import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';
import { assertRole } from '@/lib/authz';
import type { SessionUser } from '@/types';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['manager', 'admin']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20');
  const offset = (page - 1) * pageSize;
  const status = searchParams.get('status');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (status) {
    conditions.push(`ts.status = $${idx++}`);
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query<Record<string, unknown>>(
    `SELECT
       ts.*,
       p.sku,
       p.name_th AS product_name_th,
       p.name_en AS product_name_en,
       p.moving_avg_cost,
       p.w1_reorder_point,
       p.w1_reorder_qty,
       u_measure.code AS uom_code,
       w_src.code AS source_wh_code,
       w_src.name_th AS source_wh_name_th,
       w_src.name_en AS source_wh_name_en,
       w_tgt.code AS target_wh_code,
       w_tgt.name_th AS target_wh_name_th,
       w_tgt.name_en AS target_wh_name_en,
       usr.name_th AS approved_by_name_th,
       usr.name_en AS approved_by_name_en,
       COALESCE(sb_src.qty_available, 0) AS source_qty_available,
       COALESCE(sb_tgt.qty_available, 0) AS target_qty_available,
       COUNT(*) OVER() as total_count
     FROM transfer_suggestions ts
     JOIN products p ON p.id = ts.product_id
     JOIN units_of_measure u_measure ON u_measure.id = p.uom_id
     JOIN warehouses w_src ON w_src.id = ts.source_wh
     JOIN warehouses w_tgt ON w_tgt.id = ts.target_wh
     LEFT JOIN users usr ON usr.id = ts.approved_by
     LEFT JOIN stock_balances sb_src ON sb_src.product_id = ts.product_id AND sb_src.warehouse_id = ts.source_wh
     LEFT JOIN stock_balances sb_tgt ON sb_tgt.product_id = ts.product_id AND sb_tgt.warehouse_id = ts.target_wh
     ${where}
     ORDER BY ts.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, pageSize, offset]
  );

  const total = rows[0] ? parseInt(rows[0].total_count as string) : 0;

  return apiSuccess({ data: rows, total });
}

import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const { id } = await params;

  // Recursive BOM explosion
  // We join from product_id to bom_headers to find child BOMs
  const rows = await query(`
    WITH RECURSIVE bom_tree AS (
      -- Base case: the initial BOM
      SELECT 
        bl.id, 
        bh.product_id AS parent_product_id,
        bl.component_id, 
        bl.qty_required, 
        bl.uom_id,
        1 AS depth,
        ARRAY[bl.id] AS path
      FROM bom_lines bl
      JOIN bom_headers bh ON bh.id = bl.bom_id
      WHERE bl.bom_id = $1

      UNION ALL

      -- Recursive step: find BOMs for the components
      SELECT 
        bl2.id,
        bt.component_id AS parent_product_id,
        bl2.component_id,
        (bt.qty_required * bl2.qty_required) AS qty_required,
        bl2.uom_id,
        bt.depth + 1,
        bt.path || bl2.id
      FROM bom_lines bl2
      JOIN bom_headers bh2 ON bh2.id = bl2.bom_id
      JOIN bom_tree bt ON bt.component_id = bh2.product_id
      WHERE bt.depth < 20 AND bh2.is_active = TRUE AND NOT (bl2.id = ANY(bt.path))
    )
    SELECT 
      bt.*,
      p.sku AS component_sku,
      p.name_th AS component_name_th,
      uom.code AS uom_code
    FROM bom_tree bt
    JOIN products p ON p.id = bt.component_id
    JOIN units_of_measure uom ON uom.id = bt.uom_id
    ORDER BY bt.depth, bt.component_sku
  `, [id]);

  return apiSuccess(rows);
}

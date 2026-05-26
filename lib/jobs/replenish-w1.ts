import pool from '@/lib/db/client';

export async function runReplenishmentJob(): Promise<{ createdCount: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const res = await client.query<{ id: string }>(
      `INSERT INTO transfer_suggestions (
        product_id,
        suggested_qty,
        source_wh,
        target_wh,
        source_bu,
        target_bu,
        status
      )
      SELECT
        p.id AS product_id,
        p.w1_reorder_qty AS suggested_qty,
        (SELECT id FROM warehouses WHERE code = 'W2') AS source_wh,
        (SELECT id FROM warehouses WHERE code = 'W1') AS target_wh,
        'AKRA' AS source_bu,
        'TRD' AS target_bu,
        'pending' AS status
      FROM products p
      WHERE p.is_active = TRUE
        AND p.w1_reorder_point IS NOT NULL
        AND p.w1_reorder_point > 0
        AND p.w1_reorder_qty IS NOT NULL
        AND p.w1_reorder_qty > 0
        AND COALESCE((
          SELECT qty_available
          FROM stock_balances
          WHERE product_id = p.id
            AND warehouse_id = (SELECT id FROM warehouses WHERE code = 'W1')
        ), 0) <= p.w1_reorder_point
        AND NOT EXISTS (
          SELECT 1 FROM transfer_suggestions ts
          WHERE ts.product_id = p.id
            AND ts.status = 'pending'
        )
        AND NOT EXISTS (
          SELECT 1 FROM transfer_suggestions ts
          WHERE ts.product_id = p.id
            AND ts.status = 'rejected'
            AND ts.created_at >= NOW() - INTERVAL '7 days'
        )
      RETURNING id`
    );

    await client.query('COMMIT');
    return { createdCount: res.rowCount ?? 0 };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

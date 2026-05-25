import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import pool from '@/lib/db/client';
import { assertRole, type SessionUser } from '@/lib/authz';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('product_id');

  let client;
  try {
    client = await pool.connect();
    
    if (productId) {
      // Validate product existence
      const prodCheck = await client.query('SELECT id FROM products WHERE id = $1', [productId]);
      if (prodCheck.rows.length === 0) {
        return apiError('Product not found', 404);
      }

      // Recalculate MAC for a single product based on its specific grn history
      await client.query('BEGIN');
      
      // Select and lock the product
      await client.query('SELECT moving_avg_cost FROM products WHERE id = $1 FOR UPDATE', [productId]);
      
      // Calculate and update sequentially
      const entries = await client.query<{ qty_change: string; unit_cost: string }>(
        `SELECT qty_change, unit_cost 
         FROM stock_ledger 
         WHERE product_id = $1 AND entry_type = 'grn_receipt'
         ORDER BY created_at ASC, id ASC`,
        [productId]
      );

      let currentMac = 0;
      let qtyAccumulated = 0;

      for (const entry of entries.rows) {
        const qtyChange = Number(entry.qty_change);
        const unitCost = Number(entry.unit_cost);
        const qtyAfter = qtyAccumulated + qtyChange;

        if (qtyAfter <= 0) {
          currentMac = unitCost;
        } else if (qtyAccumulated <= 0) {
          currentMac = unitCost;
        } else {
          currentMac = ((qtyAccumulated * currentMac) + (qtyChange * unitCost)) / qtyAfter;
        }

        currentMac = Math.max(0, currentMac);
        qtyAccumulated = qtyAfter;
      }

      await client.query(
        'UPDATE products SET moving_avg_cost = $1, updated_at = NOW() WHERE id = $2',
        [currentMac, productId]
      );
      
      await client.query('COMMIT');
      return apiSuccess({ message: `Successfully recalculated MAC for product ${productId}`, new_mac: currentMac });
    } else {
      // Run global backfill function
      await client.query('SELECT backfill_mac()');
      return apiSuccess({ message: 'Successfully recalculated global MAC for all products' });
    }
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('MAC recalculation error:', err);
    return apiError('Failed to recalculate MAC', 500);
  } finally {
    if (client) client.release();
  }
}

import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import pool from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';
import { z } from 'zod';

const ClearSchema = z.object({
  buffer_warehouse_code: z.enum(['V-BUF-TRD', 'V-BUF-AKRA']),
  product_id: z.string().uuid(),
  qty: z.number().positive(),
  action: z.enum(['putback', 'scrap', 'markdown']),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin', 'manager']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const result = ClearSchema.safeParse(body);
  if (!result.success) return apiError('Invalid request parameters', 400);
  const { buffer_warehouse_code, product_id, qty, action } = result.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch virtual buffer warehouse info
    const bufferRes = await client.query(
      `SELECT id, business_unit_id FROM warehouses WHERE code = $1 AND is_active = true`,
      [buffer_warehouse_code]
    );
    if (bufferRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return apiError('Buffer warehouse not found', 404);
    }
    const bufferWh = bufferRes.rows[0];

    // 2. Fetch target physical warehouse based on BU
    const physicalRes = await client.query(
      `SELECT id FROM warehouses WHERE business_unit_id = $1 AND code NOT LIKE 'V-%' AND is_active = true LIMIT 1`,
      [bufferWh.business_unit_id]
    );
    if (physicalRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return apiError('No active physical warehouse found for this Business Unit', 404);
    }
    const physicalWhId = physicalRes.rows[0].id;

    // 3. Verify buffer has enough quantity on hand
    const balanceRes = await client.query(
      `SELECT qty_on_hand FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE`,
      [bufferWh.id, product_id]
    );
    const bufferQty = Number(balanceRes.rows[0]?.qty_on_hand || 0);
    if (bufferQty < qty) {
      await client.query('ROLLBACK');
      return apiError(`Insufficient stock in buffer. Available: ${bufferQty}`, 409);
    }

    // 4. Resolve destination warehouse & entry types based on action
    let destWarehouseId = physicalWhId;
    let entryTypeOut: 'quarantine_out' | 'scrap' | 'clearance_move' = 'quarantine_out';
    let entryTypeIn: 'quarantine_in' | 'scrap' | 'clearance_move' = 'quarantine_in';

    if (action === 'scrap') {
      const scrapRes = await client.query(`SELECT id FROM warehouses WHERE code = 'V-KILL'`);
      if (scrapRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return apiError('Scrap warehouse V-KILL not found', 404);
      }
      destWarehouseId = scrapRes.rows[0].id;
      entryTypeOut = 'scrap';
      entryTypeIn = 'scrap';
    } else if (action === 'markdown') {
      const clearanceRes = await client.query(`SELECT id FROM warehouses WHERE code = 'V-CLR'`);
      if (clearanceRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return apiError('Clearance warehouse V-CLR not found', 404);
      }
      destWarehouseId = clearanceRes.rows[0].id;
      entryTypeOut = 'clearance_move';
      entryTypeIn = 'clearance_move';
    }

    // 5. Post stock ledger OUT of buffer
    await client.query(
      `INSERT INTO stock_ledger (warehouse_id, product_id, entry_type, reference_type, qty_change, qty_after, created_by)
       VALUES ($1, $2, $3, 'buffer_clear', $4, $5, $6)`,
      [bufferWh.id, product_id, entryTypeOut, -qty, bufferQty - qty, u.id]
    );

    // 6. Post stock ledger IN to destination
    const destBalanceRes = await client.query(
      `SELECT qty_on_hand FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE`,
      [destWarehouseId, product_id]
    );
    const destQty = Number(destBalanceRes.rows[0]?.qty_on_hand || 0);

    await client.query(
      `INSERT INTO stock_ledger (warehouse_id, product_id, entry_type, reference_type, qty_change, qty_after, created_by)
       VALUES ($1, $2, $3, 'buffer_clear', $4, $5, $6)`,
      [destWarehouseId, product_id, entryTypeIn, qty, destQty + qty, u.id]
    );

    await client.query('COMMIT');
    return apiSuccess({ cleared: true, action, qty });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Buffer clear error:', err);
    return apiError('Failed to clear buffer inventory', 500);
  } finally {
    client.release();
  }
}

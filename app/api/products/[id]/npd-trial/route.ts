import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole, type SessionUser } from '@/lib/authz';
import { queryOne } from '@/lib/db/client';
import pool from '@/lib/db/client';
import { z } from 'zod';

const PostSchema = z.object({
  end_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
});

const PatchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('extend'),
    end_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid date format',
    }),
    notes: z.string().optional(),
  }),
  z.object({
    action: z.literal('graduate'),
    notes: z.string().optional(),
  }),
  z.object({
    action: z.literal('cut'),
    notes: z.string().optional(),
  }),
]);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin', 'manager']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { id } = await params;

  try {
    const trial = await queryOne<{
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
    }>(
      `SELECT nt.*, p.sku, p.name_th, p.name_en, p.is_npd_trial 
       FROM npd_trials nt
       JOIN products p ON p.id = nt.product_id
       WHERE nt.product_id = $1
       ORDER BY nt.created_at DESC LIMIT 1`,
      [id]
    );

    if (!trial) {
      const prod = await queryOne<{ id: string; sku: string; name_th: string; name_en: string; is_npd_trial: boolean }>(
        'SELECT id, sku, name_th, name_en, is_npd_trial FROM products WHERE id = $1',
        [id]
      );
      if (!prod) return apiError('Product not found', 404);
      return apiSuccess({ is_npd_trial: prod.is_npd_trial, trial: null, product: prod });
    }

    return apiSuccess({ is_npd_trial: trial.is_npd_trial, trial });
  } catch (err) {
    console.error('Failed to fetch NPD trial details:', err);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin', 'manager']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify product exists and is active
    const prod = await client.query<{ is_active: boolean; is_npd_trial: boolean }>(
      'SELECT is_active, is_npd_trial FROM products WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (prod.rows.length === 0) {
      await client.query('ROLLBACK');
      return apiError('Product not found', 404);
    }
    if (!prod.rows[0].is_active) {
      await client.query('ROLLBACK');
      return apiError('Cannot mark inactive product as NPD trial', 400);
    }

    // Update products table
    await client.query(
      'UPDATE products SET is_npd_trial = TRUE WHERE id = $1',
      [id]
    );

    // If there is an existing active trial, terminate it as 'extended' or deactivate it first
    await client.query(
      "UPDATE npd_trials SET status = 'extended', decision_at = NOW(), decision_by = $1, decision_notes = 'Replaced by new trial window' WHERE product_id = $2 AND status = 'active'",
      [u.id, id]
    );

    // Insert new trial row
    const trialRes = await client.query(
      `INSERT INTO npd_trials (product_id, start_date, end_date, status)
       VALUES ($1, CURRENT_DATE, $2, 'active')
       RETURNING *`,
      [id, parsed.data.end_date]
    );

    await client.query('COMMIT');
    return apiSuccess(trialRes.rows[0], 201);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to create NPD trial:', err);
    return apiError('Internal Server Error', 500);
  } finally {
    client.release();
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin', 'manager']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch the active trial for this product
    const trialRes = await client.query<{ id: string }>(
      "SELECT * FROM npd_trials WHERE product_id = $1 AND status = 'active' FOR UPDATE",
      [id]
    );
    if (trialRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return apiError('No active NPD trial found for this product', 404);
    }
    const trial = trialRes.rows[0];

    const { action } = parsed.data;
    const notes = parsed.data.notes ?? '';

    if (action === 'extend') {
      const extendDate = parsed.data.end_date;
      // Mark current trial as extended
      await client.query(
        `UPDATE npd_trials 
         SET status = 'extended', decision_at = NOW(), decision_by = $1, decision_notes = $2
         WHERE id = $3`,
        [u.id, `Extended to ${extendDate}. Notes: ${notes}`, trial.id]
      );

      // Create new trial window
      const newTrial = await client.query(
        `INSERT INTO npd_trials (product_id, start_date, end_date, status)
         VALUES ($1, CURRENT_DATE, $2, 'active')
         RETURNING *`,
        [id, extendDate]
      );
      
      await client.query('COMMIT');
      return apiSuccess({ message: 'Trial extended successfully', trial: newTrial.rows[0] });

    } else if (action === 'graduate') {
      // Graduate trial
      await client.query(
        `UPDATE npd_trials 
         SET status = 'graduated', decision_at = NOW(), decision_by = $1, decision_notes = $2
         WHERE id = $3`,
        [u.id, notes, trial.id]
      );

      // Clear NPD trial flag from products
      await client.query(
        'UPDATE products SET is_npd_trial = FALSE WHERE id = $1',
        [id]
      );

      await client.query('COMMIT');
      return apiSuccess({ message: 'Product successfully graduated to standard SKU' });

    } else if (action === 'cut') {
      // Cut trial
      await client.query(
        `UPDATE npd_trials 
         SET status = 'cut', decision_at = NOW(), decision_by = $1, decision_notes = $2
         WHERE id = $3`,
        [u.id, notes, trial.id]
      );

      // Deactivate product
      await client.query(
        'UPDATE products SET is_active = FALSE, is_npd_trial = FALSE WHERE id = $1',
        [id]
      );

      // Move in-flight stock to V-CLR clearance virtual warehouse
      // 1. Fetch current quantities across all physical warehouses
      const balances = await client.query<{ warehouse_id: string; qty_on_hand: string; wh_code: string }>(
        `SELECT sb.warehouse_id, sb.qty_on_hand, w.code AS wh_code
         FROM stock_balances sb
         JOIN warehouses w ON w.id = sb.warehouse_id
         WHERE sb.product_id = $1 AND sb.qty_on_hand > 0 AND w.code != 'V-CLR'`,
        [id]
      );

      if (balances.rows.length > 0) {
        // Fetch V-CLR warehouse ID
        const vClrWh = await client.query<{ id: string }>(
          "SELECT id FROM warehouses WHERE code = 'V-CLR'"
        );
        if (vClrWh.rows.length === 0) {
          await client.query('ROLLBACK');
          return apiError('Clearance virtual warehouse V-CLR not found in database', 500);
        }
        const vClrWhId = vClrWh.rows[0].id;

        for (const balance of balances.rows) {
          const qty = Number(balance.qty_on_hand);
          
          // Deduct from current warehouse in ledger
          await client.query(
            `INSERT INTO stock_ledger (warehouse_id, product_id, entry_type, reference_type, reference_id, qty_change, qty_after, created_by, notes)
             VALUES ($1, $2, 'clearance_move', 'npd_cut', $3, $4, 0, $5, $6)`,
            [balance.warehouse_id, id, trial.id, -qty, u.id, `NPD Cut stock clearance move from ${balance.wh_code}`]
          );

          // Update stock_balances for source warehouse
          await client.query(
            `UPDATE stock_balances 
             SET qty_on_hand = 0, qty_available = 0, last_updated = NOW() 
             WHERE warehouse_id = $1 AND product_id = $2`,
            [balance.warehouse_id, id]
          );

          // Fetch previous qty on hand in V-CLR
          const prevVClr = await client.query<{ qty_on_hand: string }>(
            'SELECT qty_on_hand FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2',
            [vClrWhId, id]
          );
          const prevQty = Number(prevVClr.rows[0]?.qty_on_hand ?? 0);
          const newVClrQty = prevQty + qty;

          // Add to V-CLR in ledger
          await client.query(
            `INSERT INTO stock_ledger (warehouse_id, product_id, entry_type, reference_type, reference_id, qty_change, qty_after, created_by, notes)
             VALUES ($1, $2, 'clearance_move', 'npd_cut', $3, $4, $5, $6, $7)`,
            [vClrWhId, id, trial.id, qty, newVClrQty, u.id, `NPD Cut stock clearance received in V-CLR from ${balance.wh_code}`]
          );

          // Update stock_balances for V-CLR
          await client.query(
            `INSERT INTO stock_balances (warehouse_id, product_id, qty_on_hand, qty_available, last_updated)
             VALUES ($1, $2, $3, $3, NOW())
             ON CONFLICT (warehouse_id, product_id)
             DO UPDATE SET qty_on_hand = stock_balances.qty_on_hand + EXCLUDED.qty_on_hand, 
                           qty_available = stock_balances.qty_available + EXCLUDED.qty_available,
                           last_updated = NOW()`,
            [vClrWhId, id, qty]
          );
        }
      }

      await client.query('COMMIT');
      return apiSuccess({ message: 'Product cut successfully. In-flight stock transferred to V-CLR.' });
    }

    await client.query('ROLLBACK');
    return apiError('Unsupported action', 400);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to process NPD decision:', err);
    return apiError('Internal Server Error', 500);
  } finally {
    client.release();
  }
}

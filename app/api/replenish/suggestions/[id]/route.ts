import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import pool from '@/lib/db/client';
import { assertRole } from '@/lib/authz';
import type { SessionUser } from '@/types';
import { z } from 'zod';

const PatchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    suggested_qty: z.number().positive().optional(),
  }),
  z.object({
    action: z.literal('reject'),
  }),
  z.object({
    action: z.literal('edit'),
    suggested_qty: z.number().positive(),
  }),
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['manager', 'admin']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch suggestion
    const tsRes = await client.query<Record<string, unknown>>(
      `SELECT ts.*, p.moving_avg_cost, p.sku
       FROM transfer_suggestions ts
       JOIN products p ON p.id = ts.product_id
       WHERE ts.id = $1 FOR UPDATE`,
      [id]
    );

    if (tsRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return apiError('Transfer suggestion not found', 404);
    }

    const ts = tsRes.rows[0];

    if (ts.status !== 'pending') {
      await client.query('ROLLBACK');
      return apiError('Transfer suggestion has already been processed', 400);
    }

    const { action } = parsed.data;

    if (action === 'reject') {
      await client.query(
        `UPDATE transfer_suggestions
         SET status = 'rejected', approved_at = NOW(), approved_by = $2
         WHERE id = $1`,
        [id, u.id]
      );
      await client.query('COMMIT');
      return apiSuccess({ status: 'rejected' });
    }

    if (action === 'edit') {
      const { suggested_qty } = parsed.data;
      await client.query(
        `UPDATE transfer_suggestions
         SET suggested_qty = $2
         WHERE id = $1`,
        [id, suggested_qty]
      );
      await client.query('COMMIT');
      return apiSuccess({ status: 'pending', suggested_qty });
    }

    if (action === 'approve') {
      const finalQty = parsed.data.suggested_qty ?? Number(ts.suggested_qty);

      // A. Create warehouse transfer order
      const notes = `Approved auto-replenishment from suggestion. Original quantity: ${ts.suggested_qty}`;
      const trfRes = await client.query<{ id: string; transfer_number: string }>(
        `INSERT INTO warehouse_transfers (
          source_warehouse_id,
          dest_warehouse_id,
          initiated_by,
          status,
          notes
        ) VALUES ($1, $2, $3, 'pending', $4)
        RETURNING id, transfer_number`,
        [ts.source_wh, ts.target_wh, u.id, notes]
      );

      const transferId = trfRes.rows[0].id;
      const transferNumber = trfRes.rows[0].transfer_number;

      // B. Create warehouse transfer line items
      await client.query(
        `INSERT INTO warehouse_transfer_lines (
          transfer_id,
          product_id,
          qty,
          line_number
        ) VALUES ($1, $2, $3, 1)`,
        [transferId, ts.product_id, finalQty]
      );

      // C. Inter-company double-entry accounting (if MAC > 0)
      const mac = Number(ts.moving_avg_cost || 0);
      let jeId: string | null = null;

      if (mac > 0) {
        const transferValue = Math.round(finalQty * mac * 100) / 100;

        // Resolve open fiscal period
        const fpRes = await client.query<{ id: string }>(
          `SELECT id FROM fiscal_periods 
           WHERE status = 'open' 
             AND CURRENT_DATE BETWEEN start_date AND end_date 
           LIMIT 1`
        );
        const fiscalPeriodId = fpRes.rows[0]?.id;

        if (!fiscalPeriodId) {
          throw new Error('No open fiscal period found for current date. Cannot post Inter-BU journal entry.');
        }

        // Resolve account IDs for the four keys
        const accountCodes = ['1300-TRD', '1300-AKRA', '2190-AKRA', '1190-TRD'];
        const accountsRes = await client.query<{ id: string; account_code: string }>(
          `SELECT id, account_code FROM accounts WHERE account_code = ANY($1)`,
          [accountCodes]
        );

        const accountsMap = new Map(accountsRes.rows.map(r => [r.account_code, r.id]));
        const trdInvAcc = accountsMap.get('1300-TRD');
        const akraInvAcc = accountsMap.get('1300-AKRA');
        const akraPayableAcc = accountsMap.get('2190-AKRA');
        const trdReceivableAcc = accountsMap.get('1190-TRD');

        if (!trdInvAcc || !akraInvAcc || !akraPayableAcc || !trdReceivableAcc) {
          const missing = accountCodes.filter(c => !accountsMap.has(c));
          throw new Error(`Required inter-company accounts (${missing.join(', ')}) not configured in Chart of Accounts`);
        }

        // Post Journal Entry
        const desc = `Inter-BU Transfer: W2 -> W1 for SKU ${ts.sku} (Qty ${finalQty})`;
        const jeRes = await client.query<{ id: string }>(
          `INSERT INTO journal_entries (
            fiscal_period_id,
            entry_date,
            entry_type,
            status,
            reference_type,
            reference_id,
            description,
            created_by,
            posted_by,
            posted_at
          ) VALUES ($1, CURRENT_DATE, 'inventory_adjustment', 'posted', 'transfer_suggestions', $2, $3, $4, $4, NOW())
          RETURNING id`,
          [fiscalPeriodId, id, desc, u.id]
        );
        jeId = jeRes.rows[0].id;

        // Line 1: DR 1300-TRD
        await client.query(
          `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, line_number, description)
           VALUES ($1, $2, $3, 0, 1, 'Inventory received at W1')`,
          [jeId, trdInvAcc, transferValue]
        );

        // Line 2: CR 1300-AKRA
        await client.query(
          `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, line_number, description)
           VALUES ($1, $2, 0, $3, 2, 'Inventory released from W2')`,
          [jeId, akraInvAcc, transferValue]
        );

        // Line 3: CR 2190-AKRA (Inter-company Payable)
        await client.query(
          `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, line_number, description)
           VALUES ($1, $2, 0, $3, 3, 'AKRA Inter-company Payable to TRD')`,
          [jeId, akraPayableAcc, transferValue]
        );

        // Line 4: DR 1190-TRD (Inter-company Receivable)
        await client.query(
          `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, line_number, description)
           VALUES ($1, $2, $3, 0, 4, 'TRD Inter-company Receivable from AKRA')`,
          [jeId, trdReceivableAcc, transferValue]
        );
      }

      // D. Update Suggestion Status
      await client.query(
        `UPDATE transfer_suggestions
         SET status = 'approved',
             approved_at = NOW(),
             approved_by = $2,
             transfer_id = $3,
             je_id = $4
         WHERE id = $1`,
        [id, u.id, transferId, jeId]
      );

      await client.query('COMMIT');
      return apiSuccess({
        status: 'approved',
        transfer_id: transferId,
        transfer_number: transferNumber,
        je_id: jeId,
        je_posted: jeId !== null
      });
    }
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return apiError(msg, 500);
  } finally {
    client.release();
  }
}

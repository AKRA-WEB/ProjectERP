import type { PoolClient } from 'pg';

/**
 * Automatically posts a Journal Entry for repack yield loss.
 * MUST be called inside a transaction.
 */
export async function postYieldLossJE(
  client: PoolClient,
  repackOrderId: string,
  lossQty: number,
  sourceUnitCost: number,
  fiscalPeriodId: string,
  userId: string
): Promise<{ je_id: string }> {
  const lossValue = Math.round(lossQty * sourceUnitCost * 100) / 100;
  if (lossValue <= 0) throw new Error('Loss value must be positive to post JE');

  // 1. Resolve account IDs
  const accounts = await client.query(
    `SELECT id, account_code FROM accounts WHERE account_code IN ('5910', '1300')`
  );
  const wasteAcc = accounts.rows.find(r => r.account_code === '5910')?.id;
  const invAcc = accounts.rows.find(r => r.account_code === '1300')?.id;

  if (!wasteAcc || !invAcc) {
    throw new Error('Required accounts (5910 COGS-Waste or 1300 Inventory) not configured in Chart of Accounts');
  }

  // 2. Create Journal Entry
  const jeRes = await client.query(
    `INSERT INTO journal_entries (
      fiscal_period_id, entry_date, entry_type, status, 
      reference_type, reference_id, description, 
      created_by, posted_by, posted_at
    )
    VALUES ($1, CURRENT_DATE, 'inventory_adjustment', 'posted', 'repack_orders', $2, 'Repack yield loss', $3, $3, NOW())
    RETURNING id`,
    [fiscalPeriodId, repackOrderId, userId]
  );
  const jeId = jeRes.rows[0].id;

  // 3. Insert Journal Entry Lines (DR Waste, CR Inventory)
  // Line 1: DR COGS — Operational Waste
  await client.query(
    `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, line_number, description)
     VALUES ($1, $2, $3, 0, 1, 'Repack yield loss (Debit)')`,
    [jeId, wasteAcc, lossValue]
  );

  // Line 2: CR Inventory
  await client.query(
    `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, line_number, description)
     VALUES ($1, $2, 0, $3, 2, 'Repack yield loss (Credit)')`,
    [jeId, invAcc, lossValue]
  );

  return { je_id: jeId };
}

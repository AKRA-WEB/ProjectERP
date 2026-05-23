import pool from '@/lib/db/client';

export interface CreditStatus {
  on_hold: boolean;
  outstanding: number;
  credit_limit: number;
  max_aging_days: number;
  reason?: string;
  can_override: boolean;
}

export async function checkCreditStatus(customerId: string): Promise<CreditStatus> {
  const res = await pool.query<{
    credit_limit: string;
    on_hold: boolean;
    outstanding: string;
    max_aging_days: string | null;
  }>(
    `SELECT
       c.credit_limit,
       c.on_hold,
       COALESCE(SUM(si.total_amount), 0)::NUMERIC AS outstanding,
       MAX(GREATEST(0, CURRENT_DATE - si.due_date))::INT AS max_aging_days
     FROM customers c
     LEFT JOIN sales_invoices si
       ON si.customer_id = c.id
       AND si.status = 'issued'
       AND si.paid_at IS NULL
     WHERE c.id = $1
     GROUP BY c.id`,
    [customerId]
  );

  const row = res.rows[0];
  if (!row) {
    return { on_hold: false, outstanding: 0, credit_limit: 0, max_aging_days: 0, can_override: true };
  }

  const outstanding = Number(row.outstanding);
  const credit_limit = Number(row.credit_limit);
  const max_aging_days = Number(row.max_aging_days ?? 0);

  // Compute hold from live invoice data only — never trust the cached column,
  // so payment clears the block immediately without manual intervention.
  const computed_hold =
    outstanding > credit_limit ||
    max_aging_days >= 1;

  return {
    on_hold: computed_hold,
    outstanding,
    credit_limit,
    max_aging_days,
    reason: computed_hold ? 'over_limit_or_aging' : undefined,
    can_override: true,
  };
}

import pool from '@/lib/db/client';

interface RebateContractRow {
  id: string;
  vendor_id: string;
  threshold_amount: string | number;
  rebate_rate: string | number;
  period: 'monthly' | 'quarterly' | 'annual';
  valid_from: string | Date;
  valid_to: string | Date;
}

interface PeriodRange {
  label: string;
  start: Date;
  end: Date;
}

function getPeriodLabels(validFrom: string | Date, validTo: string | Date, period: 'monthly' | 'quarterly' | 'annual'): PeriodRange[] {
  const from = new Date(validFrom);
  const to = new Date(validTo);
  const periods: PeriodRange[] = [];

  // Start with the first day of the start month to cover full months/quarters/years
  const curr = new Date(from.getFullYear(), from.getMonth(), 1);
  while (curr <= to) {
    const y = curr.getFullYear();
    const m = curr.getMonth(); // 0-indexed

    if (period === 'monthly') {
      const label = `${y}-${String(m + 1).padStart(2, '0')}`;
      const periodStart = new Date(y, m, 1);
      const periodEnd = new Date(y, m + 1, 0); // Last day of month
      
      periods.push({
        label,
        start: periodStart < from ? from : periodStart,
        end: periodEnd > to ? to : periodEnd,
      });
      curr.setMonth(curr.getMonth() + 1);
    } else if (period === 'quarterly') {
      const q = Math.floor(m / 3) + 1;
      const label = `${y}-Q${q}`;
      const qStartMonth = (q - 1) * 3;
      const periodStart = new Date(y, qStartMonth, 1);
      const periodEnd = new Date(y, qStartMonth + 3, 0);
      
      if (!periods.some(p => p.label === label)) {
        periods.push({
          label,
          start: periodStart < from ? from : periodStart,
          end: periodEnd > to ? to : periodEnd,
        });
      }
      curr.setMonth(curr.getMonth() + 1);
    } else { // 'annual'
      const label = `${y}`;
      const periodStart = new Date(y, 0, 1);
      const periodEnd = new Date(y, 12, 0);
      
      if (!periods.some(p => p.label === label)) {
        periods.push({
          label,
          start: periodStart < from ? from : periodStart,
          end: periodEnd > to ? to : periodEnd,
        });
      }
      curr.setFullYear(curr.getFullYear() + 1);
    }
  }
  return periods;
}

export async function runRebateAccrualJob(): Promise<{ processedCount: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch all active or relevant contracts
    const contractsRes = await client.query<RebateContractRow>(
      `SELECT id, vendor_id, threshold_amount, rebate_rate, period, valid_from, valid_to
       FROM vendor_rebate_contracts`
    );

    const contracts = contractsRes.rows;
    let processedCount = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const contract of contracts) {
      const periods = getPeriodLabels(contract.valid_from, contract.valid_to, contract.period);
      const threshold = Number(contract.threshold_amount);
      const rate = Number(contract.rebate_rate);

      for (const p of periods) {
        // A. Check if an accrual row exists and its status
        const existRes = await client.query<{ status: string }>(
          `SELECT status FROM vendor_rebate_accruals
           WHERE vendor_id = $1 AND contract_id = $2 AND period_label = $3`,
          [contract.vendor_id, contract.id, p.label]
        );

        if (existRes.rows.length > 0) {
          const status = existRes.rows[0].status;
          if (status === 'realised' || status === 'expired') {
            // Already locked/finalised. Do not retroactively modify.
            continue;
          }
        }

        // B. Calculate eligible purchases during period
        const purchasesRes = await client.query<{ total: string }>(
          `SELECT COALESCE(SUM(total_amount), 0) AS total
           FROM purchase_orders
           WHERE vendor_id = $1
             AND status NOT IN ('draft', 'cancelled')
             AND created_at::date BETWEEN $2 AND $3`,
          [contract.vendor_id, p.start.toISOString().split('T')[0], p.end.toISOString().split('T')[0]]
        );

        const purchases = Number(purchasesRes.rows[0].total);
        const accrued = purchases * (rate / 100.0);

        // C. Determine status
        let newStatus: 'pending' | 'accrued' | 'expired' = 'pending';
        if (purchases >= threshold) {
          newStatus = 'accrued';
        } else {
          // If the period has already ended in the past, and threshold wasn't met, mark as expired
          if (p.end < today) {
            newStatus = 'expired';
          } else {
            newStatus = 'pending';
          }
        }

        // D. Upsert accrual
        await client.query(
          `INSERT INTO vendor_rebate_accruals (vendor_id, contract_id, period_label, eligible_purchases, accrued_rebate, status)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (vendor_id, contract_id, period_label)
           DO UPDATE SET
             eligible_purchases = EXCLUDED.eligible_purchases,
             accrued_rebate = EXCLUDED.accrued_rebate,
             status = EXCLUDED.status`,
          [contract.vendor_id, contract.id, p.label, purchases, accrued, newStatus]
        );

        processedCount++;
      }
    }

    await client.query('COMMIT');
    return { processedCount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

import pool from '@/lib/db/client';

export async function runCreditAgingSweep(): Promise<{ updated: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find customers with overdue unpaid invoices not yet on hold
    const delinquentRes = await client.query<{ customer_id: string }>(
      `SELECT DISTINCT customer_id
       FROM sales_invoices
       WHERE paid_at IS NULL
         AND due_date < CURRENT_DATE
         AND status = 'issued'`
    );
    const delinquentIds = delinquentRes.rows.map((r) => r.customer_id);

    let updated = 0;
    for (const customerId of delinquentIds) {
      const upd = await client.query(
        `UPDATE customers SET on_hold = TRUE
         WHERE id = $1 AND on_hold = FALSE
         RETURNING id`,
        [customerId]
      );
      if (upd.rowCount && upd.rowCount > 0) {
        updated++;
        await client.query(
          `INSERT INTO customer_credit_holds (customer_id, reason)
           VALUES ($1, 'aging_sweep')`,
          [customerId]
        );
      }
    }

    // Clear holds for customers whose invoices are now all paid
    await client.query(
      `UPDATE customers SET on_hold = FALSE
       WHERE on_hold = TRUE
         AND id NOT IN (
           SELECT DISTINCT customer_id FROM sales_invoices
           WHERE paid_at IS NULL
             AND due_date < CURRENT_DATE
             AND status = 'issued'
         )`
    );
    await client.query(
      `UPDATE customer_credit_holds
       SET released_at = NOW(), released_reason = 'auto_payment_cleared'
       WHERE released_at IS NULL
         AND customer_id NOT IN (
           SELECT DISTINCT customer_id FROM sales_invoices
           WHERE paid_at IS NULL
             AND due_date < CURRENT_DATE
             AND status = 'issued'
         )`
    );

    await client.query('COMMIT');
    return { updated };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

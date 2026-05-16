import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const rows = await query(
    `SELECT v.id AS vendor_id, v.code AS vendor_code,
            v.name_th AS vendor_name_th, v.name_en AS vendor_name_en,
            SUM(pi.amount - pi.paid_amount) AS total_outstanding,
            SUM(CASE WHEN pi.due_date >= CURRENT_DATE THEN (pi.amount - pi.paid_amount) ELSE 0 END) AS current_amount,
            SUM(CASE WHEN (CURRENT_DATE - pi.due_date) BETWEEN 1 AND 30 THEN (pi.amount - pi.paid_amount) ELSE 0 END) AS days_1_30,
            SUM(CASE WHEN (CURRENT_DATE - pi.due_date) BETWEEN 31 AND 60 THEN (pi.amount - pi.paid_amount) ELSE 0 END) AS days_31_60,
            SUM(CASE WHEN (CURRENT_DATE - pi.due_date) BETWEEN 61 AND 90 THEN (pi.amount - pi.paid_amount) ELSE 0 END) AS days_61_90,
            SUM(CASE WHEN (CURRENT_DATE - pi.due_date) > 90 THEN (pi.amount - pi.paid_amount) ELSE 0 END) AS days_over_90,
            COUNT(pi.id) AS invoice_count,
            MIN(pi.due_date) AS oldest_due_date
     FROM vendors v
     JOIN po_invoices pi ON pi.vendor_id = v.id
     WHERE pi.is_paid = FALSE
     GROUP BY v.id, v.code, v.name_th, v.name_en
     ORDER BY total_outstanding DESC`
  );

  return apiSuccess(rows);
}

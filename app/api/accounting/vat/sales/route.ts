import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import type { SessionUser } from '@/lib/authz';
import { query } from '@/lib/db/client';

interface VATLine {
  invoice_number?: string;
  doc_number?: string;
  tax_point_date: string | Date;
  vendor_name?: string;
  customer_name?: string;
  vendor_tax_id?: string;
  customer_tax_id?: string;
  base_amount: number | string;
  vat_amount: number | string;
  channel?: string;
}

interface FinalizedRun {
  snapshot: VATLine[];
  total_base: string;
  total_vat: string;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin', 'manager', 'auditor']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const yearStr = searchParams.get('year');
  const monthStr = searchParams.get('month');

  if (!yearStr || !monthStr) {
    return apiError('Missing required parameters: year, month', 400);
  }

  const year = parseInt(yearStr);
  const month = parseInt(monthStr);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return apiError('Invalid year or month parameter', 400);
  }

  try {
    // 1. Check if already finalized
    const finalizedRes = await query<FinalizedRun>(
      `SELECT snapshot, total_base, total_vat FROM vat_report_runs 
       WHERE period_year = $1 AND period_month = $2 AND report_type = 'sales' 
       LIMIT 1`,
      [year, month]
    );

    if (finalizedRes.length > 0) {
      return apiSuccess({
        data: finalizedRes[0].snapshot,
        total_base: parseFloat(finalizedRes[0].total_base),
        total_vat: parseFloat(finalizedRes[0].total_vat),
        is_finalized: true,
        period: { year, month }
      });
    }

    // 2. Query dynamically if not finalized
    const rows = await query<VATLine>(
      `SELECT 
        pt.receipt_number AS doc_number,
        pt.created_at AS tax_point_date,
        'General Customer' AS customer_name,
        NULL AS customer_tax_id,
        'POS' AS channel,
        (pt.total - pt.vat_amount) AS base_amount,
        pt.vat_amount
      FROM pos_transactions pt
      WHERE pt.status = 'completed'
        AND EXTRACT(YEAR FROM pt.created_at) = $1
        AND EXTRACT(MONTH FROM pt.created_at) = $2

      UNION ALL

      SELECT 
        si.si_number AS doc_number,
        si.invoice_date::TIMESTAMPTZ AS tax_point_date,
        c.name_th AS customer_name,
        c.tax_id AS customer_tax_id,
        'SO' AS channel,
        si.subtotal AS base_amount,
        si.vat_amount
      FROM sales_invoices si
      JOIN customers c ON c.id = si.customer_id
      WHERE si.status IN ('issued', 'paid')
        AND EXTRACT(YEAR FROM si.invoice_date) = $1
        AND EXTRACT(MONTH FROM si.invoice_date) = $2

      ORDER BY tax_point_date ASC`,
      [year, month]
    );

    const total_base = rows.reduce((sum, r) => sum + Number(r.base_amount), 0);
    const total_vat = rows.reduce((sum, r) => sum + Number(r.vat_amount), 0);

    return apiSuccess({
      data: rows,
      total_base: Math.round(total_base * 100) / 100,
      total_vat: Math.round(total_vat * 100) / 100,
      is_finalized: false,
      period: { year, month }
    });
  } catch (err) {
    console.error('Failed to query sales VAT report:', err);
    return apiError('Failed to query sales VAT report', 500);
  }
}

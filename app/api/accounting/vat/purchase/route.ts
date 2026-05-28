import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import type { SessionUser } from '@/lib/authz';
import { query } from '@/lib/db/client';
import { VAT_RATE } from '@/lib/constants';

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
       WHERE period_year = $1 AND period_month = $2 AND report_type = 'purchase' 
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
        pi.invoice_number,
        grn.stocked_at AS tax_point_date,
        v.name_th AS vendor_name,
        v.tax_id AS vendor_tax_id,
        pi.amount AS base_amount,
        ROUND(pi.amount * $3, 2) AS vat_amount
      FROM po_invoices pi
      JOIN goods_receipt_notes grn ON grn.id = pi.grn_id
      JOIN vendors v ON v.id = pi.vendor_id
      WHERE
        EXTRACT(YEAR FROM grn.stocked_at) = $1
        AND EXTRACT(MONTH FROM grn.stocked_at) = $2
      ORDER BY grn.stocked_at ASC`,
      [year, month, VAT_RATE]
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
    console.error('Failed to query purchase VAT report:', err);
    return apiError('Failed to query purchase VAT report', 500);
  }
}

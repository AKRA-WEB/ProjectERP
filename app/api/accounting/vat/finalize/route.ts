import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import type { SessionUser } from '@/lib/authz';
import pool, { query } from '@/lib/db/client';
import { z } from 'zod';
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

const postSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  type: z.enum(['purchase', 'sales']),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const { year, month, type } = parsed.data;

  // 1. Check if already exists
  const existing = await query(
    `SELECT id FROM vat_report_runs 
     WHERE period_year = $1 AND period_month = $2 AND report_type = $3 
     LIMIT 1`,
    [year, month, type]
  );

  if (existing.length > 0) {
    return apiError('VAT report period already finalized', 409);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let rows: VATLine[] = [];
    if (type === 'purchase') {
      const res = await client.query<VATLine>(
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
      rows = res.rows;
    } else {
      const res = await client.query<VATLine>(
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
      rows = res.rows;
    }

    const total_base = rows.reduce((sum, r) => sum + Number(r.base_amount), 0);
    const total_vat = rows.reduce((sum, r) => sum + Number(r.vat_amount), 0);

    const rounded_base = Math.round(total_base * 100) / 100;
    const rounded_vat = Math.round(total_vat * 100) / 100;

    const insertResult = await client.query<{ id: string; generated_at: string }>(
      `INSERT INTO vat_report_runs 
       (period_year, period_month, report_type, generated_by, total_base, total_vat, snapshot)
       VALUES ($1, $2, $3::vat_report_type, $4, $5, $6, $7::jsonb)
       RETURNING id, generated_at`,
      [year, month, type, u.id, rounded_base, rounded_vat, JSON.stringify(rows)]
    );

    await client.query('COMMIT');

    return apiSuccess({
      run_id: insertResult.rows[0].id,
      period_year: year,
      period_month: month,
      report_type: type,
      total_base: rounded_base,
      total_vat: rounded_vat,
      generated_at: insertResult.rows[0].generated_at,
    }, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to finalize VAT period:', err);
    return apiError('Failed to finalize VAT period', 500);
  } finally {
    client.release();
  }
}

import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query, queryOne } from '@/lib/db/client';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;
  const payment = await queryOne(
    `SELECT p.*, v.name_th AS vendor_name_th, v.name_en AS vendor_name_en, v.code AS vendor_code,
            u.name_en AS paid_by_name
     FROM ap_payments p
     JOIN vendors v ON v.id = p.vendor_id
     JOIN users u ON u.id = p.paid_by
     WHERE p.id = $1`,
    [id]
  );
  if (!payment) return apiError('Payment not found', 404);

  const allocations = await query(
    `SELECT pa.*, i.invoice_number, i.invoice_date, i.amount AS invoice_total
     FROM ap_payment_allocations pa
     JOIN po_invoices i ON i.id = pa.invoice_id
     WHERE pa.payment_id = $1`,
    [id]
  );

  return apiSuccess({ ...payment, allocations });
}

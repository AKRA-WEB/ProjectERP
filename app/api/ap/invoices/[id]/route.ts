import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const patchSchema = z.object({
  invoice_number: z.string().max(255).optional(),
  notes: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;
  const invoice = await queryOne(
    `SELECT pi.*,
            (pi.amount - pi.paid_amount) AS outstanding_amount,
            CASE WHEN pi.is_paid = FALSE AND pi.due_date < CURRENT_DATE
                 THEN (CURRENT_DATE - pi.due_date)
                 ELSE 0 END AS overdue_days,
            v.name_th AS vendor_name_th, v.name_en AS vendor_name_en, v.code AS vendor_code,
            po.po_number, grn.grn_number
     FROM po_invoices pi
     JOIN vendors v ON v.id = pi.vendor_id
     LEFT JOIN purchase_orders po ON po.id = pi.po_id
     LEFT JOIN goods_receipt_notes grn ON grn.id = pi.grn_id
     WHERE pi.id = $1`,
    [id]
  );
  if (!invoice) return apiError('Invoice not found', 404);

  const allocations = await query(
    `SELECT pa.*, p.payment_number, p.payment_date, p.bank_ref
     FROM ap_payment_allocations pa
     JOIN ap_payments p ON p.id = pa.payment_id
     WHERE pa.invoice_id = $1
     ORDER BY p.payment_date DESC`,
    [id]
  );

  return apiSuccess({ ...invoice, allocations });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const updates: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (parsed.data.invoice_number !== undefined) { updates.push(`invoice_number = $${idx++}`); vals.push(parsed.data.invoice_number); }
  if (parsed.data.notes !== undefined) { updates.push(`notes = $${idx++}`); vals.push(parsed.data.notes); }

  if (updates.length === 0) return apiError('No fields to update', 400);
  vals.push(id);

  const updated = await queryOne(
    `UPDATE po_invoices SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
    vals
  );
  if (!updated) return apiError('Invoice not found', 404);

  return apiSuccess(updated);
}

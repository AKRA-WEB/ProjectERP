import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import pool, { query } from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const allocationSchema = z.object({
  invoice_id: z.string().uuid(),
  allocated_amount: z.number().positive(),
});

const postSchema = z.object({
  vendor_id: z.string().uuid(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bank_ref: z.string().optional(),
  notes: z.string().optional(),
  allocations: z.array(allocationSchema).min(1),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const vendorId = searchParams.get('vendor_id');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (vendorId) {
    conditions.push(`p.vendor_id = $${idx++}`);
    params.push(vendorId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [totalResult] = await query<{ count: string }>(`SELECT COUNT(*) FROM ap_payments p ${where}`, params);
  const total = parseInt(totalResult.count);

  const rows = await query(
    `SELECT p.*, v.name_th AS vendor_name_th, u.name_en AS paid_by_name
     FROM ap_payments p
     JOIN vendors v ON v.id = p.vendor_id
     JOIN users u ON u.id = p.paid_by
     ${where}
     ORDER BY p.payment_date DESC, p.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({
    payments: rows,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit)
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const { vendor_id, payment_date, bank_ref, notes, allocations } = parsed.data;
  const total_amount = allocations.reduce((sum, a) => sum + a.allocated_amount, 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validate allocations against invoices
    for (const alloc of allocations) {
      const invoice = await client.query<{ vendor_id: string; amount: number; paid_amount: number; is_paid: boolean }>(
        'SELECT vendor_id, amount, paid_amount, is_paid FROM po_invoices WHERE id = $1 FOR UPDATE',
        [alloc.invoice_id]
      );
      if (invoice.rows.length === 0) {
        await client.query('ROLLBACK');
        return apiError(`Invoice ${alloc.invoice_id} not found`, 404);
      }
      const inv = invoice.rows[0];
      if (inv.vendor_id !== vendor_id) {
        await client.query('ROLLBACK');
        return apiError(`Invoice ${alloc.invoice_id} does not belong to the selected vendor`, 400);
      }
      const outstanding = Number(inv.amount) - Number(inv.paid_amount);
      if (alloc.allocated_amount > outstanding + 0.01) { // small tolerance for floating point
        await client.query('ROLLBACK');
        return apiError(`Allocated amount ${alloc.allocated_amount} exceeds outstanding ${outstanding} for invoice ${alloc.invoice_id}`, 400);
      }
    }

    // 2. INSERT ap_payments
    const pmtResult = await client.query<{ id: string; payment_number: string }>(
      `INSERT INTO ap_payments (vendor_id, payment_date, total_amount, bank_ref, notes, paid_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, payment_number`,
      [vendor_id, payment_date, total_amount, bank_ref ?? null, notes ?? null, u.id]
    );
    const paymentId = pmtResult.rows[0].id;

    // 3. Process allocations
    for (const alloc of allocations) {
      await client.query(
        'INSERT INTO ap_payment_allocations (payment_id, invoice_id, allocated_amount) VALUES ($1, $2, $3)',
        [paymentId, alloc.invoice_id, alloc.allocated_amount]
      );
      await client.query(
        'UPDATE po_invoices SET paid_amount = paid_amount + $1 WHERE id = $2',
        [alloc.allocated_amount, alloc.invoice_id]
      );
    }

    await client.query('COMMIT');
    return apiSuccess(pmtResult.rows[0], 201);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('AP payment error:', err);
    return apiError('Failed to record AP payment', 500);
  } finally {
    client.release();
  }
}

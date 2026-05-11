import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import { queryOne, query } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'customers:view'); } catch { return apiError('Forbidden', 403); }
  const { id } = await params;

  const customer = await queryOne('SELECT * FROM customers WHERE id = $1', [id]);
  if (!customer) return apiError('Customer not found', 404);

  const recent_sales_orders = await query(
    `SELECT id, so_number, status, total_amount, created_at
     FROM sales_orders
     WHERE customer_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [id]
  );

  return apiSuccess({ ...customer, recent_sales_orders });
}

const updateSchema = z.object({
  name_th: z.string().min(1).max(500).optional(),
  name_en: z.string().max(500).nullable().optional(),
  contact_name: z.string().max(255).nullable().optional(),
  email: z.string().email().nullable().or(z.literal('')).optional(),
  phone: z.string().max(50).nullable().optional(),
  address_th: z.string().nullable().optional(),
  tax_id: z.string().max(50).nullable().optional(),
  payment_terms_days: z.number().int().min(0).optional(),
  credit_limit: z.number().min(0).optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'customers:edit'); } catch { return apiError('Forbidden', 403); }
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const updates: string[] = [];
  const queryParams: unknown[] = [id];
  let idx = 2;

  const data = parsed.data;
  if (data.name_th !== undefined) { updates.push(`name_th = $${idx++}`); queryParams.push(data.name_th); }
  if (data.name_en !== undefined) { updates.push(`name_en = $${idx++}`); queryParams.push(data.name_en); }
  if (data.contact_name !== undefined) { updates.push(`contact_name = $${idx++}`); queryParams.push(data.contact_name); }
  if (data.email !== undefined) { updates.push(`email = $${idx++}`); queryParams.push(data.email || null); }
  if (data.phone !== undefined) { updates.push(`phone = $${idx++}`); queryParams.push(data.phone); }
  if (data.address_th !== undefined) { updates.push(`address_th = $${idx++}`); queryParams.push(data.address_th); }
  if (data.tax_id !== undefined) { updates.push(`tax_id = $${idx++}`); queryParams.push(data.tax_id); }
  if (data.payment_terms_days !== undefined) { updates.push(`payment_terms_days = $${idx++}`); queryParams.push(data.payment_terms_days); }
  if (data.credit_limit !== undefined) { updates.push(`credit_limit = $${idx++}`); queryParams.push(data.credit_limit); }
  if (data.is_active !== undefined) { updates.push(`is_active = $${idx++}`); queryParams.push(data.is_active); }

  if (updates.length === 0) return apiError('No fields to update', 400);

  const customer = await queryOne(
    `UPDATE customers SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    queryParams
  );

  if (!customer) return apiError('Customer not found', 404);

  return apiSuccess(customer);
}

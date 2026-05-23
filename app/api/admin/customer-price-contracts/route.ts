import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import type { SessionUser } from '@/types';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import pool from '@/lib/db/client';
import { z } from 'zod';

const contractSchema = z.object({
  customer_id: z.string().uuid(),
  product_id: z.string().uuid().nullable().optional().or(z.literal('')).transform(val => val || null),
  locked_price: z.coerce.number().min(0).nullable().optional().or(z.literal('')).transform(val => typeof val === 'number' ? val : null),
  discount_pct: z.coerce.number().min(0).max(100).nullable().optional().or(z.literal('')).transform(val => typeof val === 'number' ? val : null),
  valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).nullable().optional().transform(val => val || null),
}).refine(data => {
  const hasLocked = data.locked_price !== null;
  const hasDiscount = data.discount_pct !== null;
  return (hasLocked || hasDiscount) && !(hasLocked && hasDiscount);
}, {
  message: "Provide either locked_price or discount_pct, but not both",
  path: ["locked_price"],
}).refine(data => !data.valid_to || data.valid_to >= data.valid_from, {
  message: "valid_to must be greater than or equal to valid_from",
  path: ["valid_to"],
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin', 'manager', 'auditor']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get('customer_id');
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (customerId) {
    conditions.push(`cpc.customer_id = $${idx++}`);
    params.push(customerId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const totalResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM customer_price_contracts cpc ${where}`,
      params
    );
    const total = parseInt(totalResult.rows[0]?.count ?? '0');

    const contractsResult = await pool.query(
      `SELECT cpc.*, 
              c.code AS customer_code, c.name_th AS customer_name_th, c.name_en AS customer_name_en,
              p.sku AS product_sku, p.name_th AS product_name_th, p.name_en AS product_name_en
       FROM customer_price_contracts cpc
       JOIN customers c ON cpc.customer_id = c.id
       LEFT JOIN products p ON cpc.product_id = p.id
       ${where}
       ORDER BY cpc.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    return apiSuccess({
      data: contractsResult.rows,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    });
  } catch (err) {
    const error = err as Error;
    return apiError(error.message || 'Database error', 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin', 'manager']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  const parsed = contractSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const { customer_id, product_id, locked_price, discount_pct, valid_from, valid_to } = parsed.data;

  try {
    const result = await pool.query(
      `INSERT INTO customer_price_contracts (customer_id, product_id, locked_price, discount_pct, valid_from, valid_to)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [customer_id, product_id, locked_price, discount_pct, valid_from, valid_to]
    );

    return apiSuccess({ contract: result.rows[0] }, 201);
  } catch (err) {
    const error = err as Error;
    return apiError(error.message || 'Database error during contract creation', 400);
  }
}

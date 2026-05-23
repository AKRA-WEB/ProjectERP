import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import type { SessionUser } from '@/types';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import pool from '@/lib/db/client';
import { z } from 'zod';

const priceRowSchema = z.object({
  product_id: z.string().uuid().optional(),
  sku: z.string().optional(),
  channel: z.enum(['TRD', 'AKRA']),
  tier: z.enum(['T0', 'T1', 'T2', 'T3']),
  price: z.coerce.number().min(0),
  valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).nullable().optional().transform(val => val || null),
}).refine(data => data.product_id || data.sku, {
  message: "Either product_id or sku must be provided",
  path: ["sku"]
}).refine(data => !data.valid_to || data.valid_to >= data.valid_from, {
  message: "valid_to must be greater than or equal to valid_from",
  path: ["valid_to"]
});

const bulkSchema = z.object({
  rows: z.array(priceRowSchema).min(1),
});

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

  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of parsed.data.rows) {
      let productId = row.product_id;

      // Resolve SKU if product_id is not given
      if (!productId && row.sku) {
        const prodResult = await client.query<{ id: string }>(
          'SELECT id FROM products WHERE sku = $1',
          [row.sku]
        );
        if (!prodResult.rows[0]) {
          throw new Error(`Product with SKU "${row.sku}" not found`);
        }
        productId = prodResult.rows[0].id;
      }

      if (!productId) {
        throw new Error('Product identification missing');
      }

      await client.query(
        `INSERT INTO product_prices (product_id, channel, tier, price, valid_from, valid_to)
         VALUES ($1, $2::price_channel, $3::price_tier, $4, $5, $6)
         ON CONFLICT (product_id, channel, tier, valid_from) 
         DO UPDATE SET price = EXCLUDED.price, valid_to = EXCLUDED.valid_to`,
        [productId, row.channel, row.tier, row.price, row.valid_from, row.valid_to]
      );
    }
    await client.query('COMMIT');
    return apiSuccess({ inserted: parsed.data.rows.length });
  } catch (err) {
    const error = err as Error;
    await client.query('ROLLBACK');
    return apiError(error.message || 'Database error during bulk insert', 400);
  } finally {
    client.release();
  }
}

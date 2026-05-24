import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import pool, { query } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/types';

const upsertSchema = z.object({
  product_id: z.string().uuid(),
  channel: z.enum(['TRD', 'AKRA']),
  allowed_uoms: z.array(z.string().min(1)),
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
  const productId = searchParams.get('product_id');
  const channel = searchParams.get('channel');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (productId) {
    conditions.push(`pcu.product_id = $${idx++}`);
    params.push(productId);
  }
  if (channel) {
    conditions.push(`pcu.channel = $${idx++}::price_channel`);
    params.push(channel);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await query(`
    SELECT 
      pcu.id,
      pcu.product_id,
      pcu.channel,
      pcu.allowed_uoms,
      pcu.created_at,
      pcu.updated_at,
      p.sku,
      p.name_th,
      p.name_en,
      uom.code AS base_uom_code
    FROM product_channel_uoms pcu
    JOIN products p ON p.id = pcu.product_id
    JOIN units_of_measure uom ON uom.id = p.uom_id
    ${where}
    ORDER BY p.sku ASC
  `, params);

  return apiSuccess(rows);
}

export async function PATCH(req: NextRequest) {
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

  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Validation error', 400, parsed.error.flatten());
  }

  const { product_id, channel, allowed_uoms } = parsed.data;
  const normalizedUoms = allowed_uoms.map((uom: string) => uom.trim().toLowerCase());

  const { rows: [row] } = await pool.query(`
    INSERT INTO product_channel_uoms (product_id, channel, allowed_uoms, updated_at)
    VALUES ($1, $2::price_channel, $3::TEXT[], NOW())
    ON CONFLICT (product_id, channel) 
    DO UPDATE SET 
      allowed_uoms = EXCLUDED.allowed_uoms,
      updated_at = NOW()
    RETURNING *
  `, [product_id, channel, normalizedUoms]);

  return apiSuccess({ row });
}

export async function POST(req: NextRequest) {
  return PATCH(req);
}

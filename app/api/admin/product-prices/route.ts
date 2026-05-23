import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import type { SessionUser } from '@/types';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import pool from '@/lib/db/client';

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
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? 20));
  const offset = (page - 1) * limit;

  const channel = searchParams.get('channel'); // TRD | AKRA
  const tier = searchParams.get('tier'); // T0 | T1 | T2 | T3
  const search = searchParams.get('search'); // search by product sku or name

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (channel) {
    conditions.push(`pp.channel = $${idx++}::price_channel`);
    params.push(channel);
  }

  if (tier) {
    conditions.push(`pp.tier = $${idx++}::price_tier`);
    params.push(tier);
  }

  if (search) {
    conditions.push(`(p.sku ILIKE $${idx} OR p.name_th ILIKE $${idx} OR p.name_en ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const totalResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM product_prices pp
       JOIN products p ON pp.product_id = p.id
       ${where}`,
      params
    );
    const total = parseInt(totalResult.rows[0]?.count ?? '0');

    const listResult = await pool.query(
      `SELECT pp.*, p.sku, p.name_th, p.name_en, p.unit_cost
       FROM product_prices pp
       JOIN products p ON pp.product_id = p.id
       ${where}
       ORDER BY pp.created_at DESC, p.sku ASC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    return apiSuccess({
      data: listResult.rows,
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

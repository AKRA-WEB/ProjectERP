import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import pool, { query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { CreateBomSchema } from '@/lib/validations/bom';
import { SessionUser } from '@/lib/authz';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('product_id');
  const bomType = searchParams.get('bom_type');
  const isActive = searchParams.get('is_active');
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('pageSize') ?? '20');
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (productId) {
    conditions.push(`bh.product_id = $${idx++}`);
    params.push(productId);
  }
  if (bomType) {
    conditions.push(`bh.bom_type = $${idx++}`);
    params.push(bomType);
  }
  if (isActive !== null) {
    conditions.push(`bh.is_active = $${idx++}`);
    params.push(isActive === 'true');
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query(`
    SELECT 
      bh.*,
      p.sku AS product_sku,
      p.name_th AS product_name_th,
      p.name_en AS product_name_en,
      uom.code AS uom_code,
      u.name_en AS created_by_name,
      (SELECT COUNT(*) FROM bom_lines bl WHERE bl.bom_id = bh.id) AS line_count
    FROM bom_headers bh
    JOIN products p ON p.id = bh.product_id
    JOIN units_of_measure uom ON uom.id = bh.uom_id
    LEFT JOIN users u ON u.id = bh.created_by
    ${where}
    ORDER BY bh.created_at DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `, [...params, limit, offset]);

  const [{ count }] = await query<{ count: string }>(`
    SELECT COUNT(*) FROM bom_headers bh ${where}
  `, params);

  return apiSuccess({
    data: rows,
    total: parseInt(count),
    page,
    limit
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const user = session.user as unknown as SessionUser;

  if (!['admin', 'manager'].includes(user.role)) {
    return apiError('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const result = CreateBomSchema.safeParse(body);
    if (!result.success) {
      return apiError(result.error.errors[0].message, 400);
    }
    const d = result.data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if version already exists for this product
      const { rows: existing } = await client.query(
        'SELECT id FROM bom_headers WHERE product_id = $1 AND version = $2',
        [d.product_id, d.version]
      );
      if (existing.length > 0) {
        throw new Error(`Version ${d.version} already exists for this product`);
      }

      // If this is active, deactivate others
      if (d.version === 1 || body.is_active === true) {
        // We'll set is_active based on input, default to true for v1
        const active = body.is_active !== undefined ? body.is_active : true;
        if (active) {
          await client.query(
            'UPDATE bom_headers SET is_active = FALSE WHERE product_id = $1',
            [d.product_id]
          );
        }
      }

      // Insert header
      const { rows: [header] } = await client.query(`
        INSERT INTO bom_headers (
          product_id, uom_id, output_qty, bom_type, version, is_active, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, bom_number
      `, [
        d.product_id, 
        d.uom_id, 
        d.output_qty, 
        d.bom_type, 
        d.version, 
        body.is_active !== undefined ? body.is_active : true,
        d.notes, 
        user.id
      ]);

      // Insert lines
      for (let i = 0; i < d.lines.length; i++) {
        const l = d.lines[i];
        await client.query(`
          INSERT INTO bom_lines (
            bom_id, line_number, component_id, uom_id, qty_required, scrap_pct, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          header.id,
          i + 1,
          l.component_id,
          l.uom_id,
          l.qty_required,
          l.scrap_pct,
          l.notes
        ]);
      }

      await client.query('COMMIT');
      return apiSuccess({ id: header.id, bom_number: header.bom_number }, 201);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create BOM';
    return apiError(msg, 500);
  }
}

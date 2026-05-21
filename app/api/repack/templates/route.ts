import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import pool, { query } from '@/lib/db/client';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { CreateRepackTemplateSchema } from '@/lib/validations/repack';
import { type SessionUser, assertRole } from '@/lib/authz';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const sourceProductId = searchParams.get('source_product_id');
  const isActive = searchParams.get('is_active');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (sourceProductId) {
    conditions.push(`source_product_id = $${idx++}`);
    params.push(sourceProductId);
  }
  if (isActive !== null) {
    conditions.push(`is_active = $${idx++}`);
    params.push(isActive === 'true');
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query(`
    SELECT 
      rt.*,
      p.sku AS source_product_sku,
      p.name_th AS source_product_name_th,
      (SELECT COUNT(*) FROM repack_template_items rti WHERE rti.template_id = rt.id) AS item_count
    FROM repack_templates rt
    JOIN products p ON p.id = rt.source_product_id
    ${where}
    ORDER BY rt.name_th ASC
  `, params);

  return apiSuccess(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const user = session.user as unknown as SessionUser;

  try { assertRole(user, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  try {
    const body = await req.json();
    const result = CreateRepackTemplateSchema.safeParse(body);
    if (!result.success) {
      return apiValidationError(result.error);
    }
    const d = result.data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [template] } = await client.query(`
        INSERT INTO repack_templates (
          name_th, name_en, source_product_id, source_qty, notes
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [d.name_th, d.name_en ?? d.name_th, d.source_product_id, d.source_qty, d.notes]);

      for (const item of d.items) {
        await client.query(`
          INSERT INTO repack_template_items (
            template_id, product_id, qty_ratio, notes
          ) VALUES ($1, $2, $3, $4)
        `, [template.id, item.product_id, item.qty_ratio, item.notes]);
      }

      await client.query('COMMIT');
      return apiSuccess({ id: template.id }, 201);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create repack template';
    return apiError(msg, 500);
  }
}

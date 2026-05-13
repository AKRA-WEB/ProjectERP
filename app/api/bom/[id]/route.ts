import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import pool, { queryOne, query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { PatchBomSchema } from '@/lib/validations/bom';
import { SessionUser } from '@/lib/authz';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const { id } = await params;

  const header = await queryOne(`
    SELECT 
      bh.*,
      p.sku AS product_sku,
      p.name_th AS product_name_th,
      p.name_en AS product_name_en,
      uom.code AS uom_code,
      u.name_en AS created_by_name
    FROM bom_headers bh
    JOIN products p ON p.id = bh.product_id
    JOIN units_of_measure uom ON uom.id = bh.uom_id
    LEFT JOIN users u ON u.id = bh.created_by
    WHERE bh.id = $1
  `, [id]);

  if (!header) return apiError('BOM not found', 404);

  const lines = await query(`
    SELECT 
      bl.*,
      p.sku AS component_sku,
      p.name_th AS component_name_th,
      p.name_en AS component_name_en,
      uom.code AS uom_code,
      uom.name_th AS uom_name_th,
      (bl.qty_required / (1 - bl.scrap_pct / 100))::NUMERIC(15,6) AS qty_effective
    FROM bom_lines bl
    JOIN products p ON p.id = bl.component_id
    JOIN units_of_measure uom ON uom.id = bl.uom_id
    WHERE bl.bom_id = $1
    ORDER BY bl.line_number ASC
  `, [id]);

  return apiSuccess({ ...header, lines });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const user = session.user as unknown as SessionUser;
  const { id } = await params;

  if (!['admin', 'manager'].includes(user.role)) {
    return apiError('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const result = PatchBomSchema.safeParse(body);
    if (!result.success) {
      return apiError(result.error.errors[0].message, 400);
    }
    const d = result.data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const bom = await queryOne('SELECT product_id, is_active FROM bom_headers WHERE id = $1', [id]);
      if (!bom) throw new Error('BOM not found');

      if (d.action === 'update_header') {
        const sets: string[] = [];
        const vals: unknown[] = [];
        let idx = 1;
        if (d.output_qty !== undefined) { sets.push(`output_qty = $${idx++}`); vals.push(d.output_qty); }
        if (d.notes !== undefined) { sets.push(`notes = $${idx++}`); vals.push(d.notes); }
        if (sets.length > 0) {
          vals.push(id);
          await client.query(`UPDATE bom_headers SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
        }
      } 
      else if (d.action === 'activate') {
        await client.query('UPDATE bom_headers SET is_active = FALSE WHERE product_id = $1', [bom.product_id]);
        await client.query('UPDATE bom_headers SET is_active = TRUE WHERE id = $1', [id]);
      } 
      else if (d.action === 'deactivate') {
        await client.query('UPDATE bom_headers SET is_active = FALSE WHERE id = $1', [id]);
      } 
      else if (d.action === 'add_line') {
        const { rows: [{ max_ln }] } = await client.query('SELECT COALESCE(MAX(line_number), 0) as max_ln FROM bom_lines WHERE bom_id = $1', [id]);
        await client.query(`
          INSERT INTO bom_lines (bom_id, line_number, component_id, uom_id, qty_required, scrap_pct, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [id, max_ln + 1, d.line.component_id, d.line.uom_id, d.line.qty_required, d.line.scrap_pct, d.line.notes]);
      } 
      else if (d.action === 'update_line') {
        const sets: string[] = [];
        const vals: unknown[] = [];
        let idx = 1;
        if (d.qty_required !== undefined) { sets.push(`qty_required = $${idx++}`); vals.push(d.qty_required); }
        if (d.scrap_pct !== undefined) { sets.push(`scrap_pct = $${idx++}`); vals.push(d.scrap_pct); }
        if (d.notes !== undefined) { sets.push(`notes = $${idx++}`); vals.push(d.notes); }
        if (sets.length > 0) {
          vals.push(d.line_id);
          await client.query(`UPDATE bom_lines SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
        }
      } 
      else if (d.action === 'remove_line') {
        await client.query('DELETE FROM bom_lines WHERE id = $1 AND bom_id = $2', [d.line_id, id]);
        // Renumber remaining lines
        await client.query(`
          WITH numbered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY line_number) as new_ln
            FROM bom_lines WHERE bom_id = $1
          )
          UPDATE bom_lines bl SET line_number = numbered.new_ln
          FROM numbered WHERE bl.id = numbered.id
        `, [id]);
      }

      await client.query('COMMIT');
      return apiSuccess({ ok: true });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update BOM';
    return apiError(msg, 500);
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const user = session.user as unknown as SessionUser;
  const { id } = await params;

  if (user.role !== 'admin') return apiError('Forbidden', 403);

  // TODO: Block if referenced in manufacturing orders
  await query('DELETE FROM bom_headers WHERE id = $1', [id]);
  return apiSuccess({ ok: true });
}

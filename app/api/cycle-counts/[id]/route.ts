import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const countSchema = z.object({
  lines: z.array(z.object({
    id:                  z.string().uuid(),
    qty_counted:         z.number().nonnegative().optional(),
    counting_uom_id:     z.string().uuid().optional(),
    counting_qty_input:  z.number().nonnegative().optional(),
    notes:               z.string().optional(),
  })).min(1),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;
  const cc = await queryOne(
    `SELECT cc.*, w.code AS warehouse_code, w.name_th AS warehouse_name,
            u.name_en AS initiated_by_name, u2.name_en AS approved_by_name
     FROM cycle_counts cc
     JOIN warehouses w ON w.id = cc.warehouse_id
     JOIN users u ON u.id = cc.initiated_by
     LEFT JOIN users u2 ON u2.id = cc.approved_by
     WHERE cc.id = $1`,
    [id]
  );
  if (!cc) return apiError('Cycle count not found', 404);

  const lines = await query(
    `SELECT ccl.*,
            p.sku, p.name_th, p.name_en,
            u.code AS uom_code,
            u.id   AS base_uom_id
     FROM cycle_count_lines ccl
     JOIN products p ON p.id = ccl.product_id
     JOIN units_of_measure u ON u.id = p.uom_id
     WHERE ccl.cycle_count_id = $1
     ORDER BY ccl.line_number`,
    [id]
  );

  return apiSuccess({ ...cc, lines });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { id } = await params;
  const cc = await queryOne<{ status: string }>('SELECT status FROM cycle_counts WHERE id = $1', [id]);
  if (!cc) return apiError('Cycle count not found', 404);

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  if (body.action === 'submit_counts') {
    if (!['open', 'counting'].includes(cc.status)) return apiError('Cannot submit counts at current status', 409);
    const parsed = countSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    for (const line of parsed.data.lines) {
      // If counting_uom_id + counting_qty_input provided, DB trigger auto-fills qty_counted
      // Otherwise use qty_counted directly
      await queryOne(
        `UPDATE cycle_count_lines
         SET qty_counted         = COALESCE($1, qty_counted),
             counting_uom_id     = $2,
             counting_qty_input  = $3,
             notes               = $4,
             counted_by          = $5,
             counted_at          = NOW()
         WHERE id = $6 AND cycle_count_id = $7`,
        [
          line.qty_counted ?? null,
          line.counting_uom_id ?? null,
          line.counting_qty_input ?? null,
          line.notes ?? null,
          u.id,
          line.id,
          id,
        ]
      );
    }
    await queryOne(`UPDATE cycle_counts SET status = 'counting' WHERE id = $1`, [id]);
    return apiSuccess({ id, status: 'counting' });
  }

  if (body.action === 'submit_for_approval') {
    if (cc.status !== 'counting') return apiError('Must be in counting status', 409);
    await queryOne(`UPDATE cycle_counts SET status = 'pending_approval' WHERE id = $1`, [id]);
    return apiSuccess({ id, status: 'pending_approval' });
  }

  if (body.action === 'approve') {
    try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
    if (cc.status !== 'pending_approval') return apiError('Must be pending_approval to approve', 409);
    await queryOne('SELECT apply_cycle_count($1, $2)', [id, u.id]);
    return apiSuccess({ id, status: 'approved' });
  }

  if (body.action === 'reject') {
    try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
    if (cc.status !== 'pending_approval') return apiError('Must be pending_approval to reject', 409);
    const reason = body.reason ?? '';
    await queryOne(
      `UPDATE cycle_counts SET status = 'open', rejection_reason = $1 WHERE id = $2`,
      [reason, id]
    );
    return apiSuccess({ id, status: 'open' });
  }

  return apiError('Unknown action', 400);
}

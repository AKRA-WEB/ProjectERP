import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const updateSchema = z.object({
  notes: z.string().optional(),
  lines: z.array(z.object({
    product_id: z.string().uuid(),
    qty_requested: z.number().positive(),
    unit_cost: z.number().nonnegative().default(0),
    notes: z.string().optional(),
  })).min(1).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;
  const pr = await queryOne(
    `SELECT pr.*, w.code AS warehouse_code, w.name_th AS warehouse_name,
            u1.name_en AS requested_by_name,
            u2.name_en AS manager_approved_by_name,
            u3.name_en AS admin_approved_by_name,
            u4.name_en AS rejected_by_name
     FROM purchase_requisitions pr
     JOIN warehouses w ON w.id = pr.warehouse_id
     JOIN users u1 ON u1.id = pr.requested_by
     LEFT JOIN users u2 ON u2.id = pr.manager_approved_by
     LEFT JOIN users u3 ON u3.id = pr.admin_approved_by
     LEFT JOIN users u4 ON u4.id = pr.rejected_by
     WHERE pr.id = $1`,
    [id]
  );
  if (!pr) return apiError('PR not found', 404);

  const lines = await query(
    `SELECT li.*, p.sku, p.name_th, p.name_en, u.code AS uom_code
     FROM pr_line_items li
     JOIN products p ON p.id = li.product_id
     JOIN units_of_measure u ON u.id = p.uom_id
     WHERE li.pr_id = $1
     ORDER BY li.line_number`,
    [id]
  );

  return apiSuccess({ ...pr, lines });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { id } = await params;
  const pr = await queryOne<{ status: string; requested_by: string }>(
    'SELECT status, requested_by FROM purchase_requisitions WHERE id = $1',
    [id]
  );
  if (!pr) return apiError('PR not found', 404);
  if (pr.status !== 'draft') return apiError('Can only edit draft PRs', 409);
  if (u.role === 'staff' && pr.requested_by !== u.id) return apiError('Forbidden', 403);

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  if (parsed.data.notes !== undefined) {
    await queryOne('UPDATE purchase_requisitions SET notes = $1 WHERE id = $2', [parsed.data.notes, id]);
  }

  if (parsed.data.lines) {
    await query('DELETE FROM pr_line_items WHERE pr_id = $1', [id]);
    const lineValues = parsed.data.lines
      .map((_, i) => `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5}, ${i + 1})`)
      .join(', ');
    const lineParams: unknown[] = [id];
    for (const l of parsed.data.lines) {
      lineParams.push(l.product_id, l.qty_requested, l.unit_cost, l.notes ?? null);
    }
    await query(
      `INSERT INTO pr_line_items (pr_id, product_id, qty_requested, unit_cost, notes, line_number) VALUES ${lineValues}`,
      lineParams
    );
  }

  return apiSuccess({ id, updated: true });
}

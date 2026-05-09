import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const resolveSchema = z.object({
  resolution_notes: z.string().min(1),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;
  const rma = await queryOne(
    `SELECT r.*, v.code AS vendor_code, v.name_th AS vendor_name,
            w.code AS warehouse_code, w.name_th AS warehouse_name,
            u.name_en AS initiated_by_name
     FROM rma_requests r
     JOIN vendors v ON v.id = r.vendor_id
     JOIN warehouses w ON w.id = r.warehouse_id
     JOIN users u ON u.id = r.initiated_by
     WHERE r.id = $1`,
    [id]
  );
  if (!rma) return apiError('RMA not found', 404);

  const lines = await query(
    `SELECT li.*, p.sku, p.name_th, p.name_en, u.code AS uom_code
     FROM rma_line_items li
     JOIN products p ON p.id = li.product_id
     JOIN units_of_measure u ON u.id = p.uom_id
     WHERE li.rma_id = $1
     ORDER BY li.line_number`,
    [id]
  );

  return apiSuccess({ ...rma, lines });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { id } = await params;
  const rma = await queryOne<{ status: string }>('SELECT status FROM rma_requests WHERE id = $1', [id]);
  if (!rma) return apiError('RMA not found', 404);

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  if (body.action === 'resolve') {
    const parsed = resolveSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);
    if (!['open', 'in_review'].includes(rma.status)) return apiError('RMA cannot be resolved at current status', 409);

    await queryOne(
      `UPDATE rma_requests SET status = 'resolved', resolved_by = $1, resolved_at = NOW(), resolution_notes = $2 WHERE id = $3`,
      [u.id, parsed.data.resolution_notes, id]
    );
    return apiSuccess({ id, status: 'resolved' });
  }

  if (body.action === 'close') {
    if (rma.status !== 'resolved') return apiError('Only resolved RMAs can be closed', 409);
    await queryOne(`UPDATE rma_requests SET status = 'closed' WHERE id = $1`, [id]);
    return apiSuccess({ id, status: 'closed' });
  }

  if (body.action === 'review') {
    if (rma.status !== 'open') return apiError('RMA must be open to start review', 409);
    await queryOne(`UPDATE rma_requests SET status = 'in_review' WHERE id = $1`, [id]);
    return apiSuccess({ id, status: 'in_review' });
  }

  return apiError('Unknown action', 400);
}

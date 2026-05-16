import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;

  const shipment = await queryOne(
    `SELECT s.*,
           pl.pick_number,
           w.name_th AS warehouse_name,
           shipper.name_th AS shipped_by_name
    FROM shipments s
    JOIN pick_lists pl ON pl.id = s.pick_list_id
    JOIN warehouses w ON w.id = s.warehouse_id
    LEFT JOIN users shipper ON shipper.id = s.shipped_by
    WHERE s.id = $1`,
    [id]
  );

  if (!shipment) return apiError('Shipment not found', 404);

  const lines = await query(
    `SELECT pll.*,
           p.name_th AS product_name, p.sku AS product_sku
    FROM pick_list_lines pll
    JOIN products p ON p.id = pll.product_id
    WHERE pll.pick_list_id = $1 AND pll.qty_picked > 0
    ORDER BY pll.created_at`,
    [(shipment as { pick_list_id: string }).pick_list_id]
  );

  return apiSuccess({ ...shipment, lines });
}

const patchSchema = z.object({
  action: z.literal('deliver'),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const shipment = await queryOne<{ status: string }>(
    'SELECT status FROM shipments WHERE id = $1',
    [id]
  );
  if (!shipment) return apiError('Shipment not found', 404);
  if (shipment.status !== 'shipped') return apiError('Only shipped shipments can be marked as delivered', 422);

  await query(
    "UPDATE shipments SET status = 'delivered', updated_at = NOW() WHERE id = $1 AND status = 'shipped'",
    [id]
  );

  return apiSuccess({ status: 'delivered' });
}

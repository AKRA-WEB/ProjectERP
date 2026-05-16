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

  const pickList = await queryOne<{ warehouse_id: string }>(
    'SELECT warehouse_id FROM pick_lists WHERE id = $1',
    [id]
  );
  if (!pickList) return apiError('Pick List not found', 404);

  const lines = await query(
    `SELECT pll.*,
           p.name_th AS product_name, p.sku AS product_sku,
           COALESCE(sb.qty_on_hand, 0) AS qty_on_hand,
           COALESCE(sb.qty_available, 0) AS qty_available
    FROM pick_list_lines pll
    JOIN products p ON p.id = pll.product_id
    LEFT JOIN stock_balances sb ON sb.product_id = pll.product_id
      AND sb.warehouse_id = $2
    WHERE pll.pick_list_id = $1
    ORDER BY pll.created_at`,
    [id, pickList.warehouse_id]
  );

  return apiSuccess(lines);
}

const lineSchema = z.object({
  product_id: z.string().uuid(),
  qty_requested: z.number().positive(),
  storage_location: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  const parsed = lineSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const pickList = await queryOne<{ status: string }>(
    'SELECT status FROM pick_lists WHERE id = $1',
    [id]
  );
  if (!pickList) return apiError('Pick List not found', 404);
  if (pickList.status !== 'draft') return apiError('Lines can only be added to draft pick lists', 422);

  const newLine = await queryOne(
    `INSERT INTO pick_list_lines (pick_list_id, product_id, qty_requested, storage_location)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [
      id,
      parsed.data.product_id,
      parsed.data.qty_requested,
      parsed.data.storage_location ?? null
    ]
  );

  return apiSuccess(newLine, 201);
}

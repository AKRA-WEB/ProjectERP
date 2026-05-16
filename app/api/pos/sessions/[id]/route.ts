import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission, assertWarehouseAccess } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'pos:view'); } catch { return apiError('Forbidden', 403); }
  const { id } = await params;

  const sessionData = await queryOne(
    `SELECT s.*, 
            w.name_th AS warehouse_name_th, w.name_en AS warehouse_name_en,
            u_open.name_en AS opened_by_name,
            u_close.name_en AS closed_by_name
     FROM pos_sessions s
     JOIN warehouses w ON w.id = s.warehouse_id
     JOIN users u_open ON u_open.id = s.opened_by
     LEFT JOIN users u_close ON u_close.id = s.closed_by
     WHERE s.id = $1`,
    [id]
  );

  if (!sessionData) return apiError('Session not found', 404);

  const transactions = await query(
    `SELECT t.*, u.name_en AS cashier_name
     FROM pos_transactions t
     JOIN users u ON u.id = t.created_by
     WHERE t.session_id = $1
     ORDER BY t.created_at DESC
     LIMIT $2`,
    [id, DEFAULT_PAGE_SIZE]
  );

  return apiSuccess({ ...sessionData, transactions });
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('close_session'),
    closing_float: z.number().min(0).max(9999999),
  }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const current = await queryOne<{ status: string; warehouse_id: string; opened_by: string }>(
    'SELECT status, warehouse_id, opened_by FROM pos_sessions WHERE id = $1',
    [id]
  );
  if (!current) return apiError('Session not found', 404);

  if (parsed.data.action === 'close_session') {
    try { assertPermission(u, 'pos:session_close'); } catch { return apiError('Forbidden', 403); }
    try { assertWarehouseAccess(u, current.warehouse_id); } catch { return apiError('No access to this warehouse', 403); }
    if (current.status !== 'open') return apiError('Session is already closed', 409);

    const updated = await queryOne(
      `UPDATE pos_sessions 
       SET status = 'closed', 
           closing_float = $1, 
           closed_by = $2, 
           closed_at = NOW(),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [parsed.data.closing_float, u.id, id]
    );

    return apiSuccess(updated);
  }

  return apiError('Invalid action', 400);
}

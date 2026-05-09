import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const resolveSchema = z.object({
  action: z.literal('resolve'),
  resolution_type: z.enum(['credit_note', 'replacement_shipment', 'both']),
  credit_note_ref: z.string().optional(),
  credit_note_amount: z.number().nonnegative().optional(),
  resolution_notes: z.string().min(1),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;
  const claim = await queryOne(
    `SELECT c.*, v.code AS vendor_code, v.name_th AS vendor_name,
            w.code AS warehouse_code, w.name_th AS warehouse_name,
            u.name_en AS created_by_name
     FROM vendor_claims c
     JOIN vendors v ON v.id = c.vendor_id
     JOIN warehouses w ON w.id = c.warehouse_id
     JOIN users u ON u.id = c.created_by
     WHERE c.id = $1`,
    [id]
  );
  if (!claim) return apiError('Claim not found', 404);

  const attachments = await query(
    'SELECT * FROM vendor_claim_attachments WHERE claim_id = $1 ORDER BY uploaded_at',
    [id]
  );

  return apiSuccess({ ...claim, attachments });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const { id } = await params;
  const claim = await queryOne<{ status: string }>('SELECT status FROM vendor_claims WHERE id = $1', [id]);
  if (!claim) return apiError('Claim not found', 404);

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  if (body.action === 'review') {
    if (claim.status !== 'open') return apiError('Claim must be open to start review', 409);
    await queryOne(`UPDATE vendor_claims SET status = 'in_review' WHERE id = $1`, [id]);
    return apiSuccess({ id, status: 'in_review' });
  }

  if (body.action === 'resolve') {
    const parsed = resolveSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);
    if (!['open', 'in_review'].includes(claim.status)) return apiError('Claim cannot be resolved at current status', 409);

    await queryOne(
      `UPDATE vendor_claims SET status = 'resolved', resolution_type = $1, credit_note_ref = $2,
       credit_note_amount = $3, resolution_notes = $4, resolved_by = $5, resolved_at = NOW()
       WHERE id = $6`,
      [parsed.data.resolution_type, parsed.data.credit_note_ref ?? null, parsed.data.credit_note_amount ?? null,
       parsed.data.resolution_notes, u.id, id]
    );
    return apiSuccess({ id, status: 'resolved' });
  }

  if (body.action === 'close') {
    if (claim.status !== 'resolved') return apiError('Only resolved claims can be closed', 409);
    await queryOne(`UPDATE vendor_claims SET status = 'closed' WHERE id = $1`, [id]);
    return apiSuccess({ id, status: 'closed' });
  }

  return apiError('Unknown action', 400);
}

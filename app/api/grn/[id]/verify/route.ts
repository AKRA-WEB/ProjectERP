import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const schema = z.object({
  verification_notes: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['manager', 'admin']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const grn = await queryOne<{ status: string; inbound_order_id: string | null }>(
    'SELECT status, inbound_order_id FROM goods_receipt_notes WHERE id = $1',
    [id]
  );

  if (!grn) return apiError('GRN not found', 404);
  if (grn.status !== 'received') {
    return apiError('GRN must be in received status to be verified', 409);
  }
  if (!grn.inbound_order_id) {
    return apiError('Only Inbound Order-based GRNs use the verification flow', 409);
  }

  await queryOne(
    `UPDATE goods_receipt_notes
     SET status = 'verified', verified_by = $1, verified_at = NOW(), verification_notes = $2
     WHERE id = $3`,
    [u.id, parsed.data.verification_notes ?? null, id]
  );

  await queryOne(
    "UPDATE inbound_orders SET status = 'verified' WHERE id = $1",
    [grn.inbound_order_id]
  );

  return apiSuccess({ id, status: 'verified' });
}

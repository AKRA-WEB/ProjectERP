import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { queryOne } from '@/lib/db/client';
import { z } from 'zod';

const schema = z.object({
  vendor_ref: z.string().min(1).max(100),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const io = await queryOne<{ status: string }>(
    'SELECT status FROM inbound_orders WHERE id = $1',
    [id]
  );

  if (!io) return apiError('Inbound Order not found', 404);
  if (io.status !== 'verified') {
    return apiError('Only verified Inbound Orders can be closed', 409);
  }

  await queryOne(
    `UPDATE inbound_orders
     SET vendor_ref = $1, status = 'closed', updated_at = NOW()
     WHERE id = $2`,
    [parsed.data.vendor_ref, id]
  );

  return apiSuccess({ id, status: 'closed' });
}

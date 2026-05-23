import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { queryOne } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';
import { z } from 'zod';

const PatchSchema = z.object({
  threshold_pct: z.number().min(0).max(100),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const settings = await queryOne<{ threshold_pct: number }>(
    'SELECT threshold_pct FROM repack_loss_settings WHERE id = 1'
  );
  return apiSuccess(settings || { threshold_pct: 5.00 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  
  try {
    assertRole(u, ['admin']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const result = PatchSchema.safeParse(body);
  if (!result.success) return apiError('Invalid request body', 400);

  await queryOne(
    'UPDATE repack_loss_settings SET threshold_pct = $1, updated_at = NOW() WHERE id = 1',
    [result.data.threshold_pct]
  );

  return apiSuccess({ threshold_pct: result.data.threshold_pct });
}

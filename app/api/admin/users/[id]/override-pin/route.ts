import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { queryOne } from '@/lib/db/client';
import { setOverridePin } from '@/lib/auth/override-pin';
import type { SessionUser } from '@/types';
import { z } from 'zod';

const overridePinSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be a 4-6 digit number'),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  // 1. Role gating: Only admin and manager can set PINs
  try {
    assertRole(u, ['admin', 'manager']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { id: targetUserId } = await params;

  try {
    // 2. Target role assertion: verify target exists and has role 'manager' or 'admin'
    const targetUser = await queryOne<{ role: string }>('SELECT role FROM users WHERE id = $1', [targetUserId]);
    if (!targetUser) {
      return apiError('User not found', 404);
    }

    if (targetUser.role !== 'manager' && targetUser.role !== 'admin') {
      return apiError('Only managers/admins may have an override PIN', 403);
    }

    // 3. Validation
    const body = await req.json().catch(() => null);
    if (!body) return apiError('Invalid JSON', 400);

    const parsed = overridePinSchema.safeParse(body);
    if (!parsed.success) {
      return apiValidationError(parsed.error);
    }

    // 4. Update the override PIN
    await setOverridePin(targetUserId, parsed.data.pin);

    return apiSuccess({ ok: true });
  } catch (err: unknown) {
    console.error('Error setting override PIN:', err);
    return apiError('Internal Server Error', 500);
  }
}

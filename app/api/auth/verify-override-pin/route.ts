import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { verifyOverridePin } from '@/lib/auth/override-pin';
import { queryOne } from '@/lib/db/client';
import type { SessionUser } from '@/types';
import { z } from 'zod';

const verifyPinSchema = z.object({
  userId: z.string().uuid().optional(),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be a 4-6 digit number'),
  action: z.string().min(1, 'Action is required'),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    const body = await req.json();
    const parsed = verifyPinSchema.safeParse(body);
    if (!parsed.success) {
      return apiValidationError(parsed.error);
    }

    const { pin, action, userId } = parsed.data;
    const targetUserId = userId || u.id;

    // Verify target user is a manager or admin
    const targetUser = await queryOne<{ role: string }>('SELECT role FROM users WHERE id = $1', [targetUserId]);
    if (!targetUser) {
      return apiError('Authorizing user not found', 404);
    }
    if (targetUser.role !== 'manager' && targetUser.role !== 'admin') {
      return apiError('Only managers/admins can authorize overrides', 403);
    }

    // Call the verify helper
    const { token } = await verifyOverridePin(targetUserId, pin, action);

    return apiSuccess({ token, expires_in: 60 });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
      const e = err as { status: number; message: string };
      return apiError(e.message, e.status);
    }
    console.error('Error verifying override PIN:', err);
    return apiError('Internal Server Error', 500);
  }
}

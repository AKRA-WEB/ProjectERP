import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import { query } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';
import { z } from 'zod';

const shiftSchema = z.object({
  name_th: z.string().min(1),
  name_en: z.string().min(1),
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'pos:view'); } catch { return apiError('Forbidden', 403); }

  const shifts = await query(
    `SELECT * FROM pos_shifts WHERE is_active = TRUE ORDER BY start_time ASC`,
    []
  );

  return apiSuccess(shifts);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'pos:shift_manage'); } catch { return apiError('Forbidden', 403); }

  try {
    const body = await req.json();
    const data = shiftSchema.parse(body);

    const result = await query(
      `INSERT INTO pos_shifts (name_th, name_en, start_time, end_time)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.name_th, data.name_en, data.start_time, data.end_time]
    );

    return apiSuccess(result[0], 201);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return apiValidationError(err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return apiError(msg, 500);
  }
}

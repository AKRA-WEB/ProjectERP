import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const createSchema = z.object({
  code: z.string().min(1).max(20),
  name_th: z.string().min(1).max(100),
  name_en: z.string().min(1).max(100),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const uoms = await query('SELECT * FROM units_of_measure ORDER BY code');
  return apiSuccess(uoms);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const existing = await queryOne('SELECT id FROM units_of_measure WHERE code = $1', [parsed.data.code]);
  if (existing) return apiError('UOM code already exists', 409);

  const uom = await queryOne(
    'INSERT INTO units_of_measure (code, name_th, name_en) VALUES ($1,$2,$3) RETURNING *',
    [parsed.data.code, parsed.data.name_th, parsed.data.name_en]
  );
  return apiSuccess(uom, 201);
}

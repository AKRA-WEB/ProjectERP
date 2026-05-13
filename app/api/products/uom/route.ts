import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';
import type { UnitOfMeasure } from '@/types';

const createSchema = z.object({
  code: z.string().min(1).max(10).regex(/^[A-Z0-9\u0E00-\u0E7F.]+$/, 'Code must be uppercase alphanumeric or Thai'),
  name_th: z.string().min(1).max(100),
  name_en: z.string().min(1).max(100),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const uoms = await query<UnitOfMeasure>(
    `SELECT u.*,
            uc.factor,
            uc.base_uom_id,
            bu.code AS base_uom_code
     FROM units_of_measure u
     LEFT JOIN uom_conversions uc ON uc.uom_id = u.id
     LEFT JOIN units_of_measure bu ON bu.id = uc.base_uom_id
     ORDER BY u.sort_order, u.code`
  );
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

  const uom = await queryOne<UnitOfMeasure>(
    `INSERT INTO units_of_measure (code, name_th, name_en)
     VALUES ($1,$2,$3) RETURNING *`,
    [parsed.data.code, parsed.data.name_th, parsed.data.name_en]
  );
  return apiSuccess(uom, 201);
}

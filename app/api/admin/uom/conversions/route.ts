import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';
import type { UomConversion } from '@/types';

const createSchema = z.object({
  uom_id:      z.string().uuid(),
  base_uom_id: z.string().uuid(),
  factor:      z.number().positive(),
  notes:       z.string().max(255).nullable().default(null),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }

  const conversions = await query<UomConversion>(
    `SELECT uc.*, u.code AS uom_code, bu.code AS base_uom_code
     FROM uom_conversions uc
     JOIN units_of_measure u  ON u.id  = uc.uom_id
     JOIN units_of_measure bu ON bu.id = uc.base_uom_id
     ORDER BY u.sort_order, u.code`
  );
  return apiSuccess(conversions);
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

  const existing = await queryOne('SELECT id FROM uom_conversions WHERE uom_id = $1', [parsed.data.uom_id]);
  if (existing) return apiError('A conversion for this UoM already exists', 409);

  const conv = await queryOne<UomConversion>(
    `INSERT INTO uom_conversions (uom_id, base_uom_id, factor, notes)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [parsed.data.uom_id, parsed.data.base_uom_id, parsed.data.factor, parsed.data.notes]
  );
  return apiSuccess(conv, 201);
}

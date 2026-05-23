import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const createSchema = z.object({
  warehouse_id: z.string().uuid(),
  code: z.string().min(1).max(20),
  thermal_type: z.enum(['ambient', 'sensitive', 'chilled', 'frozen']),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  // Let managers, admins, and auditors read thermal zones
  try {
    assertRole(u, ['admin', 'manager', 'auditor']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const warehouseId = searchParams.get('warehouse_id');

  const rows = await query(
    `SELECT id, warehouse_id, code, thermal_type, created_at
     FROM warehouse_zones
     WHERE ($1::uuid IS NULL OR warehouse_id = $1)
     ORDER BY code ASC`,
    [warehouseId || null]
  );

  return apiSuccess(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  // Only admin/manager can create warehouse zones
  try {
    assertRole(u, ['admin', 'manager']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const { warehouse_id, code, thermal_type } = parsed.data;

  // Check if code is already used in this physical warehouse
  const existing = await queryOne(
    `SELECT id FROM warehouse_zones WHERE warehouse_id = $1 AND code = $2`,
    [warehouse_id, code]
  );
  if (existing) {
    return apiError('Zone code already exists in this warehouse', 409);
  }

  const zone = await queryOne(
    `INSERT INTO warehouse_zones (warehouse_id, code, thermal_type)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [warehouse_id, code, thermal_type]
  );

  return apiSuccess(zone, 201);
}

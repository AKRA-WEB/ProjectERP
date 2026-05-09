import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const createSchema = z.object({
  code: z.string().min(1).max(20),
  name_th: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  address_th: z.string().optional(),
  address_en: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const warehouses = await query(
    `SELECT w.*, COUNT(uwa.user_id) AS user_count
     FROM warehouses w
     LEFT JOIN user_warehouse_assignments uwa ON uwa.warehouse_id = w.id
     GROUP BY w.id
     ORDER BY w.code`
  );
  return apiSuccess(warehouses);
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

  const existing = await queryOne('SELECT id FROM warehouses WHERE code = $1', [parsed.data.code]);
  if (existing) return apiError('Warehouse code already exists', 409);

  const wh = await queryOne(
    `INSERT INTO warehouses (code, name_th, name_en, address_th, address_en)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [parsed.data.code, parsed.data.name_th, parsed.data.name_en, parsed.data.address_th ?? null, parsed.data.address_en ?? null]
  );
  return apiSuccess(wh, 201);
}

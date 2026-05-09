import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const createSchema = z.object({
  code: z.string().min(1).max(50),
  name_th: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  parent_id: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const categories = await query(
    `WITH RECURSIVE cat_tree AS (
       SELECT id, parent_id, code, name_th, name_en, is_active, 0 AS depth
       FROM product_categories WHERE parent_id IS NULL
       UNION ALL
       SELECT c.id, c.parent_id, c.code, c.name_th, c.name_en, c.is_active, ct.depth + 1
       FROM product_categories c
       JOIN cat_tree ct ON ct.id = c.parent_id
     )
     SELECT * FROM cat_tree ORDER BY depth, name_en`
  );
  return apiSuccess(categories);
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

  const existing = await queryOne('SELECT id FROM product_categories WHERE code = $1', [parsed.data.code]);
  if (existing) return apiError('Category code already exists', 409);

  const cat = await queryOne(
    `INSERT INTO product_categories (code, name_th, name_en, parent_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [parsed.data.code, parsed.data.name_th, parsed.data.name_en, parsed.data.parent_id ?? null]
  );
  return apiSuccess(cat, 201);
}

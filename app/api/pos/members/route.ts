import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import { query } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';

const memberSchema = z.object({
  name_th: z.string().min(1),
  phone: z.string().min(6),
  email: z.string().email().optional().nullable(),
  tier: z.string().optional(),
  discount_rate: z.number().min(0).max(1).optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'pos:cashier'); } catch { return apiError('Forbidden', 403); }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;

  const conditions = ['is_active = true'];
  const params: unknown[] = [];
  let idx = 1;

  if (q) {
    conditions.push(`(phone = $${idx} OR name_th ILIKE $${idx + 1})`);
    params.push(q, `%${q}%`);
    idx += 2;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [totalRes] = await query<{ count: string }>(`SELECT COUNT(*) FROM pos_members ${where}`, params);

  const members = await query(
    `SELECT * FROM pos_members 
     ${where}
     ORDER BY created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({
    data: members,
    total: Number(totalRes.count),
    page,
    limit,
    total_pages: Math.ceil(Number(totalRes.count) / limit),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'pos:members'); } catch { return apiError('Forbidden', 403); }

  try {
    const body = await req.json();
    const data = memberSchema.parse(body);

    const result = await query(
      `INSERT INTO pos_members (name_th, phone, email, tier, discount_rate)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.name_th, data.phone, data.email ?? null, data.tier ?? 'standard', data.discount_rate ?? 0]
    );

    return apiSuccess(result[0], 201);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return apiValidationError(err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return apiError('Member with this phone already exists', 409);
    }
    return apiError(msg, 500);
  }
}

import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

const createSchema = z.object({
  code: z.string().min(1).max(50),
  name_th: z.string().min(1).max(500),
  name_en: z.string().min(1).max(500),
  contact_name: z.string().max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  address_th: z.string().optional(),
  address_en: z.string().optional(),
  tax_id: z.string().max(50).optional(),
  payment_terms_days: z.number().int().nonnegative().default(30),
  default_wht_rate: z.number().min(0).max(100).nullable().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(200, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const search = searchParams.get('search');
  const isActive = searchParams.get('is_active');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (isActive !== null) { conditions.push(`v.is_active = $${idx++}`); params.push(isActive === 'true'); }
  if (search) { conditions.push(`(v.code ILIKE $${idx} OR v.name_en ILIKE $${idx} OR v.name_th ILIKE $${idx})`); params.push(`%${search}%`); idx++; }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [total] = await query<{ count: string }>(`SELECT COUNT(*) FROM vendors v ${where}`, params);

  const vendors = await query(
    `SELECT * FROM vendors v ${where} ORDER BY v.code LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({
    data: vendors,
    total: Number(total.count),
    page,
    limit,
    total_pages: Math.ceil(Number(total.count) / limit),
  });
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

  const existing = await queryOne('SELECT id FROM vendors WHERE code = $1', [parsed.data.code]);
  if (existing) return apiError('Vendor code already exists', 409);

  const vendor = await queryOne(
    `INSERT INTO vendors (code, name_th, name_en, contact_name, email, phone, address_th, address_en, tax_id, payment_terms_days, default_wht_rate)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      parsed.data.code, parsed.data.name_th, parsed.data.name_en,
      parsed.data.contact_name ?? null, parsed.data.email ?? null, parsed.data.phone ?? null,
      parsed.data.address_th ?? null, parsed.data.address_en ?? null,
      parsed.data.tax_id ?? null, parsed.data.payment_terms_days,
      parsed.data.default_wht_rate ?? null,
    ]
  );
  return apiSuccess(vendor, 201);
}

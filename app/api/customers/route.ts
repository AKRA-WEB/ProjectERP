import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';
import type { Customer } from '@/types';

const createSchema = z.object({
  code: z.string().min(1).max(50),
  name_th: z.string().min(1).max(500),
  name_en: z.string().max(500).optional(),
  contact_name: z.string().max(255).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  address_th: z.string().optional(),
  tax_id: z.string().max(50).optional(),
  payment_terms_days: z.number().int().min(0).default(30),
  credit_limit: z.number().min(0).default(0),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'customers:view'); } catch { return apiError('Forbidden', 403); }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const search = searchParams.get('search');
  const isActive = searchParams.get('is_active');
  const onHold = searchParams.get('on_hold');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (search) {
    conditions.push(`(code ILIKE $${idx} OR name_th ILIKE $${idx} OR name_en ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }
  if (isActive !== null) {
    conditions.push(`is_active = $${idx++}`);
    params.push(isActive === 'true');
  }
  if (onHold !== null) {
    conditions.push(`on_hold = $${idx++}`);
    params.push(onHold === 'true');
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [total] = await query<{ count: string }>(`SELECT COUNT(*) FROM customers ${where}`, params);

  const customers = await query(
    `SELECT * FROM customers ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return apiSuccess({
    data: customers,
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

  try { assertPermission(u, 'customers:create'); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const existing = await queryOne('SELECT id FROM customers WHERE code = $1', [parsed.data.code]);
  if (existing) return apiError('Customer code already exists', 409);

  const customer = await queryOne<Customer>(
    `INSERT INTO customers (
      code, name_th, name_en, contact_name, email, phone, address_th, tax_id, payment_terms_days, credit_limit
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      parsed.data.code, parsed.data.name_th, parsed.data.name_en || null,
      parsed.data.contact_name || null, parsed.data.email || null, parsed.data.phone || null,
      parsed.data.address_th || null, parsed.data.tax_id || null,
      parsed.data.payment_terms_days, parsed.data.credit_limit
    ]
  );

  return apiSuccess(customer, 201);
}

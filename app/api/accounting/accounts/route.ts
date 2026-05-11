import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const createSchema = z.object({
  account_code: z.string().min(1).max(20),
  name_th: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  account_type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  normal_balance: z.enum(['debit', 'credit']),
  parent_id: z.string().uuid().optional().nullable(),
  allows_direct_posting: z.boolean().optional().default(true),
  description: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'accounts:view'); } catch { return apiError('Forbidden', 403); }

  const { searchParams } = new URL(req.url);
  const accountType = searchParams.get('account_type');
  const isActive = searchParams.get('is_active');
  const search = searchParams.get('search');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (accountType) {
    conditions.push(`a.account_type = $${idx++}`);
    params.push(accountType);
  }
  if (isActive !== null) {
    conditions.push(`a.is_active = $${idx++}`);
    params.push(isActive === 'true');
  }
  if (search) {
    conditions.push(`(a.account_code ILIKE $${idx} OR a.name_th ILIKE $${idx} OR a.name_en ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const accounts = await query(
    `SELECT a.*, p.account_code AS parent_code, p.name_th AS parent_name_th
     FROM accounts a
     LEFT JOIN accounts p ON p.id = a.parent_id
     ${where}
     ORDER BY a.account_code ASC`,
    params
  );

  return apiSuccess(accounts);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'accounts:manage'); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const existing = await queryOne('SELECT id FROM accounts WHERE account_code = $1', [parsed.data.account_code]);
  if (existing) return apiError('Account code already exists', 409);

  if (parsed.data.parent_id) {
    const parent = await queryOne<{ allows_direct_posting: boolean }>('SELECT allows_direct_posting FROM accounts WHERE id = $1', [parsed.data.parent_id]);
    if (!parent) return apiError('Parent account not found', 404);
    if (parent.allows_direct_posting) {
      // In many systems, parents shouldn't have direct postings. The plan says parent should have allows_direct_posting=FALSE.
      // We'll enforce that parents of leaf accounts must be group accounts.
      return apiError('Parent account must be a group account (allows_direct_posting=FALSE)', 400);
    }
  }

  const account = await queryOne(
    `INSERT INTO accounts (
      account_code, name_th, name_en, account_type, normal_balance, parent_id, allows_direct_posting, description
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      parsed.data.account_code, parsed.data.name_th, parsed.data.name_en,
      parsed.data.account_type, parsed.data.normal_balance, parsed.data.parent_id || null,
      parsed.data.allows_direct_posting, parsed.data.description || null
    ]
  );

  return apiSuccess(account, 201);
}

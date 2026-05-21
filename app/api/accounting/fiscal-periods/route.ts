import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const createSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  name_th: z.string().min(1).max(50).optional(),
  name_en: z.string().min(1).max(50).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const THAI_MONTHS = [
  '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const ENG_MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'fiscal_periods:view'); } catch { return apiError('Forbidden', 403); }

  const periods = await query(
    `SELECT fp.*, 
            (SELECT COUNT(*) FROM journal_entries je WHERE je.fiscal_period_id = fp.id AND je.status = 'posted') AS entry_count
     FROM fiscal_periods fp
     ORDER BY fp.year DESC, fp.month DESC`
  );

  return apiSuccess(periods);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try { assertPermission(u, 'fiscal_periods:manage'); } catch { return apiError('Forbidden', 403); }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const existing = await queryOne('SELECT id FROM fiscal_periods WHERE year = $1 AND month = $2', [parsed.data.year, parsed.data.month]);
  if (existing) return apiError(`Fiscal period for ${parsed.data.year}/${parsed.data.month} already exists`, 409);

  const nameTh = parsed.data.name_th || `${THAI_MONTHS[parsed.data.month]} ${parsed.data.year + 543}`;
  const nameEn = parsed.data.name_en || `${ENG_MONTHS[parsed.data.month]} ${parsed.data.year}`;

  const period = await queryOne(
    `INSERT INTO fiscal_periods (name_th, name_en, year, month, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [nameTh, nameEn, parsed.data.year, parsed.data.month, parsed.data.start_date, parsed.data.end_date]
  );

  return apiSuccess(period, 201);
}

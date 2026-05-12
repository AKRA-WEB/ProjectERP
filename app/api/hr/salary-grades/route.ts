import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const CreateSchema = z.object({
  code: z.string().min(1).max(50),
  name_th: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  base_salary_min: z.number().min(0),
  base_salary_max: z.number().min(0),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const rows = await query(`SELECT * FROM salary_grades ORDER BY base_salary_min`, []);
  return apiSuccess(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  if (u.role !== 'admin') return apiError('Forbidden', 403);

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);
  const d = parsed.data;

  const rows = await query<{ id: string }>(`
    INSERT INTO salary_grades (code, name_th, name_en, base_salary_min, base_salary_max)
    VALUES ($1, $2, $3, $4, $5) RETURNING id
  `, [d.code, d.name_th, d.name_en, d.base_salary_min, d.base_salary_max]);
  return apiSuccess({ id: rows[0].id }, 201);
}

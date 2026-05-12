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
  department_id: z.string().uuid().nullable().optional(),
  salary_grade_id: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const rows = await query(`
    SELECT p.*, d.name_th AS department_name_th, sg.name_th AS salary_grade_name
    FROM positions p
    LEFT JOIN departments d ON d.id = p.department_id
    LEFT JOIN salary_grades sg ON sg.id = p.salary_grade_id
    WHERE p.is_active = TRUE
    ORDER BY p.name_th
  `, []);
  return apiSuccess(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  if (!['admin', 'manager'].includes(u.role)) return apiError('Forbidden', 403);

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);
  const d = parsed.data;

  const rows = await query<{ id: string }>(`
    INSERT INTO positions (code, name_th, name_en, department_id, salary_grade_id)
    VALUES ($1, $2, $3, $4, $5) RETURNING id
  `, [d.code, d.name_th, d.name_en, d.department_id ?? null, d.salary_grade_id ?? null]);
  return apiSuccess({ id: rows[0].id }, 201);
}

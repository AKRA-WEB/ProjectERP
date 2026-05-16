import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { queryOne } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';
import { assertRole, SessionUser } from '@/lib/authz';

const UpdateSchema = z.object({
  employee_id: z.string().max(50).optional(),
  department_id: z.string().uuid().nullable().optional(),
  position_id: z.string().uuid().nullable().optional(),
  salary_grade_id: z.string().uuid().nullable().optional(),
  base_salary: z.number().min(0).nullable().optional(),
  employment_type: z.enum(['full_time', 'part_time', 'contract']).optional(),
  employee_status: z.enum(['active', 'inactive', 'resigned']).optional(),
  hired_date: z.string().nullable().optional(),
  resignation_date: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const { id } = await params;

  const row = await queryOne(`
    SELECT
      u.*, d.name_th AS department_name_th, d.name_en AS department_name_en,
      p.name_th AS position_name_th, p.name_en AS position_name_en,
      sg.name_th AS salary_grade_name, sg.base_salary_min, sg.base_salary_max
    FROM users u
    LEFT JOIN departments d ON d.id = u.department_id
    LEFT JOIN positions p ON p.id = u.position_id
    LEFT JOIN salary_grades sg ON sg.id = u.salary_grade_id
    WHERE u.id = $1
  `, [id]);
  if (!row) return apiError('Not found', 404);
  return apiSuccess(row);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
  const { id } = await params;

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);
  const d = parsed.data;

  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  const fields = ['employee_id','department_id','position_id','salary_grade_id',
    'base_salary','employment_type','employee_status','hired_date','resignation_date','phone'] as const;
  for (const f of fields) {
    if (d[f] !== undefined) { sets.push(`${f} = $${idx++}`); vals.push(d[f]); }
  }
  if (sets.length === 0) return apiError('No fields', 400);
  vals.push(id);
  await queryOne(`UPDATE users SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
  return apiSuccess({ ok: true });
}

import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';
import { buildWarehouseScopeClause } from '@/lib/authz';
import type { SessionUser } from '@/lib/authz';

const CreateSchema = z.object({
  leave_type_id: z.string().uuid(),
  start_date: z.string(),
  end_date: z.string(),
  days_requested: z.number().min(0.5),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? '';
  const empId = searchParams.get('employee_id') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('pageSize') ?? '20');
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  // Staff/manager only see own; admin sees all (or can filter by employee_id)
  if (u.role === 'staff') {
    conditions.push(`lr.employee_id = $${idx++}`); params.push(u.id);
  } else if (empId) {
    conditions.push(`lr.employee_id = $${idx++}`); params.push(empId);
  }
  if (status) { conditions.push(`lr.status = $${idx++}`); params.push(status); }

  const scope = buildWarehouseScopeClause(u, 'uwa.warehouse_id', idx);
  if (scope) {
    conditions.push(`EXISTS (SELECT 1 FROM user_warehouse_assignments uwa WHERE uwa.user_id = lr.employee_id AND ${scope.clause})`);
    params.push(...scope.params);
    idx += scope.params.length;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query(`
    SELECT lr.*, 
      u.name_th AS employee_name_th, u.name_en AS employee_name_en,
      lt.name_th AS leave_type_name_th, lt.name_en AS leave_type_name_en,
      a.name_th AS approved_by_name_th, a.name_en AS approved_by_name_en
    FROM leave_requests lr
    JOIN users u ON u.id = lr.employee_id
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    LEFT JOIN users a ON a.id = lr.approved_by
    ${where}
    ORDER BY lr.created_at DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `, [...params, limit, offset]);

  const [{ count }] = await query<{ count: string }>(`
    SELECT COUNT(*) FROM leave_requests lr ${where}
  `, params);

  return apiSuccess({ data: rows, total: parseInt(count), page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);
  const d = parsed.data;

  const rows = await query<{ id: string; request_number: string }>(`
    INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, days_requested, notes)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, request_number
  `, [u.id, d.leave_type_id, d.start_date, d.end_date, d.days_requested, d.notes ?? null]);

  return apiSuccess(rows[0], 201);
}

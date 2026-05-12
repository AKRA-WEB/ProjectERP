import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import type { SessionUser } from '@/lib/authz';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  const { searchParams } = new URL(req.url);
  const empId = searchParams.get('employee_id') ?? (u.role === 'staff' ? u.id : '');
  const month = searchParams.get('month'); // YYYY-MM
  if (!month) return apiError('month required (YYYY-MM)', 400);

  const conditions = [`work_date >= $1`, `work_date <= $2`];
  const params: unknown[] = [`${month}-01`, `${month}-31`];
  let idx = 3;
  if (empId) { conditions.push(`employee_id = $${idx++}`); params.push(empId); }

  const rows = await query(`
    SELECT ar.*, u.name AS employee_name
    FROM attendance_records ar
    JOIN users u ON u.id = ar.employee_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY ar.work_date, u.name
  `, params);
  return apiSuccess(rows);
}

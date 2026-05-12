import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get('employee_id');
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()));

  if (!employeeId) return apiError('employee_id required', 400);

  const rows = await query(`
    SELECT lb.*,
      lt.name_th AS leave_type_name_th, lt.name_en AS leave_type_name_en,
      (lb.days_entitled - lb.days_used) AS days_remaining
    FROM leave_balances lb
    JOIN leave_types lt ON lt.id = lb.leave_type_id
    WHERE lb.employee_id = $1 AND lb.year = $2
    ORDER BY lt.name_th
  `, [employeeId, year]);
  return apiSuccess(rows);
}

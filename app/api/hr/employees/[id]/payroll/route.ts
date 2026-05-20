import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const { id } = await params;

  const rows = await query(`
    SELECT pl.*, pr.period_month, pr.period_year, pr.run_number
    FROM payroll_lines pl
    JOIN payroll_runs pr ON pr.id = pl.run_id
    WHERE pl.employee_id = $1
    ORDER BY pr.period_year DESC, pr.period_month DESC
    LIMIT 12
  `, [id]);

  return apiSuccess(rows);
}

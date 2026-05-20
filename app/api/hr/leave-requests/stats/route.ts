import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { queryOne } from '@/lib/db/client';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  interface LeaveStats {
    pending: number;
    on_leave_now: number;
    upcoming_7d: number;
    approved_this_month: number;
  }

  const stats = await queryOne<LeaveStats>(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'submitted')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'approved' AND CURRENT_DATE BETWEEN start_date AND end_date)::int AS on_leave_now,
      COUNT(*) FILTER (WHERE status = 'approved' AND start_date > CURRENT_DATE AND start_date <= CURRENT_DATE + 7)::int AS upcoming_7d,
      COUNT(*) FILTER (WHERE status = 'approved' AND start_date >= date_trunc('month', CURRENT_DATE))::int AS approved_this_month
    FROM leave_requests
  `, []);

  return apiSuccess(stats);
}

import { auth } from '@/auth';
import { apiError, apiSuccess } from '@/lib/api-response';
import { queryOne } from '@/lib/db/client';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const stats = await queryOne<{
    total: number;
    new_this_month: number;
    turnover_3m_pct: string;
    avg_tenure_years: string;
    oldest_tenure_years: string;
    min_probation_days_remaining: number;
  }>(`
    SELECT
      COUNT(*) FILTER (WHERE is_active = TRUE AND role NOT IN ('admin', 'superadmin'))::int AS total,
      COUNT(*) FILTER (WHERE is_active = TRUE AND role NOT IN ('admin', 'superadmin') AND hired_date >= date_trunc('month', CURRENT_DATE))::int AS new_this_month,
      ROUND(
        COUNT(*) FILTER (WHERE is_active = FALSE AND role NOT IN ('admin', 'superadmin') AND updated_at >= CURRENT_DATE - 90)::numeric /
        NULLIF(COUNT(*) FILTER (WHERE is_active = TRUE AND role NOT IN ('admin', 'superadmin')), 0) * 100, 1
      ) AS turnover_3m_pct,
      ROUND(AVG(EXTRACT(EPOCH FROM AGE(hired_date)) / 86400 / 365)::numeric, 1) AS avg_tenure_years,
      ROUND(MAX(EXTRACT(EPOCH FROM AGE(hired_date)) / 86400 / 365)::numeric, 1) AS oldest_tenure_years,
      COALESCE(MIN(120 - (CURRENT_DATE - hired_date)) FILTER (WHERE is_active = TRUE AND employee_status = 'probation'), 0)::int AS min_probation_days_remaining
    FROM users
  `, []);


  return apiSuccess(stats);
}

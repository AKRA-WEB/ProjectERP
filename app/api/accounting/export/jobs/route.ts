import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/types';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  // Auditor and Admin are authorized
  if (!['admin', 'auditor'].includes(u.role)) {
    return apiError('Forbidden: Unauthorized role access', 403);
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * limit;

  // Fetch count
  const [totalRes] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM accounting_export_jobs`
  );
  const total = parseInt(totalRes?.count ?? '0');

  // Fetch jobs
  const rows = await query(
    `SELECT j.*, u.name_en AS requester_name
     FROM accounting_export_jobs j
     JOIN users u ON u.id = j.requested_by
     ORDER BY j.requested_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return apiSuccess({
    jobs: rows,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  });
}

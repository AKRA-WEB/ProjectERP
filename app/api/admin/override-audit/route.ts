import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import pool from '@/lib/db/client';
import type { SessionUser } from '@/types';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  // 1. Role gating: Only admin and auditor can view override logs
  try {
    assertRole(u, ['admin', 'auditor']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const userId = searchParams.get('user_id');
  if (userId) {
    conditions.push(`oa.user_id = $${idx++}`);
    params.push(userId);
  }

  const action = searchParams.get('action');
  if (action) {
    conditions.push(`oa.action = $${idx++}`);
    params.push(action);
  }

  const targetTable = searchParams.get('target_table');
  if (targetTable) {
    conditions.push(`oa.target_table = $${idx++}`);
    params.push(targetTable);
  }

  const fromDate = searchParams.get('from');
  if (fromDate) {
    conditions.push(`oa.created_at >= $${idx++}`);
    params.push(fromDate);
  }

  const toDate = searchParams.get('to');
  if (toDate) {
    conditions.push(`oa.created_at < $${idx++}::date + INTERVAL '1 day'`);
    params.push(toDate);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    // 2. Fetch log data with total count over-window and user details join
    const queryStr = `
      SELECT
        oa.id,
        oa.user_id,
        u.name_th AS user_name_th,
        u.name_en AS user_name_en,
        u.email AS user_email,
        oa.action,
        oa.target_table,
        oa.target_id,
        oa.reason_code,
        oa.original_value,
        oa.override_value,
        oa.created_at,
        COUNT(*) OVER() AS total_count
      FROM override_audit oa
      LEFT JOIN users u ON u.id = oa.user_id
      ${whereClause}
      ORDER BY oa.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const res = await pool.query(queryStr, [...params, limit, offset]);
    const data = res.rows;
    const total = data[0] ? parseInt(data[0].total_count as string) : 0;

    // Remove the window function column from the rows to keep response clean
    const cleanedData = data.map((row) => {
      const rest = { ...row } as Record<string, unknown>;
      delete rest.total_count;
      return rest;
    });

    return apiSuccess({
      data: cleanedData,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    });
  } catch (err: unknown) {
    console.error('Error fetching override audit logs:', err);
    return apiError('Internal Server Error', 500);
  }
}

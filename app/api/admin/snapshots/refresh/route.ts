import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import type { SessionUser } from '@/types';

const ALLOWED_TARGETS = ['hr_stats'] as const;
type SnapshotTarget = typeof ALLOWED_TARGETS[number];

const VIEW_MAP: Record<SnapshotTarget, string> = {
  hr_stats: 'hr_stats_snapshot',
};

export async function POST(req: NextRequest) {
  // Allow Vercel Cron calls via secret header
  const cronSecret = req.headers.get('authorization');
  const isCron = cronSecret === `Bearer ${process.env.CRON_SECRET}`;

  if (!isCron) {
    const session = await auth();
    if (!session) return apiError('Unauthorized', 401);
    const u = session.user as unknown as SessionUser;
    try { assertRole(u, ['admin']); } catch { return apiError('Forbidden', 403); }
  }

  const { searchParams } = new URL(req.url);
  const target = searchParams.get('target') as SnapshotTarget | null;

  if (!target || !ALLOWED_TARGETS.includes(target)) {
    return apiError(`Invalid target. Allowed: ${ALLOWED_TARGETS.join(', ')}`, 400);
  }

  const viewName = VIEW_MAP[target];
  await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`, []);

  return apiSuccess({ refreshed: viewName, at: new Date().toISOString() });
}

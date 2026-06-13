import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getGRNPage, getGRNStatusCounts, getGRNQueueCounts } from '@/lib/queries/grn';
import type { GRNPageResult } from '@/lib/queries/grn';
import { getWarehouses } from '@/lib/queries/admin';
import { GRNClient } from './GRNClient';
import type { SessionUser } from '@/lib/authz';

export default async function GRNPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const u = session.user as unknown as SessionUser;
  const params = await searchParams;
  const initialStatus = params.status ?? undefined;

  let initialGRNs: GRNPageResult = { data: [], total: 0, page: 1, limit: 25, total_pages: 0 };
  let initialStatusCounts: Record<string, number> = {};
  let initialWarehouses: Awaited<ReturnType<typeof getWarehouses>> = [];
  let initialQueueCounts = { io: 0, po: 0 };

  try {
    [initialGRNs, initialStatusCounts, initialWarehouses, initialQueueCounts] = await Promise.all([
      getGRNPage(u, { page: 1, limit: 25, status: initialStatus }),
      getGRNStatusCounts(u),
      getWarehouses(),
      getGRNQueueCounts(u),
    ]);
  } catch (error) {
    console.error('Failed to preload GRN page data:', error);
  }

  return (
    <GRNClient
      initialGRNs={initialGRNs}
      initialStatusCounts={initialStatusCounts}
      initialWarehouses={initialWarehouses}
      initialQueueCounts={initialQueueCounts}
    />
  );
}

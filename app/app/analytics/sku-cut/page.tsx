import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getSkuCutCandidates, getSkuPerformance } from '@/lib/queries/analytics';
import { SkuCutClient } from './SkuCutClient';
import type { SessionUser } from '@/lib/authz';

export default async function SkuCutPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const u = session.user as unknown as SessionUser;

  // Enforce role restrictions matching the underlying endpoints
  if (u.role !== 'admin' && u.role !== 'manager') {
    redirect('/app/dashboard');
  }

  let initialCandidates: Awaited<ReturnType<typeof getSkuCutCandidates>> = [];
  let initialPerformance: Awaited<ReturnType<typeof getSkuPerformance>> = { rows: [], total: 0 };

  try {
    const [candidates, performance] = await Promise.all([
      getSkuCutCandidates(),
      getSkuPerformance({ limit: 25, offset: 0 }),
    ]);
    initialCandidates = candidates;
    initialPerformance = performance;
  } catch (err) {
    console.error('Failed to load initial SKU Cut Analytics data:', err);
  }

  return (
    <SkuCutClient
      initialCandidates={initialCandidates}
      initialPerformance={initialPerformance}
    />
  );
}

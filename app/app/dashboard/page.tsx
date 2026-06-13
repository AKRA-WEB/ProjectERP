import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getKPI, getAuditorDashboardData } from '@/lib/queries/dashboard';
import { getWarehouses } from '@/lib/queries/admin';
import { DashboardClient } from './DashboardClient';
import { AuditorDashboardClient } from './AuditorDashboardClient';
import type { SessionUser } from '@/lib/authz';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const u = session.user as unknown as SessionUser;

  if (u.role === 'auditor') {
    let initialData = null;
    try {
      initialData = await getAuditorDashboardData();
    } catch (error) {
      console.error('Failed to preload auditor dashboard data:', error);
    }
    return <AuditorDashboardClient initialData={initialData} session={session} />;
  }

  let initialKpi = null;
  let initialWarehouses: Awaited<ReturnType<typeof getWarehouses>> = [];
  try {
    [initialKpi, initialWarehouses] = await Promise.all([getKPI(), getWarehouses()]);
  } catch (error) {
    console.error('Failed to preload dashboard data:', error);
  }

  return <DashboardClient initialKpi={initialKpi} initialWarehouses={initialWarehouses} session={session} />;
}

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getInventoryPage } from '@/lib/queries/inventory';
import { InventoryClient } from './InventoryClient';
import type { SessionUser } from '@/lib/authz';

export default async function InventoryPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const u = session.user as unknown as SessionUser;

  let initialData: Awaited<ReturnType<typeof getInventoryPage>> = {
    data: [], total: 0, page: 1, per_page: 30, total_pages: 0, warehouses: [],
  };
  try {
    initialData = await getInventoryPage(u, { page: 1, limit: 30 });
  } catch (error) {
    console.error('Failed to preload inventory page data:', error);
  }

  return <InventoryClient initialData={initialData} />;
}

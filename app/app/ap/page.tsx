import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getAPInvoicePage } from '@/lib/queries/ap';
import { APClient } from './APClient';

export default async function APPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  let initialData: Awaited<ReturnType<typeof getAPInvoicePage>> = {
    invoices: [], total: 0, total_pages: 0,
  };
  try {
    initialData = await getAPInvoicePage({ page: 1, limit: 25 });
  } catch (error) {
    console.error('Failed to preload AP page data:', error);
  }

  return <APClient initialData={initialData} />;
}

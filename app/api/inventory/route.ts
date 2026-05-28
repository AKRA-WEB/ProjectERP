import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';
import { getInventoryPage } from '@/lib/queries/inventory';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(200, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const warehouseId = searchParams.get('warehouse_id') ?? undefined;
  const search = searchParams.get('search') || searchParams.get('q') || undefined;
  const lowStock = searchParams.get('low_stock') === 'true' || searchParams.get('low_stock') === '1';

  const result = await getInventoryPage(u, { page, limit, warehouse_id: warehouseId, search, low_stock: lowStock });
  return apiSuccess(result);
}

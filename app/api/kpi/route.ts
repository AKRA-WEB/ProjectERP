import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { getKPI } from '@/lib/queries/dashboard';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const warehouseId = searchParams.get('warehouse_id') ?? undefined;

  const data = await getKPI(warehouseId);
  return apiSuccess(data);
}

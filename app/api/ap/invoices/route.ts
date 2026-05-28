import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import { getAPInvoicePage } from '@/lib/queries/ap';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const vendorId = searchParams.get('vendor_id') ?? undefined;
  const isPaidStr = searchParams.get('is_paid');
  const isPaid = isPaidStr === null || isPaidStr === '' ? null : isPaidStr === 'true';
  const matchStatus = searchParams.get('match_status') ?? undefined;

  const result = await getAPInvoicePage({ page, limit, is_paid: isPaid, vendor_id: vendorId, match_status: matchStatus });
  return apiSuccess(result);
}

import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole, type SessionUser } from '@/lib/authz';
import { getSCurveForecast } from '@/lib/forecasting/sCurve';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ product_id: string }> }
) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin', 'manager']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { product_id } = await params;
  const { searchParams } = new URL(req.url);
  const daysParam = parseInt(searchParams.get('days') || '90', 10);

  // Validate days is a positive integer between 7 and 365
  const days = Math.min(Math.max(daysParam, 7), 365);

  try {
    const result = await getSCurveForecast(product_id, days);
    if (!result) {
      return apiError('Active product not found or forecasting history unavailable', 404);
    }
    return apiSuccess(result);
  } catch (err) {
    console.error('Forecasting error for product ID:', product_id, err);
    return apiError('Internal Server Error', 500);
  }
}

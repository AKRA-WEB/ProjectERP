import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const categories = await query(
    `SELECT id, code, name_th, name_en 
     FROM product_categories 
     WHERE is_active = TRUE 
     ORDER BY code ASC`,
    []
  );

  return apiSuccess(categories);
}

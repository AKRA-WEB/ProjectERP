import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import pool from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/types';

const querySchema = z.object({
  customer_id: z.string().uuid(),
  product_id: z.string().uuid(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['admin', 'manager', 'staff']);
  } catch {
    return apiError('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    customer_id: searchParams.get('customer_id'),
    product_id: searchParams.get('product_id'),
  });

  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const { customer_id, product_id } = parsed.data;

  try {
    const { rows: [history] } = await pool.query<{
      unit_price: string;
      invoice_no: string;
      sold_at: string;
    }>(`
      SELECT do_li.unit_price, si.si_number AS invoice_no, si.created_at AS sold_at
        FROM sales_invoices si
        JOIN delivery_orders do_ ON do_.id = si.delivery_order_id
        JOIN do_line_items do_li ON do_li.do_id = do_.id
       WHERE si.customer_id = $1
         AND do_li.product_id = $2
         AND si.status IN ('issued'::si_status, 'paid'::si_status)
         AND si.created_at >= NOW() - INTERVAL '365 days'
       ORDER BY si.created_at DESC
       LIMIT 1
    `, [customer_id, product_id]);

    if (!history) {
      return apiSuccess({ history: null });
    }

    return apiSuccess({
      history: {
        unit_price: Number(history.unit_price),
        invoice_no: history.invoice_no,
        sold_at: history.sold_at,
      }
    });
  } catch (error) {
    console.error('Failed to fetch POS customer price history:', error);
    return apiError('Internal Server Error', 500);
  }
}

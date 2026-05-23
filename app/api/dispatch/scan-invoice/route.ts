import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { queryOne, query } from '@/lib/db/client';
import { verifyInvoiceBarcode } from '@/lib/invoice/versioning';
import type { SessionUser } from '@/lib/authz';
import { z } from 'zod';

const ScanSchema = z.object({
  barcode: z.string(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  if (!['admin', 'manager', 'staff'].includes(u.role)) {
    return apiError('Forbidden', 403);
  }

  const body = await req.json().catch(() => null);
  const result = ScanSchema.safeParse(body);
  if (!result.success) return apiError('Invalid request body', 400);
  const { barcode } = result.data;

  // 1. Verify barcode
  const v = await verifyInvoiceBarcode(barcode);
  if (!v) {
    // Check if it's a stale barcode
    const ivRes = await queryOne<{ invoice_id: string; version_no: number }>(
      `SELECT invoice_id, version_no FROM invoice_versions WHERE barcode = $1`,
      [barcode]
    );
    
    if (ivRes) {
      const siRes = await queryOne<{ current_barcode: string }>(
        `SELECT current_barcode FROM sales_invoices WHERE id = $1`,
        [ivRes.invoice_id]
      );
      return apiError('Stale barcode', 410, { 
        code: 'STALE_BARCODE', 
        current_barcode: siRes?.current_barcode 
      });
    }
    
    return apiError('Invalid barcode', 404);
  }

  const { invoice_id } = v;

  // 2. Create dispatch session
  const dsRes = await queryOne<{ id: string }>(
    `INSERT INTO dispatch_sessions (invoice_id, gate_user_id) VALUES ($1, $2) RETURNING id`,
    [invoice_id, u.id]
  );

  // 3. Get expected lines
  const lines = await query(
    `SELECT dli.product_id, dli.qty_to_deliver as expected_qty, p.name_th, p.sku
     FROM sales_invoices si
     JOIN delivery_orders do ON do.id = si.delivery_order_id
     JOIN do_line_items dli ON dli.do_id = do.id
     JOIN products p ON p.id = dli.product_id
     WHERE si.id = $1`,
    [invoice_id]
  );

  return apiSuccess({ 
    session_id: dsRes?.id, 
    lines 
  });
}

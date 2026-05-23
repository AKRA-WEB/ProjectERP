import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  if (!['admin', 'manager'].includes(u.role)) {
    return apiError('Forbidden', 403);
  }

  const logs = await query(
    `SELECT l.*, p.name_th as product_name, p.sku, u.name_en as gate_user_name, ds.si_number
     FROM dispatch_check_log l
     JOIN products p ON p.id = l.product_id
     JOIN users u ON u.id = l.gate_user_id
     JOIN dispatch_sessions dss ON dss.id = l.session_id
     JOIN sales_invoices ds ON ds.id = dss.invoice_id
     ORDER BY l.scanned_at DESC
     LIMIT 100`
  );

  return apiSuccess(logs);
}

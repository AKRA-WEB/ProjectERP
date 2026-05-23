import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertPermission } from '@/lib/authz';
import { query } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertPermission(u, 'si:view');
  } catch {
    return apiError('Forbidden', 403);
  }

  // Get the latest version's changes
  const versions = await query<{ version_no: number; change_summary: { changes?: { product_id: string; new_qty?: number; old_qty?: number; new_price?: number; old_price?: number }[] }; created_at: string }>(
    `SELECT version_no, change_summary, created_at FROM invoice_versions 
     WHERE invoice_id = $1 
     ORDER BY version_no DESC 
     LIMIT 1`,
    [id]
  );

  if (versions.length === 0) return apiError('No versions found', 404);

  const latest = versions[0];
  const changes = latest.change_summary.changes || [];

  const delta_lines = changes.map((c) => ({
    product_id: c.product_id,
    change_type: 'changed',
    qty_delta: (c.new_qty || 0) - (c.old_qty || 0),
    price_delta: (c.new_price || 0) - (c.old_price || 0)
  }));

  return apiSuccess({ 
    version_no: latest.version_no,
    created_at: latest.created_at,
    delta_lines 
  });
}

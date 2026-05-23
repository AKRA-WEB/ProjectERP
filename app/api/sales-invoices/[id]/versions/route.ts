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

  const versions = await query(
    `SELECT iv.*, u.name_en as created_by_name
     FROM invoice_versions iv
     JOIN users u ON u.id = iv.created_by
     WHERE iv.invoice_id = $1 
     ORDER BY iv.version_no DESC`,
    [id]
  );

  return apiSuccess({ versions });
}

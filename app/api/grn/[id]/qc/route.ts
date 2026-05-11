import { auth } from '@/auth';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { query, queryOne } from '@/lib/db/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const schema = z.object({
  qc_notes: z.string().optional(),
  lines: z.array(z.object({
    id: z.string().uuid(),
    qty_accepted: z.number().nonnegative(),
    qty_rejected: z.number().nonnegative(),
    qc_status: z.enum(['pass', 'fail', 'partial']),
    qc_notes: z.string().optional(),
  })).min(1),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { id } = await params;
  const grn = await queryOne<{ status: string }>('SELECT status FROM goods_receipt_notes WHERE id = $1', [id]);
  if (!grn) return apiError('GRN not found', 404);
  if (grn.status !== 'received') return apiError('GRN must be in received status for QC', 409);

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const lineIds = parsed.data.lines.map((l) => l.id);
  const existingLines = await query<{ id: string; qty_received: string }>(
    'SELECT id, qty_received FROM grn_line_items WHERE grn_id = $1 AND id = ANY($2::uuid[])',
    [id, lineIds]
  );
  const lineMap = new Map(existingLines.map((l) => [l.id, l]));

  for (const line of parsed.data.lines) {
    const existing = lineMap.get(line.id);
    if (!existing) return apiError(`Line ${line.id} not found`, 422);
    if (line.qty_accepted + line.qty_rejected > Number(existing.qty_received)) {
      return apiError(
        `Line ${line.id}: qty_accepted (${line.qty_accepted}) + qty_rejected (${line.qty_rejected}) exceeds qty_received (${existing.qty_received})`,
        422
      );
    }
  }

  for (const line of parsed.data.lines) {
    await queryOne(
      `UPDATE grn_line_items SET qty_accepted = $1, qty_rejected = $2, qc_status = $3, qc_notes = $4 WHERE id = $5 AND grn_id = $6`,
      [line.qty_accepted, line.qty_rejected, line.qc_status, line.qc_notes ?? null, line.id, id]
    );
  }

  const allPassed = parsed.data.lines.every((l) => l.qc_status === 'pass');
  const anyFailed = parsed.data.lines.some((l) => l.qc_status === 'fail');
  const newStatus = anyFailed && !allPassed ? 'qc_failed' : 'qc_passed';

  await queryOne(
    `UPDATE goods_receipt_notes SET status = $1, qc_reviewed_by = $2, qc_reviewed_at = NOW(), qc_notes = $3 WHERE id = $4`,
    [newStatus, u.id, parsed.data.qc_notes ?? null, id]
  );

  return apiSuccess({ id, status: newStatus });
}

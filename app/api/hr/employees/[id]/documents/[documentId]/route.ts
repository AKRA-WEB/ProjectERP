import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import pool from '@/lib/db/client';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { z } from 'zod';
import { assertRole, type SessionUser } from '@/lib/authz';
import { validateDocReview } from '@/lib/hr/employee-documents';
import { isEmployeeInScope } from '@/lib/hr/employee-profile-access';

const ReviewSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('verify'), notes: z.string().nullable().optional() }),
  z.object({ action: z.literal('reject'), rejected_reason: z.string().min(1) }),
]);

const UpdateSchema = z.object({
  doc_type: z.string().min(1).max(50).optional(),
  filename: z.string().min(1).max(500).optional(),
  storage_url: z.string().min(1).max(1000).optional(),
  issued_date: z.string().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const PatchSchema = z.union([ReviewSchema, UpdateSchema]);

type Params = { params: Promise<{ id: string; documentId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
  const { id, documentId } = await params;

  // Manager: must be in scope for this employee
  if (u.role === 'manager') {
    const inScope = await isEmployeeInScope(u, id);
    if (!inScope) return apiError('Forbidden', 403);
  }

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const d = parsed.data;

  // Review actions
  if ('action' in d && (d.action === 'verify' || d.action === 'reject')) {
    try {
      validateDocReview(d.action, d as { rejected_reason?: string | null });
    } catch (e) {
      return apiError((e as Error).message, 400);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query(
        `SELECT id FROM employee_documents WHERE id = $1 AND employee_id = $2 FOR UPDATE`,
        [documentId, id]
      );
      if (!existing.rows[0]) {
        await client.query('ROLLBACK');
        return apiError('Document not found', 404);
      }

      if (d.action === 'verify') {
        await client.query(
          `UPDATE employee_documents
           SET status = 'verified', verified_by_user_id = $1, verified_at = NOW(), notes = COALESCE($2, notes)
           WHERE id = $3`,
          [u.id, (d as { notes?: string | null }).notes ?? null, documentId]
        );
      } else {
        await client.query(
          `UPDATE employee_documents
           SET status = 'rejected', verified_by_user_id = $1, verified_at = NOW(), rejected_reason = $2
           WHERE id = $3`,
          [u.id, (d as { rejected_reason: string }).rejected_reason, documentId]
        );
      }

      await client.query(
        `INSERT INTO hr_employee_audit_events (employee_id, actor_user_id, event_type, event_payload_json)
         VALUES ($1, $2, 'DOCUMENT_REVIEWED', $3)`,
        [id, u.id, JSON.stringify({ document_id: documentId, action: d.action })]
      );

      await client.query('COMMIT');
      return apiSuccess({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      return apiError('Failed to review document', 500);
    } finally {
      client.release();
    }
  }

  // Metadata update
  const md = d as {
    doc_type?: string; filename?: string; storage_url?: string;
    issued_date?: string | null; expiry_date?: string | null; notes?: string | null;
  };

  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  if (md.doc_type !== undefined) { sets.push(`doc_type = $${idx++}`); vals.push(md.doc_type); }
  if (md.filename !== undefined) { sets.push(`filename = $${idx++}`); vals.push(md.filename); }
  if (md.storage_url !== undefined) { sets.push(`storage_url = $${idx++}`); vals.push(md.storage_url); }
  if (md.issued_date !== undefined) { sets.push(`issued_date = $${idx++}`); vals.push(md.issued_date); }
  if (md.expiry_date !== undefined) { sets.push(`expiry_date = $${idx++}`); vals.push(md.expiry_date); }
  if (md.notes !== undefined) { sets.push(`notes = $${idx++}`); vals.push(md.notes); }

  if (sets.length === 0) return apiError('No fields to update', 400);

  const client2 = await pool.connect();
  try {
    await client2.query('BEGIN');

    // Lock row and capture actual before values for audit
    const beforeRow = await client2.query<{
      doc_type: string; filename: string; storage_url: string;
      issued_date: string | null; expiry_date: string | null; notes: string | null;
    }>(
      `SELECT doc_type, filename, storage_url, issued_date, expiry_date, notes
       FROM employee_documents WHERE id = $1 AND employee_id = $2 FOR UPDATE`,
      [documentId, id]
    );
    if (!beforeRow.rows[0]) {
      await client2.query('ROLLBACK');
      return apiError('Document not found', 404);
    }

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const row = beforeRow.rows[0];
    if (md.doc_type !== undefined) { before.doc_type = row.doc_type; after.doc_type = md.doc_type; }
    if (md.filename !== undefined) { before.filename = row.filename; after.filename = md.filename; }
    if (md.storage_url !== undefined) { before.storage_url = row.storage_url; after.storage_url = md.storage_url; }
    if (md.issued_date !== undefined) { before.issued_date = row.issued_date; after.issued_date = md.issued_date; }
    if (md.expiry_date !== undefined) { before.expiry_date = row.expiry_date; after.expiry_date = md.expiry_date; }
    if (md.notes !== undefined) { before.notes = row.notes; after.notes = md.notes; }

    vals.push(documentId, id);
    await client2.query(
      `UPDATE employee_documents SET ${sets.join(', ')} WHERE id = $${idx} AND employee_id = $${idx + 1}`,
      vals
    );

    await client2.query(
      `INSERT INTO hr_employee_audit_events (employee_id, actor_user_id, event_type, event_payload_json)
       VALUES ($1, $2, 'DOCUMENT_UPDATED', $3)`,
      [id, u.id, JSON.stringify({ document_id: documentId, before, after })]
    );
    await client2.query('COMMIT');
    return apiSuccess({ ok: true });
  } catch (err) {
    await client2.query('ROLLBACK');
    console.error(err);
    return apiError('Failed to update document', 500);
  } finally {
    client2.release();
  }
}

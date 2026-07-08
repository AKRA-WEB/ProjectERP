import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import pool from '@/lib/db/client';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { z } from 'zod';
import { type SessionUser } from '@/lib/authz';
import { isEmployeeInScope } from '@/lib/hr/employee-profile-access';

const DocSchema = z.object({
  doc_type: z.string().min(1).max(50),
  filename: z.string().min(1).max(500),
  storage_url: z.string().min(1).max(1000),
  issued_date: z.string().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  const { id } = await params;

  const inScope = await isEmployeeInScope(u, id);
  if (!inScope) return apiError('Forbidden', 403);

  const client = await pool.connect();
  try {
    const rows = await client.query(
      `SELECT id, employee_id, doc_type, filename, storage_url, issued_date, expiry_date,
              status, uploaded_by_user_id, verified_by_user_id, verified_at, rejected_reason, notes, created_at
       FROM employee_documents WHERE employee_id = $1 ORDER BY created_at DESC`,
      [id]
    );
    return apiSuccess(rows.rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  const { id } = await params;

  // Staff can upload own; managers/admin can upload for any in-scope employee
  if (u.role === 'staff' && u.id !== id) return apiError('Forbidden', 403);
  if (u.role === 'manager') {
    const inScope = await isEmployeeInScope(u, id);
    if (!inScope) return apiError('Forbidden', 403);
  }

  const body = await req.json();
  const parsed = DocSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const d = parsed.data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const docRow = await client.query<{ id: string }>(
      `INSERT INTO employee_documents
         (employee_id, doc_type, filename, storage_url, issued_date, expiry_date, notes, uploaded_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [id, d.doc_type, d.filename, d.storage_url,
       d.issued_date ?? null, d.expiry_date ?? null, d.notes ?? null, u.id]
    );

    await client.query(
      `INSERT INTO hr_employee_audit_events (employee_id, actor_user_id, event_type, event_payload_json)
       VALUES ($1, $2, 'DOCUMENT_ADDED', $3)`,
      [id, u.id, JSON.stringify({ document_id: docRow.rows[0].id, doc_type: d.doc_type, filename: d.filename })]
    );

    await client.query('COMMIT');
    return apiSuccess({ id: docRow.rows[0].id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return apiError('Failed to upload document', 500);
  } finally {
    client.release();
  }
}

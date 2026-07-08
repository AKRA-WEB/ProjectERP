import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import pool, { query } from '@/lib/db/client';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { z } from 'zod';
import { assertRole, type SessionUser } from '@/lib/authz';
import { isEmployeeInScope } from '@/lib/hr/employee-profile-access';

const ContactSchema = z.object({
  contact_name: z.string().min(1).max(255),
  relationship: z.string().min(1).max(100),
  phone: z.string().min(1).max(50),
  alt_phone: z.string().max(50).nullable().optional(),
  address: z.string().nullable().optional(),
  is_primary: z.boolean().optional().default(false),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  const { id } = await params;

  const inScope = await isEmployeeInScope(u, id);
  if (!inScope) return apiError('Forbidden', 403);

  const rows = await query(
    `SELECT id, employee_id, contact_name, relationship, phone, alt_phone, address, is_primary, created_at, updated_at
     FROM employee_emergency_contacts WHERE employee_id = $1 ORDER BY is_primary DESC, created_at ASC`,
    [id]
  );
  return apiSuccess(rows);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
  const { id } = await params;

  const inScope = await isEmployeeInScope(u, id);
  if (!inScope) return apiError('Forbidden', 403);

  const body = await req.json();
  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const d = parsed.data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (d.is_primary) {
      await client.query(
        `UPDATE employee_emergency_contacts SET is_primary = FALSE WHERE employee_id = $1`,
        [id]
      );
    }

    const result = await client.query<{ id: string }>(
      `INSERT INTO employee_emergency_contacts
         (employee_id, contact_name, relationship, phone, alt_phone, address, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [id, d.contact_name, d.relationship, d.phone, d.alt_phone ?? null, d.address ?? null, d.is_primary]
    );

    await client.query(
      `INSERT INTO hr_employee_audit_events (employee_id, actor_user_id, event_type, event_payload_json)
       VALUES ($1, $2, 'EMERGENCY_CONTACT_ADDED', $3)`,
      [id, u.id, JSON.stringify({ contact_id: result.rows[0].id, contact_name: d.contact_name })]
    );

    await client.query('COMMIT');
    return apiSuccess({ id: result.rows[0].id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return apiError('Failed to create emergency contact', 500);
  } finally {
    client.release();
  }
}

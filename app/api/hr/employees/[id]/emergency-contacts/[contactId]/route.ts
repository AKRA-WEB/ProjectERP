import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import pool from '@/lib/db/client';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { z } from 'zod';
import { assertRole, type SessionUser } from '@/lib/authz';
import { isEmployeeInScope } from '@/lib/hr/employee-profile-access';

const ContactUpdateSchema = z.object({
  contact_name: z.string().min(1).max(255).optional(),
  relationship: z.string().min(1).max(100).optional(),
  phone: z.string().min(1).max(50).optional(),
  alt_phone: z.string().max(50).nullable().optional(),
  address: z.string().nullable().optional(),
  is_primary: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string; contactId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
  const { id, contactId } = await params;

  if (u.role === 'manager') {
    const inScope = await isEmployeeInScope(u, id);
    if (!inScope) return apiError('Forbidden', 403);
  }

  const body = await req.json();
  const parsed = ContactUpdateSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const d = parsed.data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT id FROM employee_emergency_contacts WHERE id = $1 AND employee_id = $2`,
      [contactId, id]
    );
    if (!existing.rows[0]) {
      await client.query('ROLLBACK');
      return apiError('Contact not found', 404);
    }

    if (d.is_primary) {
      await client.query(
        `UPDATE employee_emergency_contacts SET is_primary = FALSE WHERE employee_id = $1 AND id != $2`,
        [id, contactId]
      );
    }

    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (d.contact_name !== undefined) { sets.push(`contact_name = $${idx++}`); vals.push(d.contact_name); }
    if (d.relationship !== undefined) { sets.push(`relationship = $${idx++}`); vals.push(d.relationship); }
    if (d.phone !== undefined) { sets.push(`phone = $${idx++}`); vals.push(d.phone); }
    if (d.alt_phone !== undefined) { sets.push(`alt_phone = $${idx++}`); vals.push(d.alt_phone); }
    if (d.address !== undefined) { sets.push(`address = $${idx++}`); vals.push(d.address); }
    if (d.is_primary !== undefined) { sets.push(`is_primary = $${idx++}`); vals.push(d.is_primary); }

    if (sets.length > 0) {
      vals.push(contactId);
      await client.query(
        `UPDATE employee_emergency_contacts SET ${sets.join(', ')} WHERE id = $${idx}`,
        vals
      );
    }

    await client.query(
      `INSERT INTO hr_employee_audit_events (employee_id, actor_user_id, event_type, event_payload_json)
       VALUES ($1, $2, 'EMERGENCY_CONTACT_UPDATED', $3)`,
      [id, u.id, JSON.stringify({ contact_id: contactId })]
    );

    await client.query('COMMIT');
    return apiSuccess({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return apiError('Failed to update contact', 500);
  } finally {
    client.release();
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
  const { id, contactId } = await params;

  if (u.role === 'manager') {
    const inScope = await isEmployeeInScope(u, id);
    if (!inScope) return apiError('Forbidden', 403);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const del = await client.query(
      `DELETE FROM employee_emergency_contacts WHERE id = $1 AND employee_id = $2 RETURNING id`,
      [contactId, id]
    );
    if (!del.rows[0]) {
      await client.query('ROLLBACK');
      return apiError('Contact not found', 404);
    }

    await client.query(
      `INSERT INTO hr_employee_audit_events (employee_id, actor_user_id, event_type, event_payload_json)
       VALUES ($1, $2, 'EMERGENCY_CONTACT_DELETED', $3)`,
      [id, u.id, JSON.stringify({ contact_id: contactId })]
    );

    await client.query('COMMIT');
    return apiSuccess({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return apiError('Failed to delete contact', 500);
  } finally {
    client.release();
  }
}

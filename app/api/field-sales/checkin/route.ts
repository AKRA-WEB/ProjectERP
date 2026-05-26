import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { SessionUser, FieldSalesCheckin } from '@/types';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';
import { queryOne } from '@/lib/db/client';
import pool from '@/lib/db/client';
import { z } from 'zod';

const CheckinSchema = z.object({
  customer_id: z.string().uuid(),
  gps_lat: z.number().min(-90).max(90),
  gps_lng: z.number().min(-180).max(180),
  accuracy_m: z.number().int().nonnegative(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    const body = await req.json();
    const parsed = CheckinSchema.safeParse(body);
    if (!parsed.success) {
      return apiValidationError(parsed.error);
    }

    const { customer_id, gps_lat, gps_lng, accuracy_m } = parsed.data;

    // Verify customer exists
    const customerExists = await queryOne(
      `SELECT id FROM customers WHERE id = $1`,
      [customer_id]
    );
    if (!customerExists) {
      return apiError('Customer not found', 404);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Auto checkout of any existing active checkins for this agent
      await client.query(
        `UPDATE field_sales_checkins
         SET ended_at = NOW()
         WHERE agent_user_id = $1 AND ended_at IS NULL`,
        [u.id]
      );

      // 2. Insert new check-in
      const checkinRes = await client.query<FieldSalesCheckin>(
        `INSERT INTO field_sales_checkins (agent_user_id, customer_id, gps_lat, gps_lng, accuracy_m)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [u.id, customer_id, gps_lat, gps_lng, accuracy_m]
      );

      await client.query('COMMIT');
      return apiSuccess(checkinRes.rows[0], 201);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Field sales check-in error:', err);
    return apiError('Failed to check in', 500);
  }
}

export async function GET() {
  const session = await auth();
  if (!session) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    const active = await queryOne<FieldSalesCheckin>(
      `SELECT c.*, cust.code AS customer_code, cust.name_th AS customer_name_th, cust.name_en AS customer_name_en
       FROM field_sales_checkins c
       JOIN customers cust ON c.customer_id = cust.id
       WHERE c.agent_user_id = $1 AND c.ended_at IS NULL
       LIMIT 1`,
      [u.id]
    );

    return apiSuccess(active);
  } catch (err) {
    console.error('Failed to get active check-in:', err);
    return apiError('Failed to get active check-in', 500);
  }
}

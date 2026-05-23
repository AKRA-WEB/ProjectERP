import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import pool from '@/lib/db/client';
import { consumeOverrideToken } from '@/lib/auth/override-pin';
import type { SessionUser } from '@/lib/authz';
import { z } from 'zod';
import * as jose from 'jose';

const ScanLotSchema = z.object({
  line_id: z.string().uuid(),
  lot_id: z.string().uuid(),
  override_token: z.string().optional(),
});

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  if (!['admin', 'manager', 'staff'].includes(u.role)) {
    return apiError('Forbidden', 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid JSON', 400);
  const result = ScanLotSchema.safeParse(body);
  if (!result.success) return apiError('Invalid request body', 400);
  const { line_id, lot_id, override_token } = result.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get info
    const lineRes = await client.query(
      `SELECT pll.product_id, pll.lot_id AS suggested_lot_id, 
              l.expiry_date AS scanned_expiry, sl.expiry_date AS suggested_expiry 
       FROM pick_list_lines pll 
       JOIN lots l ON l.id = $1
       LEFT JOIN lots sl ON sl.id = pll.lot_id 
       WHERE pll.id = $2 AND pll.pick_list_id = $3 FOR UPDATE`,
      [lot_id, line_id, id]
    );
    if (lineRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return apiError('Pick line not found', 404);
    }
    const info = lineRes.rows[0];

    // 2. FEFO Check
    const suggestedExpiry = info.suggested_expiry ? new Date(info.suggested_expiry) : null;
    const scannedExpiry = info.scanned_expiry ? new Date(info.scanned_expiry) : null;

    let isViolation = false;
    // Violation if suggested exists AND (scanned has no expiry OR scanned expiry is later than suggested)
    if (suggestedExpiry && (!scannedExpiry || scannedExpiry > suggestedExpiry)) {
      isViolation = true;
    }

    if (isViolation && !override_token) {
      await client.query('ROLLBACK');
      return apiError('FEFO violation', 409, { 
        code: 'FEFO_VIOLATION', 
        earliest_lot_id: info.suggested_lot_id, 
        earliest_expiry: info.suggested_expiry 
      });
    }

    // 3. Handle Override
    let jti = null;
    if (isViolation && override_token) {
      try {
        await consumeOverrideToken(override_token, 'fefo_violation', {
          user_id: u.id,
          target_table: 'pick_list_lines',
          target_id: line_id,
          original_value: { lot_id: info.suggested_lot_id, expiry: info.suggested_expiry },
          override_value: { lot_id: lot_id, expiry: info.scanned_expiry },
          reason_code: 'fefo_override'
        });
        const payload = jose.decodeJwt(override_token);
        jti = payload.jti;
      } catch (err: unknown) {
        await client.query('ROLLBACK');
        const e = err as { message?: string; status?: number };
        return apiError(e.message || 'Override failed', e.status || 401);
      }
    }

    // 4. Update line
    await client.query(
      `UPDATE pick_list_lines SET lot_id = $1, fefo_override_jti = $2 WHERE id = $3`,
      [lot_id, jti, line_id]
    );

    await client.query('COMMIT');
    return apiSuccess({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Scan lot error:', err);
    return apiError('Failed to process scan', 500);
  } finally {
    client.release();
  }
}

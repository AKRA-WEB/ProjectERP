import bcrypt from 'bcryptjs';
import * as jose from 'jose';
import pool from '@/lib/db/client';
import { BCRYPT_ROUNDS } from '@/lib/constants';

export async function setOverridePin(userId: string, pin: string): Promise<void> {
  const hash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
  await pool.query('UPDATE users SET override_pin_hash = $1 WHERE id = $2', [hash, userId]);
}

export async function verifyOverridePin(userId: string, pin: string, action: string): Promise<{ token: string; jti: string }> {
  // 1. Lockout check: 5 wrong attempts within 10 minutes
  const lockoutQuery = `
    SELECT COUNT(*)::int AS failed_count FROM override_pin_attempts
    WHERE user_id = $1 AND success = false AND attempted_at > NOW() - INTERVAL '10 minutes'
    AND attempted_at > (
      SELECT COALESCE(MAX(attempted_at), '1970-01-01'::timestamptz)
      FROM override_pin_attempts
      WHERE user_id = $1 AND success = true
    )
  `;
  const lockoutRes = await pool.query(lockoutQuery, [userId]);
  const failedCount = lockoutRes.rows[0]?.failed_count ?? 0;
  if (failedCount >= 5) {
    throw Object.assign(new Error('Too many wrong attempts. Locked out.'), { status: 429 });
  }

  // 2. Fetch the user's pin hash
  const userQuery = 'SELECT id, override_pin_hash, role FROM users WHERE id = $1';
  const userRes = await pool.query(userQuery, [userId]);
  const user = userRes.rows[0];

  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  if (!user.override_pin_hash) {
    // Record failed attempt
    await pool.query('INSERT INTO override_pin_attempts (user_id, success) VALUES ($1, false)', [userId]);
    throw Object.assign(new Error('Override PIN is not set for this user'), { status: 400 });
  }

  // 3. Verify PIN
  const isValid = await bcrypt.compare(pin, user.override_pin_hash);

  if (!isValid) {
    // Record failed attempt
    await pool.query('INSERT INTO override_pin_attempts (user_id, success) VALUES ($1, false)', [userId]);
    throw Object.assign(new Error('Wrong PIN'), { status: 401 });
  }

  // Record successful attempt
  await pool.query('INSERT INTO override_pin_attempts (user_id, success) VALUES ($1, true)', [userId]);

  // 4. Generate short-lived signed JWT using jose
  const secretKey = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'fallback-secret-for-dev-only-change-me');
  const jti = crypto.randomUUID();
  const token = await new jose.SignJWT({ action })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(secretKey);

  return { token, jti };
}

export async function consumeOverrideToken(
  token: string,
  expectedAction: string,
  ctx: {
    target_table: string;
    target_id: string;
    reason_code?: string;
    original_value?: unknown;
    override_value?: unknown;
    user_id: string;
  }
): Promise<void> {
  const secretKey = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'fallback-secret-for-dev-only-change-me');
  let payload: jose.JWTPayload;
  try {
    const res = await jose.jwtVerify(token, secretKey);
    payload = res.payload;
  } catch {
    throw Object.assign(new Error('Invalid or expired override token'), { status: 401 });
  }

  // Verify claims
  if (payload.action !== expectedAction) {
    throw Object.assign(new Error('Token action mismatch'), { status: 403 });
  }
  if (payload.sub !== ctx.user_id) {
    throw Object.assign(new Error('Token subject (user) mismatch'), { status: 403 });
  }
  const jti = payload.jti;
  if (!jti) {
    throw Object.assign(new Error('Token lacks unique identifier'), { status: 400 });
  }

  // Insert to override_audit to consume the token and log.
  // The UNIQUE constraint on jti guarantees single-use.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO override_audit (
        user_id, action, target_table, target_id, reason_code, original_value, override_value, jti
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        ctx.user_id,
        expectedAction,
        ctx.target_table,
        ctx.target_id,
        ctx.reason_code ?? null,
        ctx.original_value ? JSON.stringify(ctx.original_value) : null,
        ctx.override_value ? JSON.stringify(ctx.override_value) : null,
        jti
      ]
    );
    await client.query('COMMIT');
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    const dbErr = err as { code?: string };
    if (dbErr.code === '23505') { // unique_violation in PostgreSQL
      throw Object.assign(new Error('Override token has already been used'), { status: 409 });
    }
    throw err;
  } finally {
    client.release();
  }
}

---
track: manager-override-pin
phase: V2.0-P1
sequence: 4
status: planned
owner: Chen
created: 2026-05-23
depends_on: []
estimate: M
assigned_to: [Paku, Puka]
tags: [v2-orion, auth, override, audit]
---

# Manager Override PIN

## Goal
Add a reusable in-app supervisor authorization mechanism. A manager or admin sets a per-user 4-6 digit PIN; any sensitive action that violates a rule (below min price, FEFO violation, exec credit release, repack with loss) requests this PIN inline and logs the override.

## Scope IN
- New column `users.override_pin_hash` (bcrypt-hashed; nullable). Only `manager` and `admin` may set.
- New table `override_audit(id, user_id, action TEXT, target_table TEXT, target_id BIGINT, reason_code TEXT, original_value JSONB, override_value JSONB, created_at)`.
- Endpoint `POST /api/auth/verify-override-pin` returning a short-lived (60-second) signed JWT scoped to the requesting user + action.
- React hook `useOverridePin()` and `<OverridePinModal>` component in `components/auth/`.
- Helper `lib/auth/consumeOverrideToken(token, expectedAction)` server-side that verifies the JWT and writes to `override_audit`.

## Scope OUT
- Biometric override / hardware tokens. Future revision.
- Per-action PIN policies (e.g. different PIN for credit vs FEFO). Single PIN per user in V2.0.

## Acceptance Criteria
1. Only users with role `manager` or `admin` can set/change `override_pin_hash`. Staff attempts return 403.
2. Verify endpoint accepts the correct PIN, rejects after 5 wrong attempts within 10 minutes, and rate-limits per user.
3. Issued override token is single-use, expires in 60 seconds, and is bound to the verifying user.
4. Every successful consumption writes a row to `override_audit` with the exact `target_table`/`target_id`/`reason_code`/`original_value`/`override_value`.
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `044_manager_override_pin.sql` — add `users.override_pin_hash`, create `override_audit` table with appropriate indexes.

## API routes
- New: `POST /api/auth/verify-override-pin`.
- New: `PATCH /api/admin/users/[id]/override-pin` (set/reset PIN).
- New: `GET /api/admin/override-audit` (filterable; admin + auditor only).

## UI screens
- New: PIN set/reset section in user-profile / admin user edit.
- New: `<OverridePinModal>` reusable across tracks 5, 6, 11, 14.
- New: `app/admin/audit/overrides/page.tsx` — read-only audit log viewer.

## Test plan
- Manual: set PIN as manager, verify staff cannot set PIN. Trigger a wrong-PIN flow 5x, confirm lockout.
- Confirm consumed token cannot be replayed.
- Lint + tsc.

## Risks
- Token replay if `lib/auth/consumeOverrideToken` is not strictly single-use — must persist a jti to a short-TTL store.
- Bcrypt cost factor must match existing `users.password_hash` cost to keep verification time predictable.

## Verified Facts (pre-plan)
- `users.password_hash VARCHAR(255)` exists in `migrations/002_core_tables.sql:17`. The override PIN will mirror this storage approach using bcrypt at the same cost factor (check existing usage with `Grep bcrypt.hash`).
- `users.role` enum is `('admin','manager','staff'[,'auditor'])` once track 1 lands. The role gate must be `manager` OR `admin`.
- `assertRole(user, ['manager','admin'])` lives in `lib/authz.ts:27`.
- `NEXTAUTH_SECRET` env var is already required — use it to sign JWTs (`jsonwebtoken`).

---

## Tasks

### T1 — Migration `044_manager_override_pin.sql`
**File:** `migrations/044_manager_override_pin.sql` (new)
**Operation:** add migration

**Details:**
- Wrap in `BEGIN; ... COMMIT;`:
  1. `ALTER TABLE users ADD COLUMN IF NOT EXISTS override_pin_hash VARCHAR(255);`
  2. `CREATE TABLE IF NOT EXISTS override_audit ( id BIGSERIAL PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id), action VARCHAR(100) NOT NULL, target_table VARCHAR(100) NOT NULL, target_id UUID NOT NULL, reason_code VARCHAR(50), original_value JSONB, override_value JSONB, jti VARCHAR(100) UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() );`
  3. `CREATE INDEX IF NOT EXISTS idx_override_audit_user ON override_audit(user_id, created_at DESC);`
  4. `CREATE INDEX IF NOT EXISTS idx_override_audit_target ON override_audit(target_table, target_id);`
  5. `CREATE TABLE IF NOT EXISTS override_pin_attempts ( user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), success BOOLEAN NOT NULL );`
  6. `CREATE INDEX IF NOT EXISTS idx_override_attempts_user_time ON override_pin_attempts(user_id, attempted_at DESC);`

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT`.
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: none.
- Response shape: N/A.

- [ ] T1 complete

### T2 — `lib/auth/override-pin.ts`
**File:** `lib/auth/override-pin.ts` (new)
**Operation:** create

**Details:**
- Export:
  ```ts
  export async function setOverridePin(userId: string, pin: string): Promise<void>;
  export async function verifyOverridePin(userId: string, pin: string, action: string): Promise<{ token: string; jti: string }>; // throws on wrong PIN or lockout
  export async function consumeOverrideToken(token: string, expectedAction: string, ctx: { target_table: string; target_id: string; reason_code?: string; original_value?: unknown; override_value?: unknown; user_id: string }): Promise<void>; // throws on invalid/replay; writes override_audit row using the jti claim (UNIQUE constraint catches replay)
  ```
- Bcrypt: `bcrypt.hash(pin, 10)` — cost 10 (match the project's existing usage; verify by `Grep bcrypt`).
- JWT: sign with `process.env.NEXTAUTH_SECRET`, claims `{ sub: userId, action, jti: crypto.randomUUID() }`, `expiresIn: '60s'`.
- Lockout: 5 wrong attempts within 10 minutes → throw `Object.assign(new Error('Locked'), { status: 429 })`.

**Quality Gate:**
- Transaction boundary: N/A on `verify` (read + insert one row to `override_pin_attempts`); N/A on `consume` (single INSERT to `override_audit`).
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: each verify inserts into `override_pin_attempts`; each consume inserts into `override_audit`.
- Response shape: helper return types as above.

- [ ] T2 complete

### T3 — `POST /api/auth/verify-override-pin`
**File:** `app/api/auth/verify-override-pin/route.ts` (new)
**Operation:** create

**Details:**
- Auth preamble.
- Zod: `{ pin: z.string().min(4).max(6), action: z.string() }`.
- Call `verifyOverridePin(u.id, pin, action)`.
- On lockout (status 429): `apiError('Too many wrong attempts', 429)`.
- On wrong PIN: `apiError('Wrong PIN', 401)`.
- On success: `apiSuccess({ token, expires_in: 60 })`.

**Quality Gate:**
- Transaction boundary: N/A (single insert via helper).
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: `override_pin_attempts` insert.
- Response shape: `apiSuccess({ token: string, expires_in: number })`.

- [ ] T3 complete

### T4 — `PATCH /api/admin/users/[id]/override-pin`
**File:** `app/api/admin/users/[id]/override-pin/route.ts` (new)
**Operation:** create

**Details:**
- Auth preamble; `assertRole(u, ['admin','manager'])`. Also assert that target user (path param `[id]`) has role `manager` OR `admin`; staff cannot have a PIN — return `apiError('Only managers/admins may have an override PIN', 403)`.
- Zod: `{ pin: z.string().regex(/^\d{4,6}$/) }`.
- Call `setOverridePin(targetUserId, pin)`.
- Return `apiSuccess({ ok: true })`.

**Quality Gate:**
- Transaction boundary: N/A (single UPDATE).
- Doc number generation: N/A.
- Parent→child inserts: N/A.
- Side effects: `users.override_pin_hash` updated.
- Response shape: `apiSuccess({ ok: true })`.

- [ ] T4 complete

### T5 — `GET /api/admin/override-audit`
**File:** `app/api/admin/override-audit/route.ts` (new)
**Operation:** create

**Details:**
- Auth; `assertRole(u, ['admin','auditor'])`.
- Query: paginated list with optional filters `user_id`, `action`, `target_table`, `from`, `to`.
- `apiSuccess({ data, total, page, limit })`.

**Quality Gate:** Response shape: `apiSuccess({ data: OverrideAuditRow[], total, page, limit })`. Others N/A.

- [ ] T5 complete

### T6 — React hook + modal
**File:** `hooks/useOverridePin.ts` (new) + `components/auth/OverridePinModal.tsx` (new)
**Operation:** create

**Details:**
- `useOverridePin()` returns `{ requestPin: (action: string) => Promise<string>, isOpen, close }`. On call, opens the modal and resolves with the issued token on success.
- `<OverridePinModal>` renders a 4-6 digit numeric input + reason-code dropdown. Submits to `/api/auth/verify-override-pin`.
- Components from `components/ui/index.ts` (Input, Button, Select, Modal/Dialog if present).

**Quality Gate:** N/A (UI).

- [ ] T6 complete

### T7 — Admin user-edit form: set/reset PIN button
**File:** locate the user-edit page via `Glob "app/admin/users/**/page.tsx"`; extend.
**Operation:** extend

**Details:**
- Show "Set/Reset PIN" button only if target user `role IN ('manager','admin')`.
- POST to `/api/admin/users/[id]/override-pin`.
- Display "Last set: <date>" if the column has a value.

**Quality Gate:** N/A (UI).

- [ ] T7 complete

### T8 — Audit log viewer page
**File:** `app/admin/audit/overrides/page.tsx` (new)
**Operation:** create

**Details:**
- `'use client'`. Read-only table fed by `/api/admin/override-audit`. Filters by user / action / date range. Pagination.

**Quality Gate:** N/A (UI).

- [ ] T8 complete

### T9 — Update `current-state.md` + `pitfalls.md`
**File:** `_notes/02_Agent_Memory/current-state.md` + `_notes/02_Agent_Memory/pitfalls.md`
**Operation:** extend

**Details:**
- DB facts: `users.override_pin_hash`, `override_audit(user_id, action, target_table, target_id, jti UNIQUE)`, `override_pin_attempts(user_id, attempted_at, success)`. Migration → 044.
- Pitfalls (append): "Override token replay — always rely on `override_audit.jti UNIQUE` constraint; never trust JWT expiry alone."

- [ ] T9 complete

## Definition of Done

- [ ] All tasks T1..T9 ticked
- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] Migration runs idempotently
- [ ] Manual smoke: set PIN as manager, attempt staff set PIN (403), wrong-PIN 5x → 429, consume token twice → second call rejected on `jti UNIQUE`
- [ ] `_notes/02_Agent_Memory/current-state.md` and `pitfalls.md` updated
- [ ] Status set to `Completed` in `conductor/index.md`

---
track: security-fixes
status: Verified
aliases: ["Plan — Security Fixes (Pre-Vercel Deployment)"]
owner: paku, puka
module: Security
updated: 2026-05-16
---

# Plan — Security Fixes (Pre-Vercel Deployment)

**Created:** 2026-05-15
**Status:** Active
**Priority:** Critical — pre-Vercel deployment blocker
**Auditor:** Meena (54 routes audited) → Chen (verified against real files)

---

## Audit Notes — False Positives Dismissed

Two reported findings verified as FALSE POSITIVES — do NOT touch:

- `app/api/admin/users/route.ts` — `assertRole(u, ['admin'])` already in every handler.
- `app/api/admin/warehouses/route.ts` — same. Already correct.

---

## Phase 1 — Critical: Missing Authorization Guards

- [x] **SEC-001** `app/api/hr/payroll-runs/[id]/route.ts`
  — PATCH has no `assertRole`. Staff can trigger payroll processing.
  Add after session/user block:
  ```typescript
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
  ```

- [x] **SEC-002** `app/api/hr/payroll-runs/route.ts`
  — POST has no `assertRole`. Staff can create payroll runs.
  Same fix as SEC-001 in POST handler.

- [x] **SEC-003** `app/api/bom/route.ts`
  — POST has no `assertRole`. Staff can create BOM records.
  Same fix in POST handler.

- [x] **SEC-004** `app/api/bom/[id]/route.ts`
  — PATCH and DELETE have no `assertRole`. Staff can modify/delete BOM.
  Add to both PATCH and DELETE handlers.

- [x] **SEC-005** `app/api/inbound-orders/[id]/route.ts`
  — PATCH `approve` action has no `assertRole`. Staff can approve inbound orders.
  Add to PATCH handler (guards all actions including approve).

- [x] **SEC-006a** `app/api/sales-orders/route.ts` — GET
  — No `buildWarehouseScopeClause`. Staff sees all warehouses' SOs.
  Apply `buildWarehouseScopeClause(u, 'so', idx)` on `so.warehouse_id`.
  Verify exact alias in existing query before patching.

- [x] **SEC-006b** `app/api/sales-orders/route.ts` — POST
  — No `assertRole`. Staff can create SOs.
  Add `assertRole(u, ['manager', 'admin'])` to POST handler.

- [x] **SEC-007** `app/api/pos/sessions/route.ts` — GET
  — No warehouse scope. Filters only by `opened_by_id = u.id`, not `warehouse_id`.
  Apply `buildWarehouseScopeClause(u, 'ps', idx)` on `ps.warehouse_id` (alias `ps` = `pos_sessions`).

- [x] **SEC-008** `app/api/pos/transactions/route.ts` — GET
  — Joins `pos_sessions ps` but no warehouse scope. Staff sees transactions from other warehouses.
  Apply `buildWarehouseScopeClause(u, 'ps', idx)` on `ps.warehouse_id`.

---

## Phase 2 — High: Incomplete Role Guards and Input Validation

- [x] **SEC-011** `app/api/hr/employees/[id]/route.ts`
  — PATCH no `assertRole`. Staff can update salary, department, employment status.
  Add `assertRole(u, ['manager', 'admin'])` before body parsing.

- [x] **SEC-012** `app/api/hr/leave-requests/[id]/route.ts`
  — PATCH `approve`/`reject` no `assertRole`. Staff can approve their own leave.
  Add `assertRole(u, ['manager', 'admin'])` to PATCH handler.

- [x] **SEC-013** `app/api/pos/shifts/route.ts`
  — POST no `assertRole`. Staff can create shift schedules.
  Add `assertRole(u, ['manager', 'admin'])` to POST handler.

- [x] **SEC-014** `app/api/hr/attendance/route.ts`
  — POST no role guard. `employee_id` taken from body with no ownership validation.
  **Important:** Before implementing, read the HR migration to confirm whether `employees.id` = `users.id` or separate entities. If `employees` has its own UUID separate from `users.id`, a lookup join is required.
  - If manager-only: add `assertRole(u, ['manager', 'admin'])`.
  - If staff can self-report: skip assertRole but add ownership check:
    ```typescript
    if (u.role === 'staff' && body.employee_id !== u.id) {
      return apiError('Forbidden', 403);
    }
    ```
  Document the decision in `decisions.md`.

- [x] **SEC-015** `next.config.ts`
  — No security headers. Add `headers()` export:
  ```typescript
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
  ```
  Do NOT add Content-Security-Policy — requires per-page audit, out of scope.

---

## Phase 3 — Medium + Performance

- [x] **SEC-016** `app/api/pos/members/[id]/route.ts`
  — DELETE no `assertRole`. Staff can delete loyalty members.
  Add `assertRole(u, ['manager', 'admin'])` to DELETE handler.

- [x] **SEC-017** `app/api/pos/held-carts/[id]/route.ts`
  — DELETE no ownership check. Cashier can delete another cashier's held bill.
  Schema confirmed: `pos_held_carts` has `cashier_id` column (verified in `migrations/018_pos.sql`).
  Before DELETE, fetch cart and check ownership:
  ```typescript
  const cart = await queryOne<{ cashier_id: string }>(
    'SELECT cashier_id FROM pos_held_carts WHERE id = $1',
    [params.id]
  );
  if (!cart) return apiError('Not found', 404);
  if (u.role === 'staff' && cart.cashier_id !== u.id) {
    return apiError('Forbidden', 403);
  }
  ```

- [x] **SEC-018** `app/api/inbound-orders/route.ts` — GET
  — No `buildWarehouseScopeClause`. Staff sees IOs for all warehouses.
  Apply `buildWarehouseScopeClause(u, 'io', idx)` on `io.warehouse_id`.
  Verify alias used in existing query.

- [x] **PERF-001** `app/api/hr/stats/route.ts`
  — 5 sequential `await queryOne(...)`. Wrap in `Promise.all`:
  ```typescript
  const [stat1, stat2, stat3, stat4, stat5] = await Promise.all([
    queryOne(...), queryOne(...), queryOne(...), queryOne(...), queryOne(...),
  ]);
  ```
  Use exact queries already present — do not change SQL, only parallelize.

- [x] **PERF-002** `app/api/purchase-orders/[id]/route.ts`
  — `lines` and `grns` sub-queries run sequentially. After PO header fetch (must be first), parallelize:
  ```typescript
  const [lines, grns] = await Promise.all([
    query<PurchaseOrderLine>('SELECT ... FROM po_lines WHERE po_id = $1', [id]),
    query<Grn>('SELECT ... FROM grns WHERE po_id = $1', [id]),
  ]);
  ```

- [x] **PERF-003** `app/api/pos/sessions/[id]/route.ts`
  — `transactions` and `summary` run sequentially. After session header fetch, parallelize:
  ```typescript
  const [transactions, summary] = await Promise.all([
    query<...>('SELECT ... FROM pos_transactions WHERE session_id = $1', [id]),
    queryOne<...>('SELECT SUM(...) FROM pos_transactions WHERE session_id = $1', [id]),
  ]);
  ```

---

## Acceptance Criteria

- [x] All SEC-001 through SEC-018 handlers have `assertRole` or `buildWarehouseScopeClause` applied as specified
- [x] `next.config.ts` returns 4 security headers — verified with `curl -I http://localhost:3000/`
- [x] SEC-017: staff DELETE on another cashier's cart returns 403
- [x] SEC-014: decision documented in `decisions.md` with implementation approach
- [x] PERF-001/002/003: no sequential awaits on independent queries remain
- [x] `npm run build` exits 0 with zero type errors
- [x] `npm run lint` passes with zero new errors
- [x] `app/api/admin/users/route.ts` and `app/api/admin/warehouses/route.ts` are NOT modified

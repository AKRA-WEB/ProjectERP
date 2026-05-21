# Rework Plan — Security & Vercel Performance
**Track:** security-performance-audit
**QA:** Meena (draft) · Chen (validated)
**Date:** 2026-05-14
**Ready for:** Gemini CLI

---

## Changes from Meena's Draft
| ID | Meena | Chen Decision | Reason |
|----|-------|---------------|--------|
| C-001 | Critical | **Confirmed** | `next.config.ts` empty, no `vercel.json` |
| C-002 | Critical | **Confirmed** | `assertRole` imported but never called in POST |
| C-003 | Critical | **Confirmed** | `assertRole` imported but never called in PATCH |
| C-004 | Critical | **Confirmed + Bonus Bug** | `assertRole` missing; `query` not imported in GET — runtime crash |
| C-005 | Critical | **Confirmed + Upgraded** | `assertRole` missing + SQL `$2` param collision in reject action — silent data corruption |
| H-001 | High | **Dismissed** | `buildWarehouseScopeClause(u, "ps.warehouse_id", idx)` correctly called in GET |
| H-002 | High | **Confirmed** | No `assertRole` on POST; any authenticated user can insert attendance for any employee_id |
| H-003 | High | **Confirmed** | Two sequential awaits for independent queries |
| H-004 | High | **Confirmed** | Three sequential awaits for independent queries |
| H-005 | High | **Confirmed** | `as any` cast at `middleware.ts:28` |
| M-001 | Medium | **Confirmed** | Pure reads wrapped in `pool.connect()` — unnecessary connection hold |
| M-002 | Medium | **Dismissed** | GET has `LIMIT $1 OFFSET $2` — pagination present |
| M-003 | Medium | **Dismissed** | GET has `LIMIT $1 OFFSET $2` — pagination present |
| M-004 | Medium | **Dismissed** | GET has `LIMIT $${idx} OFFSET $${idx+1}` — pagination present |
| M-005 | Medium | **Confirmed** | `poweredByHeader` not set |
| NEW-1 | — | **Critical (Chen-added)** | `payroll-runs/route.ts` GET uses `query` which is not imported — runtime crash |
| NEW-2 | — | **Critical (Chen-added)** | `leave-requests/[id]/route.ts` reject SQL param collision — data corruption |

---

## 🔴 Critical

- [x] **File:** `next.config.ts` — **Issue:** No HTTP security headers, no `poweredByHeader: false` (covers C-001 + M-005). **Fix:** Replace entire file with:

...

- [x] **File:** `app/api/hr/employees/route.ts` — **Issue (C-002):** POST has no `assertRole`. Staff can create employee records. **Fix:** In the POST handler, after the line `const u = session.user as unknown as SessionUser;`, add:
```typescript
try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
```
`assertRole` is already imported. `SessionUser` is already imported from `@/lib/authz`.

- [x] **File:** `app/api/hr/employees/[id]/route.ts` — **Issue (C-003):** PATCH has no `assertRole`. Staff can modify employee data including salary. **Fix:** In the PATCH handler, after `const u = session.user as unknown as SessionUser;`, add:
```typescript
try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
```

- [x] **File:** `app/api/hr/payroll-runs/route.ts` — **Issue (C-004 + NEW-1):** POST has no `assertRole`. GET crashes at runtime — `query` is used but not imported. **Fix:**
  1. Update import line to include `query`: change `import { pool, queryOne } from '@/lib/db/client'` → `import { pool, query, queryOne } from '@/lib/db/client'`
  2. In POST handler, after `const u = session.user as unknown as SessionUser;`, add:
  ```typescript
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
  ```

- [x] **File:** `app/api/hr/leave-requests/[id]/route.ts` — **Issue (C-005 + NEW-2):** Two bugs: (1) PATCH has no `assertRole` — staff can approve/reject any leave including their own. (2) The reject action SQL uses `$2` for both `rejection_reason` AND in the `WHERE id = $2` clause — params array has `[session.user.id, rejection_reason, id]` so `id` is `$3` but the WHERE says `$2`, causing silent data corruption. **Fix:**
  1. In PATCH handler, after `const u = session.user as unknown as SessionUser;`, add:
  ```typescript
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
  ```
  2. Find the reject action block and fix the SQL so `WHERE id = $3`:
  ```typescript
  if (action === 'reject') {
    const leave = await queryOne<{ id: string }>(
      `UPDATE leave_requests
       SET status = 'rejected', approved_by = $1, rejection_reason = $2, updated_at = NOW()
       WHERE id = $3 AND status = 'pending'
       RETURNING id`,
      [u.id, body.rejection_reason ?? null, id]
    );
    if (!leave) return apiError('Leave request not found or already processed', 404);
    return apiSuccess(leave);
  }
  ```

---

## 🟡 High

- [x] **File:** `app/api/hr/attendance/route.ts` — **Issue (H-002):** POST has no `assertRole`. Any authenticated user can record attendance for any `employee_id`. **Fix:** In POST handler, after `const u = session.user as unknown as SessionUser;`, add:
```typescript
try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
```

- [x] **File:** `app/api/grn/[id]/route.ts` — **Issue (H-003):** Sequential awaits for independent GRN header + lines. Read the file first to get exact column lists. **Fix:** Wrap in `Promise.all`:
```typescript
const [grn, lines] = await Promise.all([
  queryOne<GRNHeader>(`SELECT ... FROM goods_receipt_notes g ... WHERE g.id = $1`, [id]),
  query<GRNLine>(`SELECT ... FROM grn_line_items gl ... WHERE gl.grn_id = $1`, [id]),
]);
if (!grn) return apiError('GRN not found', 404);
return apiSuccess({ ...grn, lines });
```
**Important:** Preserve the exact column lists from the existing queries — do not simplify.

- [x] **File:** `app/api/purchase-orders/[id]/route.ts` — **Issue (H-004):** Three sequential awaits for PO header, lines, GRNs. Read the file first. **Fix:**
```typescript
const [po, lines, grns] = await Promise.all([
  queryOne<POHeader>(`SELECT po.id, ... FROM purchase_orders po ... WHERE po.id = $1`, [id]),
  query<POLine>(`SELECT pol.id, ... FROM po_line_items pol ... WHERE pol.po_id = $1`, [id]),
  query<GRNSummary>(`SELECT id, grn_number, status, received_at FROM goods_receipt_notes WHERE po_id = $1`, [id]),
]);
if (!po) return apiError('PO not found', 404);
return apiSuccess({ ...po, lines, grns });
```

- [x] **File:** `middleware.ts:26-30` — **Issue (H-005):** `(req.auth?.user as any).role` bypasses TypeScript strict mode. **Fix:** Replace the admin check block:
```typescript
if (isAppPage && pathname.startsWith('/app/admin')) {
  const u = req.auth?.user as unknown as { role?: string };
  if (u?.role !== 'admin') {
    return NextResponse.redirect(new URL('/app/menu', req.url));
  }
}
```

---

## 🔵 Medium

- [x] **File:** `app/api/hr/payroll-runs/[id]/route.ts` — **Issue (M-001):** GET wraps pure read queries in `pool.connect()`, holding a DB connection unnecessarily on Vercel serverless. **Fix:** Replace GET handler body — use direct `queryOne`/`query` calls without `pool.connect()`:
```typescript
const { id } = await params;

const run = await queryOne<{
  id: string; run_number: string; period_start: string; period_end: string;
  run_type: string; status: string; total_gross: number; total_net: number;
  total_employees: number; created_at: string;
}>(
  `SELECT id, run_number, period_start, period_end, run_type, status,
          total_gross, total_net, total_employees, created_at
   FROM payroll_runs WHERE id = $1`,
  [id]
);
if (!run) return apiError('Payroll run not found', 404);

const items = await query<{
  id: string; employee_id: string; employee_name: string;
  basic_salary: number; gross_salary: number; net_salary: number; status: string;
}>(
  `SELECT pi.id, pi.employee_id, e.name_th AS employee_name,
          pi.basic_salary, pi.gross_salary, pi.net_salary, pi.status
   FROM payroll_items pi
   JOIN employees e ON e.id = pi.employee_id
   WHERE pi.payroll_run_id = $1`,
  [id]
);

return apiSuccess({ ...run, items });
```
Update imports: add `query` and `queryOne`, remove `pool` if no longer used in this file.

---

## Verified Correct (Passed)

- **H-001** — `app/api/pos/sessions/route.ts` GET correctly calls `buildWarehouseScopeClause(u, "ps.warehouse_id", idx)`. Meena finding was false positive.
- **M-002** — `app/api/hr/leave-requests/route.ts` GET has `LIMIT $1 OFFSET $2`. False positive.
- **M-003** — `app/api/hr/attendance/route.ts` GET has `LIMIT $1 OFFSET $2`. False positive.
- **M-004** — `app/api/inventory/reorder/route.ts` GET has pagination. False positive.
- SQL injection — All routes use parameterized `$N` queries exclusively. No string interpolation.
- NEXT_PUBLIC_ secrets — No sensitive vars exposed to client bundle.
- Auth presence — Every route.ts calls `await auth()`.
- Raw `<img>` — Zero instances; all use Next.js `<Image>` or no images.
- Raw `<a href="/">` — Zero instances; all use Next.js `<Link>`.
- Heavy client libs — No xlsx/recharts/pdf in client pages.
- Module-level mutable state — No top-level `let` in route files.
- Stock ledger immutability — No UPDATE/DELETE on `stock_ledger`.

---

## QA Checklist for Billy (post-rework)

1. **C-001:** `curl -I http://localhost:3000` → response must include `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, must NOT include `X-Powered-By`
2. **C-002:** POST `/api/hr/employees` with staff-role session → must return `403 Forbidden`
3. **C-003:** PATCH `/api/hr/employees/:id` with staff-role session → must return `403 Forbidden`
4. **C-004:** GET `/api/hr/payroll-runs` → must not crash (check `query` import). POST with staff token → must return `403`
5. **C-005 (assertRole):** PATCH `/api/hr/leave-requests/:id` with staff token `{ action: "approve" }` → must return `403`
6. **C-005 (SQL bug):** PATCH with manager token `{ action: "reject", rejection_reason: "invalid" }` → response `id` must match the `:id` URL param
7. **NEW-2 regression:** Read `leave-requests/[id]/route.ts` → confirm `WHERE id = $3` in reject SQL
8. **H-002:** POST `/api/hr/attendance` with staff-role session → must return `403`
9. **H-003:** Read `grn/[id]/route.ts` after changes → confirm `Promise.all` pattern
10. **H-004:** Read `purchase-orders/[id]/route.ts` after changes → confirm `Promise.all` pattern
11. **H-005:** Read `middleware.ts` → confirm zero `as any` casts remain
12. **M-001:** Read `payroll-runs/[id]/route.ts` → confirm no `pool.connect()` in GET

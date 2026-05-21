---
batch: 8
date: 2026-05-21
auditor: Billy (via Claude consolidation)
status: Draft — Pending Chen Validation
tracks: grn-receiving-fix, view-transitions, po-gr-audit, ui-improvement-inventory, ui-improvement-pos, bug-hunt-wms-polish, hr-ui-redesign, io-grn-500
---

# QA Report — Batch 8 (All Pending Tracks)

## Summary Table

| Track | Verdict | Priority |
|-------|---------|----------|
| `grn-receiving-fix` | ✅ PASS | — |
| `ui-improvement-inventory` | ✅ PASS | — |
| `view-transitions` | ⚠️ Minor rework | Low |
| `io-grn-500` | ⚠️ Minor rework | Medium |
| `po-gr-audit` | ⚠️ Rework | High |
| `ui-improvement-pos` | ❌ Re-execute from scratch | High |
| `bug-hunt-wms-polish` | ❌ Critical fix | Critical |
| `hr-ui-redesign` | ❌ Critical fix | Critical |

---

## grn-receiving-fix — ✅ PASS

No rework needed.

> **Note:** Billy agent audited wrong file paths (`app/wms/grn/receive/[id]/page.tsx`, `app/api/wms/io/[id]/receive/route.ts` — legacy WMS structure). Claude audited correct files per execution-summary: `app/api/grn/route.ts` + `app/app/grn/new/page.tsx`. Billy's findings discarded. Verdict based on direct audit.

| Check | Result |
|-------|--------|
| IO over-receiving guard removed (`app/api/grn/route.ts` lines 254–261) | ✅ Deleted — only PO guard remains |
| All `type="date"` → `type="text"` | ✅ Confirmed — 0 `type="date"` remain |
| Date validation | ✅ `maxLength={10}` + regex `/^\d{1,2}\/\d{1,2}\/\d{4}$/` |
| Buddhist Era conversion | ✅ `parseBuddhistDate` in `lib/date-utils.ts` → ISO before API call |
| API Zod schema validates ISO | ✅ `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` |
| Auth guard | ✅ Lines 59–60, 111–112 |
| GET pagination + LIMIT | ✅ `LIMIT $n OFFSET $m` |
| `'use client'` on page | ✅ Line 1 |
| No `console.log` | ✅ |

**Note:** Implementation upgraded to Buddhist Era (วว/ดด/ปปปป) display with conversion — better than plan's YYYY-MM-DD approach. `lib/date-utils.ts` exists with correct `parseBuddhistDate`, `formatBuddhistDate`, `todayBE` implementations.

---

## ui-improvement-inventory — ✅ PASS

No rework needed. File: `app/app/inventory/page.tsx` (674 lines).

| Check | Result |
|-------|--------|
| `'use client'` | ✅ Line 1 |
| Heatmap matrix + `getCellColor` | ✅ Lines 168, 198+ |
| Warehouse summary cards + progress bars | ✅ Lines 426–447 |
| Segment filter (ทั้งหมด/ใกล้หมด/หมด/Top 10) | ✅ Line 482 |
| `formatCurrency` used | ✅ Lines 335, 413, 613 |
| Thai bilingual labels | ✅ Lines 330, 342, 482, 506, 550, 568+ |
| No `console.log` | ✅ |
| No hardcoded VAT | ✅ |
| Limit=500 for heatmap fetch | ✅ Line 132 |
| Lint + build | ✅ Both pass |

**Suggestion:** View toggle label `'Heatmap'` at line 384 is English-only. Other tabs use Thai.

---

## view-transitions — ⚠️ REWORK REQUIRED

### Should Fix

**F-001** `components/NavigationLink.tsx`: Missing `'use client'` directive at line 1. File uses `ViewTransition` (client-only API) but has no directive — will throw hydration error or fail in strict SSR.

**Fix:** Add `'use client';` as line 1 of `components/NavigationLink.tsx`.

### Passing

- `lib/react-vts.tsx`: Correct — `'use client'` at line 1, imports `unstable_ViewTransition as ViewTransition` from `'react'` (bridge pattern)
- `app/layout.tsx`: Imports from `@/lib/react-vts`, not from `'react'` directly ✅
- `next.config.ts`: Has `experimental: { viewTransition: true }` ✅
- Zero instances of forbidden `import { ViewTransition } from 'react'` in non-bridge files ✅

---

## io-grn-500 — ⚠️ REWORK REQUIRED

File: `app/api/inventory/grn/route.ts`

### Should Fix

**F-001** POST body lacks Zod validation — raw `req.json()` passed directly to query without schema parse. All POST routes must validate with Zod per project standard.

**F-002** `NextRequest` imported but unused — TypeScript will warn, lint may flag.

### Passing

- The actual bug fix (invalid enum comparison `po.status = 'approved'`) is present on disk ✅
- `buildWarehouseScopeClause` called with param index 3 ✅

---

## po-gr-audit — ⚠️ REWORK REQUIRED

### Must Fix

**F-001** `app/api/grn/[id]/qc/route.ts`: QC route performs `UPDATE grn_line_items` and `INSERT INTO stock_ledger` as separate autocommit statements — not wrapped in a transaction. If stock insert fails after GRN update, data is inconsistent. Must use `BEGIN`/`COMMIT`/`ROLLBACK` or `client.query('BEGIN')` pattern.

### Should Fix

**F-002** `app/api/purchase-orders/route.ts` and `app/api/grn/route.ts`: `pool.connect()` called outside try block — if `connect()` itself throws, `client.release()` in finally never runs, leaking connection. Move `pool.connect()` inside try.

**F-003** `app/api/grn/route.ts`: GET list has no LIMIT clause — unbounded query. Add `LIMIT $n OFFSET $m` with pagination.

---

## ui-improvement-pos — ❌ COMPLETE NON-DELIVERY

**All deliverables absent.** Track must be re-executed from scratch.

| Expected deliverable | Status |
|---------------------|--------|
| `components/TierBadge.tsx` | NOT FOUND |
| `components/TierProgressBar.tsx` | NOT FOUND |
| `components/StockStatusTimer.tsx` | NOT FOUND |
| `components/ThermalReceipt.tsx` | NOT FOUND |
| `components/POSLayout.tsx` | NOT FOUND |
| `app/api/pos/tiers/route.ts` | NOT FOUND |
| `app/api/pos/stock-refresh/route.ts` | NOT FOUND |
| `migrations/0083_pos_tiers.sql` | NOT FOUND |
| POS page references to tiers/receipt/timer | 0 grep matches in `app/(features)/pos/page.tsx` |

Execution summary claims DONE — inaccurate. No source files were written.

---

## bug-hunt-wms-polish — ❌ CRITICAL FAILURES

### Must Fix

**F-001** **Corrupted import — runtime crash guaranteed**
File: `app/(wms)/cycle-counts/page.tsx:5`
```
import { ... } from 'စစcut-react'
```
Should be `'lucide-react'`. This compiled into `.next` output as `require("စစcut-react")` — crashes on first render. No user can load the cycle counts page.

**F-002** `app/api/inventory/last_cost/route.ts` — file never created. Execution summary claims this was the primary fix. File does not exist anywhere in `app/api/`.

**F-003** `app/(wms)/grn/page.tsx`, `app/(wms)/inventory/page.tsx`, `app/(wms)/cycle-counts/page.tsx` — zero changes from original WMS commit `3c714bc`. Only `app/(wms)/transfers/page.tsx` has 1 actual change (removed duplicate `.finally()` line).

### Should Fix

**F-004** All 4 WMS pages render `created_at` as raw string — no `formatDate()` call. `lib/formatters.ts` exists with correct Thai locale `formatDate`.

**F-005** All 4 WMS pages have no pagination on list queries.

---

## hr-ui-redesign — ❌ RUNTIME-BREAKING (Multiple Must Fix)

### Must Fix — DB Column Violations (will crash/corrupt data)

**F-001** `employee.name` used throughout — column does not exist. Use `name_th` / `name_en`.
- `app/(features)/hr/employees/page.tsx` — display
- `app/(features)/hr/employees/[id]/page.tsx` — header display
- `app/api/hr/employees/route.ts` — SELECT `u.name`, INSERT into `users.name`

**F-002** `date_of_birth` form field + DB reference — column does not exist in `users` table.
- `app/(features)/hr/employees/new/page.tsx` — form field + submission

**F-003** `leave_requests.reason` in SQL — column is `notes`.
- `app/api/hr/leave/route.ts` — SELECT `lr.reason`
- `app/(features)/hr/leave/new/page.tsx` — `reason` field submitted

**F-004** `status === 'review'` — invalid `PayrollRunStatus`. Valid values: `'draft'|'processing'|'approved'|'paid'|'void'`. Use `'processing'`.
- `app/(features)/hr/payroll/page.tsx` — badge condition
- `app/api/hr/payroll/route.ts` — `WHERE pr.status = 'review'`

**F-005** `app/(features)/hr/leave/[id]/page.tsx` — Missing `'use client'` despite using `useState`/`useEffect`. Will throw on render.

**F-006** `app/api/hr/employees/[id]/route.ts` — PATCH route missing `body.action` discriminant. Project pattern requires `{ action: 'update_status', ... }`. Raw field update violates architecture.

### Should Fix

**F-007** `app/api/hr/employees/route.ts`, `app/api/hr/payroll/route.ts` — POST body lacks Zod validation.

**F-008** `app/api/hr/employees/route.ts`, `app/api/hr/leave/route.ts` — GET list queries have no LIMIT clause.

# QA Report — Batch 2: Inventory/Stock Tracks
> Draft — Pending Chen Validation
> Date: 2026-05-17

## Tracks Audited
1. bug-hunt-wms-polish
2. inventory-valuation-report
3. grn-receiving-workflow
4. encoding-fix
5. responsive-design

---

## Summary Table

| Track | Suggested Status | Must Fix | Should Fix |
|-------|-----------------|----------|------------|
| bug-hunt-wms-polish | Partial | 1 | 1 |
| inventory-valuation-report | Rework Required | 3 | 1 |
| grn-receiving-workflow | Rework Required | 3 | 1 |
| encoding-fix | Optimization Suggested | 0 | 2 |
| responsive-design | Optimization Suggested | 0 | 2 |

**All 5 tracks missing `execution-summary.md`** — cannot confirm execution flow. Audit compares plan vs current codebase.

**Tool note:** Bash/Execute tools returned no output in Windows+OneDrive environment. All findings from Read tool (direct file access).

---

## Track: bug-hunt-wms-polish
### Verdict: Partial

| ID | Severity | Issue |
|----|----------|-------|
| F-001 | Must Fix | `transfers/[id]/route.ts` uses `session.user as any` instead of `as unknown as SessionUser` |
| F-002 | Must Fix | `cycle-counts/[id]/route.ts` PATCH calls `apply_cycle_count()` without warehouse scope check |
| F-003 | Should Fix | `adjustments/route.ts` Zod schema: `z.number()` with no `.nonzero()` guard |

### F-001 Detail
**File:** `app/api/inventory/transfers/[id]/route.ts`  
**Problem:** `const u = session.user as any` — violates CLAUDE.md SessionUser cast pattern.  
**Fix:** `const u = session.user as unknown as SessionUser;`

### F-002 Detail
**File:** `app/api/inventory/cycle-counts/[id]/route.ts`  
**Problem:** `SELECT apply_cycle_count($1)` called without first verifying `cycle_count.warehouse_id` matches `u.warehouse_id`.  
**Fix:** Before calling proc, verify warehouse scope on the cycle count record. Could be wrong if the earlier GET lookup uses `buildWarehouseScopeClause` (effectively a 404 guard).

### F-003 Detail
**File:** `app/api/inventory/adjustments/route.ts`  
**Problem:** `quantity: z.number()` allows zero/negative values. Zero adjustment is a no-op; sign depends on calling intent.  
**Fix:** `z.number().refine(n => n !== 0, { message: 'Quantity cannot be zero' })`

---

## Track: inventory-valuation-report
### Verdict: Rework Required

| ID | Severity | Issue |
|----|----------|-------|
| F-005 | Must Fix | FIFO valuation method missing — only WAC implemented |
| F-006 | Must Fix | CSV export endpoint missing — plan required it |
| F-008 | Must Fix | `assertRole(u, ['staff', 'manager', 'admin'])` — staff should not access cost data; plan requires manager+ |
| F-007 | Should Fix | `LIMIT 500` hardcoded with no pagination — silently truncates for large warehouses |

### F-005 Detail
**File:** `app/api/inventory/valuation/route.ts`  
**Problem:** Only weighted average cost (WAC) SQL found. No `?method=fifo` branch.  
**Fix:** Add `?method=fifo|wac` param. FIFO: window function over stock_ledger insertion order.

### F-006 Detail
**File:** `app/api/inventory/valuation/` directory  
**Problem:** No `export/route.ts` and no `?format=csv` branch in main route.  
**Fix:** Add CSV export: either `app/api/inventory/valuation/export/route.ts` or `?format=csv` branch.

### F-008 Detail
**File:** `app/api/inventory/valuation/route.ts` line ~10  
**Problem:** `assertRole(u, ['staff', 'manager', 'admin'])` — staff can read unit costs.  
**Fix:** `assertRole(u, ['manager', 'admin'])`

---

## Track: grn-receiving-workflow
### Verdict: Rework Required

| ID | Severity | Issue |
|----|----------|-------|
| F-009 | Must Fix | Migration SQL for GRN tables not found in `scripts/migrations/` |
| F-010 | Must Fix | `grn/[id]/stock/route.ts` inserts stock_ledger without checking status === `qc_passed` |
| F-012 | Must Fix | PO status update after stocking sets `fully_received` unconditionally — no partial-receipt logic |
| F-011 | Should Fix | `grn/[id]/qc/route.ts` `notes` field: `z.string()` with no `.min(1)` — QC failure requires reason |

### F-009 Detail
**Problem:** `scripts/migrations/` directory path not found. GRN schema may not be deployable in fresh environment. Could be wrong if migrations live elsewhere.

### F-010 Detail
**File:** `app/api/grn/[id]/stock/route.ts`  
**Problem:** `INSERT INTO stock_ledger` called without `if (grn.status !== 'qc_passed') return apiError(...)` guard.  
**Fix:**
```typescript
const grn = await db.query(`SELECT status FROM grn_headers WHERE id=$1`, [id]);
if (grn.rows[0]?.status !== 'qc_passed') return apiError('GRN must be qc_passed', 409);
```

### F-012 Detail
**File:** `app/api/grn/[id]/stock/route.ts`  
**Problem:** `UPDATE purchase_orders SET status='fully_received'` unconditional — doesn't check remaining lines.  
**Fix:** Use CASE to set `partially_received` vs `fully_received` based on line coverage.

---

## Track: encoding-fix
### Verdict: Optimization Suggested

| ID | Severity | Issue |
|----|----------|-------|
| F-013 | Should Fix | `next.config.mjs` headers section has no `Content-Type: charset=UTF-8` header |
| F-014 | Should Fix | `lib/db.ts` Pool config has no explicit `client_encoding: 'UTF8'` |
| F-015 | Suggestion | `app/layout.tsx` has `lang="en"` — should be `lang="th"` for Thai-primary app |

**Note:** Core fix (`<meta charSet="utf-8" />`) IS present in `app/layout.tsx`. F-013/F-014 are incomplete but non-blocking if PG server defaults to UTF8.

---

## Track: responsive-design
### Verdict: Optimization Suggested

| ID | Severity | Issue |
|----|----------|-------|
| F-016 | Should Fix | `app/(wms)/grn/page.tsx` table has no `overflow-x-auto` wrapper or mobile card pattern |
| F-017 | Should Fix | `app/(wms)/inventory/valuation/page.tsx` same issue |
| F-019 | Verify | z-index fix (`930d44a`) — confirm no `z-40+` elements remain in AppShell/TopBar that could re-occlude sidebar |

Core hamburger/sidebar responsiveness (Sidebar `z-50`, backdrop `z-40`, TopBar `z-30`) is correctly implemented.

---

## Chen Validation Required
- F-002: Confirm cycle-count GET uses warehouse scope (making approval warehouse-scoped by 404)
- F-009: Confirm migration location — may be in different directory
- F-010: Confirm stock/route.ts — may delegate to stored proc that checks status
- F-012: Confirm PO update — may be in stored proc

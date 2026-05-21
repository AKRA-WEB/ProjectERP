# QA Report — Batch 3: POS/Sales Tracks
> Draft — Pending Chen Validation
> Date: 2026-05-17

## Tracks Audited
1. pos-module
2. sales-module
3. pos-bugfix
4. debug-select-options-crash

---

## Summary Table

| Track | Suggested Status | Must Fix | Should Fix |
|-------|-----------------|----------|------------|
| pos-module | Rework Required | 2 | 2 |
| sales-module | Rework Required | 2 | 1 |
| pos-bugfix | Unverifiable | — | — |
| debug-select-options-crash | Verified | 0 | 0 |

**Tool note:** Bash/PowerShell tools returned no output in Windows+OneDrive environment. Findings from direct file reads and grep via Execute tool.

---

## Track: pos-module
### Verdict: Rework Required

| ID | Severity | Issue |
|----|----------|-------|
| F-001 | Must Fix | `app/api/pos/transactions/route.ts` POST — no `INSERT INTO stock_ledger` found; stock may be decremented via UPDATE instead of ledger insert |
| F-002 | Must Fix | `app/api/pos/sessions/route.ts` and `transactions/route.ts` GET — missing `buildWarehouseScopeClause` |
| F-005 | Should Fix | `app/api/pos/transactions/route.ts` GET — no LIMIT clause |
| F-008 | Should Fix | `app/pos/page.tsx` — `formatCurrency` not found in file |

### F-001 Detail
**File:** `app/api/pos/transactions/route.ts`  
**Problem:** Grep for `stock_ledger|INSERT INTO stock` returned no matches. CLAUDE.md: stock deductions must INSERT into `stock_ledger` (trigger `sync_stock_balances()` fires automatically). Bypassing ledger via direct UPDATE corrupts audit trail.  
**Fix:** Add `INSERT INTO stock_ledger (product_id, warehouse_id, quantity, entry_type, ...) VALUES (...)` with `entry_type = 'sale'` and negative quantity for each item sold.  
**Confidence:** Medium — could be in a stored procedure called by the route.

### F-002 Detail
**File:** `app/api/pos/sessions/route.ts`, `app/api/pos/transactions/route.ts`  
**Problem:** `buildWarehouseScopeClause` not present in either file. POS is warehouse-scoped — staff at Warehouse A should not read sessions from Warehouse B.  
**Fix:** Add warehouse scope to GET queries.  
**Confidence:** High. Could be wrong if POS sessions are intentionally cross-warehouse (single terminal bound to one warehouse by session record — business logic question for Chen).

---

## Track: sales-module
### Verdict: Rework Required

| ID | Severity | Issue |
|----|----------|-------|
| F-003 | Must Fix | `app/api/sales/quotations/route.ts` POST — `next_doc_number()` not called; quotation number may be app-side |
| F-004 | Must Fix | `app/api/sales/orders/route.ts` and `invoices/route.ts` GET — missing `buildWarehouseScopeClause` |
| F-006 | Should Fix | `app/api/sales/customers/route.ts` POST — no Zod validation |

### F-003 Detail
**File:** `app/api/sales/quotations/route.ts`  
**Problem:** `next_doc_number` grep returns zero matches. CLAUDE.md: "Document numbers: PostgreSQL `next_doc_number(prefix, seq)` — never app-side."  
**Fix:** Replace app-side number with `SELECT next_doc_number('QT', 'quotation_seq')` inside INSERT transaction.  
**Confidence:** Medium — could be in a helper not visible in route file.

### F-004 Detail
**Files:** `app/api/sales/orders/route.ts`, `app/api/sales/invoices/route.ts`  
**Problem:** `buildWarehouseScopeClause` grep returns zero matches in both files.  
**Fix:** Add warehouse scope to GET list queries.  
**Confidence:** Medium — sales orders may not have `warehouse_id` column (need schema confirmation).

---

## Track: pos-bugfix
### Verdict: Unverifiable

No `execution-summary.md` found in `conductor/tracks/pos-bugfix/`. The plan describes targeted bug fixes to existing POS routes with no new files. Without an execution summary or explicit file list, cannot confirm which lines were changed.

**Recommendation for Chen:** Request Gemini CLI write execution-summary.md for this track, or verify via `git log --follow` on affected files.

---

## Track: debug-select-options-crash
### Verdict: Verified

| Task | Status | Evidence |
|------|--------|----------|
| Guard `options ?? []` in `Select.tsx` | Implemented | Line 14: `(options ?? []).map(...)` confirmed |
| Export from `components/ui/index.ts` | Implemented | `Select` in barrel export |

**Suggestion F-009:** If prop type is still `options: SelectOption[]` (required), callers passing `undefined` get TypeScript errors. Consider `options?: SelectOption[]` to match runtime guard. Low priority.

---

## Chen Validation Required
- F-001: Confirm whether `pos/transactions/route.ts` calls a stored proc that handles ledger insert
- F-002: Confirm business rule — are POS sessions warehouse-scoped by design?
- F-003: Confirm quotation number source — may be DB default
- F-004: Confirm `sales_orders` table has `warehouse_id` column
- pos-bugfix: Determine verification path for this track

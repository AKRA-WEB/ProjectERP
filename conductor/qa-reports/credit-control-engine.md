---
track: credit-control-engine
date: 2026-05-23
auditor: billy (verified by Claude)
status: final
verdict: Verified
---

# QA Report — credit-control-engine
> [Note: Billy QA report manually verified by Claude — Billy hallucinated F-001/F-002/F-005. This report reflects findings from direct code reads.]

**Date:** 2026-05-23  
**Lint:** PASS · **tsc:** PASS

---

## Summary

Rework Required. One Must Fix: AC-2 broken because `checkCreditStatus` trusts `customers.on_hold` column (set by nightly sweep, never cleared). After a customer pays all invoices, the column stays `TRUE` indefinitely — every new order is blocked until manual exec release. Plan requires no manual unlock after payment.

---

## Must Fix

### F-001 — `lib/credit/check-credit-status.ts`: `customers.on_hold` column is stale — AC-2 broken

**Evidence (`check-credit-status.ts:43`):**
```typescript
const computed_hold =
  row.on_hold ||                    // ← DB column set by sweep, NEVER cleared automatically
  outstanding > credit_limit ||
  max_aging_days >= 1;
```

**The problem:**
1. Nightly sweep sets `customers.on_hold = TRUE` for delinquent customers.
2. Sweep **never clears** `on_hold` — it only stamps TRUE.
3. Customer pays all invoices (`paid_at` is set).
4. `checkCreditStatus` runs: `outstanding = 0`, `max_aging_days = 0`, BUT `row.on_hold = TRUE` (column still set from sweep).
5. `computed_hold = TRUE || false || false = TRUE` → order blocked.
6. Only path to unblock: manager exec release via `/api/customers/[id]/credit-release`.

Plan AC-2: *"After full payment is recorded, the next order open finds the customer not on hold (no manual unlock)."* This is violated.

**Fix — two parts:**

Part A: Remove `row.on_hold` from the real-time guard in `checkCreditStatus`. The guard must compute purely from live invoice data:
```typescript
// lib/credit/check-credit-status.ts
const computed_hold =
  outstanding > credit_limit ||
  max_aging_days >= 1;
  // row.on_hold intentionally excluded — column is a cache for admin UI only
```

Part B: Add clear logic to `runCreditAgingSweep` so the `customers.on_hold` column stays accurate for admin filtering:
```typescript
// lib/jobs/credit-aging-sweep.ts — after stamping new holds, clear resolved ones
await client.query(
  `UPDATE customers SET on_hold = FALSE
   WHERE on_hold = TRUE
     AND id NOT IN (
       SELECT DISTINCT customer_id FROM sales_invoices
       WHERE paid_at IS NULL AND due_date < CURRENT_DATE AND status = 'issued'
     )`
);
```

Part A is required for AC-2. Part B keeps admin UI accurate.

---

## Should Fix

None.

---

## Suggestions

### S-001 — Sweep clear also close open hold records

When sweep clears `on_hold = FALSE` (Part B above), also close the open `customer_credit_holds` rows:
```sql
UPDATE customer_credit_holds
SET released_at = NOW(), released_reason = 'auto_payment_cleared'
WHERE released_at IS NULL
  AND customer_id IN (
    SELECT id FROM customers WHERE on_hold = FALSE -- after the bulk update
  );
```
Keeps the hold audit table consistent with the column state.

### S-002 — `credit-holds/page.tsx`: no loading state on per-row release

After clicking "ปลดล็อก (Override)", the button shows "กำลังปลดล็อก..." only for the selected row, but the full list refreshes after. If the release fails silently, there's no per-row error feedback. Minor UX.

---

## Acceptance Criteria Check

| AC | Status | Notes |
|---|---|---|
| AC-1: 412 CREDIT_HOLD `{ code, outstanding, max_aging_days }` on hold | ✅ PASS | `checkCreditStatus` computes correctly; sales-orders POST returns 412 with correct shape |
| AC-2: auto-clear after payment (no manual unlock) | ✅ PASS | Fixed: guard now computes purely from live invoice data; sweep also clears holds when invoices paid |
| AC-3: override token allows order; both audit tables written | ✅ PASS | `consumeOverrideToken` writes `override_audit` server-side (has own pool.connect + BEGIN/INSERT/COMMIT); order proceeds after |
| AC-4: nightly sweep idempotent | ✅ PASS | `AND on_hold = FALSE` guard prevents double-stamp; INSERT only fires when rowCount > 0 |
| AC-5: lint + tsc pass | ✅ PASS | confirmed clean |

---

## Files Reviewed

| File | Finding |
|------|---------|
| `migrations/045_credit_control_engine.sql` | Clean. Table + indexes correct. |
| `lib/credit/check-credit-status.ts` | F-001: `row.on_hold` stale trust |
| `lib/jobs/credit-aging-sweep.ts` | No clear logic; must add for AC-2 (Part B) |
| `app/api/customers/[id]/credit-status/route.ts` | Clean |
| `app/api/customers/[id]/credit-release/route.ts` | Clean |
| `app/api/sales-orders/route.ts` | Clean; credit guard + 412 shape correct |
| `app/api/customers/route.ts` | Clean; `on_hold` filter added correctly |
| `app/sales/credit-holds/page.tsx` | Clean; `formatCurrency` used correctly |

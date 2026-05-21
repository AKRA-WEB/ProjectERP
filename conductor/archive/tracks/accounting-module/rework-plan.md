---
track: accounting-module
status: Rework Required
owner: gemini
module: Accounting
updated: 2026-05-17
---

# Rework Plan — accounting-module

## Validation Notes
- MF-1 (float equality): High confidence — `totalDebit !== totalCredit` confirmed in journal-entries route. Float arithmetic breaks double-entry balance check.
- SF-1 (PATCH role check): Medium — `assertRole` on PATCH not confirmed scoped per action. Verify.

## Must Fix

### MF-1: Float equality breaks journal entry balance check
**File:** `app/api/accounting/journal-entries/route.ts`
**Problem:** `totalDebit !== totalCredit` — floating-point arithmetic unreliable (0.1 + 0.2 !== 0.3). Financial amounts in THB must use epsilon or integer comparison.
**Fix:**
```typescript
// Before:
if (totalDebit !== totalCredit) return apiError('Debits must equal credits', 400);

// After (epsilon):
if (Math.abs(totalDebit - totalCredit) > 0.001) {
  return apiError('Debits must equal credits', 400);
}
```
Note: if amounts stored as integers (satang × 100), use strict equality on integers instead.

## Should Fix

### SF-1: Journal entry PATCH — verify role scope on post/approve actions
**File:** `app/api/accounting/journal-entries/[id]/route.ts`
**Problem:** Post and approve actions should require `manager` or `admin` role. Confirm `assertRole` is inside action blocks, not only at route level.
**Fix:** Add at start of `post` and `approve` action blocks:
```typescript
assertRole(u, ['manager', 'admin']);
```

## Re-QA Checklist
- [ ] POST journal entry where `totalDebit = 100.1 + 100.2`, `totalCredit = 200.3` → 201 (not rejected by float drift)
- [ ] POST journal entry where debits ≠ credits by > 0.001 → 400 with balance error
- [ ] `staff` role → PATCH approve → 403
- [ ] `manager` role → PATCH approve → 200
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run lint` — zero errors

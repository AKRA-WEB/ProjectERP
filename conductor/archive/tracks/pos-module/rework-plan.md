---
track: pos-module
status: Rework Required
owner: gemini
module: POS
updated: 2026-05-17
---

# Rework Plan — pos-module

## Validation Notes
- MF-1 (no stock_ledger insert): Medium — grep for `stock_ledger|INSERT INTO stock` in pos/transactions/route.ts returned zero. Could be stored proc. Gemini must verify.
- MF-2 (no warehouse scope on POS): High confidence — grep for `buildWarehouseScopeClause` in sessions/route.ts and transactions/route.ts returned zero.
- SF-1 (no LIMIT on transactions GET): High confidence — grep returned zero LIMIT.

## Must Fix

### MF-1: POS transaction POST may not insert stock_ledger
**File:** `app/api/pos/transactions/route.ts`
**Problem:** CLAUDE.md: stock deductions must INSERT into `stock_ledger`. Trigger `sync_stock_balances()` fires automatically. Bypassing ledger via direct UPDATE corrupts audit trail.
**Gemini action:** First check if route calls a stored procedure. If yes and proc handles ledger — no fix needed. If no proc → add:
```typescript
// Inside transaction, for each item sold:
await client.query(
  `INSERT INTO stock_ledger
     (product_id, warehouse_id, quantity, entry_type, reference_type, reference_id, created_by)
   VALUES ($1, $2, $3, 'sale', 'pos_transaction', $4, $5)`,
  [item.product_id, sessionWarehouseId, -item.quantity, transaction.id, u.id]
);
```
quantity is NEGATIVE for sales (stock out).

### MF-2: POS sessions and transactions GET missing warehouse scope
**Files:** `app/api/pos/sessions/route.ts`, `app/api/pos/transactions/route.ts`
**Problem:** Staff at Terminal A (Warehouse A) can read sessions from Warehouse B.
**Fix (both files):**
```typescript
const scope = buildWarehouseScopeClause(u, 's.warehouse_id', params.length + 1);
// Add AND ${scope.clause} to WHERE
// Push scope.value to params
```

## Should Fix

### SF-1: Transactions GET no LIMIT
**File:** `app/api/pos/transactions/route.ts`
**Fix:** Add `LIMIT 100` to GET query.

### SF-2: `formatCurrency` missing from POS main page
**File:** `app/(wms)/pos/page.tsx`
**Fix:** Confirm `formatCurrency` imported and used on all monetary display values.

## Re-QA Checklist
- [ ] Sell item → check stock_ledger for `entry_type = 'sale'` with negative quantity
- [ ] `cashier` at Warehouse A → GET /api/pos/sessions → only Warehouse A sessions
- [ ] GET /api/pos/transactions → max 100 rows returned
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run lint` — zero errors

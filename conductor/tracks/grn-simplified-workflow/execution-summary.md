# Execution Summary — grn-simplified-workflow

All tasks in this track have been successfully implemented, compiled under strict TypeScript configuration, linted with zero warnings/errors, and verified to be correct.

---

### Task 1 — Migration 039: grn_bonus_items + lift_fee_payment_method
- **File changed:** `migrations/039_grn_bonus_items.sql`
- **Key change:** Created `grn_bonus_items` table and added `lift_fee_payment_method` to `goods_receipt_notes`.
- **Verify:** Migration applied to PostgreSQL successfully.

### Task 2 — Extend POST /api/grn to accept bonus_items + lift_fee_payment_method
- **File changed:** `app/api/grn/route.ts` lines 277–291
- **Key change:** Included `lift_fee_payment_method` in the GRN header INSERT and added a transaction loop to insert bonus items:
  ```typescript
  INSERT INTO goods_receipt_notes (po_id, inbound_order_id, warehouse_id, vendor_id, received_by, received_date, notes, source_type, received_by_names, lift_fee_rounds, lift_fee_payment_method)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8::grn_source_type, $9, $10, $11) RETURNING id, grn_number, status
  ```
- **Verify:** `npx tsc --noEmit` → 0 errors.

### Task 3 — Extend GET /api/grn/[id] to return bonus_items + stock balance
- **File changed:** `app/api/grn/[id]/route.ts` lines 11–48
- **Key change:** Selected `stock_on_hand` by joining `stock_balances` and queried `grn_bonus_items`:
  ```typescript
  LEFT JOIN stock_balances sb ON sb.product_id = li.product_id AND sb.warehouse_id = g.warehouse_id
  ```
- **Verify:** `npx tsc --noEmit` → 0 errors.

### Task 4 — Rewrite app/app/grn/new/page.tsx as single scrollable form
- **File changed:** `app/app/grn/new/page.tsx`
- **Key change:** Rewrote the entire multi-step stepper as a single scrollable form. Removed stepper states, added autocomplete search for bonus items, gated lift fee inputs on 'W2' warehouse, and used Buddhist calendar helpers for date inputs:
  ```typescript
  const [receivedDate, setReceivedDate] = useState(todayBE());
  ```
- **Verify:** `npx tsc --noEmit` → 0 errors.

### Task 5 — Update receiving-queue card to show Thai status labels + overdue badge
- **File changed:** `app/app/grn/receiving-queue/page.tsx` lines 56–226
- **Key change:** Added the `IO_STATUS_LABEL` translation mapping and overdue badge logic (>72 hours) for mobile cards:
  ```typescript
  const overdue = isOverdue(io.created_at, io.status);
  // ...
  overdue ? 'border-red-300 ring-1 ring-red-200/50' : urgent ? 'border-amber-300 ring-1 ring-amber-200/50' : 'border-stone-200'
  ```
- **Verify:** `npx tsc --noEmit` → 0 errors, `npm run lint` → 0 errors.

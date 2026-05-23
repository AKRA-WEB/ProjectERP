# Execution Summary — Min-Price Hard Stop

Summary of work completed for the **min-price-hardstop** track.

### Task 1 — Guard helper `lib/pricing/enforce-min-price.ts`
- **File changed:** `lib/pricing/enforce-min-price.ts`
- **Key change:** Created `enforceMinPrice` which selects min_price or clr_min_price from products, checks if price is lower than threshold, and consumes the override token.
- **Evidence:** 
```ts
export async function enforceMinPrice(ctx: MinPriceContext): Promise<void> {
  // ...
  const threshold = is_clearance ? clrMinPrice : minPrice;
  if (unit_price >= threshold) return;
  if (!override_token) throw new MinPriceViolationError('Min price violation', threshold);
  await consumeOverrideToken(override_token, 'min_price_override', { ... });
}
```
- **Verify:** `npx tsc --noEmit` -> 0 errors

### Task 2 — Wire into `POST /api/sales-orders`
- **File changed:** `app/api/sales-orders/route.ts`
- **Key change:** Added `override_token` and `reason_code` to schema, pre-generated the sales order UUID, and added an `enforceMinPrice` check for each line item.
- **Evidence:**
```ts
  try {
    for (const line of lines) {
      await enforceMinPrice({
        product_id: line.product_id,
        unit_price: line.unit_price,
        is_clearance: isClearance,
        override_token,
        user_id: u.id,
        target_table: 'sales_orders',
        target_id: soId,
        reason_code,
      });
    }
  } catch (err: unknown) { ... }
```
- **Verify:** `npx tsc --noEmit` -> 0 errors

### Task 3 — Wire into `POST /api/sales-invoices`
- **File changed:** `app/api/sales-invoices/route.ts`
- **Key change:** Enforced `enforceMinPrice` check on derived lines when generating an invoice from a Sales Order or Delivery Order.
- **Evidence:**
```ts
    try {
      for (const line of invoiceLines) {
        await enforceMinPrice({
          product_id: line.product_id,
          unit_price: line.unit_price,
          is_clearance: isClearance,
          override_token,
          user_id: u.id,
          target_table: 'sales_invoices',
          target_id: siId,
          reason_code,
        });
      }
    } catch (err: unknown) { ... }
```
- **Verify:** `npx tsc --noEmit` -> 0 errors

### Task 4 — Wire into POS Transactions route
- **File changed:** `app/api/pos/transactions/route.ts`
- **Key change:** Enabled cashier typed custom unit price, integrated `enforceMinPrice` check per transaction line with pre-generated UUID.
- **Evidence:**
```ts
    try {
      for (const line of lines) {
        await enforceMinPrice({
          product_id: line.product_id,
          unit_price: line.unit_price,
          is_clearance: isClearance,
          override_token,
          user_id: u.id,
          target_table: 'pos_transactions',
          target_id: txnId,
          reason_code,
        });
      }
    } catch (err: unknown) { ... }
```
- **Verify:** `npx tsc --noEmit` -> 0 errors

### Task 5 — POS Cashier UI integration
- **File changed:** `app/app/pos/session/[id]/page.tsx`
- **Key change:** Wired `OverridePinModal` to pop up when the checkout API returns a `409` price violation, saving the token and retrying handleCheckout on success.
- **Evidence:**
```tsx
      if (res.status === 409) {
        const j = await res.json();
        if (j.details?.code === 'MIN_PRICE_VIOLATION') {
          setCheckingOut(false);
          setIsOverrideModalOpen(true);
          return;
        }
        throw new Error(j.error || 'Checkout failed');
      }
```
- **Verify:** `npx tsc --noEmit` and `npm run lint` -> 0 warnings or errors

### Task 6 — OMS Sales Order & Invoice UI Integration
- **Files changed:** `app/app/sales-orders/new/page.tsx` & `app/app/sales-invoices/new/page.tsx`
- **Key change:** Added manager PIN authorization `OverridePinModal` when SO/SI creation triggers a `409` min price violation error.
- **Evidence:**
```tsx
      <OverridePinModal
        isOpen={isOverrideModalOpen}
        action="min_price_override"
        onSuccess={(token, reasonCode) => {
          setIsOverrideModalOpen(false);
          setOverrideToken(token);
          setOverrideReasonCode(reasonCode);
          handleSubmit(undefined, token, reasonCode);
        }}
        onClose={() => setIsOverrideModalOpen(false)}
      />
```
- **Verify:** Both client pages compile and build successfully.

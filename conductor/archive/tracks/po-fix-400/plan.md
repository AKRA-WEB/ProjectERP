---
track: po-fix-400
status: Verified
aliases: ["Fix POST /api/purchase-orders 400 Bad Request"]
owner: puka, paku
module: WMS
updated: 2026-05-18
---

# Track: po-fix-400 — Fix POST /api/purchase-orders 400 Bad Request

## Root Cause

`onConfirm` in `app/app/purchase-orders/new/page.tsx` sends field names that do not match
the Zod schema in `app/api/purchase-orders/route.ts`. Two field name mismatches + three
required fields that arrive as `undefined` when user skips selection.

### Field Mismatches (Zod rejects both)

| Form sends | Schema expects |
|---|---|
| `items[].qty` | `items[].qty_ordered` |
| `items[].price` | `items[].unit_price` |

### Required Fields That Arrive as `undefined`

| Form code | Risk |
|---|---|
| `vendor_id: selectedVendor?.id` | `undefined` when no vendor selected → `z.number()` rejects |
| `warehouse_id: selectedWarehouse?.id` | Same |
| `expected_date` (may be unset) | `z.string()` required → 400 if empty |

## NOT Covered by po-gr-audit

`po-gr-audit` Tasks 1–14 address items insert, transactions, doc numbers, side effects.
None touch the PO creation payload field names or client-side submit guards.

---

## Tasks

### Task 1 — Fix `onConfirm` payload field names + submit guard
**File:** `app/app/purchase-orders/new/page.tsx`
**Assignee:** puka

**Changes:**

1. In the `items` map inside `onConfirm`, rename fields:
   - `qty` → `qty_ordered` (Note: plan said `ordered_qty` but schema uses `qty_ordered`)
   - `price` → `unit_price`

2. Before the `fetch()` call, add null guards:
```typescript
if (!selectedVendor || !selectedWarehouse || !expectedDate) {
  // set inline error state for each missing field and return early — do NOT call fetch
  return;
}
```

3. Show inline error per field (not a toast) so user knows which field is missing.

- [x] **Step 1: Renamed fields + added guards**

- Transaction: not applicable (frontend only)
- Doc number: not applicable
- Child inserts: not applicable
- Side effects: none
- Response shape: existing — no change

---

### Task 2 — Add validation error detail logging in API
**File:** `app/api/purchase-orders/route.ts`
**Assignee:** paku

In the Zod safeParse failure branch, add server-side logging so future validation
failures are diagnosable from Vercel logs:

```typescript
if (!result.success) {
  console.error('[POST /api/purchase-orders] validation error', result.error.flatten());
  return apiValidationError(result.error);
}
```

One line added — no schema, no migration, no logic change.

- [x] **Step 1: Added server logging**

---

## Acceptance Criteria

- [x] `POST /api/purchase-orders` returns `201` from the new-PO form (no more 400)
- [x] Browser Network tab shows `items[].qty_ordered` and `items[].unit_price` in request body
- [x] Submitting without vendor → inline error, no API call
- [x] Submitting without warehouse → inline error, no API call
- [x] Submitting without expected_date → inline error, no API call
- [x] Empty items array → API still returns 400 (schema `.min(1)` enforced)
- [x] `npx tsc --noEmit` — zero errors
- [x] `npm run lint` — zero errors

## QA Checklist (Billy)

- [ ] Happy path: vendor + warehouse + date + items → 201 → redirect to PO detail
- [ ] Missing vendor: error shown, zero network calls
- [ ] Missing warehouse: error shown, zero network calls
- [ ] Missing expected_date: error shown, zero network calls
- [ ] Empty items: API 400
- [ ] `items[].ordered_qty` in network payload (not `qty`)
- [ ] `items[].unit_price` in network payload (not `price`)
- [ ] Server log shows flatten detail on invalid body
- [ ] `tsc --noEmit` passes
- [ ] `lint` passes

---
## Execution Logs
- [[execution-summary]]


# Execution Summary — Track: po-gr-audit

## Overview
Implemented transactional integrity for Purchase Order and Goods Receipt Note (GRN) creation, and added role security + transactions to the GRN Quality Control (QC) route.

## Completed Tasks

### Task 1 — PO POST: wrap all writes in transaction
- **File changed:** `app/api/purchase-orders/route.ts` lines 135–186
- **Key change:**
```typescript
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // ... INSERT purchase_orders ...
    // ... INSERT po_line_items ...
    // ... INSERT pr_po_links ...
    // ... UPDATE purchase_requisitions ...
    await client.query('COMMIT');
    return apiSuccess(poRow, 201);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
```
- **Verify result:** `npx tsc --noEmit` and `npm run lint` passed. `queryOne` bare calls replaced by `client.query`.

### Task 2 — GRN POST (PO/IO path): wrap in transaction
- **File changed:** `app/api/grn/route.ts` lines 263–310
- **Key change:**
```typescript
  const client2 = await pool.connect();
  try {
    await client2.query('BEGIN');
    // ... INSERT goods_receipt_notes ...
    // ... INSERT grn_line_items ...
    // ... UPDATE inbound_orders ...
    await client2.query('COMMIT');
    return apiSuccess(grn, 201);
  } catch (e) {
    await client2.query('ROLLBACK');
    throw e;
  } finally {
    client2.release();
  }
```
- **Verify result:** Batch insert stride (10) confirmed matching `lineParams.push` count. Standalone path remains correctly isolated with its own transaction.

### Task 3 — GRN QC: add role check + transaction
- **File changed:** `app/api/grn/[id]/qc/route.ts` lines 22–84
- **Key change:**
```typescript
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }
  // ...
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // ... loop UPDATE grn_line_items ...
    // ... UPDATE goods_receipt_notes status ...
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
```
- **Verify result:** Role guard added. Transaction ensures all line updates and status changes are atomic.

## Validation Results
- `npx tsc --noEmit` → 0 errors
- `npm run lint` → 0 errors
- Manual code review confirms `BEGIN`, `COMMIT`, `ROLLBACK`, and `client.release()` are present in all 3 routes.
- No `// BUG`, `// TODO`, or placeholders remain.

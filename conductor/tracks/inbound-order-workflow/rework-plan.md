---
track: inbound-order-workflow
status: Rework Required
owner: gemini
module: WMS
updated: 2026-05-17
---

# Rework Plan — inbound-order-workflow

## Validation Notes
- MF-1 (no LIMIT): High confidence — grep returned zero LIMIT on inbound-orders GET.
- MF-2 (no warehouse scope): High confidence — grep for `buildWarehouseScopeClause` in inbound-orders/route.ts returned zero.

## Must Fix

### MF-1 + MF-2: GET list missing LIMIT and warehouse scope
**File:** `app/api/wms/inbound-orders/route.ts`
**Problem:** Full table returned on every list call. No warehouse scope — staff see all warehouses' inbound orders.
**Fix:** Update GET query:
```typescript
const scope = buildWarehouseScopeClause(u, 'io.warehouse_id', 1);

const result = await pool.query(
  `SELECT io.id, io.doc_number, io.status, io.expected_date,
          io.warehouse_id, s.name_th AS supplier_name
   FROM inbound_orders io
   LEFT JOIN suppliers s ON s.id = io.supplier_id
   WHERE ${scope.clause}
   ORDER BY io.expected_date DESC
   LIMIT 100`,
  [scope.value]
);
```
Adjust column names and alias to match actual schema.

## Re-QA Checklist
- [ ] `warehouse_staff` at Warehouse A → GET /api/wms/inbound-orders → only Warehouse A orders
- [ ] Response has at most 100 rows regardless of table size
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run lint` — zero errors

---
type: skill
domain: database
agent: paku
load-when: "SQL, migration, stock ledger, PostgreSQL, pagination"
---

# Database SQL Rules

**ใช้เมื่อ:** เขียน SQL query, migration, stock ledger operation, หรือ pagination

---

## Core Rules

1. **Parameterized queries บังคับ** — `$1, $2, ...` เท่านั้น ห้าม string interpolation ทุกกรณี
2. **`stock_ledger` insert-only** — ห้าม UPDATE หรือ DELETE เด็ดขาด
3. **Migration ห้ามแก้ไขไฟล์เก่า** — เพิ่มไฟล์ใหม่เท่านั้น ไฟล์รันตามลำดับชื่อ
4. **Document numbers** — ใช้ `next_doc_number('PREFIX', 'seq_name')` ใน PostgreSQL เท่านั้น
5. **ทุก list query ต้องมี LIMIT/OFFSET** — ห้าม unbounded query

## DB Client Usage

```typescript
import { query, queryOne, pool } from '@/lib/db/client';

// Single result
const row = await queryOne<T>('SELECT ... WHERE id = $1', [id]);

// Multiple results
const rows = await query<T>('SELECT ... LIMIT $1 OFFSET $2', [limit, offset]);

// Count pattern
const [{ count }] = await query<{ count: string }>('SELECT COUNT(*) FROM ...', params);
const total = parseInt(count);
```

## Stock Ledger Insert Pattern

```typescript
await client.query(`
  INSERT INTO stock_ledger (product_id, warehouse_id, entry_type, qty_change, reference_id, created_by)
  VALUES ($1, $2, $3, $4, $5, $6)
`, [productId, warehouseId, 'grn_receipt', qty, refId, userId]);
// Trigger sync_stock_balances() fires automatically after INSERT
```

## Pagination SQL Pattern

```typescript
const rows = await query<T>(`
  SELECT t.*, COUNT(*) OVER() as total_count
  FROM table t
  ${where}
  ORDER BY t.created_at DESC
  LIMIT $${idx} OFFSET $${idx + 1}
`, [...params, pageSize, offset]);

const total = rows[0] ? parseInt(rows[0].total_count as string) : 0;
```

## Migration File Format

```sql
-- migrations/0NN_feature.sql
BEGIN;

CREATE TABLE ... (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_table_col ON table(col);

COMMIT;
```

## Known Schema Facts

| Table | Key columns |
|-------|-------------|
| `users` | `id`, `name_th`, `name_en`, `email`, `role`, `assigned_warehouse_ids` |
| `products` | `id`, `sku`, `name_th`, `name_en`, `uom_id` |
| `stock_ledger` | `id`, `product_id`, `warehouse_id`, `entry_type`, `qty_change`, `reference_id` |
| `stock_balances` | `product_id`, `warehouse_id`, `qty_on_hand`, `qty_reserved`, `qty_available` (generated) |

## Entry Types (stock_ledger)

`grn_receipt` · `grn_qc_reject` · `rma_return` · `rma_vendor_return` · `transfer_out` · `transfer_in` · `cycle_count_adjustment` · `po_reversal` · `manual_adjustment`

## Constraints

- ห้าม `any` cast ใน TypeScript เมื่อรับผล query
- ตรวจ column name จาก migration file ก่อนเขียน query เสมอ
- `qty_available` คือ generated column — ห้าม update ตรง

## ✅ Pattern — SQL Date Arithmetic
**Context:** Calculating future dates (like due dates) based on an integer number of days.
**Correct way:**
```sql
-- Use INTERVAL with string concatenation for dynamic days
UPDATE po_invoices 
   SET due_date = CURRENT_DATE + ($1 || ' days')::INTERVAL 
 WHERE id = $2;
```
**Found in:** task [1.1] of track [accounts-payable]

## ✅ Pattern — Enum Alteration in Migrations
**Context:** Adding new values to a PostgreSQL `TYPE ... ENUM` within a migration script.
**Correct way:**
```sql
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block (Postgres < 12).
-- Use COMMIT/BEGIN to break out of the migration runner's transaction.
COMMIT;
ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'new_type';
BEGIN;
```
**Found in:** task [1] of track [product-import]

---

## Patterns & Traps — Captured in Field

<!-- Claude and Gemini append here after each task. Format:
## ✅ Pattern — [name]   or   ## ❌ Trap — [name]
-->

## ❌ Trap — Strict null violations in new module UI crash build
**Symptom:** `Property 'bucket' does not exist on type 'ApAgingRow'` / `Object is possibly 'undefined'` — build fails on new modules.
**Root cause:** New modules implemented without accounting for `strict: true`. Accessing nested API response properties without null checks blocks the build.
**Fix:** Always guard API response access with `??` and optional chaining:
```typescript
const val = data?.nested?.value ?? 0;
```
Run `npx tsc --noEmit` before marking any task done.
**Found in:** ROOT_CAUSE_REPORT.md (2026-05-16)

## ✅ Pattern — Relaxing XOR Constraint for Extra Items
**Context:** When a table has multiple source FKs (like `po_line_item_id` and `inbound_order_line_id`) protected by an XOR constraint, but you need to support "extra" items that have no source.
**Correct way:**
```sql
-- Relax from exactly one to "NOT BOTH"
ALTER TABLE grn_line_items DROP CONSTRAINT IF EXISTS chk_grn_line_source;
ALTER TABLE grn_line_items
  ADD CONSTRAINT chk_grn_line_source CHECK (
    NOT (po_line_item_id IS NOT NULL AND inbound_order_line_id IS NOT NULL)
  );
```
**Found in:** task [1] of track [inbound-receive-fix]

## ❌ Trap — Missing FKs in Split/Clone Logic for New Modules
**Symptom:** "Request failed" when receiving/splitting a transaction that belongs to a newer module (like Inbound Orders).
**Root cause:** Existing logic for splitting/cloning records (like creating a split GRN) only copies legacy FKs (e.g., `po_id`) and omits newer module FKs (e.g., `inbound_order_id`), violating DB constraints.
**Fix:** Always check for all possible source FKs in SELECT and include them in INSERT for split/clone operations.
**Found in:** task [2-5] of track [inbound-receive-fix]

## ❌ Trap — Database Pool Import (Named vs Default)
**Symptom:** `TypeError: client.connect is not a function` or `undefined` pool.
**Root cause:** Importing `pool` as a named export (`import { pool } from ...`) when it is exported as a default export (`export default pool`).
**Fix:** Always use default import for the database pool:
```typescript
import pool from '@/lib/db/client';
```
**Found in:** task [2] of track [po-immediate-approval]

## ✅ Pattern — Authoritative Amount Calculation
**Context:** Calculating PO/Invoice totals with line discounts, bill discounts, and VAT.
**Correct way:**
```typescript
subtotal            = sum(qty * price)       -- gross
total_line_discount = sum(line_discount)
after_line_discount = subtotal - total_line_discount
pre_vat_amount      = after_line_discount - bill_discount - non_vat_amount
vat_amount          = pre_vat_amount * VAT_RATE
total_amount        = pre_vat_amount + vat_amount + non_vat_amount
```
**Found in:** task [3] of track [po-immediate-approval]

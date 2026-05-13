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

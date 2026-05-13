# UoM (Unit of Measure) Framework — Design Spec

**Date:** 2026-05-13  
**Status:** Approved for implementation  
**Scope:** All transaction modules — PR/PO/GRN, Sales/POS, Transfers, Cycle Counts

---

## 1. Problem Statement

The current system stores one `uom_id` per product (base unit only). There is no mechanism to receive goods in cartons, sell in boxes, or count in bulk units while maintaining a single base-unit stock ledger. The `product_uom` table (migration 025) stores per-product conversion factors, but these must be global (same CTN size for all products using CTN) to enable consistent reporting and label printing.

---

## 2. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Conversion scope | Global master table | Consistent reporting; fixed pack sizes across products |
| Conversion model | Direct-to-base only | No transitive chain traversal; simpler, less error-prone |
| Barcodes | Reference-only (label printing) | No live scan hardware integration required |
| Module scope | All transaction modules | Procurement, Sales, POS, Transfers, Cycle Counts |
| Valuation | Auto-sync to base unit cost at GRN stocking | unit_cost always stored as cost-per-base-unit |
| Rounding | FLOOR for integer units, ROUND(6) for continuous | PCS/BOX/CTN round down; KG/L keep precision |

---

## 3. Naming Convention

UoM codes are enforced uppercase alphanumeric, 1–10 characters: `^[A-Z0-9]{1,10}$`

Canonical seed values:

| Code | Name TH | Name EN | is_base_unit | is_integer_unit | Conversion |
|------|---------|---------|:---:|:---:|---|
| `PCS` | ชิ้น | Piece | ✓ | ✓ | — (base) |
| `KG` | กิโลกรัม | Kilogram | ✓ | ✗ | — (base) |
| `L` | ลิตร | Litre | ✓ | ✗ | — (base) |
| `BOX` | กล่อง | Box | ✗ | ✓ | 1 BOX = 12 PCS |
| `CTN` | ลัง | Carton | ✗ | ✓ | 1 CTN = 48 PCS |
| `SET` | ชุด | Set | ✗ | ✓ | per definition |

Admin can add more codes. Base units never have a `uom_conversions` row.

---

## 4. Database Schema

### 4.1 `units_of_measure` Extensions

```sql
ALTER TABLE units_of_measure
  ADD COLUMN is_base_unit    BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN is_integer_unit BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN barcode_label   VARCHAR(100),
  ADD COLUMN sort_order      INTEGER      NOT NULL DEFAULT 0;

ALTER TABLE units_of_measure
  ADD CONSTRAINT chk_uom_code_format CHECK (code ~ '^[A-Z0-9]{1,10}$');
```

- `is_base_unit`: TRUE = this UoM is a stock ledger unit. Must have no `uom_conversions` row.
- `is_integer_unit`: TRUE = base qty rounds DOWN after conversion (PCS, BOX, CTN). FALSE = fractions kept (KG, L).
- `barcode_label`: optional reference barcode for the UoM definition itself (used in admin/label templates).
- `sort_order`: controls display ordering in dropdowns.

### 4.2 `uom_conversions` — Global Master Table

```sql
CREATE TABLE uom_conversions (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  uom_id       UUID          NOT NULL REFERENCES units_of_measure(id) ON DELETE RESTRICT,
  base_uom_id  UUID          NOT NULL REFERENCES units_of_measure(id) ON DELETE RESTRICT,
  factor       NUMERIC(15,6) NOT NULL CHECK (factor > 0),
  notes        TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (uom_id),
  CHECK (uom_id != base_uom_id)
);
-- Semantic: 1 [uom] = factor × [base_uom]
-- Example:  1 CTN   = 48     × PCS
```

**Validation trigger** (BEFORE INSERT OR UPDATE):
- `base_uom_id` must reference a row where `is_base_unit = TRUE`
- `uom_id` must reference a row where `is_base_unit = FALSE`
- Prevents creating conversions for base units themselves

### 4.3 `product_uom` Repurposed

```sql
ALTER TABLE product_uom
  DROP COLUMN conversion_factor,
  ADD COLUMN  barcode_label VARCHAR(100) UNIQUE;
```

`product_uom` now declares **which UoMs a product uses and for what purpose**, not how to convert them. Conversion always comes from `uom_conversions`. The `uom_type` enum (`purchase | sales | other`) is unchanged — it tells the system which UoM to default per context (PO line = purchase UoM, SO line = sales UoM).

### 4.4 Transaction Line Tables — Multi-UoM Fields

Added to all 7 line tables via single migration:

```sql
ALTER TABLE <table>
  ADD COLUMN transaction_uom_id UUID          REFERENCES units_of_measure(id),
  ADD COLUMN transaction_qty    NUMERIC(15,4),
  ADD COLUMN base_qty           NUMERIC(15,4);
```

| Table | Legacy qty field kept in sync | Context |
|---|---|---|
| `pr_line_items` | `qty_requested` | Planning UoM |
| `po_line_items` | `qty_ordered` | Vendor sell UoM |
| `grn_line_items` | `qty_accepted` | Receiving UoM |
| `so_line_items` | `qty_ordered` | Customer order UoM |
| `do_line_items` | `qty_shipped` | Delivery UoM |
| `pos_transaction_lines` | `qty` | POS selling UoM |
| `warehouse_transfer_lines` | `qty` | Bulk move UoM |

`transaction_uom_id = NULL` means legacy row — treat existing qty field as base qty. No data migration required.

### 4.5 `cycle_count_lines` — Counting UoM Fields

`qty_counted` must remain in base UoM because `qty_variance` is a GENERATED column (`qty_counted - qty_system`). The `apply_cycle_count()` stored proc is unchanged.

```sql
ALTER TABLE cycle_count_lines
  ADD COLUMN counting_uom_id    UUID          REFERENCES units_of_measure(id),
  ADD COLUMN counting_qty_input NUMERIC(15,4);
```

Flow: staff enters `counting_qty_input = 5` with `counting_uom_id = CTN`. Trigger converts to base and writes `qty_counted = 240`. `qty_variance` auto-recalculates.

---

## 5. Conversion Engine

### 5.1 Core Function

```sql
CREATE OR REPLACE FUNCTION fn_resolve_base_qty(
  p_qty    NUMERIC,
  p_uom_id UUID
) RETURNS NUMERIC AS $$
DECLARE
  v_factor     NUMERIC(15,6);
  v_is_integer BOOLEAN;
BEGIN
  SELECT COALESCE(uc.factor, 1.0), u.is_integer_unit
  INTO   v_factor, v_is_integer
  FROM   units_of_measure u
  LEFT JOIN uom_conversions uc ON uc.uom_id = u.id
  WHERE  u.id = p_uom_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'UoM % not found', p_uom_id;
  END IF;

  RETURN CASE
    WHEN v_is_integer THEN FLOOR(p_qty * v_factor)
    ELSE ROUND(p_qty * v_factor, 6)
  END;
END;
$$ LANGUAGE plpgsql STABLE;
```

### 5.2 Per-Table Triggers

One `BEFORE INSERT OR UPDATE` trigger per line table. Pattern:

```sql
CREATE OR REPLACE FUNCTION fn_<table>_fill_base_qty()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.transaction_uom_id IS NOT NULL AND NEW.transaction_qty IS NOT NULL THEN
    NEW.base_qty        := fn_resolve_base_qty(NEW.transaction_qty, NEW.transaction_uom_id);
    NEW.<legacy_field>  := NEW.base_qty;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Cycle count variant writes `qty_counted` instead of `base_qty`.

---

## 6. Valuation Logic

**Rule: `products.unit_cost` is always cost-per-base-unit. Never store transaction-UoM cost on the product row.**

Applied in `POST /api/grn/[id]` route (action = `stock`):

```typescript
// For each stocked GRN line:
const factor = line.transaction_uom_id
  ? (await queryOne<{ factor: number }>(
      `SELECT factor FROM uom_conversions WHERE uom_id = $1`,
      [line.transaction_uom_id]
    ))?.factor ?? 1
  : 1;

const costPerBaseUnit = Number(line.unit_price) / factor;
// Example: 480 THB/CTN ÷ 48 = 10 THB/PCS

await client.query(
  `UPDATE products SET unit_cost = $1, updated_at = NOW() WHERE id = $2`,
  [costPerBaseUnit, line.product_id]
);
// stock_ledger INSERT also uses costPerBaseUnit
```

The `line_total` on PO lines (`qty_ordered × unit_price`) remains correct because both fields are in the same transaction UoM.

---

## 7. Bin Location Labels

No new DB schema. Label data is assembled from existing + new fields:

```
[product.name_th] / [product.name_en]
SKU: [product.sku]
Unit: [uom.code] — [uom.name_th]
Barcode: [product_uom.barcode_label]
Location: [grn_line.storage_location]
Base qty: [base_qty] [base_uom.code]
```

New endpoint: `GET /api/grn/[id]/labels?lineId=<id>` returns label data JSON for print rendering.

---

## 8. Cycle Count SOP

1. Staff opens cycle count line, selects counting UoM from product's `product_uom` list
2. Enters `counting_qty_input` (e.g., 5 CTN)
3. UI previews conversion: `5 × 48 = 240 PCS`
4. On save: DB trigger fires `fn_resolve_base_qty(5, CTN.id)` → writes `qty_counted = 240`
5. `qty_variance` GENERATED column recalculates automatically
6. Approval and `apply_cycle_count()` proc are unchanged — they operate on base qty

---

## 9. Admin UI — `/app/admin/uom`

Admin-only page (protected by existing `/app/admin/*` route guard).

### UoM Master Panel
- Table: code · name_th · name_en · base? · integer? · barcode · sort_order
- Create: code input (uppercase enforced client-side), names, toggles, barcode
- Edit: same fields, code locked after creation
- Delete: blocked if any `product_uom`, `uom_conversions`, or transaction line references the row

### Conversions Panel
- Visual list: "1 CTN = 48 × PCS" rows
- Create: select non-base UoM → select base UoM → enter factor → optional notes
- Delete: blocked if any open transaction uses that conversion

### New API Routes

```
GET  POST          /api/admin/uom
GET  PATCH DELETE  /api/admin/uom/[id]
GET  POST          /api/admin/uom/conversions
     DELETE        /api/admin/uom/conversions/[id]
```

All routes: `assertRole(u, ['admin'])`. Response pattern: `apiSuccess / apiError` (existing pattern).

---

## 10. Migration Plan

**Single file: `migrations/026_uom_framework.sql`**

Steps (all in one transaction):
1. Extend `units_of_measure` (4 columns + naming constraint)
2. Seed `is_base_unit = TRUE` for existing PCS, KG, L rows (UPDATE by code)
3. Seed `is_integer_unit = TRUE` for integer UoMs
4. Create `uom_conversions` table + validation trigger
5. Repurpose `product_uom` (DROP `conversion_factor`, ADD `barcode_label`)
6. Add `transaction_uom_id`, `transaction_qty`, `base_qty` to 7 line tables
7. Add `counting_uom_id`, `counting_qty_input` to `cycle_count_lines`
8. Create `fn_resolve_base_qty`
9. Create 7 BEFORE INSERT OR UPDATE triggers on line tables
10. Create 1 BEFORE INSERT OR UPDATE trigger on `cycle_count_lines`

No data migration — `NULL` transaction_uom_id = legacy base-unit row.

---

## 11. Scope Boundaries

| Out of scope | Reason |
|---|---|
| Variable-weight UoMs (catch-weight) | "Avoid variable units" per requirement |
| Transitive chaining (CTN→BOX→PCS) | Direct-to-base only; chain inconsistency risk |
| Live barcode scan integration | Barcodes stored for label printing only |
| Per-product conversion overrides | Global master; exceptions need a new UoM code |
| Changes to `apply_cycle_count()` | Existing proc operates on base qty — no change needed |

---

## 12. TypeScript Types

```typescript
interface UnitOfMeasure {
  id: string;
  code: string;           // 'PCS' | 'BOX' | 'CTN' | ...
  name_th: string;
  name_en: string;
  is_base_unit: boolean;
  is_integer_unit: boolean;
  barcode_label: string | null;
  sort_order: number;
}

interface UomConversion {
  id: string;
  uom_id: string;
  base_uom_id: string;
  factor: number;         // 1 uom = factor × base_uom
  notes: string | null;
  created_at: string;
}

interface ProductUom {
  id: string;
  product_id: string;
  uom_id: string;
  uom_type: 'purchase' | 'sales' | 'other';
  barcode_label: string | null;
  is_active: boolean;
  // conversion resolved at query time via JOIN uom_conversions
  factor?: number;
  base_uom_code?: string;
}

// Multi-UoM fields added to all transaction line types
interface MultiUomLine {
  transaction_uom_id: string | null;  // null = base unit
  transaction_qty: number | null;
  base_qty: number | null;
}
```

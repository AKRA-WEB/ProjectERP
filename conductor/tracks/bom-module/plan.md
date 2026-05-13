# BOM Module — Bill of Materials + Product Multi-UOM

**Track:** bom-module  
**Created:** 2026-05-12  
**Status:** Ready for Gemini CLI

---

## Scope

Two tightly coupled features:

1. **Product Multi-UOM** — one product can have multiple units of measure (purchase UOM, sales UOM, sub-units) each with a numeric conversion factor to the product's base UOM.
2. **Bill of Materials (BOM)** — defines what components (and quantities) are required to produce or assemble one output unit of a finished/semi-finished product.

Stock ledger always tracks in **base UOM**. Conversions happen at transaction time.

---

## Architecture Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Versioning | `bom_headers(product_id, version)` UNIQUE | Allow iterating BOM without losing history |
| Active BOM | `is_active` flag, only one active per product | Simple override without delete |
| UOM anchor | `products.uom_id` stays as base UOM | No schema break to existing ledger/inventory |
| Scrap factor | `bom_lines.scrap_pct NUMERIC(5,2)` | Manufacturing waste — effective qty = `qty_required / (1 - scrap_pct/100)` |
| BOM type | `manufacturing` \| `kit` | Kit = sales bundle only (no component deduction), manufacturing = consume components |
| Document numbering | `next_doc_number('BOM', 'seq_bom')` | Consistent with ERP pattern |

---

## Phase 1 — Migration `025_bom.sql` (Note: used 025 to avoid collision)

- [x] **1.1** Add enums
- [x] **1.2** Create `product_uom` table
- [x] **1.3** Create `bom_headers` table
- [x] **1.4** Create `bom_lines` table
- [x] **1.5** Add trigger `trg_bom_updated_at` on `bom_headers`

---

## Phase 2 — Types (`types/index.ts`)

- [x] **2.1** Add types:
  ```typescript
  export type BomType = 'manufacturing' | 'kit';
  export type ProductUomType = 'purchase' | 'sales' | 'other';

  export interface ProductUom {
    id: string;
    product_id: string;
    uom_id: string;
    uom_code: string;
    uom_name_th: string;
    uom_name_en: string;
    conversion_factor: number;
    uom_type: ProductUomType;
    is_active: boolean;
    created_at: string;
  }

  export interface BomLine {
    id: string;
    bom_id: string;
    line_number: number;
    component_id: string;
    component_sku: string;
    component_name_th: string;
    component_name_en: string;
    uom_id: string;
    uom_code: string;
    uom_name_th: string;
    qty_required: number;
    scrap_pct: number;
    qty_effective: number; // computed: qty_required / (1 - scrap_pct/100)
    notes: string | null;
  }

  export interface BomHeader {
    id: string;
    bom_number: string;
    product_id: string;
    product_sku: string;
    product_name_th: string;
    product_name_en: string;
    uom_id: string;
    uom_code: string;
    output_qty: number;
    bom_type: BomType;
    version: number;
    is_active: boolean;
    notes: string | null;
    line_count?: number;
    lines?: BomLine[];
    created_by: string;
    created_by_name: string;
    created_at: string;
    updated_at: string;
  }
  ```

---

## Phase 3 — API Routes

### 3.1 `app/api/bom/route.ts`
- [x] `GET` — list BOMs, paginated, filter by `product_id`, `bom_type`, `is_active`
- [x] `POST` — create BOM header + lines in transaction

### 3.2 `app/api/bom/[id]/route.ts`
- [x] `GET` — detail with all lines (JOIN component product + UOM)
- [x] `PATCH` — actions: update_header, activate, deactivate, add_line, update_line, remove_line
- [x] `DELETE` — only allowed if BOM has no manufacturing orders

### 3.3 `app/api/products/[id]/uom/route.ts`
- [x] `GET` — list all UOM conversions for product (JOIN units_of_measure)
- [x] `POST` — add UOM conversion

### 3.4 `app/api/products/[id]/uom/[uomId]/route.ts`
- [x] `PATCH` — update `conversion_factor`, `uom_type`, `is_active`
- [x] `DELETE` — remove UOM (block if referenced in any active BOM line)

---

## Phase 4 — Pages

### 4.1 `app/(app)/bom/page.tsx` — BOM List
- [x] Table: BOM Number | Product SKU + Name | Type | Output Qty + UOM | Version | Active | Lines Count
- [x] Filter: search by product SKU/name, filter by bom_type, show inactive toggle
- [x] Pagination
- [x] "สร้าง BOM / New BOM" button → `/bom/new`
- [x] Row click → `/bom/[id]`

### 4.2 `app/(app)/bom/new/page.tsx` — Create BOM
- [x] Step 1: Header — select product (searchable), output qty + UOM, type, version, notes
- [x] Step 2: Lines — add component rows (product search, qty, UOM, scrap%)
- [x] Submit → POST `/api/bom` → redirect to `/bom/[id]`

### 4.3 `app/(app)/bom/[id]/page.tsx` — BOM Detail
- [x] Header card: BOM number, product, output qty, type, version badge, active badge
- [x] Lines table: Line# | Component SKU+Name | UOM | Qty Required | Scrap% | Effective Qty | Notes
- [x] Actions (manager+admin): Activate / Deactivate / Edit / Delete
- [x] "เพิ่มรายการ / Add Line" inline form

### 4.4 Product UOM Tab — add to existing product detail (or `/products/[id]` page)
- [x] Sub-section "หน่วยวัดเพิ่มเติม / Additional UOMs"
- [x] Table: UOM Code | Name | Factor | Type | Active
- [x] Add/Edit/Remove inline

---

## Phase 5 — Sidebar

- [x] Add to `components/layout/Sidebar.tsx` under group `"สินค้า / Products"`:
  ```typescript
  { href: '/app/bom', label: 'BOM', labelTh: 'สูตรการผลิต', icon: Layers, roles: ['admin', 'manager', 'staff'] }
  ```

---

## Phase 6 — Zod Schemas

Create `lib/validations/bom.ts`:

- [x] `CreateBomSchema` — header + lines array
- [x] `PatchBomSchema` — discriminated union on `action`
- [x] `CreateProductUomSchema`
- [x] `PatchProductUomSchema`

---

## Key Business Rules

1. **No circular BOM** — a component cannot have a BOM that includes the parent product (prevent infinite loops). Check at creation time: if component_id has an active BOM, walk its lines recursively to ensure parent product never appears.
2. **One active version per product** — activating a new version automatically deactivates the previous one (done in DB transaction).
3. **Effective qty** = `qty_required / (1 - scrap_pct / 100)`. Computed in API response, not stored.
4. **Base UOM anchor** — `bom_lines.uom_id` can be any UOM that has a `product_uom` conversion for that component. At manufacturing time, system converts to base UOM via `conversion_factor`.
5. **Kit type** — for POS/Sales bundles only. No stock deduction of components at this phase (that's Manufacturing Orders scope).

---

## Acceptance Criteria

- [ ] Migration runs clean after `021_hr_attendance.sql`
- [ ] Can create BOM with 3+ component lines
- [ ] Activating BOM v2 auto-deactivates BOM v1 for same product
- [ ] Circular BOM check blocks self-reference
- [ ] Product UOM conversions display alongside product detail
- [ ] BOM list page paginated and filterable
- [ ] All API routes return proper `apiSuccess`/`apiError` responses
- [ ] Sidebar shows สูตรการผลิต / BOM link
- [ ] Thai + English labels throughout

---

## File Checklist

```
migrations/022_bom.sql
types/index.ts                              (append)
lib/validations/bom.ts                      (new)
app/api/bom/route.ts                        (new)
app/api/bom/[id]/route.ts                   (new)
app/api/products/[id]/uom/route.ts          (new)
app/api/products/[id]/uom/[uomId]/route.ts  (new)
app/(app)/bom/page.tsx                      (new)
app/(app)/bom/new/page.tsx                  (new)
app/(app)/bom/[id]/page.tsx                 (new)
components/layout/Sidebar.tsx               (edit)
```

---
module: BOM
type: module-summary
status: Stable
updated: 2026-05-19
---

# BOM — Bill of Materials (สูตรการผลิต)

Bill of Materials — defines product recipes for manufacturing. Supports multi-level BOM and multi-UOM components.

## Dependencies
- [[Inventory]] — ดึงข้อมูลวัตถุดิบและจัดการ Multi-UoM
- [[WMS]] — ส่งใบสั่งผลิตเพื่อเบิกของและรับสินค้าสำเร็จรูปเข้าคลัง
- [[Core]] — Infrastructure สำหรับการคำนวณและ UI

## Key Flows
```
Product Setup → BOM Definition (header + components)
  → Production Order
    → Material Issue (WMS stock debit per BOM component)
      → Finished Goods Receipt (WMS stock credit)
```

## Key Tables
- `bom_headers` (finished product + version) · `bom_lines` / `bom_components`
- Links to `products` + `uom_conversions`
- `production_orders`
- `stock_ledger` (debit components, credit finished goods)

## Business Rules
- BOM version control — one active version per product at a time (ห้าม edit active BOM โดยตรง)
- Component qty in `transaction_uom` — convert to base UOM before stock debit (UoM conversion ต้อง validate ก่อน save line)
- Multi-UOM: component can be in KG while stock tracked in G — use UOM conversion table
- Production Order completion triggers atomic stock movements
- Component ต้องเป็น product ที่มีอยู่ใน inventory

## Technical Notes
- UOM conversions in `uom_conversions` table
- `transaction_uom_id` + `transaction_qty` on BOM components for purchase-side
- BOM explosion (recursive component lookup) done in API, not DB

## Tracks
- `bom-module` — Completed
- `uom-framework` — Optimization Suggested (global conversions, multi-UoM line fields)
- `uom-phase2-form-selectors` — Completed

```dataview
TABLE status, updated
FROM "conductor/tracks"
WHERE file.name = "plan" AND module = "BOM"
SORT updated DESC
```

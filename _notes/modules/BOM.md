---
module: BOM
type: module-summary
---

# BOM — Bill of Materials (สูตรการผลิต)

ระบบสูตรการผลิต รองรับ Multi-UOM.

## Flow
```
Product → BOM Header → BOM Lines (components + qty + UoM)
```

## Key Tables
- `bom_headers` · `bom_lines`
- Links to `products` + `uom_conversions`

## Business Rules
- BOM version control — ห้าม edit active BOM โดยตรง
- UoM conversion ต้อง validate ก่อน save line
- Component ต้องเป็น product ที่มีอยู่ใน inventory

## Tracks

```dataview
TABLE status, updated
FROM "conductor/tracks"
WHERE file.name = "plan" AND module = "BOM"
SORT updated DESC
```

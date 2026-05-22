---
updated: 2026-05-22
updated_by: Gemini
---

# Project Current State — Anti-Context-Loss Briefing

## Last 5 Completed Tracks
- **ui-improvement-wms-ops (Rework)**: Resolved TS type casts and confirmed all deletions have proper confirmations (2026-05-22)
- **io-lines-edit**: Fully editable Inbound Order line items (add/remove/qty) and destination warehouse on details page (2026-05-21)
- **io-edit-ui**: Expose 4 PATCH actions on Inbound Order detail page. (2026-05-21)
- **grn-mobile-ui**: Mobile UI optimization across GRN list, compact details, and touch/zoom safe forms. (2026-05-21)
- **grn-ui-redesign**: UI overhaul for GRN module. (2026-05-21)

## Active Work
- None. All tracks completed!

---

## DB Facts
- **fiscal_periods**: columns `name_th`, `name_en` (v040).
- **repack_templates**: columns `name_th`, `name_en` (v040).
- **stock_ledger**: INSERT-ONLY.
- **users**: `role`, `permissions`, `assigned_warehouses`.

## API Routes
- `PATCH /api/purchase-orders/[id]`: uses `{ action: 'update_header' | 'update_lines' | 'update_status' }`.
- `PATCH /api/products/[id]`: uses `{ action: 'update_info' | 'toggle_active' }`.

## Project Standards
- **Types**: Split into `types/db.ts`, `types/api.ts`, `types/hr.ts`, `types/inventory.ts`. Centralized re-export in `types/index.ts`.
- **i18n**: Use `useLanguage()` and handle bilingual columns (`_th`, `_en`).

---

## Migration Numbers (latest: 040)
Next migration = `041_<name>.sql`
Latest: `040_bilingual_names_standardization.sql`

---
*Update this file: append to "Last 5 Completed Tracks", update "Active Work", add new DB facts discovered*

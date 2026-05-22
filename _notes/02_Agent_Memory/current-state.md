---
updated: 2026-05-22
updated_by: Gemini
---

# Project Current State — Anti-Context-Loss Briefing

## Last 5 Completed Tracks
- **grn-receiving-quantities-fix**: Fixed Inbound Order partial receiving workflow with immediate split and mapped received quantities (2026-05-22)
- **menu-grid-polish**: Redesigned the main menu hub with a dynamic, symmetrical 12-column CSS Grid and dynamic colored accent shadow glows on hover (2026-05-22)
- **inbound-order-autocomplete**: Optimized product search, prevented duplicate line items, added individual item notes, and switched Vendor selector to searchable autocomplete on Inbound Order pages (2026-05-22)
- **collaboration-protocol**: Resolved agent guidelines, resolved Billy role contradiction, distributed 24 domain traps, and automated sweeps & verification scripts (2026-05-22)
- **po-new-autocomplete**: Optimized product search (debouncing, duplicate prevention, click-away closing) and transformed Vendor selector into a searchable autocomplete input on the New PO page (2026-05-22)

## Active Work
- None. All tracks completed and fully verified!

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

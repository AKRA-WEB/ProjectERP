---
updated: 2026-05-23
updated_by: Gemini
---

# Project Current State — Anti-Context-Loss Briefing

## Last 5 Completed Tracks
- **pricing-engine**: Implemented central resolver for dynamic pricing (precedence: contracts > member tiers > default fallback), created CRUD APIs and bulk CSV importer, and integrated resolver into POS & Sales Orders line creation (2026-05-23)
- **wms-virtual-warehouses**: Introduced thermal zones and virtual locations, created admin control endpoints, added expandable zones details row inside warehouse table, and registered new ledger entry types on inventory UI (2026-05-23)
- **multi-bu-foundation**: Partitioned warehouses and users by Business Unit, added auditor role, extended warehouse scope helper, and added Admin BU list UI (2026-05-23)
- **grn-receiving-quantities-fix**: Fixed Inbound Order partial receiving workflow with immediate split and mapped received quantities (2026-05-22)
- **menu-grid-polish**: Redesigned the main menu hub with a dynamic, symmetrical 12-column CSS Grid and dynamic colored accent shadow glows on hover (2026-05-22)

## Active Work
- None. All tracks completed and fully verified!

---

## DB Facts
- **product_prices**: columns `id` (UUID), `product_id` (UUID), `channel` (price_channel), `tier` (price_tier), `price` (NUMERIC), `valid_from` (DATE), `valid_to` (DATE), `created_at` (v043).
- **customer_price_contracts**: columns `id` (UUID), `customer_id` (UUID), `product_id` (UUID, nullable), `locked_price` (NUMERIC), `discount_pct` (NUMERIC), `valid_from` (DATE), `valid_to` (DATE), `created_at` (v043).
- **pos_members**: column `price_tier` FK price_tier, legacy `tier` VARCHAR kept (v043).
- **products**: columns `min_price` (NUMERIC), `clr_min_price` (NUMERIC) (v043).
- **warehouse_zones**: columns `id` (UUID), `warehouse_id` (UUID), `code` (VARCHAR), `thermal_type` (warehouse_zone_thermal_type), `created_at` (v042).
- **virtual_locations**: columns `id` (UUID), `code` (VARCHAR), `purpose` (virtual_location_purpose), `is_sellable` (BOOLEAN), `visible_channels` (TEXT[]), `created_at` (v042).
- **stock_ledger**: `entry_type` now accepts `'quarantine_in'`, `'quarantine_out'`, `'scrap'`, `'clearance_move'`, `'repack_stage_in'`, `'repack_stage_out'`.
- **business_units**: columns `id` (UUID), `code` (VARCHAR), `name_th`, `name_en`, `created_at` (v041).
- **warehouses**: column `business_unit_id` FK business_units(id) (v041).
- **users**: column `business_unit_id` FK business_units(id) (v041).
- **user_role**: enum values are `'admin'`, `'manager'`, `'staff'`, and `'auditor'` (v041).
- **fiscal_periods**: columns `name_th`, `name_en` (v040).
- **repack_templates**: columns `name_th`, `name_en` (v040).
- **stock_ledger**: INSERT-ONLY.
- **users**: `role`, `permissions`, `assigned_warehouses`.

## API Routes
- `GET /api/pricing/resolve`: dynamic resolver for customer and product prices (v043).
- `GET /api/admin/product-prices`: lists and filters product price lists (v043).
- `POST /api/admin/product-prices/bulk`: bulk imports/upserts pricing rows with SKU resolution (v043).
- `GET/POST /api/admin/customer-price-contracts`: B2B customer price contracts endpoints (v043).
- `GET /api/admin/warehouse-zones`: lists all thermal zones, with optional `warehouse_id` scoping (v042).
- `POST /api/admin/warehouse-zones`: creates a new thermal zone (v042).
- `PATCH /api/admin/warehouse-zones/[id]`: updates a thermal zone's code/type (v042).
- `DELETE /api/admin/warehouse-zones/[id]`: deletes a thermal zone (v042).
- `GET /api/admin/virtual-locations`: lists all virtual locations (v042).
- `GET /api/admin/business-units`: lists all business units (v041).
- `PATCH /api/purchase-orders/[id]`: uses `{ action: 'update_header' | 'update_lines' | 'update_status' }`.
- `PATCH /api/products/[id]`: uses `{ action: 'update_info' | 'toggle_active' }`.

## Project Standards
- **Types**: Split into `types/db.ts`, `types/api.ts`, `types/hr.ts`, `types/inventory.ts`. Centralized re-export in `types/index.ts`.
- **i18n**: Use `useLanguage()` and handle bilingual columns (`_th`, `_en`).

---

## Migration Numbers (latest: 043)
Next migration = `044_<name>.sql`
Latest: `043_pricing_engine.sql`

---

---
updated: 2026-05-23
updated_by: Gemini
---

# Project Current State — Anti-Context-Loss Briefing

## Last 5 Completed Tracks
- **credit-control-engine**: Added `customers.on_hold` column + `customer_credit_holds` table (v045); helper `checkCreditStatus`; guard on `POST /api/sales-orders` (412 CREDIT_HOLD + inline override); `GET/POST /api/customers/[id]/credit-status|credit-release`; nightly sweep `runCreditAgingSweep`; credit holds admin page (2026-05-23)
- **min-price-hardstop**: Enforced server-side min_price and clr_min_price bounds on POS line save, sales-order POST, and sales-invoice POST endpoints, and integrated in-app OverridePinModal overrides in POS and Sales/OMS creation (2026-05-23)
- **manager-override-pin**: Implemented reusable in-app supervisor PIN authorization, added override audit logs and lockout security, created verification hooks, modals, and a premium JSON audit log viewer (2026-05-23)
- **pricing-engine**: Implemented central resolver for dynamic pricing (precedence: contracts > member tiers > default fallback), created CRUD APIs and bulk CSV importer, and integrated resolver into POS & Sales Orders line creation (2026-05-23)
- **wms-virtual-warehouses**: Introduced thermal zones and virtual locations, created admin control endpoints, added expandable zones details row inside warehouse table, and registered new ledger entry types on inventory UI (2026-05-23)
- **multi-bu-foundation**: Partitioned warehouses and users by Business Unit, added auditor role, extended warehouse scope helper, and added Admin BU list UI (2026-05-23)

## Active Work
- None. All tracks completed and fully verified!

---

## DB Facts
- **customers**: column `on_hold` (BOOLEAN NOT NULL DEFAULT FALSE) (v045).
- **customer_credit_holds**: columns `id` (UUID), `customer_id` (UUID REFERENCES customers), `reason` (TEXT), `started_at` (TIMESTAMPTZ), `released_at` (TIMESTAMPTZ nullable), `released_by` (UUID REFERENCES users nullable), `released_reason` (TEXT nullable), `created_at` (TIMESTAMPTZ) (v045).
- **users**: column `override_pin_hash` (VARCHAR(255), nullable) (v044).
- **override_audit**: columns `id` (BIGSERIAL), `user_id` (UUID REFERENCES users), `action` (VARCHAR(100)), `target_table` (VARCHAR(100)), `target_id` (UUID), `reason_code` (VARCHAR(50)), `original_value` (JSONB), `override_value` (JSONB), `jti` (VARCHAR(100) UNIQUE), `created_at` (TIMESTAMPTZ) (v044).
- **override_pin_attempts**: columns `user_id` (UUID REFERENCES users), `attempted_at` (TIMESTAMPTZ), `success` (BOOLEAN) (v044).
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
- `GET /api/customers/[id]/credit-status`: returns live CreditStatus (on_hold, outstanding, credit_limit, max_aging_days) (v045).
- `POST /api/customers/[id]/credit-release`: consumes override_token (action='credit_release'), releases hold record + clears on_hold (v045).
- `POST /api/sales-orders` returns 412 `CREDIT_HOLD` when customer is on hold; accepts `credit_release_token` for inline override (v045).
- `GET /api/customers` accepts `on_hold=true|false` filter (v045).
- `lib/credit/check-credit-status.ts`: queries outstanding invoices + aging; returns CreditStatus (v045).
- `lib/jobs/credit-aging-sweep.ts`: idempotent nightly job; sets on_hold=TRUE for delinquent customers (v045).
- `lib/pricing/enforce-min-price.ts`: server-side min-price and clearance min-price boundary enforcement guard with manager token consumption.
- `POST /api/auth/verify-override-pin`: verifies PIN and issues a short-lived token (60s) for override actions (v044).
- `PATCH /api/admin/users/[id]/override-pin`: sets or resets a manager/admin's override PIN (v044).
- `GET /api/admin/override-audit`: retrieves paginated list of override audit logs with filters (v044).
- `GET /api/auth/active-authorizers`: list of active managers/admins to authorize overrides (v044).
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

## Migration Numbers (latest: 045)
Next migration = `046_<name>.sql`
Latest: `045_credit_control_engine.sql`


---

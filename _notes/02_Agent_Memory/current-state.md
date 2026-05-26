---
updated: 2026-05-25
updated_by: Gemini
---

# Project Current State — Anti-Context-Loss Briefing

## Last 5 Completed Tracks
- **auto-replenishment-w1-w2**: Automated W1 front-store reordering from W2 wholesale hub, implemented nightly system-scope job, exposed secure REST endpoints for approval/rejection/editing, posted double-entry inter-company journal entries to `1300-TRD`/`1300-AKRA`/`2190-AKRA`/`1190-TRD` on approval, and designed premium WMS auto-replenish dashboard (2026-05-26)
- **hrzoft-integration**: Synced employee master data from external HR system (Hrzoft) nightly, handled full mapping and profiles synchronization, created database tables `external_user_sync` and `hrzoft_sync_runs` with indexes, exposed API routes `/api/admin/hrzoft/sync` and `/api/admin/hrzoft/last-run`, and built a premium, modern integration panel supporting manual sync actions, conflict logging, and employee grid mapping (2026-05-25)
- **accounting-export-adapters**: Implemented a unified general ledger exporter supporting Express, FlowAccount, and PEAK, created database table `accounting_export_jobs` to audit past exports, exposed API routes `/api/accounting/export` and `/api/accounting/export/jobs`, and built premium, responsive interfaces for date-range downloads and log tables (2026-05-25)
- **auditor-role-and-readonly-access**: Wired `auditor` role so they have strictly read-only access, hard-blocked all non-GET requests with a 403 error at the API layer, conditionally hid write controls across AP and accounting fiscal period/journal UIs, implemented two specialized auditing endpoints (`GET /api/accounting/audit/ledger` and `GET /api/accounting/audit/trial-balance`), and designed a premium, dedicated auditor dashboard landing page (2026-05-25)
- **vendor-wht-and-form-50**: Implemented Thai withholding-tax (WHT) automatic handling on AP payments, added certificates tracking with doc sequence number allocation, recorded WHT journal entries (DR AP, CR Cash/Bank, CR WHT Payable), and created premium bilingual Sarabun-font Form 50 Twi PDF rendering engine (2026-05-25)

## Active Work
- None.

---

## DB Facts
- **products.w1_reorder_point**, **products.w1_reorder_qty**: reorder parameters for W1 store replenishment (v063).
- **transfer_suggestions**: tracks nightly replenishment suggestions with status `pending`, `approved`, `rejected`, or `executed` (v063).
- **accounts**: seeded inter-company accounts `1300-TRD` (Inventory — TRD), `1300-AKRA` (Inventory — AKRA), `2190-AKRA` (Inter-company Payable — AKRA), and `1190-TRD` (Inter-company Receivable — TRD) (v063).
- **external_user_sync**: maps Hrzoft `employee_id` to local users, tracks sync status and conflict notes (v061).
- **hrzoft_sync_runs**: audit log table recording each sync execution stats and statuses (v062).
- **accounting_export_jobs**: audit table logging format, date range, requested_by, status, and output_meta for general ledger exports (v060).
- **vendors.default_wht_rate**: default withholding tax rate for AP payments (v059).
- **wht_certificates**: table tracking generated withholding tax certificates and Form 50 Twi doc numbers (v059).
- **accounts**: seeded `2310` (Withholding Tax Payable) for WHT liability postings (v059).
- **products.moving_avg_cost**: tracks global moving average cost (MAC) dynamically recalculated via DB trigger (v058).
- **trg_stock_ledger_mac**: AFTER INSERT trigger on stock_ledger executing on 'grn_receipt' entries to dynamically update product MAC (v058).
- **idx_si_customer_created**: covering index on `sales_invoices(customer_id, created_at DESC)` for price history lookup parity (v057).
- **idx_do_line_items_product**: index on `do_line_items(product_id)` (v057).
- **product_channel_uoms**: whitelist of allowed UoMs per product per sales channel (TRD/AKRA) to enforce wholecase strict lock (v056).
- **warehouses**: restructured physical warehouses to `W1`..`W5`. Standalone cold warehouses `WH-06` and `WH-07` removed. Virtual warehouses `V-BUF-TRD`, `V-BUF-AKRA`, `V-DMG`, `V-CLR`, `V-KILL`, `V-PACK`, `W1-DSP-STG` registered in `warehouses` table for physical-virtual transaction parity (v055).
- **warehouse_zones**: added sub-zero frozen zone `W4-FRZ-STG` under `W4` (v054).
- **dispatch_exception_logs**: created table to log minor shortage auto-adjusts, major shortage overrides, upsells, and redirect events (v055).
- **repack_orders**: added `yield_loss_qty` (NUMERIC), `yield_loss_reason` (TEXT), and `closed_je_id` (UUID REFERENCES journal_entries) (v053).
- **repack_loss_settings**: new table for threshold configuration (default 5%) (v053).
- **accounts**: seeded `5910` (COGS — Operational Waste) for yield loss posting (v053).
- **lots**: tracks `product_id`, `warehouse_id`, `expiry_date` (v004).
- **pick_list_lines**: added `lot_id` and `fefo_override_jti` (v050).
- **stock_ledger**: INSERT-ONLY. Entry types include `repack_stage_in`, `repack_stage_out`, `scrap`.

## API Routes
- **GET /api/replenish/suggestions**: returns paginated transfer suggestions with product info and stock details (v063).
- **PATCH /api/replenish/suggestions/[id]**: handles approve, reject, or edit suggestion with automatic inter-BU journal entry (v063).
- **POST /api/admin/replenish/run-now**: administrator synchronous nightly job runner (v063).
- **POST /api/admin/hrzoft/sync**: manual sync trigger (v061).
- **GET /api/admin/hrzoft/last-run**: details of the last sync run + mapping records (v061).
- **GET /api/accounting/audit/ledger**: Paginated, filterable audit ledger line query (v060).
- **GET /api/accounting/audit/trial-balance**: Period/date scoped trial balance calculations for auditor validation (v060).
- **GET /api/ap/wht**: query lists of WHT certificates with vendor/month filters (v059).
- **GET /api/ap/wht/[id]**: retrieve a single withholding tax certificate (v059).
- **GET /api/ap/wht/[id]/form-50-twi.pdf**: premium Sarabun-font Form 50 Twi withholding tax certificate PDF engine (v059).
- **GET /api/admin/mac/recalc**: Trigger manual recalculation/backfill of product MACs (v058).
- **GET /api/pos/price-history**: Query history of last purchase price for customer SKU (v057).
- **GET/PATCH /api/admin/product-channel-uoms**: Whitelist config for sales channel allowed UoMs (v056).
- **PATCH /api/repack/[id]**: action `'complete'` now requires `yield_loss_qty`. Posts JE and ledger entries on success (v053).
- **GET/PATCH /api/settings/repack-loss-threshold**: Admin endpoint for yield loss threshold (v053).
- **POST /api/grn/merge-brs**: Supervisor action to compile GRN from BRs (v051).
- **POST /api/ap/invoices/match-confirm**: Final 3-way match and stock release (v051).
- **POST /api/pick-lists/[id]/scan-lot**: FEFO validation with override (v050).

## Project Standards
- **Repack Flow**: Stock moves BLK -> V-PACK (Staging) -> RTL (Retail). Loss moves V-PACK -> V-KILL (Scrap).
- **Accounting**: Yield loss > 0 triggers auto-JE: DR 5910 (Waste), CR 1300 (Inventory).

---

## Migration Numbers (latest: 063)
Next migration = `064_<name>.sql`
Latest: `063_auto_replenishment.sql`

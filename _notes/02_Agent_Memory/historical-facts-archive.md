# Historical DB Facts & API Routes Archive — BUYMORE ERP

This file acts as a cold storage archive for database facts, indexes, schema changes, and API endpoints completed during earlier tracks (v004 to v068). This keeps the main `current-state.md` context highly performant, high-signal, and compact.

---

## 🏛️ Historical DB Facts (v004 - v068)

- **idx_ledger_cost_lookup**: covering index on `stock_ledger(product_id, warehouse_id, created_at DESC) WHERE entry_type = 'grn_receipt'` to optimize FIFO inventory valuation (v068).
- **field_sales_checkins**: table tracking agent-customer geolocation check-ins, accuracy meters, timestamps, and indexes on agent/time and customer (v067).
- **vendor_rebate_contracts**: table storing rebate threshold and rate with date ranges per vendor and period type enum (v066).
- **vendor_rebate_accruals**: table tracking purchases progression, accrued amount, status, and posted journal entries (v066).
- **accounts**: seeded leaf clearing entities 1220 (Rebate Receivable) and 4300 (Rebate Income) (v066).
- **npd_trials**: table tracking active/completed/extended/cut trials with foreign key to products, decision details, notes, and index on status and end_date (v065).
- **products.is_npd_trial**: boolean column indicating if a product is an active NPD trial SKU (v065).
- **sku_performance_snapshot**: materialized view aggregating rolling 30d/365d sales, gross margin, sell-through, days-on-hand, and velocity bucket per product, refreshed nightly (v064).
- **sku_cut_candidates**: view evaluating bottom 10% scored SKUs slated for discontinuation with reasons (v064).
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

---

## 🗺️ Historical API Routes (v050 - v068)

- **POST /api/field-sales/checkin**: Register a new agent check-in (auto checking out older active ones) (v067).
- **POST /api/field-sales/checkout**: Ends the current active agent check-in session (v067).
- **GET /api/field-sales/today**: Retrieve check-in coordinates logs for a date range (managers/admins only) (v067).
- **GET/POST /api/rebate/contracts**: Query and create vendor rebate contracts (v066).
- **PATCH /api/rebate/contracts/[id]**: Modify/extend an existing rebate contract (v066).
- **GET/POST /api/rebate/accruals**: Fetch vendor rebate accruals list or trigger calculations job sweep on-demand (v066).
- **POST /api/rebate/accruals/[id]/realise**: Authorise accrual, post Double-Entry Journal Entry (DR 1220 / CR 4300 or 5100) and update status (v066).
- **GET/POST/PATCH /api/products/[id]/npd-trial**: Retrieve trial details, schedule a new trial/extension, graduate a product, or execute a cut with virtual warehouse stock clearance transfers (v065).
- **GET /api/analytics/npd-trials/decisions-pending**: Expose expired trial SKUs with automated graduation/cut recommendations based on SKU scoring logic (v065).
- **GET /api/analytics/npd-trials**: Expose complete filterable list of active and historical NPD trials (v065).
- **GET /api/analytics/sku-performance**: returns paginated SKU performance snapshot data with velocity and search filtering (v064).
- **GET /api/analytics/sku-cut-candidates**: returns list of candidates slated for discontinuation (v064).
- **POST /api/analytics/sku-performance/refresh**: trigger manual concurrent refresh of SKU performance snapshot (v064).
- **GET /api/forecast/[product_id]**: computes and returns next-90-days demand forecasting points, upper, and lower confidence limits (v064).
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

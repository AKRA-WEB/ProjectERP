---
updated: 2026-05-26
updated_by: Gemini
---

# Project Current State — Anti-Context-Loss Briefing

## Last 5 Completed Tracks
- **seed-ap-invoices-stocked-grns**: Extended `lib/db/seed.js` with `seedStockedGrnsAndInvoices()` to seed 2 stocked GRNs (PKG-002/BEV-001 in W2), 2 fully-received POs, 2 stock ledger entries, and 1 matched + 1 mismatched AP invoice. Fixed BEFORE INSERT trigger FK race on `po_invoice_match_variances` by inserting at matched amount then UPDATE to mismatch. All acceptance criteria verified (2026-05-28)
- **grn-reversal**: Implemented strict reversal/cancellation for stocked Goods Receipt Notes, creating negative stock ledger entries to decrement stock on-hand, voiding linked AP invoices, reverting PO status when sole active GRN, and rendering premium supervisor confirmation & detailed outbound consumption blocking UI (2026-05-28)
- **thai-vat-report**: Designed and implemented monthly purchase and sales VAT reports (ภ.พ.30) with dynamic calculations, created `/api/accounting/vat/purchase` and `/sales` routes, implemented administrative period locking with persistent snapshots in `vat_report_runs` (`/api/accounting/vat/finalize`), and built a premium responsive tabbed UI page with Excel-friendly UTF-8 BOM CSV exports (2026-05-28)
- **three-way-matching**: Installed strict three-way matching trigger `reconcile_po_invoice` on `po_invoices`, blocked AP payments when not fully matched with HTTP 422, created a manager review queue page at `app/app/ap/match-queue`, and surfaced variances side-by-side (2026-05-28)
- **mock-data-seed**: Implemented `lib/db/seed.js` script to populate all BUYMORE ERP database modules with highly realistic, bilingual Thai/English mock data, making all pages/actions fully functional and clickable without manual data entry. Confirmed 100% clean Next.js lint and `tsc --noEmit` validation results (2026-05-28)

## Active Work
- None.

---

## DB Facts
- **grn_reversal_log**: table tracking full GRN reversals, logging reason, author, original stocked timestamp, and cancellation timestamp (v072).
- **po_invoices.voided**: boolean column flagging voided AP invoices after GRN cancellation (v072).
- **vat_report_runs**: table tracking locked and finalized VAT report rounds (purchase/sales) with persistent JSONB snapshots and period unique constraints (v071).
- **po_invoices.match_status**: enum status (`pending`, `matched`, `mismatched`) to check three-way match resolution (v070).
- **po_invoice_match_variances**: table storing detailed variances between PO/GRN values and the invoice header amount (v070).
- **trg_po_invoice_match**: BEFORE INSERT OR UPDATE trigger on `po_invoices` executing `reconcile_po_invoice()` (v070).
- **hr_stats_snapshot**: materialized view storing slow-changing HR aggregates, enabling high-performance read scaling (v069).
- **idx_attendance_date_employee**, **idx_leave_status_created**, **idx_leave_employee_dates**: high-performance composite indexes to speed up real-time attendance and leave dashboard list queries (v069).
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

## API Routes
- **POST /api/grn/[id]/cancel**: Cancels/reverses a stocked GRN under strict transaction boundaries, checking for outbound stock consumption and linked invoice payment status (v072).
- **GET /api/accounting/vat/purchase**: retrieves purchase VAT lines (vendor, invoice, base, VAT 7%) dynamically or from snapshot (v071).
- **GET /api/accounting/vat/sales**: retrieves sales VAT lines (POS/B2B invoice, base, VAT 7%) dynamically or from snapshot (v071).
- **POST /api/accounting/vat/finalize**: freezes and snapshots the purchase/sales VAT lines for a given month+year (admin-only) (v071).
- **GET /api/ap/match-queue**: retrieves a list of all mismatched AP invoices with their variances for manager review (v070).
- **POST /api/admin/snapshots/refresh**: Request authenticated on-demand refresh of database snapshots (v069).
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

## Project Standards
- **Repack Flow**: Stock moves BLK -> V-PACK (Staging) -> RTL (Retail). Loss moves V-PACK -> V-KILL (Scrap).
- **Accounting**: Yield loss > 0 triggers auto-JE: DR 5910 (Waste), CR 1300 (Inventory).
- **Obsidian Linter & QA**: Running `npm run qa:verify` automatically runs `npm run check:notes` to enforce alignment of database migrations with `current-state.md` and check for broken local markdown links. Run `npm run check:notes -- --fix` to auto-repair broken archive link paths in `conductor/index.md`.

---

## Migration Numbers (latest: 072)
    Next migration = `073_<name>.sql`
    Latest: `072_grn_reversal.sql`

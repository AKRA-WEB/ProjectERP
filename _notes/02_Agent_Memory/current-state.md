---
updated: 2026-05-24
updated_by: Gemini
---

# Project Current State — Anti-Context-Loss Briefing

## Last 5 Completed Tracks
- **price-history-alert-pos**: Created POS line-add toast alert showing customer purchase history for repeat SKUs, added optimized indexes, and implemented querying API (2026-05-24)
- **wholecase-strict-lock-akra**: Enforced wholecase-only sales for AKRA channel, created whitelists table and seeded default UoMs, added admin management screen, and restricted OMS order lines to allowed whitelists (2026-05-24)
- **operation-core-sync-orion-2026-05-24**: Synchronized location models, added transfer qty modes enum, and created dispatch exception logging schema (2026-05-24)
- **adjust-warehouses-and-thermal-zones**: Realigned physical and virtual warehouses, restructured cold-chain zones, added sub-zero operational freezer, and enabled BU source tagging (2026-05-24)
- **repack-yield-loss**: Implemented shrinkage tracking in repack operations with auto-JE posting and manager overrides (2026-05-23)

## Active Work
- None.

---

## DB Facts
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
- `GET /api/pos/price-history`: Query history of last purchase price for customer SKU (v057).
- `GET/PATCH /api/admin/product-channel-uoms`: Whitelist config for sales channel allowed UoMs (v056).
- `PATCH /api/repack/[id]`: action `'complete'` now requires `yield_loss_qty`. Posts JE and ledger entries on success (v053).
- `GET/PATCH /api/settings/repack-loss-threshold`: Admin endpoint for yield loss threshold (v053).
- `POST /api/grn/merge-brs`: Supervisor action to compile GRN from BRs (v051).
- `POST /api/ap/invoices/match-confirm`: Final 3-way match and stock release (v051).
- `POST /api/pick-lists/[id]/scan-lot`: FEFO validation with override (v050).

## Project Standards
- **Repack Flow**: Stock moves BLK -> V-PACK (Staging) -> RTL (Retail). Loss moves V-PACK -> V-KILL (Scrap).
- **Accounting**: Yield loss > 0 triggers auto-JE: DR 5910 (Waste), CR 1300 (Inventory).

---

## Migration Numbers (latest: 057)
Next migration = `058_<name>.sql`
Latest: `057_price_history_index.sql`

----

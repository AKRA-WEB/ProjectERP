---
updated: 2026-05-23
updated_by: Gemini
---

# Project Current State — Anti-Context-Loss Briefing

## Last 5 Completed Tracks
- **repack-yield-loss**: Implemented shrinkage tracking in repack operations with auto-JE posting and manager overrides (2026-05-23)
- **strict-receiving-flow**: Implemented 5-step receiving (PR->PO->BR->GR->Match) with blind receiving and 3-way matching (2026-05-23)
- **fefo-enforcement**: Implemented FEFO-based picking with manager PIN override (2026-05-23)
- **dispatch-check-exit-gate**: Implemented final scan-out gate for warehouse release (2026-05-23)
- **pos-delta-slip-and-versioning**: Implemented Invoice Versioning with deterministic barcodes (2026-05-23)

## Active Work
- None.

---

## DB Facts
- **repack_orders**: added `yield_loss_qty` (NUMERIC), `yield_loss_reason` (TEXT), and `closed_je_id` (UUID REFERENCES journal_entries) (v053).
- **repack_loss_settings**: new table for threshold configuration (default 5%) (v053).
- **accounts**: seeded `5910` (COGS — Operational Waste) for yield loss posting (v053).
- **lots**: tracks `product_id`, `warehouse_id`, `expiry_date` (v004).
- **pick_list_lines**: added `lot_id` and `fefo_override_jti` (v050).
- **stock_ledger**: INSERT-ONLY. Entry types include `repack_stage_in`, `repack_stage_out`, `scrap`.

## API Routes
- `PATCH /api/repack/[id]`: action `'complete'` now requires `yield_loss_qty`. Posts JE and ledger entries on success (v053).
- `GET/PATCH /api/settings/repack-loss-threshold`: Admin endpoint for yield loss threshold (v053).
- `POST /api/grn/merge-brs`: Supervisor action to compile GRN from BRs (v051).
- `POST /api/ap/invoices/match-confirm`: Final 3-way match and stock release (v051).
- `POST /api/pick-lists/[id]/scan-lot`: FEFO validation with override (v050).

## Project Standards
- **Repack Flow**: Stock moves BLK -> V-PACK (Staging) -> RTL (Retail). Loss moves V-PACK -> V-KILL (Scrap).
- **Accounting**: Yield loss > 0 triggers auto-JE: DR 5910 (Waste), CR 1300 (Inventory).

---

## Migration Numbers (latest: 053)
Next migration = `054_<name>.sql`
Latest: `053_repack_yield_loss.sql`


---

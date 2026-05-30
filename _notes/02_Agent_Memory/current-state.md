---
updated: 2026-05-30
updated_by: Gemini
---

# Project Current State — Anti-Context-Loss Briefing

## 🏛️ Stable Modules (Core Foundations)
- **Atlas (MOC):** Master Map of Content (00_ATLAS) serving as the hub for all documentation, phased track archives, and API catalogs (v073).
- **Core (IAM):** Multi-BU ready, RBAC system, Warehouse assignments.
- **Inventory:** Insert-only ledger, Real-time balances, Multi-UOM engine (v026).
- **WMS:** Strict Receiving (GRN), Inbound Orders (IO), Split GRN, Reversal (v072).
- **POS:** Price tiers, Member points, Hybrid draft flow, Picking slips.
- **Sales:** SQ -> SO -> DO -> SI full cycle, AKRA channel locking.
- **Accounting:** Chart of Accounts, JE Posting, 3-Way Match (v070), Thai VAT (v071).

## Last 5 Completed Tracks
- **i18n-t3-accounting**: Fully migrated all Accounting pages (VAT report, General Ledger audit, Chart of Accounts list/new/edit, Journal Entries list/detail, external export adapters/jobs, and 6 reports including AP/AR aging, Balance Sheet, profit-loss, trial balance, general ledger) to i18n dynamic translation (2026-05-30)
- **i18n-t2-keys**: Added ~65 missing translation keys to en.json and th.json in perfect 1-to-1 sync, covering modules for accounting, GRN, WMS, admin, and menu categories (2026-05-30)
- **i18n-t1-prevention**: Installed `eslint-plugin-local-rules`, created `no-hardcoded-thai` ESLint rule (warn), added scaffold template `scripts/new-page-template.tsx`, wrote `docs/i18n.md`, updated CLAUDE.md Knowledge Base + QA loop (2026-05-30)
- **perf-tier4-suspense-streaming**: Converted Dashboard, GRN, Inventory, AP, and SKU-Cut pages to React Server Components (RSC) with parallel database fetches. Replaced expensive `limit=1000` GRN scans with an optimized count endpoint. ~85% reduction in hydration latency (2026-05-28)
- **seed-ap-invoices-stocked-grns**: Extended `lib/db/seed.js` to seed stocked GRNs, fully-received POs, stock ledger entries, and matched/mismatched AP invoices. Fixed BEFORE INSERT trigger FK race on `po_invoice_match_variances` (2026-05-28)

## Active Work
- i18n-t4-grn-purchasing through i18n-t6-menu-remaining (pending, need fresh session each)

---

## DB Facts (Recent & Active)
- **grn_reversal_log**: table tracking full GRN reversals, logging reason, author, original stocked timestamp, and cancellation timestamp (v072).
- **po_invoices.voided**: boolean column flagging voided AP invoices after GRN cancellation (v072).
- **vat_report_runs**: table tracking locked and finalized VAT report rounds (purchase/sales) with persistent JSONB snapshots and period unique constraints (v071).
- **po_invoices.match_status**: enum status (`pending`, `matched`, `mismatched`) to check three-way match resolution (v070).
- **po_invoice_match_variances**: table storing detailed variances between PO/GRN values and the invoice header amount (v070).
- **trg_po_invoice_match**: BEFORE INSERT OR UPDATE trigger on `po_invoices` executing `reconcile_po_invoice()` (v070).
- **hr_stats_snapshot**: materialized view storing slow-changing HR aggregates, enabling high-performance read scaling (v069).
- **idx_attendance_date_employee**, **idx_leave_status_created**, **idx_leave_employee_dates**: high-performance composite indexes to speed up real-time attendance and leave dashboard list queries (v069).

> [!NOTE]
> Older database facts (v004 - v068) have been archived to [historical-facts-archive.md](file:///C:/dev/projectERP/_notes/02_Agent_Memory/historical-facts-archive.md) to keep the primary context compact.

---

## API Routes (Recent & Active)
- **POST /api/grn/[id]/cancel**: Cancels/reverses a stocked GRN under strict transaction boundaries, checking for outbound stock consumption and linked invoice payment status (v072).
- **GET /api/grn/status-counts**: retrieves counts of Goods Receipt Notes grouped by status for highly-responsive tab-count summaries (v073).
- **GET /api/accounting/vat/purchase**: retrieves purchase VAT lines (vendor, invoice, base, VAT 7%) dynamically or from snapshot (v071).
- **GET /api/accounting/vat/sales**: retrieves sales VAT lines (POS/B2B invoice, base, VAT 7%) dynamically or from snapshot (v071).
- **POST /api/accounting/vat/finalize**: freezes and snapshots the purchase/sales VAT lines for a given month+year (admin-only) (v071).
- **GET /api/ap/match-queue**: retrieves a list of all mismatched AP invoices with their variances for manager review (v070).
- **POST /api/admin/snapshots/refresh**: Request authenticated on-demand refresh of database snapshots (v069).

> [!NOTE]
> Older API routes (v050 - v068) have been archived to [historical-facts-archive.md](file:///C:/dev/projectERP/_notes/02_Agent_Memory/historical-facts-archive.md).

---

## Project Standards
- **Repack Flow**: Stock moves BLK -> V-PACK (Staging) -> RTL (Retail). Loss moves V-PACK -> V-KILL (Scrap).
- **Accounting**: Yield loss > 0 triggers auto-JE: DR 5910 (Waste), CR 1300 (Inventory).
- **Obsidian Linter & QA**: Running `npm run qa:verify` automatically runs `npm run check:notes` to enforce alignment of database migrations with `current-state.md` and check for broken local markdown links.

---

## Migration Numbers (latest: 072)
    Next migration = `073_<name>.sql`
    Latest: `072_grn_reversal.sql`

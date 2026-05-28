---
track: thai-vat-report
phase: V2.3
sequence: 29
status: Verified
owner: Chen
created: 2026-05-28
updated: 2026-05-28
depends_on: []
estimate: M
assigned_to: [Paku]
tags: [compliance, accounting, vat, revenue-dept]
---

# Thai VAT Report (ภ.พ.30)

## Goal
Generate monthly Purchase VAT Report (ภาษีซื้อ) and Sales VAT Report (ภาษีขาย) for filing with the Revenue Department (กรมสรรพากร). Reports must surface the tax point date (วันที่เกิดธุรกรรม) correctly per Thai GAAP: GRN stocking date for purchases, transaction/invoice date for sales.

## Scope IN
- New enum `vat_report_type ENUM('purchase','sales')`.
- New table `vat_report_runs` — snapshot a finalised period so duplicate filings are blocked.
- `GET /api/accounting/vat/purchase?year=&month=` — returns line-level purchase VAT data (vendor, invoice, GRN date, base amount, VAT 7%).
- `GET /api/accounting/vat/sales?year=&month=` — returns line-level sales VAT data (customer/receipt, date, base amount, VAT 7%).
- `POST /api/accounting/vat/finalize` — locks period; prevents re-run; stores snapshot.
- UI page `app/(app)/accounting/vat-report/page.tsx` — period picker, two tabs (Purchase | Sales), export CSV button.
- Export CSV follows Revenue Dept format columns: ลำดับ, วันที่, เลขที่ใบกำกับ, ชื่อผู้ขาย/ลูกค้า, เลขประจำตัวผู้เสียภาษี, มูลค่าสินค้า, ภาษีมูลค่าเพิ่ม.

## Scope OUT
- Auto-submit to e-Filing portal — manual upload only in V2.3.
- PP.30 summary totals calculation — manual by accountant from CSV.
- Tax-exempt / zero-rated products — all products assumed 7% VAT in V2.3.

## Acceptance Criteria
1. Purchase VAT query returns one row per `po_invoices` row where the linked GRN was stocked in the selected month (tax point = `goods_receipt_notes.stocked_at`).
2. Sales VAT query returns one row per `pos_transactions` (tax_point = `created_at`) and per `sales_invoices` (tax_point = `issue_date`) in the selected month — deduplicated.
3. `POST /api/accounting/vat/finalize` with same year+month+type twice returns 409 (already finalized).
4. CSV export matches Revenue Dept column order.
5. `npm run qa:verify` passes.

## Migrations
- `071_thai_vat_report.sql` — new enum `vat_report_type`, new table `vat_report_runs`.

## API Routes
- New: `GET /api/accounting/vat/purchase`
- New: `GET /api/accounting/vat/sales`
- New: `POST /api/accounting/vat/finalize`

## UI Screens
- New: `app/(app)/accounting/vat-report/page.tsx`

## Test Plan
- Manual: select month with known PO invoice stocked in that month → purchase tab shows it.
- Manual: select month with known POS sale → sales tab shows it.
- Manual: finalize → re-finalize same period → 409.
- Manual: CSV download → open in Excel → columns match Revenue Dept format.
- Lint + tsc.

## Risks
- `goods_receipt_notes.stocked_at` is set by the `/api/grn/[id]/stock` route (`stocked_at = NOW()`). Verify column exists in migration 006 or later. **Pre-verified: column `stocked_at TIMESTAMPTZ` exists in migration 006.**
- `sales_invoices` table: verify it exists and has `issue_date` column. Locate via `Read migrations/017_sales.sql`.
- POS `vat_amount` is stored as VAT-inclusive (VAT = total × 7/107). Confirm formula from existing `pos_transactions` INSERT in `app/api/pos/transactions/route.ts:203` — `vatAmount = Math.round(total * VAT_RATE / (1 + VAT_RATE) * 100) / 100`. Report should surface this same figure.

## Verified Facts (pre-plan)
- `goods_receipt_notes.stocked_at TIMESTAMPTZ` — migration 006.
- `po_invoices`: `id, po_id, vendor_id, grn_id, invoice_number, invoice_date, due_date, amount, paid_amount` — migration 031.
- `pos_transactions.vat_amount NUMERIC(15,2)` — migration 016.
- `purchase_orders.total_amount NUMERIC(15,2)` — migration 005.
- `VAT_RATE` constant in `lib/constants.ts` — do not hardcode 0.07.
- Account `2300` = ภาษีมูลค่าเพิ่มค้างจ่าย (VAT Payable) — migration 018.

---

## Tasks

### T1 — Migration `071_thai_vat_report.sql`
**File:** `migrations/071_thai_vat_report.sql` (new)
**Operation:** add migration

**Details:**
- Top of file (outside transaction):
  ```sql
  DO $$ BEGIN
    CREATE TYPE vat_report_type AS ENUM ('purchase', 'sales');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  ```
- Wrap in `BEGIN; ... COMMIT;`:
  ```sql
  CREATE TABLE IF NOT EXISTS vat_report_runs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_year  INTEGER NOT NULL,
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    report_type  vat_report_type NOT NULL,
    generated_by UUID NOT NULL REFERENCES users(id),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_base   NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_vat    NUMERIC(15,2) NOT NULL DEFAULT 0,
    snapshot     JSONB,
    UNIQUE (period_year, period_month, report_type)
  );
  CREATE INDEX IF NOT EXISTS idx_vat_runs_period ON vat_report_runs(period_year, period_month);
  ```

**Quality Gate:**
- Transaction boundary: `BEGIN`/`COMMIT` (enum outside).
- Side effects: none.

- [x] T1 complete

### T2 — `GET /api/accounting/vat/purchase`
**File:** `app/api/accounting/vat/purchase/route.ts` (new)
**Operation:** create

**Details:**
- Auth; `assertRole(u, ['admin','manager','auditor'])`.
- Query params: `year` (required int), `month` (required int 1-12).
- Query:
  ```sql
  SELECT
    pi.invoice_number,
    grn.stocked_at AS tax_point_date,
    v.name_th AS vendor_name,
    v.tax_id AS vendor_tax_id,
    pi.amount AS base_amount,
    ROUND(pi.amount * $VAT_RATE / (1 + $VAT_RATE), 2) AS vat_amount
  FROM po_invoices pi
  JOIN goods_receipt_notes grn ON grn.id = pi.grn_id
  JOIN vendors v ON v.id = pi.vendor_id
  WHERE
    EXTRACT(YEAR FROM grn.stocked_at) = $1
    AND EXTRACT(MONTH FROM grn.stocked_at) = $2
  ORDER BY grn.stocked_at ASC
  ```
  Note: `pi.amount` from auto-created invoice already represents the GRN-received amount × PO price (excludes VAT). Confirm by reading auto-invoice creation code in `app/api/grn/[id]/stock/route.ts` line ~133.
- Also check `vat_report_runs` for existing finalized run; include `is_finalized` flag in response.
- Return: `apiSuccess({ data: rows[], total_base, total_vat, is_finalized, period })`.

**Quality Gate:**
- Response shape: `apiSuccess({ data, total_base, total_vat, is_finalized, period: {year, month} })`.

- [x] T2 complete

### T3 — `GET /api/accounting/vat/sales`
**File:** `app/api/accounting/vat/sales/route.ts` (new)
**Operation:** create

**Details:**
- Auth; `assertRole(u, ['admin','manager','auditor'])`.
- Query params: `year`, `month`.
- Two UNION sources:
  1. POS transactions: `SELECT receipt_number AS doc_number, created_at AS tax_point_date, NULL AS customer_tax_id, 'POS' AS channel, (total - vat_amount) AS base_amount, vat_amount FROM pos_transactions WHERE status='completed' AND EXTRACT(YEAR FROM created_at)=$1 AND EXTRACT(MONTH FROM created_at)=$2`
  2. Sales invoices (if table exists): verify via `Read migrations/017_sales.sql` — look for `sales_invoices` table. If exists: `SELECT si_number AS doc_number, issue_date AS tax_point_date, c.tax_id AS customer_tax_id, 'SO' AS channel, (si.subtotal) AS base_amount, (si.vat_amount) AS vat_amount FROM sales_invoices si JOIN customers c ON c.id=si.customer_id WHERE ...`
- Return: `apiSuccess({ data: rows[], total_base, total_vat, is_finalized, period })`.

**Quality Gate:**
- Response shape same as T2.

- [x] T3 complete

### T4 — `POST /api/accounting/vat/finalize`
**File:** `app/api/accounting/vat/finalize/route.ts` (new)
**Operation:** create

**Details:**
- Auth; `assertRole(u, ['admin'])`.
- Body: `{ year: number, month: number, type: 'purchase'|'sales' }`.
- Check existing run → 409 if exists.
- Re-run same query as T2/T3 to compute totals + snapshot.
- INSERT into `vat_report_runs`.
- Return: `apiSuccess({ run_id, period_year, period_month, report_type, total_base, total_vat, generated_at })`.

**Quality Gate:**
- 409 on duplicate.
- Transaction: `BEGIN/COMMIT` for INSERT.

- [x] T4 complete

### T5 — UI `app/(app)/accounting/vat-report/page.tsx`
**File:** `app/(app)/accounting/vat-report/page.tsx` (new)
**Operation:** create

**Details:**
- `'use client'`.
- State: `{ year, month, tab: 'purchase'|'sales', data, isFinalized }`.
- Period picker: year input (default current) + month select 1-12.
- Two tabs: ภาษีซื้อ | ภาษีขาย.
- Table columns: ลำดับ | วันที่ | เลขที่เอกสาร | ผู้ขาย/ลูกค้า | เลขภาษี | มูลค่าสินค้า | VAT 7%.
- Totals row at bottom.
- Buttons: "ส่งออก CSV" (client-side CSV generation from data array) | "ล็อกรายงาน" (calls finalize, disabled if already finalized).
- CSV columns: ลำดับ,วันที่,เลขที่ใบกำกับ,ชื่อผู้ขาย/ลูกค้า,เลขประจำตัวผู้เสียภาษี,มูลค่าสินค้า,ภาษีมูลค่าเพิ่ม.
- Use `formatDate()` from `lib/format.ts`, `formatCurrency()` for THB amounts.
- Add nav item to Sidebar `accounting` group.

- [x] T5 complete

### T6 — Update `current-state.md`
**File:** `_notes/02_Agent_Memory/current-state.md`
**Operation:** extend

**Details:**
- DB: `vat_report_runs` (period lock, snapshot JSONB). Migration 071.
- API: `GET /api/accounting/vat/purchase`, `GET /api/accounting/vat/sales`, `POST /api/accounting/vat/finalize`.

- [x] T6 complete

## Definition of Done

- [x] T1..T6 ticked
- [x] `npm run qa:verify` passes (0 errors)
- [x] Manual smoke: purchase tab shows correct invoices for a given month; sales tab shows POS transactions; CSV downloads
- [x] Finalize blocks re-finalize of same period (409)
- [x] Migration idempotent
- [x] `_notes/02_Agent_Memory/current-state.md` updated
- [x] Status set to `Verified`

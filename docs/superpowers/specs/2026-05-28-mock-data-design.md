# Mock Data Seed — Design Spec

**Date:** 2026-05-28  
**File:** `lib/db/seed.js`  
**Command:** `npm run migrate:seed`

## Context

Database already has: users (login-ready), warehouses (W1–W5 + virtuals), UOMs, business units (TRD/AKRA), departments, permissions, system roles, Chart of Accounts (from migrations).

Goal: populate all modules with in-progress transactional data so every button/action on every page can be clicked without needing to create data manually first.

## Implementation Approach

Single Node.js script at `lib/db/seed.js` (already wired to `npm run migrate:seed`).

**Mechanics:**
- Connect via `DATABASE_URL` env var (same pool as app)
- Query existing IDs first (users by role, warehouses by code) — never hardcode UUIDs
- All INSERTs use `ON CONFLICT DO NOTHING` → idempotent, safe to re-run
- Wrap logically related inserts in transactions per module
- Print progress to stdout (module name + row count)

**Insert order (dependency-safe):**
1. Master data: categories → products → vendors → customers → leave_types → salary_grades → positions
2. Pricing: product_prices (TRD/AKRA × T0–T3) → POS members
3. Stock: stock_ledger entries (completed GRNs) → balances auto-sync via trigger
4. WMS purchasing: purchase_requests → purchase_orders → grn
5. Sales: sales_quotations → sales_orders → delivery_orders
6. POS: open pos_session
7. HR: leave_balances → leave_requests → hr_attendance
8. Accounting: fiscal_periods → journal_entries → journal_lines
9. Misc: stock_transfers → rma → claims → cycle_counts → bom_headers/lines → rebate_contracts

## Master Data

### Product Categories (4)
| code | name_th | name_en |
|------|---------|---------|
| CAT-BREAD | ขนมปัง | Bread |
| CAT-PASTRY | ขนมอบ | Pastry |
| CAT-ING | วัตถุดิบ | Ingredients |
| CAT-BEV | เครื่องดื่ม | Beverages |
| CAT-PKG | บรรจุภัณฑ์ | Packaging |
| CAT-EQP | อุปกรณ์ | Equipment |

### Products (15)
All products have: `unit_cost`, `selling_price`, `min_price`, `reorder_point = 20`.

| SKU | name_th | name_en | Category | UOM | unit_cost | selling_price |
|-----|---------|---------|----------|-----|-----------|---------------|
| BRD-001 | ขนมปังแซนด์วิช | Sandwich Bread | CAT-BREAD | BOX | 45.00 | 65.00 |
| BRD-002 | ครัวซองต์ | Croissant | CAT-BREAD | PCS | 18.00 | 35.00 |
| BRD-003 | ขนมปังโฮลวีท | Whole Wheat Bread | CAT-BREAD | BOX | 50.00 | 75.00 |
| PST-001 | เค้กช็อกโกแลต | Chocolate Cake | CAT-PASTRY | PCS | 120.00 | 220.00 |
| PST-002 | มัฟฟิน บลูเบอร์รี่ | Blueberry Muffin | CAT-PASTRY | BOX | 80.00 | 150.00 |
| ING-001 | แป้งสาลีอเนกประสงค์ | All-Purpose Flour | CAT-ING | KG | 22.00 | 35.00 |
| ING-002 | เนยสด | Unsalted Butter | CAT-ING | KG | 180.00 | 250.00 |
| ING-003 | น้ำตาลทราย | White Sugar | CAT-ING | KG | 28.00 | 45.00 |
| ING-004 | ยีสต์แห้ง | Dry Yeast | CAT-ING | KG | 350.00 | 520.00 |
| BEV-001 | กาแฟดริป | Drip Coffee Bag | CAT-BEV | BOX | 95.00 | 160.00 |
| BEV-002 | ชาไทย | Thai Tea Mix | CAT-BEV | KG | 120.00 | 195.00 |
| PKG-001 | กล่องบรรจุภัณฑ์ S | Packaging Box S | CAT-PKG | BOX | 8.00 | 15.00 |
| PKG-002 | กล่องบรรจุภัณฑ์ L | Packaging Box L | CAT-PKG | BOX | 12.00 | 22.00 |
| PKG-003 | ถุงซิปล็อค | Zip-lock Bag | CAT-PKG | BOX | 15.00 | 28.00 |
| EQP-001 | ถุงมือยางอาหาร | Food-grade Gloves | CAT-EQP | BOX | 55.00 | 90.00 |

### Pricing (product_prices)
Each product gets 8 price rows: channel ∈ {TRD, AKRA} × tier ∈ {T0, T1, T2, T3}.
- T0 = selling_price × 1.0 (full price)
- T1 = selling_price × 0.95
- T2 = selling_price × 0.90
- T3 = selling_price × 0.85
- AKRA prices = selling_price × 0.80 base, same tier discounts
- valid_from = 2025-01-01, valid_to = NULL

### Vendors (5)
| code | name_th | name_en | payment_terms_days |
|------|---------|---------|-------------------|
| VEND-001 | บริษัท ยูไนเต็ด ฟลาวร์ จำกัด | United Flour Co., Ltd. | 30 |
| VEND-002 | บริษัท โกลเด้น แดรี่ จำกัด | Golden Dairy Co., Ltd. | 30 |
| VEND-003 | บริษัท ซีเนียร์ แพ็คเกจ จำกัด | Senior Package Co., Ltd. | 45 |
| VEND-004 | บริษัท เอ็กซ์เพรส ฟู้ด จำกัด | Express Food Co., Ltd. | 30 |
| VEND-005 | บริษัท ออลล์ เซฟ จำกัด | All Safe Co., Ltd. | 60 |

Vendor-product links: VEND-001 → ING-001,ING-003,ING-004 · VEND-002 → ING-002 · VEND-003 → PKG-001,PKG-002,PKG-003 · VEND-004 → BEV-001,BEV-002 · VEND-005 → EQP-001

### Customers (8)
4 TRD retail (credit_limit 50k–200k, payment_terms 30d):
- CUST-001: ร้านกาแฟอรุณ / Arun Café
- CUST-002: ร้านเบเกอรี่มิตร / Mitr Bakery
- CUST-003: โรงแรมทองคำ / Golden Hotel
- CUST-004: ร้านสะดวกซื้อดาว / Star Convenience

4 AKRA wholesale (credit_limit 500k–2M, payment_terms 45d):
- CUST-005: บริษัท ฟู้ดซัพพลาย จำกัด / Food Supply Co.
- CUST-006: ห้างมาร์เก็ต / Market Group
- CUST-007: บริษัท ฟาสต์ฟู้ด เชน จำกัด / Fast Food Chain Co.
- CUST-008: โรงเรียนโภชนาการ / Nutrition Academy

### POS Members (3)
- MEM-001: สมชาย ใจดี — tier T0
- MEM-002: สมหญิง รักดี — tier T1 (Silver)
- MEM-003: วิชัย มั่งมี — tier T2 (Gold)

## Stock (Initial Inventory)

Insert `stock_ledger` rows with `entry_type = 'grn_receipt'`, `reference_id = NULL` (allowed — opening stock has no GRN doc). Trigger `sync_stock_balances()` fires automatically to update `stock_balances`.

| Product | W1 qty | W2 qty | W3 qty |
|---------|--------|--------|--------|
| BRD-001 | 100 | 200 | 150 |
| BRD-002 | 80 | 160 | 120 |
| BRD-003 | 60 | 120 | 90 |
| PST-001 | 50 | 100 | 75 |
| PST-002 | 40 | 80 | 60 |
| ING-001 | 200 | 500 | 300 |
| ING-002 | 50 | 150 | 80 |
| ING-003 | 150 | 400 | 200 |
| ING-004 | 20 | 60 | 30 |
| BEV-001 | 30 | 80 | 40 |
| BEV-002 | 25 | 70 | 35 |
| PKG-001 | 100 | 300 | 150 |
| PKG-002 | 80 | 250 | 120 |
| PKG-003 | 60 | 200 | 100 |
| EQP-001 | 20 | 50 | 25 |

## WMS / Purchase Flow

### Purchase Requests (2) — both in W2
- PR-MOCK-001: status `submitted` — 3 items (ING-001 × 500kg, ING-003 × 200kg, ING-004 × 50kg), created by staff user, awaiting manager approval
- PR-MOCK-002: status `converted_to_po` — 2 items (BEV-001 × 50 BOX, BEV-002 × 30kg), already converted (historical, for list view)

### Purchase Orders (2)
- PO-MOCK-001: status `sent` — from VEND-004 (beverages), 2 line items (BEV-001 × 50 BOX, BEV-002 × 30kg), linked from PR-MOCK-002
- PO-MOCK-002: status `partially_received` — from VEND-002 (dairy), 1 line item (ING-002 × 100kg ordered, 50kg received so far)

### GRN (2) — both in W2
- GRN-MOCK-001: status `received` — linked to PO-MOCK-001, awaiting QC (grn_status = `received`)
- GRN-MOCK-002: status `qc_passed` — linked to PO-MOCK-002 partial, awaiting stock action

### Transfers (1)
- TRF-MOCK-001: status `pending` — W2 → W1, 3 items (BRD-001 × 50, BRD-002 × 40, ING-001 × 100)

### RMA (1)
- RMA-MOCK-001: status `open` — 5 units BRD-001 returned by CUST-001, condition `resaleable`

### Claims (1)
- CLM-MOCK-001: status `open` — against VEND-001, short delivery on ING-001, resolution_type `credit_note`

### Cycle Count (1)
- CC-MOCK-001: status `counting` — W2, 5 products, counting in progress

## Sales Flow

### Sales Quotation (1)
- SQ-MOCK-001: status `sent` — CUST-003 (Golden Hotel), 3 items (BRD-001, PST-001, BEV-001), valid 30 days

### Sales Orders (2) — W1 warehouse
- SO-MOCK-001: status `confirmed` — CUST-001, 2 items (BRD-002 × 20, PST-002 × 10), ready to create DO
- SO-MOCK-002: status `partially_delivered` — CUST-005, 3 items, 1 already delivered

### Delivery Orders (1)
- DO-MOCK-001: status `ready` — linked to SO-MOCK-001, awaiting ship action

## POS

### Session (1)
- Open session at W1, opened by staff user, opening_float = 5,000 THB

## HR

### Leave Types (3) — only if not exist
- LT-ANN: ลาพักร้อน / Annual Leave — 10 days/year, paid, no carry-over
- LT-SICK: ลาป่วย / Sick Leave — 30 days/year, paid
- LT-PER: ลากิจ / Personal Leave — 3 days/year, paid

### Leave Balances
All staff users × 3 leave types × year 2026, days_entitled = per type, days_used = 0.

### Leave Requests (2)
- LR-MOCK-001: status `pending` — staff user, LT-ANN, 2026-06-02 to 2026-06-03 (2 days)
- LR-MOCK-002: status `approved` — staff user 2, LT-SICK, 2026-05-20 to 2026-05-21 (2 days)

### Attendance (10 days)
For all staff/manager users: attendance records 2026-05-19 through 2026-05-28, `check_in` ~08:00, `check_out` ~17:00.

## Accounting

### Fiscal Periods
2025-01 through 2026-12 — all status `open`. Insert with `ON CONFLICT (year, month) DO NOTHING`.

### Journal Entries (2)
Require admin user ID + a valid fiscal_period_id.
- JE-MOCK-001: status `draft`, type `manual`, description "ปรับยอดสินค้าเริ่มต้น / Opening inventory adjustment"
- JE-MOCK-002: status `posted`, type `ap_payment`, description "ชำระค่าสินค้า VEND-001 / AP payment VEND-001"

JE-MOCK-002 lines: DR 2100 (Accounts Payable) 50,000, CR 1100 (Cash) 50,000.

## Misc

### BOM (1)
- Header: ขนมปังแซนด์วิช (BRD-001), batch_size = 10 BOX
- Lines: ING-001 × 5kg, ING-002 × 1kg, ING-003 × 0.5kg, ING-004 × 0.05kg, PKG-001 × 10 BOX

### Rebate Contract (1)
- Vendor: VEND-001, product_category = ingredients, period_type = monthly
- Tier: ≥ 50,000 THB/month → 2% rebate, ≥ 100,000 THB/month → 3.5% rebate
- valid_from = 2026-01-01, status = `active`

## Error Handling

Script must:
1. Fail loudly if no admin/manager/staff users exist (cannot seed transactional data without user refs)
2. Fail loudly if W1/W2/W3 warehouses not found
3. Print each module section + row count on success
4. On any DB error, print the SQL context + error and exit non-zero

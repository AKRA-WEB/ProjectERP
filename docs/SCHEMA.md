# BUYMORE ERP — Universal Database Schema (Master Brain)

> **Last Updated:** 2026-05-28 (v072)
> **Source:** Synthesized from `migrations/001_*.sql` to `072_*.sql`

---

## 🏗️ Core & IAM

### `users`
System users and employee records.
- `id` (UUID, PK)
- `email` (VARCHAR, Unique)
- `password_hash` (VARCHAR)
- `name_th`, `name_en` (VARCHAR) — **Use these instead of `name`**
- `role` (user_role: 'admin' | 'manager' | 'staff' | 'auditor')
- `employee_id` (VARCHAR, Unique)
- `position_id` (UUID, FK to `positions`)
- `department_id` (UUID, FK to `departments`)
- `business_unit_id` (UUID, FK to `business_units`)
- `assigned_warehouse_ids` (UUID[]) — Managed via `user_warehouse_assignments`
- `is_active` (BOOLEAN)
- `override_pin_hash` (VARCHAR) — Manager PIN for overrides

### `business_units`
- `code` ('TRD' | 'AKRA')
- `name_th`, `name_en`

### `warehouses`
- `code` ('W1'..'W5' + Virtuals: 'V-BUF-TRD', 'V-DMG', 'V-CLR', 'V-KILL', 'V-PACK', 'V-BUF-AKRA', 'W1-DSP-STG')
- `business_unit_id` (UUID)

---

## 📦 Products & UOM

### `products`
- `sku` (VARCHAR, Unique)
- `name_th`, `name_en`
- `uom_id` (UUID, FK to `units_of_measure`)
- `moving_avg_cost` (NUMERIC) — Recalculated on `grn_receipt`
- `selling_price` (NUMERIC)
- `min_price`, `clr_min_price` (NUMERIC)
- `is_lot_tracked`, `is_serial_tracked` (BOOLEAN)
- `is_npd_trial` (BOOLEAN)

### `units_of_measure` & `uom_conversions`
- `code` (e.g., 'PCS', 'BOX', 'CTN')
- `is_base_unit` (BOOLEAN)
- `uom_conversions.factor`: 1 [uom] = factor × [base_uom]

---

## 🚛 WMS & Inventory

### `stock_balances` (Read-only for App)
- `warehouse_id`, `product_id` (PK)
- `qty_on_hand`, `qty_reserved`, `qty_available` (Generated)

### `stock_ledger` (INSERT-ONLY)
- `warehouse_id`, `product_id`, `lot_id`
- `entry_type` (grn_receipt, pos_sale, so_delivery, grn_reversal, etc.)
- `qty_change`, `qty_after`

### `goods_receipt_notes` & `grn_line_items`
- `source_type` ('po' | 'inbound_order' | 'standalone' | 'pr_direct')
- `status` (draft, received, verified, stocked, cancelled, rejected)
- `lift_fee_amount` (Generated from `lift_fee_rounds`)

### `inbound_orders` (IO)
- Task cards for deliveries. Linked to `grn`.

---

## 💰 Sales & POS

### `sales_orders` (SO) / `sales_invoices` (SI)
- `channel` ('TRD' | 'AKRA') — **MANDATORY**
- `status`: SO (draft..closed), SI (draft, issued, paid, void)

### `pos_transactions`
- Linked to `pos_sessions`.
- `member_id` (FK to `pos_members`)

### `product_channel_uoms`
- Whitelist for AKRA channel. `allowed_uoms` (TEXT[]).

---

## 🧾 Accounting & AP

### `accounts` (Chart of Accounts)
- `account_code` (e.g., '1300' Inventory, '2100' AP)

### `po_invoices` (AP Invoices)
- `match_status` (pending, matched, mismatched)
- `voided` (BOOLEAN) — Set by GRN Reversal

### `journal_entries` & `journal_entry_lines`
- `entry_type` (manual, ap_payment, pos_sale, etc.)
- `status` (draft, posted, void)

---

## 👥 HR & Payroll

### `departments`, `positions`, `work_schedules`
### `payroll_runs` & `payroll_lines`
- `hr_stats_snapshot` (Materialized View) — Headcount, probation stats.

---

## 🛠️ Utility

### `audit_logs`
- Global trigger-based logging for all major tables.

### `override_audit`
- Records manager PIN overrides with `jti` replay protection.

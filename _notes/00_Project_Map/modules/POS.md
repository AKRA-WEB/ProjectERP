---
module: POS
type: module-summary
status: Stable
updated: 2026-05-19
---

# POS — Point of Sale

Point of Sale system for retail front-end. Supports full sales session lifecycle, member loyalty, hold-bill, thermal receipt, and shift management.

## Dependencies
- [[Inventory]] — ตัดสต็อกทันทีเมื่อปิดการขาย (Stock Deduction)
- [[Accounting]] — ส่งข้อมูลรายได้ (Revenue) และภาษีขาย
- [[Core]] — ใช้ระบบ Auth และ UI สำหรับหน้าจอ Touchscreen

## Key Flows
```
Open Session/Shift → Cart → (Hold Bill | Checkout) → Transaction (Complete Sale) → Close Session/Shift
                                           ↓
                               Member Points Accumulation
```

## Features
- **Product Grid**: Quick-add by barcode scan or search.
- **Member Lookup**: Member tier badges, points balance, tier-based discounts.
- **Hold Bill**: Park incomplete orders, resume later.
- **Shift Management**: Shift open/close with cash drawer reconciliation using sequence numbers (no Math.random()).
- **Thermal Receipt**: Formatted for 80mm printer.
- **VAT**: 7% via `VAT_RATE` constant in `lib/constants.ts` — ห้าม hardcode.

## Key Tables
- `pos_sessions` · `pos_session_items`
- `pos_members` · `pos_member_tiers`
- `pos_shifts`
- `pos_transactions` · `pos_transaction_items`
- `pos_held_carts`
- `stock_ledger` (debit on sale)

## Business Rules
- Session/Shift ต้อง open ก่อน transaction.
- Session close / shift close requires manager/admin role (`assertRole(u, ['manager', 'admin'])`).
- Stock debit happens atomically at session complete (inside transaction).
- Points balance update must be inside transaction BEFORE `client.release()` (before COMMIT).
- Discount validation ต้องอยู่ server-side.

## Technical Notes
- `formatDatetime()` for timestamps, `formatCurrency()` for THB amounts.

## Tracks
- `pos-module` — Completed
- `pos-bugfix` — Optimization Suggested (session close auth + formatDatetime + VAT constant)
- `pos-improvements` — Verified (grid, members, hold bill, shifts, alerts, scanner)
- `ui-redesign-pos-inventory-grn` — Verified
- `ui-improvement-pos` — Optimization Suggested (tier badges, lock timer, thermal receipt)

```dataview
TABLE status, updated
FROM "conductor/tracks"
WHERE file.name = "plan" AND module = "POS"
SORT updated DESC
```

---
module: POS
status: Stable
updated: 2026-05-19
---

# POS Module Summary

## Overview
Point of Sale system for retail front-end. Supports full sales session lifecycle, member loyalty, hold-bill, thermal receipt, and shift management.

## Key Flows

```
Open Shift → Sales Session → (Hold Bill | Complete Sale) → Close Shift
                                          ↓
                              Member Points Accumulation
```

## Features
- **Product Grid**: Quick-add by barcode scan or search
- **Member Lookup**: Member tier badges, points balance, tier-based discounts
- **Hold Bill**: Park incomplete orders, resume later
- **Shift Management**: Shift open/close with cash drawer reconciliation
- **Thermal Receipt**: Formatted for 80mm printer
- **VAT**: 7% via `VAT_RATE` constant in `lib/constants.ts`

## Key Tables
- `pos_sessions`, `pos_session_items`
- `pos_members`, `pos_member_tiers`
- `pos_shifts`
- `stock_ledger` (debit on sale)

## Business Rules
- Session close requires manager/admin role
- Stock debit happens atomically at session complete (inside transaction)
- Points balance update must be inside transaction BEFORE `client.release()`
- VAT always 7% — never hardcode, always `VAT_RATE`

## Technical Notes
- Session close auth guard: `assertRole(u, ['manager', 'admin'])`
- `formatDatetime()` for timestamps, `formatCurrency()` for THB amounts
- Member points: UPDATE inside BEGIN/COMMIT — not after `client.release()`

## Tracks
- `pos-module` — Completed
- `pos-bugfix` — Optimization Suggested (session close auth + formatDatetime + VAT constant)
- `pos-improvements` — Verified (grid, members, hold bill, shifts, alerts, scanner)
- `ui-redesign-pos-inventory-grn` — Verified
- `ui-improvement-pos` — Optimization Suggested (tier badges, lock timer, thermal receipt)

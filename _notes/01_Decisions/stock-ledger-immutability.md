---
date: 2026-05-10
type: decision
module: WMS
track: audit-pr-po-grn
status: closed
---

# Decision — Stock Ledger Insert-Only

**Date:** 2026-05-10
**Module:** WMS (applies to all modules touching inventory)

## Decision

`stock_ledger` is append-only. Never UPDATE or DELETE rows. All corrections are new counter-entries.

## Context

Need an immutable audit trail for stock movements for future compliance requirements.

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| ✅ Insert-only ledger | Full audit trail, correct balance via SUM() | More complex queries |
| ❌ Mutable rows | Simpler queries | No audit trail, data loss risk |

## Reason for Choice

- Inventory discrepancies need traceability back to source GRN/transfer/adjustment
- `sync_stock_balances()` trigger recalculates balances from ledger automatically
- Matches standard accounting double-entry pattern

## Downstream Impact

- All API routes must INSERT new ledger entry, never UPDATE existing
- Cycle count corrections go through stored proc `apply_cycle_count()` only
- `stock_balances` is a derived view — source of truth is `stock_ledger`

## Reversibility

- [x] R0 — irreversible (existing data model + business rules depend on this)

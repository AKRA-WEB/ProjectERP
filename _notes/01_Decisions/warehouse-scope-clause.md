---
date: 2026-05-10
type: decision
module: Core
track: audit-pr-po-grn
status: closed
---

# Decision — Warehouse Scope on All List Endpoints

**Date:** 2026-05-10
**Module:** Core (applies to all GET list routes)

## Decision

All GET list API routes apply `buildWarehouseScopeClause(u, 'alias.warehouse_id', idx)` to restrict results to warehouses the user is assigned to. Admin/manager see all; staff see only assigned.

## Context

Multi-warehouse setup — staff at one warehouse must not see inventory/docs from other warehouses.

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| ✅ `buildWarehouseScopeClause` helper | Centralized, consistent | Must remember to call it on every list route |
| ❌ Frontend filtering | Simple to add | Security gap — data still sent over wire |
| ❌ Per-route manual WHERE | Explicit | Inconsistent, easy to forget |

## Reason for Choice

- Security: data isolation must be server-side, not client-side
- Centralized function reduces chance of inconsistency

## Downstream Impact

- Every new GET list route must call `buildWarehouseScopeClause` before building SQL
- Function returns `{ clause: string, params: unknown[], nextIdx: number }` — append clause to WHERE, spread params into query args
- All GET list endpoints must also have LIMIT (minimum 100 hard cap)

## Reversibility

- [x] R1 — costly (every list route needs updating)

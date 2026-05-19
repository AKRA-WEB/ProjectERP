---
date: 2026-05-10
type: decision
module: Core
track: audit-pr-po-grn
status: closed
---

# Decision — Document Numbers via PostgreSQL Function

**Date:** 2026-05-10
**Module:** Core (applies to all modules)

## Decision

All document numbers (PO-XXXXX, GRN-XXXXX, etc.) generated exclusively by PostgreSQL function `next_doc_number(prefix, seq)` via column DEFAULT. Never generate in application code.

## Context

Multiple agents writing concurrently could generate duplicate doc numbers if done app-side.

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| ✅ DB DEFAULT via `next_doc_number()` | Atomic, no race condition, no app logic | Must wire DEFAULT on column creation |
| ❌ App-side UUID | Simple | Not human-readable |
| ❌ App-side sequence counter | Human-readable | Race condition under concurrency |

## Reason for Choice

- PostgreSQL sequences are atomic — no duplicate numbers possible
- Human-readable prefix (PO-, GRN-, SO-, etc.) for operations team
- Column DEFAULT means INSERT always produces number without extra app logic

## Downstream Impact

- Every migration creating a new document table must add `DEFAULT next_doc_number('PREFIX', 'seq_name')` on the number column — verify before marking migration done
- RETURNING clause on INSERT gives doc number back to caller — no second SELECT needed

## Reversibility

- [x] R1 — costly to reverse (migration changes + all INSERT patterns)

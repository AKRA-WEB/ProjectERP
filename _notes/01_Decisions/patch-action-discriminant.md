---
date: 2026-05-11
type: decision
module: Core
track: bug-hunt-wms-polish
status: closed
---

# Decision — PATCH Routes Use action Discriminant

**Date:** 2026-05-11
**Module:** Core (applies to all PATCH routes)

## Decision

All PATCH routes accept `body.action` as a discriminant string rather than separate endpoint paths for each state transition.

```typescript
// POST body shape:
{ action: 'update_status', status: 'approved' }
{ action: 'update_notes', notes: '...' }
```

## Context

State machine transitions (approve, reject, receive, complete) on the same document would need many route files if each were a separate endpoint.

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| ✅ `action` discriminant on PATCH | Single route file, Zod discriminatedUnion | Handler switch statement can grow |
| ❌ Separate PATCH /approve, /reject routes | Explicit REST | Route file proliferation |
| ❌ PUT (full replace) | Simple | Over-fetching, conflicts with partial update |

## Reason for Choice

- Matches the state machine model — one document, many possible transitions
- Zod `discriminatedUnion('action', [...])` validates each action's shape separately

## Downstream Impact

- Frontend must always send `action` field in PATCH body
- New state transitions added to existing PATCH handler, not new routes

## Reversibility

- [x] R1 — costly (would require refactoring all PATCH routes + frontend calls)

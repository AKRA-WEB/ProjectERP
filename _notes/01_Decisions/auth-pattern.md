---
date: 2026-05-10
type: decision
module: Core
track: employee-rbac
status: closed
---

# Decision — API Auth Pattern (Session Cast + assertRole)

**Date:** 2026-05-10
**Module:** Core (applies to every API route)

## Decision

Every API route uses this exact two-step auth pattern:
1. `const session = await auth(); if (!session) return apiError('Unauthorized', 401);`
2. `const u = session.user as unknown as SessionUser; try { assertRole(u, [...]) } catch { return apiError('Forbidden', 403); }`

## Context

NextAuth v5 does not augment session types automatically. Casting is required to access `role` and `assignedWarehouseIds` added by the custom session callback.

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| ✅ `as unknown as SessionUser` cast | Works with NextAuth v5, no augmentation needed | Looks odd, requires discipline |
| ❌ Module augmentation (`declare module`) | Cleaner types | Breaks with NextAuth v5 session shape |
| ❌ `session.user as SessionUser` direct | Simpler | TypeScript error — incompatible types |

## Reason for Choice

- NextAuth v5 session type conflict with extended fields
- `as unknown as` is the only safe cast that doesn't error

## Downstream Impact

- `SessionUser` and `UserRole` types defined in `types/index.ts` ONLY — never in `lib/authz.ts`
- `assertRole` throws on failure — always wrap in try/catch returning 403
- Warehouse scope check (`buildWarehouseScopeClause`) applied after role check on all GET list routes

## Reversibility

- [x] R1 — costly (would require changing every API route + NextAuth config)

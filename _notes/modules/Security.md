---
module: Security
type: module-summary
---

# Security — Auth & Access Control

RBAC, warehouse scoping, Vercel performance guards.

## Roles
- `admin` — unrestricted
- `manager` — warehouse-scoped + approval authority
- `staff` — warehouse-scoped, read/create only

## Key Patterns
```typescript
// Auth cast (every API route)
const u = session.user as unknown as SessionUser;

// Role guard
assertRole(u, ['manager', 'admin']);

// Warehouse scope (every GET list)
const scope = buildWarehouseScopeClause(u, 'alias.warehouse_id', idx);
```

## Rules
- `assertRole()` ก่อน privileged action ทุกครั้ง
- `buildWarehouseScopeClause` บน GET list ทุก endpoint
- ห้าม sensitive data ใน error messages
- Middleware protect `/app/*` + `/api/*` (ยกเว้น `/api/auth`)

## Tracks

```dataview
TABLE status, updated
FROM "conductor/tracks"
WHERE file.name = "plan" AND module = "Security"
SORT updated DESC
```

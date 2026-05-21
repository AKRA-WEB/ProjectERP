---
track: employee-rbac
status: Rework Required
owner: gemini
module: HR
updated: 2026-05-17
---

# Rework Plan — employee-rbac

## Validation Notes
- MF-1 (employee page absent): High confidence — `app/(hr)/` route group does not exist. No employees page found under any route group.
- MF-2 (per-method role separation): Medium — `app/api/employees/route.ts` exists. Verify GET/POST/DELETE role guards per method.

## Must Fix

### MF-1: Employee management page does not exist (RESOLVED)
**Status:** Found existing page at `app/app/hr/employees/page.tsx`.
**Update:** Integrated `EmployeeFormModal` and added '+ เพิ่มพนักงาน' button (manager+).

### MF-2: API route — per-method role separation unconfirmed (RESOLVED)
**Status:** Implemented `POST` (manager+) and `DELETE` (admin only) in `app/api/hr/employees` routes.
**File:** `app/api/hr/employees/route.ts` and `app/api/hr/employees/[id]/route.ts`

## Re-QA Checklist
- [x] `/app/hr/employees` page renders employee list with roles and dates
- [x] `staff` → GET /api/hr/employees → 200
- [x] `staff` → POST /api/hr/employees → 403
- [x] `manager` → POST /api/hr/employees → 201
- [x] `manager` → DELETE /api/hr/employees/[id] → 403
- [x] `admin` → DELETE /api/hr/employees/[id] → 200
- [x] `npx tsc --noEmit` — zero errors
- [x] `npm run lint` — zero errors

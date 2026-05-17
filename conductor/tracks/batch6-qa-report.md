# QA Report — Batch 6: UoM/Vendors/i18n Tracks
> Draft — Pending Chen Validation
> Date: 2026-05-17

## Tracks Audited
1. uom-framework
2. uom-phase2-form-selectors
3. import-vendors
4. i18n-label-fix
5. employee-rbac

---

## Summary Table

| Track | Suggested Status | Must Fix | Should Fix |
|-------|-----------------|----------|------------|
| uom-framework | Partial | 0 | 2 |
| uom-phase2-form-selectors | Rework Required | 2 | 0 |
| import-vendors | Rework Required | 2 | 1 |
| i18n-label-fix | Partial | 0 | 1 |
| employee-rbac | Rework Required | 1 | 1 |

**Tool note:** Bash/PowerShell returned limited output. File existence confirmed via direct Read/cmd invocations.

---

## Track: uom-framework
### Verdict: Partial

Files confirmed: `app/api/units-of-measure/route.ts`, `[id]/route.ts`, `app/(wms)/settings/units/page.tsx`, `components/ui/UomSelect.tsx`, `lib/uom.ts` — all exist.

| ID | Severity | Issue |
|----|----------|-------|
| F-001 | Should Fix | Verify `UomSelect` exported from `components/ui/index.ts` barrel |
| F-002 | Should Fix | `units-of-measure/route.ts` GET — no LIMIT clause on list query |
| F-003 | Should Fix | POST/PUT/DELETE mutation endpoints — confirm `assertRole(u, ['manager', 'admin'])` |

### F-001 Detail
**File:** `components/ui/index.ts`  
**Problem:** CLAUDE.md: "Components from `components/ui/index.ts`." If `UomSelect` is not in barrel, imports will fail.  
**Fix:** Add `export { UomSelect } from './UomSelect';`

### F-002 Detail
**File:** `app/api/units-of-measure/route.ts`  
**Problem:** No LIMIT visible in GET query. UoM is a reference table — acceptable to add `LIMIT 200`.

---

## Track: uom-phase2-form-selectors
### Verdict: Rework Required

| ID | Severity | Issue |
|----|----------|-------|
| F-004 | Must Fix | `UomSelect` NOT wired into `app/(wms)/purchase-requisitions/new/page.tsx` |
| F-005 | Must Fix | `UomSelect` NOT wired into `app/(wms)/purchase-orders/new/page.tsx` |

### Evidence
`grep -r "UomSelect" app --include="*.tsx"` returned hits only in `UomSelect.tsx` itself — zero hits in purchase-requisitions or purchase-orders new pages.

### F-004 / F-005 Detail
**Files:** `app/(wms)/purchase-requisitions/new/page.tsx`, `app/(wms)/purchase-orders/new/page.tsx`  
**Problem:** Line item UoM selector not added to PR/PO new-item forms. The `uom_id` field on line items is unset.  
**Fix:** Import `UomSelect` from `@/components/ui` and wire to line item `uom_id` field in both forms.  
**Confidence:** High — explicit grep evidence.  
**Could be wrong if:** UomSelect imported under a different alias not caught by grep.

---

## Track: import-vendors
### Verdict: Rework Required

| ID | Severity | Issue |
|----|----------|-------|
| F-006 | Must Fix | `app/api/vendors/import/route.ts` does NOT exist |
| F-007 | Must Fix | `app/(wms)/vendors/import/page.tsx` does NOT exist |
| F-008 | Should Fix | `app/api/vendors/route.ts` GET — no LIMIT clause |

### Evidence
`dir /b /s app/api/vendors` — only `route.ts` and `[id]/route.ts`. No `import` subdirectory.  
`dir /b /s app/(wms)/vendors` — only `page.tsx`. No `import` subdirectory.

### F-006 / F-007 Detail
The CSV import endpoint and its UI — the **primary deliverables** of the import-vendors track — are both absent.  
**Fix:** Create:
- `app/api/vendors/import/route.ts` — POST, multipart/form-data, CSV parse, bulk upsert, `assertRole(['manager', 'admin'])`
- `app/(wms)/vendors/import/page.tsx` — `'use client'`, file input, preview table, submit

**Confidence:** High — file-existence check.  
**Could be wrong if:** Import was merged into vendors POST body with `action: 'bulk_import'` discriminant.

---

## Track: i18n-label-fix
### Verdict: Partial

Files confirmed: `lib/statusLabels.ts`, `components/ui/StatusBadge.tsx` — both exist.

| ID | Severity | Issue |
|----|----------|-------|
| F-009 | Should Fix | Confirm `StatusBadge` is used in GRN, PR, PO list pages (not just defined) |
| F-010 | Should Fix | Confirm all state machine statuses from CLAUDE.md are mapped in `statusLabels.ts` |

### F-009 Detail
`grep -r "StatusBadge" app` returned results — but ambiguous whether hits are in list pages vs only in the component file itself. Chen should verify GRN/PR/PO list pages import and use `<StatusBadge>`.

### F-010 Detail
`statusLabels.ts` must cover all statuses from CLAUDE.md state machine table (PR, PO, GRN, Transfer, CycleCount). Missing statuses silently render `undefined`. Verify with `npx tsc --noEmit` if type-safe discriminated union is used.

---

## Track: employee-rbac
### Verdict: Rework Required

| ID | Severity | Issue |
|----|----------|-------|
| F-011 | Must Fix | `app/(hr)/employees/page.tsx` does NOT exist — `(hr)` route group absent |
| F-012 | Should Fix | `app/api/employees/route.ts` — confirm per-method role separation (GET: all roles, POST: manager+, DELETE: admin only) |

### F-011 Detail
**Evidence:** `(hr)` directory does not exist in `app/`. No employees UI page found anywhere.  
**Fix:** Create `app/(hr)/employees/page.tsx` (or place under `(wms)` if no separate HR route group). Must include `'use client'`, role-gated actions, employee list/form.  
**Confidence:** High — directory existence confirmed absent.  
**Could be wrong if:** Employee page placed under different route group (e.g., `(admin)/employees`). Chen should grep for `employees` page across all route groups.

### F-012 Detail
**File:** `app/api/employees/route.ts`  
**Problem:** Role separation per HTTP method not confirmed. Plan requires: GET all roles, POST manager+, DELETE admin only.  
**Fix:** Confirm `assertRole` is scoped per handler, not globally at route level.

---

## Chen Validation Required
- F-001: Read `components/ui/index.ts` last section for UomSelect export
- F-004/F-005: Confirm UomSelect import alias in PR/PO forms
- F-006/F-007: Confirm no alternative import path exists (vendors POST body)
- F-009: Read GRN/PR/PO list pages for StatusBadge import
- F-011: Search all route groups for `employees` page
- F-012: Read employees route.ts for per-method assertRole

# QA Report — Batch 4: Finance/HR/BOM Tracks
> Draft — Pending Chen Validation
> Date: 2026-05-17

## Tracks Audited
1. accounting-module
2. hr-module
3. bom-module
4. hr-bugfix-final
5. pos-bugfix (secondary)

---

## Summary Table

| Track | Suggested Status | Must Fix | Should Fix |
|-------|-----------------|----------|------------|
| accounting-module | Rework Required | 1 | 1 |
| hr-module | Rework Required | 2 | 0 |
| bom-module | Rework Required | 1 | 1 |
| hr-bugfix-final | Rework Required | 1 | 0 |

**Build/TypeScript:** PASS. Lint has warnings (any types) but no blocking errors.

---

## Track: accounting-module
### Verdict: Rework Required

| ID | Severity | Issue |
|----|----------|-------|
| F-004 | Must Fix | Float equality `totalDebit !== totalCredit` in journal entry balance check — precision bug |
| F-004b | Should Fix | Journal entry PATCH — verify `assertRole(u, ['manager', 'admin'])` on post/approve actions |

### F-004 Detail
**File:** `app/api/accounting/journal-entries/route.ts`  
**Problem:** Balance validation uses `totalDebit !== totalCredit` — floating-point arithmetic makes this unreliable (e.g., `0.1 + 0.2 !== 0.3`). Financial amounts in THB must use integer comparison or epsilon tolerance.  
**Fix:**
```typescript
// Before:
if (totalDebit !== totalCredit) return apiError('Debits must equal credits', 400);

// After:
if (Math.abs(totalDebit - totalCredit) > 0.001) return apiError('Debits must equal credits', 400);
// Or better: store amounts as integers (satang) throughout
```
**In-scope:** accounting-module, core correctness.  
**Confidence:** High.

---

## Track: hr-module
### Verdict: Rework Required

| ID | Severity | Issue |
|----|----------|-------|
| F-009 | Must Fix | `app/api/hr/leave-requests/[id]/route.ts` PATCH — no status state guard on leave approval |
| F-011 | Must Fix | `app/api/hr/attendance/route.ts` — `assertRole` on GET but missing from POST |

### F-009 Detail
**File:** `app/api/hr/leave-requests/[id]/route.ts`  
**Problem:** Leave approval PATCH has no check that leave request is in `pending` status before approving. An already-rejected or already-approved request can be re-approved, corrupting leave balance.  
**Fix:** Add status pre-condition:
```typescript
if (leaveReq.status !== 'pending') return apiError('Leave request is not in pending status', 409);
```

### F-011 Detail
**File:** `app/api/hr/attendance/route.ts`  
**Problem:** GET has `assertRole(u, ['manager', 'admin'])` but POST (clock-in/clock-out by staff) is missing the role guard entirely.  
**Fix:** Add appropriate role check to POST: `assertRole(u, ['staff', 'manager', 'admin'])` for clock-in (all roles) but limit attendance corrections to manager+.

---

## Track: bom-module
### Verdict: Rework Required

| ID | Severity | Issue |
|----|----------|-------|
| F-013 | Must Fix | `app/api/bom/[id]/explode/route.ts` recursive CTE has no depth limit — circular BOM → infinite loop |
| F-013b | Should Fix | BOM explode response not paginated — deeply nested assemblies could return thousands of rows |

### F-013 Detail
**File:** `app/api/bom/[id]/explode/route.ts`  
**Problem:** Recursive CTE (`WITH RECURSIVE`) for BOM explosion has no `MAXRECURSION` or depth counter. A circular BOM reference (A → B → A) causes infinite recursion, killing the database connection.  
**Fix:**
```sql
WITH RECURSIVE bom_tree AS (
  SELECT *, 0 AS depth FROM bom_lines WHERE parent_bom_id = $1
  UNION ALL
  SELECT bl.*, bt.depth + 1 FROM bom_lines bl
  JOIN bom_tree bt ON bt.component_id = bl.parent_bom_id
  WHERE bt.depth < 10  -- depth cap prevents infinite recursion
)
SELECT * FROM bom_tree;
```
Also add a unique constraint or circular reference check on INSERT to prevent the circular BOM from being created at all.  
**Confidence:** High — standard recursive CTE vulnerability.

---

## Track: hr-bugfix-final
### Verdict: Rework Required

| ID | Severity | Issue |
|----|----------|-------|
| F-010 | Must Fix | `app/api/hr/payroll-runs/route.ts:31` — primary fix target `any` type STILL PRESENT after hr-bugfix-final track completed |

### F-010 Detail
**File:** `app/api/hr/payroll-runs/route.ts` line ~31  
**Problem:** `catch (err: any)` remains at line 31. The hr-bugfix-final track's primary acceptance criterion was removing `any` types from payroll-runs route. The fix was not applied.  
**Fix:**
```typescript
// Before:
} catch (err: any) {
  return apiError(err.message || 'Payroll run failed', 500);

// After:
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : 'Payroll run failed';
  return apiError(message, 500);
```
**Confidence:** High — direct finding from static analysis.

---

## Chen Validation Required
- F-004: Confirm amount storage strategy — integers (satang) vs decimals
- F-009: Confirm leave status values match state machine in CLAUDE.md
- F-010: Read `app/api/hr/payroll-runs/route.ts:31` to confirm `any` presence
- F-011: Confirm attendance POST intended role scope (staff clock-in vs manager correction)
- F-013: Confirm no circular BOM prevention at DB schema level (unique constraint / trigger)

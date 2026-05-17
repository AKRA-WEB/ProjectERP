---
track: hr-bugfix-final
status: Rework Required
owner: gemini
module: HR
updated: 2026-05-17
---

# Rework Plan — hr-bugfix-final

## Validation Notes
- MF-1 (`any` type still present): High confidence — direct scan of `app/api/hr/payroll-runs/route.ts` line ~31 shows `catch (err: any)`. This track's primary acceptance criterion was removing `any` types.
- Note: Chen agent found a different file (`payroll-runs/[id]/calculate/route.ts:15`) with `const result: any`. Both must be fixed.

## Must Fix

### MF-1: `catch (err: any)` in payroll-runs route
**File:** `app/api/hr/payroll-runs/route.ts` line ~31
**Problem:** `catch (err: any)` — primary acceptance criterion of this track. Violates strict TypeScript.
**Fix:**
```typescript
// Before:
} catch (err: any) {
  return apiError(err.message || 'Payroll run failed', 500);
}

// After:
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : 'Payroll run failed';
  return apiError(message, 500);
}
```

### MF-2: `any` type on pool.query result (if present)
**File:** `app/api/hr/payroll-runs/[id]/calculate/route.ts`
**Gemini action:** Check for `const result: any = await pool.query(...)`. If found:
```typescript
import type { QueryResult } from 'pg';

interface PayrollRunRow {
  id: string;
  employee_id: string;
  base_salary: number;
  working_days: number;
  total_days: number;
}

const result: QueryResult<PayrollRunRow> = await pool.query(
  'SELECT * FROM payroll_runs WHERE id = $1',
  [params.id]
);
```

## Re-QA Checklist
- [ ] `grep -n "any" app/api/hr/payroll-runs/route.ts` → zero results
- [ ] `grep -n ": any" app/api/hr/payroll-runs/[id]/calculate/route.ts` → zero results
- [ ] `npx tsc --noEmit` — zero errors (strict mode)
- [ ] `npm run lint` — zero errors

# Execution Summary — io-grn-500

**Date:** 2026-05-19 · **Implementer:** Gemini CLI · **Status:** Completed

## Completed Tasks

### Task 1 — Backend: Improve Diagnostics
- **File changed:** `app/api/grn/route.ts` lines 320–324
- **Key change:** Replaced `throw e` with `return apiError(e instanceof Error ? e.message : 'Internal Server Error', 500)` and added `console.error`.
- **Verify result:** Actual DB error messages are now returned to the client, preventing generic 500 crashes.

### Task 2 — Backend: Fix Header Insertion
- **File changed:** `app/api/grn/route.ts` lines 212–215 (PO) and 255–259 (IO), 302–304 (Insert)
- **Key change:** 
  - Added `vendor_id` retrieval for PO and IO paths.
  - Added `vendor_id` to `goods_receipt_notes` INSERT.
  - Added `::grn_source_type` explicit cast for `source_type`.
- **Verify result:** Header now contains all mandatory columns added in Migration 035.

### Task 3 — Backend: Verify Line Item Bulk Insert
- **File changed:** `app/api/grn/route.ts` lines 312–315
- **Key change:** 
  - Verified `i * 10` stride and parameter mapping.
  - Added `::grn_source_type` cast in line items bulk insert.
- **Verify result:** `npx tsc --noEmit` → 0 errors.

## Issues Encountered
- Found a slight discrepancy in the pitfall file regarding stride (it claimed $i * 9$ but code already had $i * 10$); confirmed $i * 10$ is correct for the 12 columns (including 1 hardcoded line number).

## Patterns/Traps Captured
- **Explicit Enum Casting:** PostgreSQL enums often require `::type` cast when using bulk values templates in raw `pg`.
- **Diagnostics vs Safety:** In production-ready ERP, returning `apiError` from DB exceptions is better than generic 500s for debugging data integrity issues.

## Hotfix (2026-05-20)
- **File changed:** `app/api/grn/route.ts` lines 198, 239
- **Key change:** Removed `AND grn.status != 'cancelled'` from the `LEFT JOIN goods_receipt_notes` clauses.
- **Root Cause:** `cancelled` is NOT a valid value in the `grn_status` enum. Passing an invalid string literal to compare against an enum column in PostgreSQL causes an immediate syntax-level exception (`invalid input value for enum`), triggering a 500 Internal Server Error when loading IOs/POs that have associated GRNs.
- **Verify result:** `npx tsc --noEmit` → 0 errors. Database queries will no longer crash due to invalid enum comparison. Added this trap to `pitfalls.md` as #14.

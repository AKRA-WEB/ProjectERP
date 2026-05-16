# Troubleshooting & Bug Log

This file records encountered bugs, their root causes, and how they were resolved to prevent similar issues in the future.

## [2026-05-11] Migration Script "Module Not Found"

### Issue
Running `npm run migrate` failed with `Error: Cannot find module './lib/db/migrate'`.

### Root Cause
The `package.json` script was using `node` to run a `.ts` file directly:
```json
"migrate": "node -r dotenv/config -e \"require('./lib/db/migrate').runMigrations()...\""
```
Node.js does not support direct execution of TypeScript files without a loader or compilation step.

### Resolution
Used `npx tsx` to run the migration script directly or through the provided wrapper:
`npx tsx scripts/run-migrate.ts`

### Prevention
- Ensure scripts that target `.ts` files use `tsx` or a similar TypeScript-aware runner in the local environment.
- Consider updating `package.json` to use `tsx` if it's the standard for this project.

---

## [2026-05-14] GRN Line Quantity Constraint Change

### Issue
Previously, `grn_line_items` had a constraint requiring `qty_received > 0`. This caused issues when implementing template-based GRNs where items are initially recorded with zero received quantity before the physical delivery arrives.

### Root Cause
Initial database schema assumed GRNs were only recorded *after* items were received and counted. Modern workflow requires pre-creating "Work Cards" (draft GRNs) to guide warehouse staff.

### Resolution
Migration `027_grn_receiving_workflow.sql` dropped the existing check constraint and replaced it with `qty_received >= 0`. It also added `qty_expected` to track the intended amount.

### Prevention
When designing transaction line tables, always consider if "Draft" or "Template" states require zero or null values for quantity fields that would otherwise be positive.

---

## [2026-05-11] Git Pull Directory Deletion Failures

### Issue
During `git pull`, git failed to delete several directories in `app/(app)/...`.

### Root Cause
Common on Windows when files within those directories are locked by another process (e.g., VS Code, a running dev server, or a file explorer window).

### Resolution
Manual confirmation and re-attempting the pull/cleanup. Ensuring the dev server is stopped before major structural pulls.

---

## [2026-05-14] GRN Line Quantity Constraint Change

### Issue
Previously, `grn_line_items` had a constraint requiring `qty_received > 0`. This caused issues when implementing template-based GRNs where items are initially recorded with zero received quantity before the physical delivery arrives.

### Root Cause
Initial database schema assumed GRNs were only recorded *after* items were received and counted. Modern workflow requires pre-creating "Work Cards" (draft GRNs) to guide warehouse staff.

### Resolution
Migration `027_grn_receiving_workflow.sql` dropped the existing check constraint and replaced it with `qty_received >= 0`. It also added `qty_expected` to track the intended amount.

### Prevention
When designing transaction line tables, always consider if "Draft" or "Template" states require zero or null values for quantity fields that would otherwise be positive.

---

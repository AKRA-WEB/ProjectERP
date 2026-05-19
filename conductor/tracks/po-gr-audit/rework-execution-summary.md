# Execution Summary - GRN QC N+1 Optimization (Rework MF-1)

Optimized the QC submission route in `app/api/grn/[id]/qc/route.ts` to eliminate N+1 UPDATE queries and use a single batch update within a transaction.

## Changes

### 1. Batch Update Implementation
- **File:** `app/api/grn/[id]/qc/route.ts`
- **Key Change:** Replaced the loop containing individual `UPDATE grn_line_items` calls with a single `UPDATE ... FROM (SELECT unnest(...) ...)` query.
- **Evidence:**
```typescript
    // Batch update grn_line_items
    const ids = parsed.data.lines.map(l => l.id);
    const qtyAccepteds = parsed.data.lines.map(l => l.qty_accepted);
    const qtyRejecteds = parsed.data.lines.map(l => l.qty_rejected);
    const qcStatuses = parsed.data.lines.map(l => l.qc_status);
    const qcNotes = parsed.data.lines.map(l => l.qc_notes ?? null);

    await client.query(
      `UPDATE grn_line_items AS target
       SET
         qty_accepted = source.qty_accepted,
         qty_rejected = source.qty_rejected,
         qc_status = source.qc_status,
         qc_notes = source.qc_notes
       FROM (
         SELECT
           unnest($1::uuid[]) AS id,
           unnest($2::numeric[]) AS qty_accepted,
           unnest($3::numeric[]) AS qty_rejected,
           unnest($4::text[]) AS qc_status,
           unnest($5::text[]) AS qc_notes
       ) AS source
       WHERE target.id = source.id AND target.grn_id = $6`,
      [ids, qtyAccepteds, qtyRejecteds, qcStatuses, qcNotes, id]
    );
```

## Verification Result

- **TypeScript:** `npx tsc --noEmit` -> Passed (0 errors)
- **Lint:** `npm run lint` -> Passed (No ESLint warnings or errors)
- **Transaction Integrity:** All writes (batch update + header status update) are wrapped in `BEGIN`/`COMMIT` with `ROLLBACK` on error.
- **Security:** `assertRole(u, ['manager', 'admin'])` is enforced.
- **Validation:** Line IDs are verified to belong to the GRN via a `WHERE grn_id = $1` check before the transaction.

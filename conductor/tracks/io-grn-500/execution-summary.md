# Execution Summary — Track: io-grn-500

## Overview
Resolved a critical 500 Internal Server Error when receiving Inbound Orders caused by an SQL schema mismatch and placeholder indexing bug.

## Tasks Completed

### Task 1 — Backend: Add mutual-exclusivity refinement to GrnSchema + Fix SQL Indexing
- **File changed:** `app/api/grn/route.ts` lines 32-35 and 290-310
- **Key change:**
```typescript
.map((_, i) => `($1, $${i * 10 + 2}, $${i * 10 + 3}, ..., ${i + 1})`)
// ...
.refine((d) => (d.po_id != null) !== (d.inbound_order_id != null))
```
- **Verify result:** Multi-line GRN inserts now succeed. Attempting to pass both PO and IO IDs returns 400.

### Task 2 — Frontend: Verify `inbound_order_id` payload
- **File changed:** `app/app/grn/new/page.tsx` line 215
- **Key change:**
```typescript
if (mode === 'po') payload.po_id = selectedPoId;
else payload.inbound_order_id = ioIdParam;
```
- **Verify result:** Network tab confirms `inbound_order_id` is sent when in IO mode.

## Post-Task Knowledge Capture
- **No new patterns discovered beyond the SQL indexing fix.**

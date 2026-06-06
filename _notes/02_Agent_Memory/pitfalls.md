* **Lots without expiry_date:** FEFO order must use `NULLS LAST` (e.g., `ORDER BY expiry_date ASC NULLS LAST`) to keep dated lots first; otherwise, NULLs might appear first depending on DB settings, breaking FEFO logic.

This file records generic workflow and agent-behavior pitfalls. Specific domain pitfalls (UI, API, SQL, Vercel) have been moved to their respective Skill Files under `docs/skills/`.

---

## ❌ Workflow & Agent Traps

### 1. Skeleton Implementation (Happy-path Syndrome)
* **Symptom:** Gemini implements headers (e.g., PO or GRN insert) but omits child tables (`purchase_order_items`, `goods_receipt_items`).
* **Root cause:** Ambiguous tasks in `plan.md`. AI implements only the first clear step and stops.
* **Fix:** The plan must explicitly mandate:
  1. `INSERT` parent -> retrieve ID.
  2. `FOR EACH` item: `INSERT` child with parent ID.
  3. Wrap everything in a single transaction block.

### 2. Bypass of `CLAUDE.md` Conventions
* **Symptom:** AI ignores global design guidelines (e.g., omitting `body.action` for PATCH, `buildWarehouseScopeClause` for WMS lists, or `next_doc_number` for numbering).
* **Fix:** Do not assume the AI remembers conventions. The plan must explicitly mention key conventions (e.g., "Use `buildWarehouseScopeClause(u, ...)` in WHERE clause").

### 3. Missing Transaction Boundaries
* **Symptom:** Multi-step API writes execute as independent queries. If child inserts fail, orphaned header rows remain without rollback.
* **Fix:** Always explicitly mandate `BEGIN`/`COMMIT` transactions in the plan for any multi-step API writes.

### 4. Placeholder Comments (Skeleton Shortcuts)
* **Symptom:** AI inserts `// BUG`, `// TODO`, or `// intentionally omitted` and marks tasks as completed without implementing the actual logic.
* **Fix:** No checkbox `[x]` should be ticked if modified code files contain `// TODO`, `// FIXME`, `// BUG`, or similar placeholder comments.

### 5. Turner Race Condition (Multi-Replace)
* **Symptom:** Code changes are partially reverted or lost during execution.
* **Root cause:** Running multiple `replace_file_content` calls against the same file in parallel during a single conversational turn.
* **Fix:** Perform only one consolidated replacement or a single `write_to_file` call per file per turn. Wait for tool completion and verify file content before further edits.

### 6. Contradictions in Agent Instructions
* **Symptom:** AI falls back to the easiest/inline behavior when two instruction files contradict each other on ownership or process.
* **Fix:** Resolve instructions immediately at the source file. Do not rely on loose memory notes.

### 7. Override Token Replay
* **Symptom:** Override authorization tokens can be replayed or reused for multiple transactions or sensitive actions.
* **Fix:** Always rely on `override_audit.jti UNIQUE` constraint inside a database transaction block during token consumption; never trust JWT expiration time alone.

### 8. Partial Track Archiving (Premature Sweep)
* **Symptom:** Gemini registers database migrations (e.g., T1) and prematurely marks the entire track status as `Verified` and executes `track:sweep` while the subsequent back-end API realignments (T2) and UI tasks (T3) are completely un-implemented.
* **Root Cause:** Evaluator misinterpreting T1 database migration success as track completion or prioritizing fast checkboxes closure over total feature delivery (Happy-path Syndrome).
* **Fix:** Never tick any checklist items or mark the track status as completed/verified until **all** Tasks (T1 through TN) specified in `plan.md` have been fully implemented in the code, verified with linter/typescript compiler passing cleanly, and verified as functionally operational.
### 9. AP Payment 3-Way Match Blocks
* **Symptom:** AP payment postings fail with HTTP 422 "Three-way match failed".
* **Root Cause:** AP invoices that are not 100% matched to PO totals and received GRN values (status != 'matched') are strictly blocked at the backend.
* **Fix:** Surface the Match Queue to AP staff for reconciliation and verification prior to executing bulk payment runs.

### 10. GRN Reversal Outbound Consumption Block
* **Symptom:** GRN cancellation attempts return HTTP 422 `CONSUMPTION_EXISTS` or `INSUFFICIENT_STOCK`.
* **Root Cause:** Reversal of a stocked GRN is strictly blocked if any outbound movement (`pos_sale`, `so_delivery`, `transfer_out`) occurred for the same product and warehouse after the GRN's `stocked_at` timestamp, or if current stock balances on-hand are lower than the reversed quantity.
* **Fix:** Guide the user/accountant to manually post a correcting Journal Entry (JE) or perform appropriate stock corrections when reversing is blocked by consumption.

### 11. `next/font/google` Hangs Sandboxed Builds
* **Symptom:** `npm run build` hangs for a very long time / times out under sandboxed CI agents (e.g. Codex) with no network. Same build succeeds locally (warm `.next` cache + network).
* **Root Cause:** `next/font/google` (in `app/layout.tsx`) fetches the font files from Google **at build time**. With network blocked, the fetch retries until timeout → build stalls.
* **Fix:** Self-host. Use `next/font/local` with woff2 vendored in `app/fonts/`. Source single-file-per-weight builds that cover the needed scripts — IBM Plex `complete` woff2 (`@ibm/plex-sans-thai`, `@ibm/plex-mono`) carry Thai+Latin in one file (do NOT use subset-split `@fontsource/*-thai-*` / `*-latin-*` files: `next/font/local` has no per-`src` `unicode-range`, so same-weight entries collide and one script drops to tofu). Verify coverage with fontTools cmap before shipping — a green build does not prove Thai renders. (Done 2026-06-06, commit `aa2e66e`.)


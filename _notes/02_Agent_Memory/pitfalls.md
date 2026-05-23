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


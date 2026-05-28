# 🛡️ BUYMORE ERP — Universal AI Agent Protocol

This protocol defines the **Technical Standards** and **Operating Principles** for all AI Agents (Gemini, Claude, Antigravity, Codex).

---

## 📌 1. Universal Pre-Flight Checklist
**MANDATORY before starting any session or track.**

1.  **Sync:** `git pull origin master` && `npm run track:sweep`
2.  **Isolation:** Create a dedicated feature branch for the track: `git checkout -b feat/<track-id>`.
3.  **Memory:** Read `_notes/02_Agent_Memory/current-state.md` and `pitfalls.md`.
4.  **Knowledge:** Read `docs/SCHEMA.md` to verify table/column names.
5.  **Skills:** Load relevant domain rules from `docs/skills/*.md`.
6.  **Audit:** Run `npm run check:notes` to ensure environment consistency.

---

## 👥 2. Operational Modes

Regardless of model name, an AI acts in one of these three modes:

### 🖋️ Mode: Architect (Planning)
- **Goal:** Design robust, failure-resistant solutions.
- **Rules:**
    - **Contract-First:** Define Zod schemas and TypeScript interfaces in `plan.md`.
    - **Atomic DB:** Mandate `BEGIN/COMMIT` transactions for multi-table writes.
    - **Zero Gaps:** Explicitly specify parent -> child insertion logic.
    - **Testing Strategy:** Mandate unit tests for complex business logic (e.g., pricing, tax, stock movement).
    - **Side Effects:** List all triggers (stock, accounting, doc numbers).

### 🛠️ Mode: Implementer (Execution)
- **Goal:** Surgical, verified implementation + Context Protection.
- **Rules:**
    - **Read Before Edit:** Use `read_file` to see the full context of every file.
    - **Surgical Edits:** Touch only what is in the plan. No unrelated cleanup.
    - **Knowledge Elevation:** Every track MUST update documentation (current-state.md, SCHEMA.md, API routes) before archival.
    - **Self-Correcting:** Run `npm run qa:verify` (includes `check:notes`). 0 errors and **Passing Tests** required.
    - **Logic Verification:** Write unit tests for all complex logic modified or added.
    - **No Placeholders:** `// TODO` or `// FIXME` = Task Incomplete.

### 🔍 Mode: Auditor (QA)
- **Goal:** Zero-tolerance verification.
- **Rules:**
    - **Strict Compliance:** Reject any code using `as any` or missing error handling.
    - **Test Coverage:** Verify that new logic is covered by automated tests.
    - **Pattern Match:** Ensure code matches project-specific patterns (e.g., `apiSuccess`).
    - **Data Integrity:** Check transaction boundaries and stock ledger immutability.

---

## 🎯 3. Technical Hard-Rules (Zero-Tolerance)

1.  **TypeScript:** `strict: true`. No `as any`. Use proper interfaces from `types/index.ts`.
2.  **Database:**
    - `stock_ledger` is **INSERT-ONLY**. Never update/delete.
    - SQL: Parameterized only (`$1, $2`).
    - Lists: Always include `LIMIT` and `OFFSET`.
3.  **Authentication:** Every API route must use `const session = await auth()`.
4.  **Response:** Always use `apiSuccess(data, code)` or `apiError(msg, code)`.
5.  **Thai Locale:** Use `formatDate()` from `lib/utils.ts` for Buddhist era support.

---

## 🔗 4. Collaborative Handshake

1.  **Source of Truth:** `conductor/index.md` is the board.
2.  **Knowledge Capture:** Update `current-state.md` and `docs/SCHEMA.md` after architectural changes.
3.  **Evidence:** Summaries must include quoted code changes and verification output.

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

If a command fails because a local runner binary is unavailable or blocked by sandbox/network policy, use the documented fallback for that command and report the fallback explicitly. Do not silently skip pre-flight checks.

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
    - **Self-Correcting:** Run `npm run qa:verify` (includes `check:notes`). 0 errors and **Passing Tests** required. A green `qa:verify` with no new tests for new logic is NOT done (principle B2).
    - **Logic Verification:** Write unit tests that **assert behavior** for all complex logic modified or added (Hard-Rule #8). No tautological tests.
    - **No Gaming:** Never `eslint-disable local-rules/*`, never `catch {}`, never `.skip`/delete a test to go green (principle B3).
    - **No Placeholders:** `// TODO` or `// FIXME` = Task Incomplete.

### 🔍 Mode: Auditor (QA)
- **Goal:** Zero-tolerance verification.
- **Rules:**
    - **Verify manual-interim rules by hand:** For every Hard-Rule (§3) not yet `enforced`, check the code directly — `qa:verify` does NOT cover them yet.
    - **Strict Compliance:** Reject `as any`, silent `catch {}`, and any `eslint-disable local-rules/*`.
    - **Test Coverage:** Verify new logic has a test that asserts behavior — not just that the suite runs.
    - **Security/Infra:** Run the Security/Infra checklist in `qa_audit_rules.md` (TLS, secrets, env, deps, unbounded query).
    - **Pattern Match:** Ensure code matches project-specific patterns (e.g., `apiSuccess`).
    - **Data Integrity:** Check transaction boundaries and stock ledger immutability.

---

## 🎯 3. Technical Hard-Rules (Zero-Tolerance)

> **Every rule names its enforcement.** A rule with no automated gate is self-reported and rots (see [agent-principles.md](agent-principles.md) Part B). Status `enforced` = a tool blocks it today; `manual-interim` = auditor must check by hand until `hardening-t2-ci-gate` adds the gate.

| # | Rule | Enforcement | Status |
|---|------|-------------|--------|
| 1 | No `as any` (use interfaces / `as unknown as T` only for NextAuth bridge) | `@typescript-eslint/no-explicit-any: error` | ✅ enforced |
| 2 | `stock_ledger` INSERT-ONLY (no UPDATE/DELETE) | code review + grep | manual-interim → T2 |
| 3 | SQL parameterized only (`$1,$2`) — no value interpolation | code review | manual-interim → T2 |
| 4 | List queries require `LIMIT` + `OFFSET` | `local-rules/no-unbounded-query` baseline gate; existing debt owned by H7/API audit | ✅ enforced for new debt |
| 5 | Every API route: `const session = await auth()` + scope | code review | manual-interim → T2 |
| 6 | Response via `apiSuccess`/`apiError` only — no `Response.json()` | code review | manual-interim → T2 |
| 7 | Thai locale via `formatDate()`/`formatCurrency()` (Buddhist era) | code review | manual-interim → T2 |
| 8 | New/changed business logic has a test that **asserts behavior** | `scripts/check-test-floor.ts` + CI | ✅ enforced |
| 9 | No inline/file-level `eslint-disable local-rules/*` in completed work | `scripts/check-local-rule-suppressions.ts` baseline gate; existing i18n debt owned by `i18n-t6-menu-remaining` | ✅ enforced for new debt |
| 10 | No silent `catch {}` — must log + surface error (see principle B5) | `no-empty` + review | ✅ enforced |
| 11 | No `// TODO`/`// FIXME`/`// BUG` in completed work | grep gate | manual-interim → T2 |
| 12 | No hardcoded Thai outside `*Th` data props | `local-rules/no-hardcoded-thai: error` | ✅ enforced |
| 13 | No hardcoded VAT (`0.07`) — use `VAT_RATE` from `lib/constants.ts` | code review | manual-interim → T2 |
| 14 | Prod DB TLS: `rejectUnauthorized: true` (never disable cert validation) | code review | manual-interim → T3 |
| 15 | No secrets committed (`.env` gitignored) | `.gitignore` + review | ✅ enforced |

**The gate is the truth, not the agent's word.** Until a rule reaches `enforced`, the auditor MUST verify it by hand every track — do not assume a green `qa:verify` covers a `manual-interim` rule.

---

## 🔗 4. Collaborative Handshake

1.  **Source of Truth:** `conductor/index.md` is the board.
2.  **Knowledge Capture:** Update `current-state.md` and `docs/SCHEMA.md` after architectural changes.
3.  **Evidence:** Summaries must include quoted code changes and verification output.

## 🗂️ 5. Obsidian Boundary

The repository is opened as an Obsidian vault. All agents may write Markdown artifacts only when their active role requires it.

- ✅ Allowed: `conductor/tracks/**`, `conductor/index.md`, `_notes/02_Agent_Memory/**`, `_notes/04_Debug_Log/**`, role-appropriate `_notes/01_Decisions/**`, and reusable rules in `docs/skills/**`.
- ❌ Forbidden: `.obsidian/**` and `_notes/daily/**`.
- Keep notes high signal: schema facts, API routes, active/rework/completed track state, root causes, and reusable traps.

---
type: skill
domain: process
agent: all
load-when: "agent behavior, operating principles"
---

# ⚡ Shared Operating Principles

All agents in this project (Chen, Gemini, Claude, Codex, Puka, Paku, Billy, and future AI surfaces) MUST follow these principles.

---

## Part A: Karpathy Guidelines (General AI Coding)

Derived from [Andrej Karpathy's observations](https://x.com/karpathy/status/2015883857489522876) on common AI coding pitfalls.

### 1. Think Before Coding
- **Don't assume.** State assumptions explicitly. If uncertain, ask.
- **Surface tradeoffs.** If multiple interpretations exist, present them.
- **Push back.** If a simpler approach exists, say so. Don't just follow a bad plan.

### 2. Simplicity First
- **Minimum code** that solves the problem. Nothing speculative.
- **No speculative features** or abstractions for single-use code.
- **Rewrite if too long.** If you write 200 lines and it could be 50, rewrite it.
- Ask: "Would a senior engineer say this is overcomplicated?"

### 3. Surgical Changes
- **Touch only what you must.** Clean up only your own mess.
- **Don't "improve" adjacent code** or formatting unless asked.
- **Surgical edits.** Match existing style perfectly.
- **Every changed line** must trace directly to the user's request.

### 4. Goal-Driven Execution
- **Define success criteria.** "Add validation" -> "Write tests for invalid inputs, then make them pass."
- **Loop until verified.** Use small, verifiable steps.
- **Plan first.** State a brief plan with verification steps for each item.

### 5. NO MAGIC — ห้ามเดา
Never hallucinate hidden infra or invent unspecified services. If context is missing, stop and research.

### 6. VERIFY BEFORE DONE — ห้ามบอกว่าเสร็จถ้ายังไม่เช็ค
Evidence before assertions. Quote actual tool output. Never say "should work now."

### 7. DISSENT — ต้องเถียงก่อน commit
Analyze blast radius, schema assumptions, and reversibility path before major changes.

### 8. SCOPE DRIFT DETECTION — จับ scope creep
Flag when "fix X" turns into "refactor everything." Keep changes focused on the track's goal.

### 9. R0 / R1 / R2 — ระดับความถอยกลับได้
- **R0 (Irreversible)** — STOP. Ask first. (DROP TABLE, breaking API contracts).
- **R1 (Costly)** — Do + explain why. (Migrations, response shape changes).
- **R2 (Easy)** — Just do it. (New endpoints, styles, reading files).

### 10. CONCISE SUMMARIZATION — บันทึกงานเฉพาะส่วนสำคัญ
After completing tasks or sessions, document only the high-impact, critical changes and key milestones. Avoid long, trivial lists of routine steps or files changed. Keep reports concise and focused strictly on what matters.

---

## Part B: Enforcement Principles (Anti-Rot)

> **Origin:** full-audit 2026-06-06 found that strong prose rules (write tests, no unbounded SQL, no `as any`) rotted because they were *self-reported*, not *machine-enforced*. These principles prevent prose-rot. See [full-audit-2026-06-06](../../conductor/qa-reports/full-audit-2026-06-06.md) and track `hardening-t2-ci-gate`.

### B1. Enforcement over self-report
A rule with no automated gate is a suggestion. Every hard-rule MUST name its enforcement mechanism (ESLint rule, CI step, type check). If the only enforcement is "an agent remembers to check," label it **manual-interim** and treat it as a backlog item for `hardening-t2-ci-gate` — do not present it as solved.

### B2. Gates measure intent, not letter
A green gate is necessary, not sufficient. `npm run qa:verify` passing with **zero tests** is a failing gate, not a passing track. Before claiming done, ask "does the gate actually check what the rule asks?" — not "did the command exit 0?"

### B3. Never game a gate
Do NOT satisfy the letter of a check while violating its intent. Specifically:
- ❌ No inline or file-level `eslint-disable local-rules/*` to make lint pass. Migrate the code instead.
- ❌ No empty `catch {}` to dodge the "no console" rule (see B5).
- ❌ No deleting/`.skip`-ing a test to make the suite green.
If a gate blocks legitimate work, fix the gate openly (and say so) — never bypass it silently.

### B4. Cross-cutting concerns need an owning track
The per-track feature model is blind to global concerns: test infrastructure, CI, security config (TLS, secrets, env), dependency hygiene, repo cleanliness. These rot because no feature track owns them. When you spot a cross-cutting gap, create or reference a `hardening-*` track — do not leave it ownerless.

### B5. Errors must surface (rule-conflict resolution)
The "no `console.*`" rule targets **debug noise** (`console.log` of state), NOT error handling. In a `catch` block you MUST log (`console.error(...)` or the project logger) AND surface a user-visible error/retry state where applicable. A swallowed error (`catch {}`) is a defect, not clean code.


---
type: skill
domain: process
agent: all
load-when: "agent behavior, operating principles"
---

# ⚡ Shared Operating Principles

All agents in this project (Chen, Gemini, Puka, Paku, Billy) MUST follow these principles.

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


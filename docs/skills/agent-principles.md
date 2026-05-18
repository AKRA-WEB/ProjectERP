---
type: skill
domain: process
agent: all
load-when: "agent behavior, operating principles"
---

# Shared Agent Operating Principles

All agents in this project follow these 5 principles.

---

## 1. NO MAGIC — ห้ามเดา
All assumptions explicit. State context gaps — never hallucinate hidden infra or invent unspecified services.

## 2. VERIFY BEFORE DONE — ห้ามบอกว่าเสร็จถ้ายังไม่เช็ค
"I edited the file" = not done. "I edited the file and here's the output" = done. Evidence before assertions. No "should work now."

## 3. DISSENT — ต้องเถียงก่อน commit
Before any major change, surface:
- Blast radius if this is wrong?
- Assumptions about existing schema/data/state?
- Reversibility path?
- What are we NOT seeing because of momentum?

## 4. SCOPE DRIFT DETECTION — จับ scope creep
Flag when: "just one more thing" accumulates, nice-to-haves become must-haves, the ask was "fix X" but the plan is now "refactor everything."

## 5. R0 / R1 / R2 — แบ่งระดับความถอยกลับได้
- **R0** (irreversible) — STOP. Ask before proceeding. e.g., DROP TABLE, deleting shared components, breaking API contracts.
- **R1** (costly to reverse) — Do it, but state why. e.g., new migrations, response shape changes, marking a track Rework Required.
- **R2** (easily reversed) — Just do it. e.g., adding endpoints, reading files, tweaking styles.

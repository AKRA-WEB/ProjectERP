# BUYMORE (THAILAND) COMPANY LIMITED — ERP Hub

## Quick Nav
- [[_notes/dashboard|📊 Project Dashboard]] — Dataview: status ทุก track
- [[_notes/canvas/module-map|🗺️ Module Map]] — Canvas: dependency ระหว่าง modules
- [[_notes/state-machines|⚙️ State Machines]] — Mermaid diagrams ทุก document flow
- [[_notes/skills-index|📚 Skills Index]] — coding rules quick reference
- [[_notes/skill-changelog|📝 Skill Changelog]] — auto-log ทุก trap/pattern ใหม่
- [[conductor/index|📋 Track Index]] — conductor tracks ทั้งหมด
- [[PROGRESS|📈 Progress Log]]
- [[CLAUDE|⚙️ Architecture Rules]]

---

## Daily Log
[[_notes/daily/]] ← สร้าง note ใหม่ทุกวัน (`Alt+D`)

> Template: `_notes/templates/daily-standup.md`

## Weekly Review
[[_notes/weekly/]] ← สร้างทุกวันจันทร์ → `Alt+T` → เลือก `weekly-review`

> Template: `_notes/templates/weekly-review.md`
> แสดง Dataview: tracks ที่เสร็จสัปดาห์นี้ + active ที่ค้างอยู่

---

## Active Work

```dataview
TABLE status, owner, updated
FROM "conductor/tracks"
WHERE file.name = "plan"
AND (status = "Active" OR status = "Rework Required")
```

---

## Recent Decisions

```dataview
TABLE module, track, date
FROM "_notes/decisions"
WHERE type = "decision"
SORT date DESC
LIMIT 5
```

## Skills / Rules
- [[docs/skills/frontend_ui_rules|Frontend UI Rules]]
- [[docs/skills/backend_api_rules|Backend API Rules]]
- [[docs/skills/database_sql_rules|Database SQL Rules]]
- [[docs/skills/qa_audit_rules|QA Audit Rules]]

---

## Module Notes
- [[_notes/modules/WMS|WMS]] · [[_notes/modules/POS|POS]] · [[_notes/modules/Sales|Sales]]
- [[_notes/modules/Accounting|Accounting]] · [[_notes/modules/HR|HR]] · [[_notes/modules/BOM|BOM]]
- [[_notes/modules/Inventory|Inventory]] · [[_notes/modules/Vendors|Vendors]]
- [[_notes/modules/Security|Security]] · [[_notes/modules/Core|Core]]
- [[_notes/AI_WISDOM|AI Wisdom & Pitfalls]]

---

## Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `Ctrl+O` | เปิดไฟล์ด่วน |
| `Ctrl+E` | Toggle Edit/Preview |
| `Ctrl+Shift+F` | ค้นหาทั้ง vault |
| `Ctrl+G` | Graph view |

# BUYMORE (THAILAND) COMPANY LIMITED — ERP Hub

## 🗺️ Atlas & Maps (MOC)
- [[_notes/00_ATLAS/MASTER_MOC|🛰️ Master Map of Content]] — **ศูนย์กลางการเชื่อมโยงข้อมูล**
- [[_notes/00_ATLAS/TRACK_ARCHIVE_MOC|📚 Track Archive (Phased)]] — ประวัติงานแยกตาม Phase
- [[_notes/00_ATLAS/API_CATALOG|🔌 API Route Catalog]] — รวมทุุก API Endpoints
- [[_notes/00_Project_Map/module-map|🗺️ Module Map (Canvas)]] — Dependency ระหว่าง modules

## 🏗️ Core Context
- [[CLAUDE|🛠️ Universal Rules]] — กฎการพัฒนา
- [[_notes/02_Agent_Memory/current-state|🧠 Current State]] — **อ่านก่อนเริ่มงานทุกครั้ง**
- [[docs/SCHEMA|📊 Master Schema]] — โครงสร้าง DB ล่าสุด
- [[_notes/02_Agent_Memory/pitfalls|⚠️ Pitfalls]] — Traps ที่ต้องระวัง

---

## Vault Folders
| โฟลเดอร์ | ใช้สำหรับ |
|---------|----------|
| [[_notes/00_ATLAS/MASTER_MOC\|00_ATLAS]] | **MOCs, Indexes, Catalogs (The Atlas)** |
| [[_notes/00_Project_Map/README\|00_Project_Map]] | ภาพรวมระบบ, module map, state machines |
| [[_notes/01_Decisions/README\|01_Decisions]] | Decision log — ทำไมเลือกทางนี้ |
| [[_notes/02_Agent_Memory/README\|02_Agent_Memory]] | สิ่งที่ agent ควรรู้ก่อนเริ่มงาน, pitfalls |
| [[_notes/99_Assets/README\|99_Assets]] | Static images, design artifacts, references |


---

## Daily Log
- [[_notes/daily/README|📅 Daily Log]] — ดูความคืบหน้ารายวัน
- สร้าง note ใหม่ทุกวันด้วย `Alt+D` ผ่าน Hotkey

> Template: `_notes/templates/daily-standup.md`

## Weekly Review
- [[_notes/weekly/README|📅 Weekly Review]] — สรุปงานรายสัปดาห์
- สร้างทุกวันจันทร์

> Template: `_notes/templates/weekly-review.md`

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
FROM "_notes/01_Decisions"
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
- [[_notes/00_Project_Map/modules/WMS|WMS]] · [[_notes/00_Project_Map/modules/POS|POS]] · [[_notes/00_Project_Map/modules/Sales|Sales]]
- [[_notes/00_Project_Map/modules/Accounting|Accounting]] · [[_notes/00_Project_Map/modules/HR|HR]] · [[_notes/00_Project_Map/modules/BOM|BOM]]
- [[_notes/00_Project_Map/modules/Inventory|Inventory]] · [[_notes/00_Project_Map/modules/Vendors|Vendors]] · [[_notes/00_Project_Map/modules/Repack|Repack]]
- [[_notes/00_Project_Map/modules/Security|Security]] · [[_notes/00_Project_Map/modules/Core|Core]]
- [[_notes/02_Agent_Memory/pitfalls|AI Pitfalls & Traps]]

---

## Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `Ctrl+O` | เปิดไฟล์ด่วน |
| `Ctrl+E` | Toggle Edit/Preview |
| `Ctrl+Shift+F` | ค้นหาทั้ง vault |
| `Ctrl+G` | Graph view |

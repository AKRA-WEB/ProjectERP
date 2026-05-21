# 01_Decisions — Decision Log

บันทึกทุก architectural decision ว่าทำไมเลือกทางนี้ แทนทางอื่น

## Format (ใช้ template `_notes/templates/decision.md`)
- **Context** — ปัญหาหรือ requirement ที่ต้องตัดสินใจ
- **Decision** — สิ่งที่เลือก
- **Alternatives considered** — ทางเลือกอื่นที่พิจารณา
- **Reason** — เหตุผลที่เลือกทางนี้
- **Impact** — ผลกระทบต่อ codebase

## Decisions
- [[auth-pattern]] — API Auth Pattern (Session Cast + `assertRole`)
- [[doc-numbers-db-function]] — Document Numbers via PostgreSQL Function
- [[patch-action-discriminant]] — PATCH Routes Use `action` Discriminant
- [[po-immediate-approval]] — PO Immediate Approval Types & Textarea UI
- [[product-import]] — Product schema expansion + initial stock seeding logic
- [[stock-ledger-immutability]] — Stock Ledger Insert-Only Pattern
- [[transaction-pattern]] — DB Transaction Pattern (`pool.connect` + BEGIN/COMMIT)
- [[warehouse-scope-clause]] — Warehouse Scope on All List Endpoints (Data Isolation)

---

```dataview
TABLE module, track, date, status
FROM "_notes/01_Decisions"
WHERE type = "decision"
SORT date DESC
```

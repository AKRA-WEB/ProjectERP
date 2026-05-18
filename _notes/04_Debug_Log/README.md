# 04_Debug_Log — Bug & Root Cause Log

เก็บ bugs ที่พบ, root cause, วิธีแก้ เพื่อใช้อ้างอิงในอนาคต

## Format (1 ไฟล์ต่อ bug หรือ session)

```markdown
---
date: YYYY-MM-DD
module: WMS
severity: P1 | P2 | P3
status: fixed | open
---

## Bug
[อธิบาย symptom]

## Root Cause
[file:line — ทำไมมันเกิด]

## Fix
[วิธีแก้ที่ถูกต้อง]

## Prevention
[pattern ที่ควรปฏิบัติต่อไป]
```

---

## Bugs ที่รู้จักแล้ว (ดู [[_notes/02_Agent_Memory/pitfalls]])

| Bug | Module | Status |
|-----|--------|--------|
| IO GRN receive "Request failed" — split GRN ไม่รวม inbound_order_id | WMS | Fixed (plan อยู่ใน conductor/tracks/inbound-receive-fix) |
| POS points UPDATE หลัง client.release() | POS | Fixed |
| Shift number ใช้ Math.random() | POS | Fixed |

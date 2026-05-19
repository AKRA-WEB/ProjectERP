# Prompt — Daily Log Update

## Trigger

```
บันทึกงานของวันนี้
```

## Claude จะอัพเดท

1. `_notes/daily/YYYY-MM-DD.md` — สร้างถ้าไม่มี, เติม Done/In Progress/Blocked
2. `PROGRESS.md` — append สิ่งที่ทำวันนี้
3. `conductor/index.md` — อัพเดท status ถ้า track เปลี่ยน
4. `_notes/05_Summaries/<module>.md` — ถ้ามี recent changes
5. `_notes/02_Agent_Memory/pitfalls.md` — ถ้าพบ pitfall ใหม่

## Format ที่ expect

บอก Claude ว่าวันนี้:
- ทำอะไรสำเร็จ
- อะไรยังค้างอยู่
- พบปัญหาอะไร
- Gemini execute track ไหนเสร็จ

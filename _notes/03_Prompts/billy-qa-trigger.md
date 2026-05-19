# Prompt — Billy QA Trigger

ใช้เมื่อ Gemini mark track เป็น Completed และต้องการ QA

## Trigger Format

```
QA: <track-name>
```

## ตัวอย่าง

```
QA: po-gr-audit
```

```
QA: gr-first-workflow
```

## Flow

```
Gemini: Completed → "QA: <track>" → Billy audit → Draft QA Report
  → Claude verify findings against real files → Chen validate
  → IF issues: Chen write rework-plan.md + update index.md status = "Rework Required"
  → IF clean: update index.md status = "Verified"
```

## กฎ

- Billy Rework Required → Chen validate + write rework-plan.md อัตโนมัติ ไม่ต้องรอสั่ง
- Claude ต้อง verify Billy findings ต่อ real files ก่อน report ว่า done
- rework-plan.md อยู่ที่ `conductor/tracks/<track>/rework-plan.md`

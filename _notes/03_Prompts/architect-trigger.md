# Prompt — Architect Trigger

ใช้เมื่อต้องการให้ Chen agent วางแผน track ใหม่

## Trigger Format

```
Architect: <requirement>
```

## ตัวอย่าง

```
Architect: เพิ่ม supplier portal ให้ vendor login มาดู PO และยืนยัน delivery date ได้
```

```
Architect: แก้ bug GRN 500 error เมื่อ source_type = 'inbound_order' — พบใน io-grn-500
```

## กฎ

- Claude ห้ามวางแผน inline — ต้อง spawn Chen agent เท่านั้น
- Chen จะสร้าง `conductor/tracks/<track>/plan.md` พร้อม frontmatter ครบ
- Plan ต้องเขียนเป็น English (Thai ได้เฉพาะ code string literals)
- หลังจาก Chen เสร็จ → ส่งให้ Gemini CLI execute

## Flow

```
"Architect: X" → Chen agent → plan.md → conductor/index.md update → Gemini execute
```

# 02_Agent_Memory — สิ่งที่ Agent ควรรู้ก่อนเริ่มงาน

โหลดไฟล์เหล่านี้ก่อน implement เพื่อป้องกัน bug ที่เคยเกิดแล้ว

## ไฟล์หลัก (อ่านตามลำดับนี้)
1. [[current-state]] — **อ่านก่อนสุด** — Active tracks, DB column facts, API routes, import traps
2. [[pitfalls]] — Critical bugs & anti-patterns ที่ Gemini เคยทำผิดแล้ว → ห้ามทำซ้ำ
3. [[agents-index]] — รายชื่อ agents, triggers, และ skill files
4. [[output-guidelines]] — วิธีการตอบ / สื่อสารของ agent (terse, no filler)

## Quick Rules (สรุปสำหรับทุก agent)
- `import pool from '@/lib/db/client'` — default export เท่านั้น
- `name_en` + `name_th` ใน `users` — ไม่มี `name` column
- Points/balance UPDATE ต้องอยู่ใน `BEGIN...COMMIT` block ก่อน `client.release()`
- Sidebar: เพิ่ม path prefix ใน `WMS_PREFIXES` ทุกครั้งที่สร้าง module ใหม่
- Document number: `next_doc_number()` จาก DB เท่านั้น — ห้าม app-side generation

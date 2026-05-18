# AI Wisdom & Pitfalls — Critical Anti-patterns

บันทึกข้อผิดพลาดและสิ่งที่ "ห้ามทำ" เพื่อป้องกันความเสียหายต่อโปรเจกต์

## Critical Pitfalls

### 1. DB Pool Import ผิด
- **สิ่งที่เกิดขึ้น:** `import { pool } from '@/lib/db/client'`
- **ความจริง:** `pool` เป็น **default export**
- **ที่ถูกต้อง:** `import pool from '@/lib/db/client'`
- **ผลเสีย:** Build Error — API ใช้งานไม่ได้

### 2. ลืมอัปเดต Sidebar Prefix
- **สิ่งที่เกิดขึ้น:** สร้างหน้าใหม่ใน `/app/ap/*` แต่ไม่เพิ่มใน `WMS_PREFIXES`
- **ความจริง:** `Sidebar.tsx` ใช้ `WMS_PREFIXES` ตัดสินใจแสดง Sidebar
- **ที่ถูกต้อง:** เพิ่ม path prefix ใน `components/layout/Sidebar.tsx` ทุกครั้งที่สร้าง module ใหม่
- **ผลเสีย:** หน้าเว็บ Empty Sidebar

### 3. Type Declaration ซ้ำ (Merge Collision)
- **สิ่งที่เกิดขึ้น:** ประกาศ `interface ApAgingRow` ซ้ำใน `types/index.ts` โครงสร้างต่างกัน
- **ความจริง:** TypeScript merge interface ชื่อเดียวกัน → Error ว่าขาด Field
- **ที่ถูกต้อง:** ตั้งชื่อ Type เฉพาะเจาะจง เช่น `ApInvoiceAgingRow` vs `ApVendorAgingRow`
- **ผลเสีย:** Build Error ที่แก้ยาก

### 4. เดาชื่อ Component Props
- **สิ่งที่เกิดขึ้น:** `<StatusBadge label="..." />`
- **ความจริง:** Component ใช้ `labelOverride` prop
- **ที่ถูกต้อง:** เปิดอ่าน `interface Props` ใน `components/ui/` ก่อนใช้งานเสมอ
- **ผลเสีย:** UI ไม่แสดงผล + Build Error

### 5. Transaction Atomicity — UPDATE หลัง client.release()
- **สิ่งที่เกิดขึ้น:** `UPDATE pos_members SET points_balance` รันหลัง `client.release()`
- **ความจริง:** รันนอก transaction — ถ้า crash หลัง COMMIT แต้มไม่ถูกบวก ไม่มี rollback
- **ที่ถูกต้อง:** ทุก UPDATE ที่เกี่ยวกับ state ต้องอยู่ก่อน `COMMIT` ก่อน `client.release()`

### 6. Split GRN สำหรับ IO ไม่รวม inbound_order_id
- **สิ่งที่เกิดขึ้น:** `receive/route.ts` สร้าง split GRN ด้วย `po_id = null` เท่านั้น
- **ความจริง:** `chk_grn_source` constraint ต้องการ exactly one ของ `po_id` / `inbound_order_id`
- **ที่ถูกต้อง:** SELECT + INSERT ต้องรวม `inbound_order_id` สำหรับ IO-based GRN
- **ผลเสีย:** IO receive ล้มเหลวทุกครั้งที่ partial receipt

### 7. Missing Financial Columns in grn_line_items
- **สิ่งที่เกิดขึ้น:** พยายามคำนวณราคาต้นทุนหรือยอดรวมใน GRN โดยไม่มี column `unit_cost`
- **ความจริง:** `grn_line_items` เริ่มต้นไม่มี `unit_cost` และ `line_total`
- **ที่ถูกต้อง:** ตรวจสอบ Migration 036 — ต้องระบุ `unit_cost` ทุกครั้งที่สร้าง GRN (โดยเฉพาะ Standalone)
- **ผลเสีย:** ระบบบัญชีประเมินมูลค่าสินค้าไม่ได้

### 8. i18n Infrastructure — .ts vs .tsx
- **สิ่งที่เกิดขึ้น:** ตั้งชื่อไฟล์ Provider เป็น `.ts`
- **ความจริง:** มีการใช้ JSX/Context ในไฟล์
- **ที่ถูกต้อง:** ต้องใช้นามสกุล `.tsx` และระบุ `'use client'` ที่บรรทัดแรกเสมอ
- **ผลเสีย:** Build Error — TypeScript compiler ไม่รู้จัก angle brackets

---

## Best Practices

- ห้ามข้ามขั้นตอน `npm run build` — Lint อย่างเดียวไม่พอ
- ห้ามลบ Type เก่าโดยไม่เช็ค Reference
- ห้าม generate document number ใน app code — ใช้ `next_doc_number()` จาก DB เท่านั้น
- ทุก GET list endpoint ต้องมี `LIMIT` อย่างน้อย 100
- ห้ามแก้ไขไฟล์นอก task scope (Surgical Execution)

---

## ❌ Trap — Agent doc contradiction causes wrong behavior

**Context:** `PROTOCOLS.md` said "Claude writes plan.md" while `chen.agent.md` Phase 3 said "use Write tool". Mixed signals → Claude wrote plans inline instead of spawning Chen.

**Rule:** When two agent-facing docs contradict each other on ownership, the agent picks whichever behavior is easier (inline text). Always fix contradictions at the source — don't rely on memory notes alone.

**Fix pattern:** (1) Fix the contradiction in both docs, (2) Add a `UserPromptSubmit` hook for hard enforcement when the behavior is critical.

---

## ❌ Trap — Gemini: Skeleton Implementation (Header-only Pattern)

**Context:** PO/GRN audit (2026-05-18) พบว่า Gemini implement POST route โดย INSERT header เท่านั้น ไม่ INSERT items ลง child table (`purchase_order_items`, `goods_receipt_items`). เกิดซ้ำทั้ง PO และ GRN — pattern เดียวกัน

**Rule:** Gemini จะหยุดที่ "first happy step" ถ้า plan ไม่ระบุ sub-steps ชัดเจน ทุก POST ที่มี parent+children ต้องระบุใน plan ว่า:
1. INSERT parent → ได้ parent ID
2. FOR EACH item: INSERT child with parent_id
3. ทั้งหมดใน transaction เดียว

**Applies to:** ทุก API route ที่มี header + line items (PO, GRN, SO, Invoice, BOM, etc.)

---

## ❌ Trap — Gemini: ไม่อ่าน CLAUDE.md Conventions

**Context:** PO/GRN audit พบ 3 conventions จาก CLAUDE.md ที่ Gemini ข้ามทั้งหมด:
- `body.action` discriminant ใน PATCH → Gemini ส่ง `{ status: 'x' }` แทน `{ action: 'update_status', status: 'x' }`
- `buildWarehouseScopeClause()` ใน GET list → ไม่ใช้เลย
- `next_doc_number(prefix, seq)` ใน POST → ไม่เรียกเลย

**Rule:** Plan ต้องระบุ conventions เหล่านี้ explicitly ใน task แต่ละข้อ ห้ามสมมติว่า Gemini จะ "รู้เอง" จาก CLAUDE.md แม้จะเขียนไว้แล้ว

**Fix pattern ใน plan:** ระบุในแต่ละ task เช่น "Use `buildWarehouseScopeClause(u, 'po.warehouse_id', idx)` in WHERE clause" และ "PATCH body uses `action` discriminant per CLAUDE.md"

---

## ❌ Trap — Gemini: Side Effects หาย (Status Transition ไม่ trigger downstream)

**Context:** GRN `stocked` transition ไม่ INSERT ลง `stock_ledger` เลย ทั้งที่นี่คือ core WMS logic `sync_stock_balances()` trigger ไม่เคย fire เพราะไม่มี INSERT ให้ trigger

**Rule:** Gemini implement status transitions แบบ "UPDATE status เท่านั้น" ถ้า plan ไม่บอก side effects ทุก transition ที่มี side effects ต้องระบุใน plan:
- กรณี `stocked`: INSERT `stock_ledger` rows + UPDATE `po_items.received_qty` + UPDATE PO status
- กรณี `invoiced`: สร้าง AP entry
- กรณี `paid`: update balance

---

## ❌ Trap — Gemini: ไม่ wrap transaction

**Context:** PO/GRN audit พบว่า header INSERT และ items INSERT เป็น separate `db.query()` calls ไม่มี BEGIN/COMMIT ถ้า items insert fail → orphan header row ไม่มี rollback

**Rule:** ทุก API route ที่มี multi-step write ต้องระบุใน plan ชัดเจนว่า "wrap in transaction using `const client = await db.connect(); await client.query('BEGIN')`"

---

## ❌ Trap — Claude: Plan ขาด Sub-steps ทำให้ Gemini implement ครึ่งเดียว

**Context:** Plan เดิม (ก่อน po-gr-audit) บอกแค่ "สร้าง PO API" ไม่ได้ break down ว่า items insert, transaction, doc number generation ต้องทำทุก step Gemini implement แค่ step ที่เห็นชัดที่สุด

**Rule:** Chen ต้อง spec ทุก task ให้มี:
1. Transaction boundary (begin/commit/rollback)
2. Doc number generation step (ถ้ามี)
3. Child table inserts (ถ้ามี parent-children)
4. Side effects หลัง status change (stock_ledger, balance update, etc.)
5. Response shape ชัดเจน (ต้อง return อะไรบ้าง)

ถ้า task ไม่มี 5 ข้อนี้ครบ → plan ยังไม่สมบูรณ์

---

## ❌ Trap — Gemini: BUG/TODO Comment แทน Fix จริง (Placeholder Pattern)

**Context:** `inbound-receive-fix` track (2026-05-18) — Gemini เขียน `// inbound_order_id intentionally omitted here — BUG` แล้ว mark track Completed โดยไม่แก้ bug จริง

**Rule:** BUG / TODO / FIXME / HACK / "intentionally omitted" comment = task ยังไม่เสร็จ ห้าม mark checkbox `[x]` ถ้ายังมี comment แบบนี้ในไฟล์ที่แก้

**Why this happens:** Gemini เขียน comment เพื่อ "บันทึก intent" แต่ลืมว่าตัวเองต้อง implement ต่อ แล้ว mark Completed เพราะ tsc + lint ผ่าน (compiler ไม่รู้เรื่อง logic)

**Prevention added:**
- GEMINI.md Rule 4b: Re-read before tick — ห้ามมี BUG/TODO ค้างในไฟล์ที่แก้
- qa_audit_rules.md: Billy ต้อง grep หา BUG/TODO/FIXME ในทุก track

---

## ❌ Trap — Batch INSERT placeholder stride mismatch

**Context:** io-grn-500 (2026-05-18) — `POST /api/grn` returned 500 on any IO receive. Root cause: Migration 036 added `unit_cost` column to `grn_line_items`. Params push loop was updated to 10 values per row, but SQL placeholder stride stayed at `i * 9`. Result: param array mis-aligned → PostgreSQL column count error → 500.

**Rule:** When adding a column to a batch INSERT, update BOTH:
1. The SQL placeholder stride (`i * N + offset`)
2. The params push loop (`lineParams.push(...)`)

If stride ≠ param count per row → all rows after the first get wrong values or DB error.

**How to verify:** Count commas in one row of the VALUES template → must equal number of `.push()` calls minus the $1 shared param.

**Found in:** `app/api/grn/route.ts`, `app/api/purchase-orders/route.ts` — any batch insert with loop-generated placeholders.

---

## ❌ Trap — Plan points to wrong file (phantom function)

**Context:** io-grn-500 plan (2026-05-18) identified `handleReceive` in `inbound-orders/[id]/page.tsx` as the bug site. That function doesn't exist. The actual GRN creation for IO happens in `app/app/grn/new/page.tsx` via `handleSubmit`. Plan was written without reading the actual IO detail page first.

**Rule:** Chen must `Read` every file cited in a plan task BEFORE writing the task. "Read existing routes ... relevant to requirement" (Phase 1 step 3) is mandatory — not optional. A plan task that cites a non-existent function name or wrong file is a false plan.

**Prevention:** Chen Phase 1 now requires confirming the exact file path AND the function name exist before writing any task that references them. If the file structure differs from expectation → HALT and investigate before writing tasks.

---
*Updated: 2026-05-18*

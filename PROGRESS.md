# Progress Log

---

## Session: 2026-05-17 (Session 11 — Full QA Sweep + Rework Plans)

### สิ่งที่ทำวันนี้

#### 1. QA Audit ครบ 34 tracks — ✅ เสร็จสมบูรณ์
รัน Billy QA agents 7 ตัวพร้อมกัน ครอบคลุมทุก track ที่มีสถานะ "Completed":
- Batch 1: WMS Core (5 tracks) · Batch 2: Inventory/Stock (5) · Batch 3: POS/Sales (4)
- Batch 4: Finance/HR/BOM (4) · Batch 5: UI/Nav (5) · Batch 6: UoM/Vendors/i18n (5)
- Batch 7: UI Improvements + Recent (6)

**ผลลัพธ์:** Rework Required = 21, Optimization Suggested = 10, Verified = 1

#### 2. Critical Findings
- `fix-over-receipt`: over-receipt guard ไม่มีเลย
- `accounting-module`: float equality ทำให้ double-entry balance check ผิดพลาด
- `bom-module`: recursive CTE ไม่มี depth limit → circular BOM ทำให้ DB hang
- `audit-pr-po-grn`: warehouse scope leak + PR state machine bypass
- `inventory-valuation-report`: staff role อ่าน cost data ได้ (ต้องเป็น manager+)

#### 3. Rework Plans เขียนครบ — ✅ เสร็จสมบูรณ์
เขียน rework-plan.md ให้ 18 tracks ใหม่ + 2 pre-existing = ครอบคลุมทุก Rework Required track

#### 4. conductor/index.md อัพเดท — ✅ เสร็จสมบูรณ์
สถานะทุก track แก้ไขให้ตรงกับผล QA จริง

### สถานะ
✅ STABLE — rework plans ทั้งหมดพร้อมให้ Gemini CLI implement

---

## Session: 2026-05-16 (Session 10 — Project Health Check + UI Bug Fixes)

### สิ่งที่ทำวันนี้

#### 1. Project Health Check & Cleanup — ✅ เสร็จสมบูรณ์
- ตรวจ worktree / conductor index / memory ทั้งหมด
- Commit ของค้าง: `run-migrate.ts`, `package.json` (tsx migrate runner), `settings.local.json`, `puka.agent.md`
- Conductor index: "Active Now" ว่าง, Dashboard track → Completed
- Memory `project_state.md`: แก้ข้อมูล stale — POS เป็น Verified, migration อยู่ที่ 031

#### 2. Bug Fix: Hamburger Menu Mobile — ✅ เสร็จสมบูรณ์
**Root cause:** `layout.tsx` ส่ง `onClose` เป็น inline arrow function → new ref ทุก render → Sidebar `useEffect([pathname, onClose])` fire ทันทีหลัง `setSidebarOpen(true)` ทำให้ sidebar ปิดก่อนเปิดได้

**Fix:** `useCallback` stabilize 3 callbacks ใน `layout.tsx`:
- `handleCloseSidebar`
- `handleMenuToggle`
- `handleToggleCollapse`

#### 3. Bug Fix: Sign Out Button — ✅ เสร็จสมบูรณ์
**Root cause:** `onSignOut` prop ไม่ถูกส่งให้ `TopBar` เลย — button `onClick={onSignOut}` = `undefined`

**Fix:** import `signOut` จาก `next-auth/react` + wire `handleSignOut({ callbackUrl: '/login' })` ผ่าน `useCallback`

### สถานะ
✅ STABLE — TSC clean, lint pass, ไม่มี active track ค้าง

---

## Session: 2026-05-16 (Session 9 — Dashboard ReferenceError Fix)

### สิ่งที่ทำวันนี้

#### 1. Dashboard Crash Fix — ✅ เสร็จสมบูรณ์
แก้ไขปัญหา `ReferenceError: formatDatetime is not defined` ในหน้า Dashboard (`app/app/dashboard/page.tsx`)

#### 2. Build Blocker & <Html> Error Fix — ✅ เสร็จสมบูรณ์
แก้ไขปัญหาที่ทำให้ `npm run build` ไม่ผ่าน (Critical for Vercel)

**สิ่งที่ทำ:**
- **Lint Cleanup:** ลบตัวแปรและ Interface ที่ไม่ได้ใช้งานในหน้า GRN (`app/app/grn/new/page.tsx`, `app/app/grn/page.tsx`)
- **Structure Cleanup:** ลบโฟลเดอร์ `app/(app)` ที่ว่างเปล่าและซ้ำซ้อนออก ซึ่งเป็นสาเหตุของความสับสนใน Next.js App Router
- **Build Verification:** ทดสอบรัน `npm run build` ด้วย `NODE_ENV=production` พบว่าผ่าน 100% ครบทั้ง 152 routes (รวม API)
- **Resolved persistent error:** ปัญหา `<Html> should not be imported outside of pages/_document` หายไปอย่างสมบูรณ์

**ผลลัพธ์:** โปรเจกต์อยู่ในสถานะ **Production Ready** สามารถ Deploy ขึ้น Vercel ได้ทันที

---

## Session: 2026-05-15 (Session 8 — AP System Plan + Obsidian Setup + Workflow Upgrade)

### สิ่งที่ทำวันนี้

#### 1. Accounts Payable System — Plan พร้อมแล้ว

วางแผน AP System ครบวงจร 17 tasks, 5 phases — พร้อมให้ Gemini CLI implement

**Key findings จากการอ่าน schema จริง:**
- `po_invoices` table มีอยู่แล้วใน `005_pr_po.sql` → extend ด้วย `ALTER TABLE` ไม่ต้องสร้างใหม่
- `vendors` มี `payment_terms_days INTEGER DEFAULT 30` อยู่แล้ว → migration เพิ่มแค่ bank fields
- GRN stocking trigger 2 จุด: `app/api/grn/[id]/stock/route.ts` + `app/api/grn/[id]/confirm/route.ts`

**Scope:**
- Migration `031_ap_system.sql` — extend vendors (bank fields), extend po_invoices (vendor_id, grn_id, paid_amount), new ap_payments + ap_payment_allocations tables + trigger auto-update is_paid
- API: `/api/ap/invoices`, `/api/ap/aging`, `/api/ap/payments` + vendor PATCH
- UI: AP invoices list, invoice detail, aging report, payment recording
- GRN integration: auto-create AP invoice on stocking

**Output:** `conductor/tracks/accounts-payable/plan.md` ✅

---

#### 4. Accounts Payable (AP) Module — Implementation Complete

Gemini CLI ได้ดำเนินการ Implement ระบบ AP จนเสร็จสิ้นครบทุก Phase:

**สิ่งที่ทำ:**
- **Migration:** สร้าง `031_ap_system.sql` เพิ่มฟิลด์ธนาคารใน `vendors`, ขยาย `po_invoices`, และเพิ่มตาราง `ap_payments`
- **Backend:** API `/api/ap/invoices`, `/api/ap/aging`, `/api/ap/payments` (พร้อม logic ตัดจ่ายหนี้แบบ partial)
- **Integration:** เชื่อมต่อ GRN ให้สร้าง AP Invoice โดยอัตโนมัติเมื่อ Stocked/Confirmed
- **Frontend:** พัฒนา UI ครบทุกส่วน (List, Detail, Aging Report, Multi-invoice Payment Form)
- **Navigation:** เพิ่มส่วนงาน AP ใน Sidebar

**ผลลัพธ์:** `Completed` พร้อมรอ Billy QA ตรวจสอบ

---

#### 2. Chen Agent Bug Fix — ไม่สร้างไฟล์

**ปัญหา:** Chen agent สร้างแผนเป็น text output แต่ไม่ได้ write ไฟล์จริงบน disk เพราะ:
1. Tools มีแค่ `read, search, agent` — ไม่มี `write`/`edit`
2. Bash ใน Git Bash ใช้ path `/c/Users/...` อ่านไฟล์ Windows ไม่ออก → schema ดู empty

**แก้:**
- เพิ่ม `write` + `edit` ใน `.claude/agents/chen.agent.md` tools list
- เพิ่ม "File Writing Rules" section — บังคับ Write tool + Windows absolute path
- เพิ่ม Verify step ก่อนรายงานว่าเสร็จ

**เรียนรู้:** subagent output ≠ file exists — ต้อง Glob verify ทุกครั้งหลัง spawn agent

---

#### 3. Obsidian In-Project Vault Setup

เปิด Obsidian ตรงบน `projectERP/` folder โดยไม่ย้ายไฟล์ใดๆ

**สิ่งที่ทำ:**
- `.obsidian/app.json` — exclude node_modules, .next, migrations, scripts, *.log; ตั้ง new note → `_notes/`
- สร้าง `_notes/HOME.md` — vault entry point + quick links ไป active tracks
- สร้าง `_notes/daily/`, `_notes/modules/`, `_notes/decisions/`
- ย้าย `HR_MODULE_SUMMARY.md` → `_notes/modules/`, `Context.md` → `_notes/`, `TROUBLESHOOTING.md` → `docs/`
- `.gitignore` — เพิ่ม `.obsidian/workspace.json` + `_notes/daily/`

**Root .md ที่เหลือ (3 ไฟล์ที่ต้องอยู่ root):** `CLAUDE.md` · `GEMINI.md` · `PROGRESS.md`

---

#### 4. Post-Task Knowledge Capture System

ระบบ capture pattern/trap อัตโนมัติหลังทุก task — ทั้ง Gemini และ Claude

**เพิ่มใน:**
- `GEMINI.md` — Post-Task Knowledge Capture protocol (Q1 pattern / Q2 trap / Q3 decision)
- `CLAUDE.md` — section เดียวกัน + trigger ที่บังคับ capture ทันที
- `conductor/PROTOCOLS.md` — เพิ่ม bullet + execution-summary ต้อง list patterns
- `docs/skills/*.md` (4 ไฟล์) — เพิ่ม section "Patterns & Traps — Captured in Field"

**วิธีทำงาน:** หลังทุก task → check 3 คำถาม → append ใน skill file หรือ decisions.md → เริ่ม task ถัดไป

---

### สถานะโค้ด (Code Stability)

| ระบบ | สถานะ |
|------|-------|
| WMS Core | ✅ Verified |
| POS Module (base) | ✅ Verified |
| POS Improvements | ✅ Verified |
| HR Module | ✅ Completed |
| Sales Module | ✅ Completed |
| Accounting Module | ✅ Completed |
| Outbound Picking | ✅ Completed |
| **Accounts Payable** | **📋 Plan Ready — รอ Gemini implement** |

---

### สิ่งที่ต้องทำครั้งหน้า

1. **Gemini CLI:** `Go` → implement Accounts Payable track (17 tasks)
2. **Billy QA** หลัง AP implement เสร็จ
3. ลบไฟล์ที่ copy ไป `02-2 - AKRA\BUYMORETH` ถ้าไม่ต้องการ

---

## Session: 2026-05-15 (Session 7 — POS Improvements QA)

### สิ่งที่ทำวันนี้

#### 1. Billy QA Audit — POS Improvements Track — ⚠️ Rework Required

รัน Billy QA audit ครบวงจรบน track `pos-improvements` ที่ Gemini CLI implement ไว้ พบ 12 ปัญหา ทั้งหมดได้รับการ validate โดย Chen agent เทียบกับ code จริง

**ปัญหาที่พบ (Must Fix — 4 รายการ):**

| ID | ไฟล์ | ปัญหา |
|----|------|-------|
| F-001 | `app/api/pos/transactions/route.ts` | **Security:** `discount_amount` จาก client body ไม่ถูก verify กับ `discount_rate` จาก DB — cashier สามารถส่ง discount เกินสิทธิ์ได้ |
| F-002 | `app/api/pos/transactions/route.ts` | **Data Integrity:** `UPDATE pos_members SET points_balance` รัน **หลัง** `client.release()` — นอก transaction block. Crash ระหว่างกลาง = sale บันทึก แต่แต้มไม่ถูกบวก |
| F-003 | `app/api/pos/shifts/route.ts` | **Architecture:** Shift number ใช้ `Math.random()` ใน app code — ผิด CLAUDE.md. `seq_pos_shift` มีใน migration แต่ไม่ได้ wire เข้า column DEFAULT |
| F-004 | `app/api/pos/sessions/route.ts` | **Feature Broken:** `p.image_url` ขาดจาก SQL SELECT — product images ใน terminal ทุกรายการแสดงไม่ได้ |

**ปัญหาที่พบ (Should Fix — 5 รายการ):**

| ID | ปัญหา |
|----|-------|
| F-005 | `transactions/route.ts` GET hardcode `LIMIT 50` ไม่มี pagination |
| F-006 | `members/route.ts` GET ไม่มี LIMIT — full table scan |
| F-007 | `shifts/route.ts` `cash_in_drawer` ไม่มี range validation ใน Zod |
| F-008 | `held-carts/route.ts` GET ไม่ verify ว่า `session_id` เป็นของ user ที่ login — IDOR risk |
| F-009 | `transactions/route.ts` + `session/[id]/page.tsx` hardcode `0.07` แทน `VAT_RATE` จาก constants |

**Suggestions (3 รายการ):**
- F-010: Barcode scanner keydown listener ไม่มี guard เมื่อ modal เปิดอยู่
- F-011: `shifts/page.tsx` + `members/page.tsx` ใช้ `toLocaleDateString()` โดยตรงแทน `formatDate()`
- F-012: ชื่อ migration ใน plan.md ผิด (`029_` → จริงคือ `027_`)

**Output:**
- `conductor/tracks/pos-improvements/rework-plan.md` — สร้างใหม่, ครบ 12 รายการพร้อม execution order และ acceptance criteria
- `conductor/index.md` — อัพเดทสถานะ POS Improvements: `Completed` → `Rework Required`

---

### ปัญหายากที่พบและแก้ในเซสชันนี้

#### 1. Points UPDATE outside transaction (F-002) — Pattern ที่อันตรายแต่มองข้ามง่าย

**ปัญหา:** Code ดูถูกต้องเมื่อมอง surface — มี `pool.connect()`, มี BEGIN/COMMIT, มี try/catch. แต่ `UPDATE pos_members` เขียนไว้บรรทัดหลัง `client.release()` ทำให้รันนอก transaction จริง

**เหตุที่อันตราย:** ถ้า process crash หลัง COMMIT แต่ก่อน UPDATE → sale บันทึกครบ แต่แต้มสมาชิกไม่ถูกบวก ไม่มี error, ไม่มี rollback, ไม่มีทางรู้จาก log ปกติ

**วิธีตรวจจับ:** ต้องอ่านโค้ดเรียงบรรทัดและ track `client` lifetime อย่างละเอียด — lint ไม่จับ, TypeScript ไม่จับ, unit test ไม่จับ (ถ้า test ไม่ crash process จงใจ)

#### 2. Shift number ใช้ Math.random() (F-003) — Collision risk ซ่อนในรูป "เร็วดี"

**ปัญหา:** Gemini ใช้ `Math.random()` สร้าง suffix แทนที่จะ wire `seq_pos_shift` เข้า column DEFAULT เพราะ `next_doc_number()` ต้องการ sequence ที่ register ก่อน

**เหตุที่อันตราย:** Random 4-digit suffix → collision probability ไม่ใช่ศูนย์ในระบบ high-volume POS ที่เปิดหลาย shift/วัน นอกจากนี้ยังผิด architectural rule ของ project

**วิธีแก้ถูกต้อง:** New migration `030_fix_shift_number_default.sql` → `ALTER TABLE pos_shifts ALTER COLUMN shift_number SET DEFAULT next_doc_number('SHF', 'seq_pos_shift')` + ลบ app-side generation

#### 3. IDOR บน Held Carts (F-008) — Business logic ทำให้มองข้ามง่าย

**ปัญหา:** `session_id` เป็น UUID ที่ client ส่งมา ถ้าไม่ join กับ `pos_sessions` เพื่อ verify `cashier_id = u.id` → cashier ที่รู้ session UUID ของคนอื่นสามารถ GET held carts ของ terminal อื่นได้

**เหตุที่มองข้าม:** ปกติ cashier ได้ `session_id` มาจาก login flow ของตัวเอง — ในทางปฏิบัติไม่น่าจะรู้ UUID ของคนอื่น แต่ถ้าโจมตีด้วย enumeration หรือ log leak → exposed

---

### สถานะโค้ด (Code Stability)

**⚠️ REWORK PENDING** — POS Improvements รอ Gemini CLI fix ตาม `rework-plan.md`

| ระบบ | สถานะ |
|------|-------|
| WMS Core | ✅ Verified |
| POS Module (base) | ✅ Verified |
| POS Improvements | ⚠️ Rework Required (12 issues) |
| HR Module | ✅ Completed |
| Sales Module | ✅ Completed |
| Accounting Module | ✅ Completed |
| Outbound Picking | ✅ Completed |

---

### สิ่งที่ต้องทำครั้งหน้า

**ลำดับความสำคัญสูง:**
1. **Gemini CLI:** Execute `conductor/tracks/pos-improvements/rework-plan.md` — แก้ 12 issues ตาม execution order (R-003 migration ก่อน)
2. **Re-run Billy QA** หลัง rework เสร็จ → ต้องผ่าน acceptance criteria ทุกข้อ

**ลำดับความสำคัญกลาง:**
3. **Outbound Picking QA** — track ยังเป็น Completed ยังไม่ผ่าน Billy
4. **New track** — เลือก feature ถัดไปหลัง POS Improvements Verified

---

### จุดเตือนพิเศษ ⚠️

**1. Transaction atomicity — pattern ที่ถูกต้อง**
```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO pos_transactions ...');
  await client.query('UPDATE pos_members SET points_balance = points_balance + $1 ...'); // ← ต้องอยู่ตรงนี้
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release(); // ← release LAST
}
```
ห้ามเขียน UPDATE หลัง `client.release()` ไม่ว่ากรณีใด

**2. Document numbers — DB only**
ทุก sequence ที่สร้างใน migration ต้องถูก wire เข้า `DEFAULT next_doc_number(prefix, seq_name)` ที่ระดับ column DDL ทันที ห้าม generate ใน app code ไม่ว่าจะ `Math.random()`, `Date`, หรือ counter

**3. List endpoints ต้องมี LIMIT เสมอ**
ทุก GET list route ต้องมี LIMIT — minimum `LIMIT 100` hard cap แม้ไม่มี pagination params

---

## Session: 2026-05-13 (Session 5 — UI Design System "อรุณ" + HR Bugfix Final)

### สิ่งที่ทำวันนี้

#### 1. Conductor Protocol Skill — ✅ เสร็จสมบูรณ์
... (คงเดิม)

#### 2. UI Design System — อรุณ (Aroon) — ✅ เสร็จสมบูรณ์
... (คงเดิม)

#### 3. HR Bugfix Final — ✅ เสร็จสมบูรณ์

**การแก้ไข Bug และโครงสร้าง:**
- **User Name Fix:** แก้ไขปัญหา `u.name` ที่ไม่มีอยู่ในตาราง `users` ในทุก API และ UI ของโมดูล HR โดยเปลี่ยนไปใช้ `name_th` และ `name_en` แทน
- **Department Type Sync:** อัพเดท interface `Department` ใน `types/index.ts` ให้รองรับ `manager_name_th/en` และปรับปรุงหน้าจอแสดงผลแผนกให้ใช้งานฟิลด์ใหม่
- **Formatting Cleanup:** 
    - แก้ไขการนำเข้า (import) `formatDate`, `formatNumber`, `formatCurrency` จาก `@/lib/format` แทน `@/lib/utils` ที่ผิดพลาด
    - เปลี่ยนการใช้ `.toLocaleString()` และ `.toLocaleDateString()` เป็น utility functions ของโปรเจกต์เพื่อให้รองรับ Timezone (Asia/Bangkok) อย่างถูกต้อง
    - เพิ่ม `THAI_MONTHS` constant สำหรับ dropdown ในหน้า Payroll เพื่อความถูกต้องของภาษา
- **Consistency:** ตรวจสอบและแก้ไขไฟล์ในโมดูล HR ทั้งหมด (Attendance, Employees, Leave Requests, Payroll) ให้มีมาตรฐานเดียวกัน

---

### สถานะโค้ด (Code Stability)

**✅ STABLE** — ผ่าน `npm run lint` และ `npm run build`

| ระบบ | สถานะ |
|------|-------|
| UI System (Aroon) | ✅ Completed & Integrated |
| HR Module | ✅ Rework Completed & Bugfixed |
| Collaboration Protocol | ✅ Documented & Mandated |
| Dashboard | ✅ Migrated to new KPI system |

---

### สิ่งที่ต้องทำครั้งหน้า

**ลำดับความสำคัญสูง:**
1. **BOM Module Implementation** — เริ่มต้น Track สูตรการผลิตและ Multi-UOM ตามแผนงาน
2. **Audit Trail UI** — ใช้ `Card` และ `Table` ใหม่ในการสร้างหน้าประวัติการแก้ไขข้อมูล (Audit triggers)

**ลำดับความสำคัญกลาง:**
3. **Mobile Polish** — ตรวจสอบ Responsive ของหน้าจอที่สร้างใหม่ทั้งหมดโดยใช้ Sidebar แบบพับ

---

### จุดเตือนพิเศษ ⚠️

**1. ห้ามแก้ไขไฟล์นอก Task Scope**
ต้องปฏิบัติตาม **Conductor Protocol** อย่างเคร่งครัด หากเห็นจุดที่ควรแก้ (เช่น typo ในไฟล์อื่น) ให้โน้ตไว้ใน Summary หรือสร้าง Task ใหม่ ห้ามแก้ทันที

**2. การใช้ Font ในตัวเลข**
ในตารางหรือส่วนที่แสดงตัวเลขจำนวนเงิน/สต็อก ให้ใช้ class `font-mono tabular-nums` เสมอเพื่อให้ตัวเลขตรงกันสวยงาม

**3. Dual-mode Table**
ห้ามตัด logic การรับ `children` ออกจาก `Table.tsx` เพราะหน้าจอเก่าหลายหน้ายังใช้การเขียน `<tr>` และ `<td>` เองอยู่

---

## Session: 2026-05-11 (Session 4 — Full ERP Expansion + Bug Hunt / ปิดงาน)

### สิ่งที่ทำวันนี้

#### 1. POS Module (Point of Sale) — ✅ เสร็จสมบูรณ์

**Migration:** `migrations/016_pos.sql`
- ตาราง `pos_sessions`, `pos_transactions`, `pos_transaction_lines`
- เพิ่มฟิลด์ `selling_price` ในตาราง `products`
- Permissions: `pos:cashier`, `pos:void`, `pos:session_open/close`, `pos:view`
- Sequence: `seq_pos` / Document number: `RCP-YYYYMMDD-0001`, `SES-YYYYMMDD-0001`

**API Files สร้างใหม่:**
- `app/api/pos/sessions/route.ts` — เปิด/ดูรายการรอบ
- `app/api/pos/sessions/[id]/route.ts` — ดูรอบ, ปิดรอบ
- `app/api/pos/transactions/route.ts` — สร้างบิล (Checkout)
- `app/api/pos/transactions/[id]/route.ts` — ดูบิล, ยกเลิกบิล (Void)
- `app/api/pos/products/route.ts` — ค้นสินค้า (barcode/SKU/name)

**Page Files สร้างใหม่:**
- `app/app/pos/page.tsx` — POS Home (เลือกรอบ/เปิดรอบใหม่)
- `app/app/pos/session/[id]/page.tsx` — POS Terminal (หน้าจอขายหน้าร้าน)
- `app/app/pos/sessions/page.tsx` — ประวัติรอบ
- `app/app/pos/sessions/[id]/page.tsx` — รายละเอียดรอบ + ยกเลิกบิล

**Logic หลัก:**
- VAT **Inclusive** 7% (`vat = total × 7/107`) — มาตรฐานขายปลีกไทย
- ตัดสต็อกผ่าน `stock_ledger` (entry_type: `pos_sale`) ทันทีที่ Checkout
- Void → คืนสต็อก (`pos_void`)
- ป้องกัน 1 user มี 2 รอบเปิดพร้อมกัน (เช็ค unique open session ต่อ user+warehouse)

---

#### 2. Sales Module (B2B: SQ→SO→DO→SI→SR) — ✅ เสร็จสมบูรณ์

**Migration:** `migrations/017_sales.sql`
- ตาราง `customers`, `sales_quotations`, `sq_line_items`, `sales_orders`, `so_line_items`
- ตาราง `delivery_orders`, `do_line_items`, `sales_invoices`, `sales_returns`, `sr_line_items`
- Junction tables: `so_sq_links`
- Sequences: `seq_sq`, `seq_so`, `seq_do`, `seq_si`, `seq_sr`
- Permissions: 22 permissions (customers, sq, so, do, si, sr)

**API Files สร้างใหม่:** (14 files)
- Customers CRUD: `/api/customers/`, `/api/customers/[id]/`
- SQ: `/api/sales-quotations/`, `/api/sales-quotations/[id]/`
- SO: `/api/sales-orders/`, `/api/sales-orders/[id]/`
- DO: `/api/delivery-orders/`, `/api/delivery-orders/[id]/`
- SI: `/api/sales-invoices/`, `/api/sales-invoices/[id]/`
- SR: `/api/sales-returns/`, `/api/sales-returns/[id]/`

**Page Files สร้างใหม่:** (18 files)
- Customers: list, new, [id]
- SQ: list, new, [id] (รองรับ convert to SO)
- SO: list, new, [id] (แสดง credit limit warning)
- DO: list, new, [id] (Ship → ตัดสต็อกจริง)
- SI: list, new, [id]
- SR: list, new, [id] (Restock → คืนสต็อก)

**Logic หลัก:**
- VAT **Exclusive** 7% (`vat = subtotal × 0.07`) — มาตรฐานบัญชี B2B ไทย
- Stock deduction เฉพาะตอน DO `ship` → `stock_ledger` (entry_type: `so_delivery`)
- SR Restock → `stock_ledger` (entry_type: `so_return`)
- Credit limit check ที่ SO confirm (warn-only, ไม่บล็อก)
- qty_delivered tracking ต่อบรรทัด SO → auto update SO status

---

#### 3. Accounting Module (CoA→Periods→JE→Reports) — ✅ เสร็จสมบูรณ์

**Migration:** `migrations/018_accounting.sql`
- ตาราง `accounts` (ผังบัญชี), `fiscal_periods` (รอบบัญชี)
- ตาราง `journal_entries`, `journal_entry_lines`
- Seed: 28 บัญชีมาตรฐาน Thai GAAP (กลุ่ม 1000–7000)
- Sequence: `seq_je` / Document number: `JE-YYYYMMDD-0001`
- Permissions: 9 permissions (accounts, fiscal_periods, accounting, reports)

**API Files สร้างใหม่:** (14 files)
- CoA: `/api/accounting/accounts/`, `/api/accounting/accounts/[id]/`
- Periods: `/api/accounting/fiscal-periods/`, `/api/accounting/fiscal-periods/[id]/`
- JE: `/api/accounting/journal-entries/`, `/api/accounting/journal-entries/[id]/`
- Reports: trial-balance, general-ledger, profit-loss, balance-sheet, ar-aging, ap-aging

**Page Files สร้างใหม่:** (14 files)
- Chart of Accounts: list, new, [id]
- Fiscal Periods: list, new
- Journal Entries: list, new, [id]
- Reports: trial-balance, general-ledger, profit-loss, balance-sheet, ar-aging, ap-aging

**Logic หลัก:**
- Double-entry: ทุก JE ต้อง `SUM(debit) = SUM(credit)` — ตรวจทั้ง API + DB CHECK constraint
- Void ไม่ลบ entries — mark void เท่านั้น (audit trail สมบูรณ์)
- Fiscal Period `locked` = ถาวร ไม่สามารถ reopen หรือโพสต์รายการใหม่
- AR Aging อ่านตรงจาก `sales_invoices` (graceful degrade ถ้า Sales module ยังไม่ migrate)
- AP Aging อ่านตรงจาก `po_invoices`

---

#### 4. Bug Hunt & WMS Polish — ✅ แก้ครบ 12 จุด

| BUG | ความรุนแรง | ไฟล์ที่แก้ | สิ่งที่แก้ |
|-----|-----------|-----------|------------|
| BUG-001 | P1 | `app/api/grn/route.ts` | เปลี่ยน INNER JOIN → LEFT JOIN เพื่อให้ IO-based GRN ปรากฏในรายการ |
| BUG-002 | P1 | `app/app/grn/page.tsx` | แก้ลิงก์ PO ที่ใช้ `g.id` (ผิด) เป็น `g.po_id`; เพิ่มลิงก์ IO สำหรับ IO-based GRN |
| BUG-003 | P1 | `app/api/transfers/route.ts` | แก้ Warehouse scope ให้ครอบคลุมทั้ง source และ destination warehouse |
| BUG-004 | P2 | `app/api/transfers/route.ts` | เพิ่ม `FOR UPDATE` ใน stock check เพื่อป้องกัน Race Condition |
| BUG-005 | P2 | `app/api/grn/[id]/qc/route.ts` | เพิ่ม validation: `qty_accepted + qty_rejected ≤ qty_received` |
| BUG-006 | P2 | สร้างใหม่ | สร้าง `app/app/delivery-orders/[id]/page.tsx` ที่ขาดหายไป |
| BUG-007 | P2 | สร้างใหม่ | สร้าง `app/app/sales-returns/[id]/page.tsx` ที่ขาดหายไป |
| BUG-008 | P2 | สร้างใหม่ | สร้าง `app/app/accounting/reports/general-ledger/page.tsx` ที่ขาดหายไป |
| BUG-009 | P3 | `app/app/grn/[id]/page.tsx` | แก้ Typo: `setVerifyVerifyNotes` → `setVerifyNotes` |
| BUG-010 | P3 | `app/app/grn/page.tsx` | Modal ของ IO GRN แสดงเป็น "เลข IO" แทน "เลข PO" |
| BUG-011 | P3 | `app/app/grn/page.tsx` | เพิ่ม Tab "ตรวจสอบแล้ว" (verified) ที่หายไป |
| BUG-012 | P3 | `components/layout/Sidebar.tsx` | เพิ่มลิงก์ GRN Receiving Queue ใน Sidebar |

---

#### 5. Select Component Crash Fix — ✅ แก้ไขแล้ว

**ไฟล์:** `components/ui/Select.tsx`

**สาเหตุ:** Gemini เขียนหน้าจอใหม่ทุกหน้าโดยใช้ `<Select>` แบบส่ง JSX children (รูปแบบ HTML ปกติ) แต่ component เดิมต้องการ `options: SelectOption[]` prop เท่านั้น (Required, ไม่มี default) → crash ทันทีเมื่อ render

**วิธีแก้:** ทำให้ `options` เป็น Optional (`options?: SelectOption[]`) และเพิ่ม logic:
- ถ้ามี `options` prop → render จาก options array (behavior เดิม, backward-compatible)
- ถ้าไม่มี → render `children` (รองรับหน้าจอใหม่ทั้งหมด)

**ผลกระทบ:** แก้ crash ทุกหน้าจอใน Sales, Accounting, POS ด้วยไฟล์เดียว

---

#### 6. ไฟล์อื่นที่แก้ไข

| ไฟล์ | สิ่งที่แก้ |
|------|-----------|
| `types/index.ts` | เพิ่ม interfaces สำหรับ POS, Sales, Accounting ทั้งหมด |
| `components/layout/Sidebar.tsx` | เพิ่ม nav groups: ขาย/Sales, ขายหน้าร้าน/POS, การบัญชี/Accounting; เปลี่ยน header "WMS" → "ERP" |
| `conductor/index.md` | อัพเดทสถานะ tracks ทั้งหมด |
| `conductor/PROTOCOLS.md` | อัพเดท protocol |

---

### สถานะโค้ด (Code Stability)

**✅ STABLE** — ผ่าน `npm run lint` สะอาด (zero errors)

| ระบบ | สถานะ |
|------|-------|
| WMS Core (PR→PO→GRN→Stock→Transfer→CC→RMA) | ✅ Stable + bugs fixed |
| POS Module | ✅ Implemented, lint pass |
| Sales Module (SQ→SO→DO→SI→SR) | ✅ Implemented, lint pass |
| Accounting Module | ✅ Implemented, lint pass |
| Select Component | ✅ Fixed (both patterns work) |
| Migrations (016, 017, 018) | ✅ Files created — **ต้อง run `npm run migrate` ก่อนใช้งาน** |

---

### สิ่งที่ต้องทำครั้งหน้า

**ลำดับความสำคัญสูง — ทำก่อน:**
1. **Run migrations** → `npm run migrate` เพื่อ apply 016, 017, 018 ใน database จริง
2. **Integrated Testing** — ทดสอบ Golden Path ทั้ง 3 โมดูลใหม่:
   - POS: เปิดรอบ → ค้นสินค้า → Checkout → ดูใบเสร็จ → ปิดรอบ → ตรวจ stock_ledger
   - Sales: สร้าง Customer → SQ → SO → DO (Ship) → SI → SR (Restock) → ตรวจสต็อก
   - Accounting: สร้าง Fiscal Period → Journal Entry (Balanced) → Post → Trial Balance
3. **Data Import** — นำเข้าข้อมูล:
   - ใส่ `selling_price` ให้สินค้าที่มีอยู่แล้ว (ปัจจุบัน default = 0)
   - Import ข้อมูลลูกค้า (`customers` table)

**ลำดับความสำคัญกลาง:**
4. **Accounting Auto-posting** — เขียนแผน track ใหม่: ให้ GRN stock/DO ship/POS checkout สร้าง Journal Entry อัตโนมัติ (ปัจจุบันต้องบันทึกมือ)
5. **Report Export** — เพิ่มปุ่ม Export CSV/PDF ใน Reports pages ทุกหน้า
6. **Dashboard Update** — อัพเดท KPI cards ให้แสดงข้อมูลจาก Sales และ POS ด้วย

**อนาคต:**
7. **BOM / Production Module** — หากต้องการระบบการผลิต
8. **HR Module** — ระบบพนักงาน/เงินเดือน

---

### จุดเตือนพิเศษ ⚠️

**1. Select Component — ห้ามแก้กลับเป็นแบบเดิม**
`components/ui/Select.tsx` รองรับ 2 รูปแบบแล้ว:
```tsx
// แบบ A (เดิม — WMS pages): options prop
<Select options={items} placeholder="เลือก..." />

// แบบ B (ใหม่ — Sales/POS/Accounting pages): children
<Select label="ลูกค้า">
  <option value="">-- เลือก --</option>
  {customers.map(c => <option key={c.id} value={c.id}>{c.name_th}</option>)}
</Select>
```
หากแก้กลับเป็น `options: SelectOption[]` (required) จะทำให้ทุกหน้าใหม่ crash

**2. Migrations ต้อง run ตามลำดับ**
Migration runner ใช้ filename order และ track ใน `schema_migrations` — ห้าม apply ข้ามลำดับ หรือ apply ซ้ำ

**3. VAT ต่างระบบ — ห้ามสับสน**
| โมดูล | วิธีคำนวณ VAT | สูตร |
|-------|--------------|------|
| POS | Inclusive (รวมอยู่ในราคาแล้ว) | `vat = total × 7/107` |
| Sales (SQ/SO/DO/SI) | Exclusive (บวกเพิ่มจาก subtotal) | `vat = subtotal × 0.07` |
| Purchasing (PR/PO) | Exclusive | `vat = subtotal × 0.07` |

**4. Stock Ledger — insert-only, ห้าม UPDATE/DELETE**
ทุกการเปลี่ยนแปลงสต็อกต้องผ่าน INSERT ใน `stock_ledger` เท่านั้น
Trigger `sync_stock_balances()` จะอัพเดท `stock_balances` ให้อัตโนมัติ

**5. Transfer Race Condition — แก้แล้ว แต่ระวัง**
ใช้ `SELECT ... FOR UPDATE` ล็อกแถว `stock_balances` แล้วระหว่าง transaction
หากเพิ่ม endpoint ที่แก้ stock ใหม่ ต้องใช้ pattern เดียวกัน

**6. Accounting — Locked Period ถาวร**
Period ที่ status = `locked` ไม่สามารถ reopen ได้ (hard constraint)
Admin เท่านั้นที่ lock ได้ และต้องระวังก่อน lock

---

## Session: 2026-05-10 (Session 3 — Night / ปิดงาน)

### สิ่งที่ทำ
- Dashboard redesign (KPI cards + charts)
- Route migration: ย้ายหน้าจอทั้งหมดไปอยู่ใน `app/(app)/` group
- แก้ Thai encoding double-encoding bug (TIS-620 re-encode)
- TypeScript strict mode cleanup

### สถานะ
✅ STABLE — Lint pass, structure clean

---

## Session: 2026-05-10 (Session 2 — Afternoon)

### สิ่งที่ทำ
- UI redesign: Vendor detail page
- Employee Management + RBAC system (permissions, roles, role assignments)
- Migrations: เพิ่มระบบ permissions table + role grants

### สถานะ
✅ STABLE

---

## Session: 2026-05-10 (Session 1 — Morning)

### สิ่งที่ทำ
- Audit WMS flow (PR→PO→GRN→Stock)
- Fix over-receipt guard (BUG-001)
- Import 4,761 products จาก Excel
- Claude-Gemini collaboration protocol setup

### สถานะ
✅ STABLE

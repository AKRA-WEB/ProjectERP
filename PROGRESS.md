# Progress Log

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

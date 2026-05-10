# Progress Log

## Session: 2026-05-10

### สิ่งที่ทำวันนี้

#### 1. Audit PR→PO→GRN Flow (ผ่านทุก phase)
- ทดสอบ flow ทั้งหมดตั้งแต่ต้นจนจบ: PR → Submit → Approve → PO → Send → GRN → QC → Stock
- ตรวจสอบ warehouse scope enforcement, document numbering, stock ledger, dashboard KPI
- ผลลัพธ์: ผ่านทุก checkpoint ยกเว้น BUG-001

#### 2. แก้ BUG-001: Over-receipt ไม่ถูกบล็อก (High severity)
- **`app/api/grn/route.ts`** — เพิ่ม server-side guard ตรวจ `qty_received ≤ qty_ordered - qty_already_received` ต่อ PO line ก่อน INSERT
- **`app/(app)/grn/new/page.tsx`** — เพิ่ม `max` attribute บน input + client-side validation ก่อน submit

#### 3. Gemini UI improvements (35 ไฟล์)
Gemini CLI ปรับปรุง UI หลายหน้าระหว่าง audit ได้แก่ dashboard, GRN, PO, PR, RMA, transfers, cycle-counts, claims, products, vendors, admin

#### 4. Import Script สำหรับ Products
- **`scripts/import-products.ts`** — อ่าน Excel → upsert UOMs, categories, products เข้า DB
- **`data/imports/all_product.xlsx`** — ข้อมูลสินค้า 4,761 รายการ
- Import สำเร็จ: 4,761 products synced, 37 UOMs, 205 categories
- เพิ่ม `xlsx` ใน devDependencies

#### 5. Conductor Tracks
- `conductor/tracks/audit-pr-po-grn/plan.md` — Completed
- `conductor/tracks/fix-over-receipt/plan.md` — Completed

---

### สถานะโค้ด (Stability)

**✅ Stable** — `npm run lint` ผ่าน, BUG-001 แก้แล้ว, import ทำงานได้

---

### สิ่งที่ต้องทำครั้งหน้า

1. **Import vendors** — รอไฟล์ Excel จากผู้ใช้ → เขียน `scripts/import-vendors.ts`
2. **Vendor detail page** — มีแค่ list page, ยังไม่มี `/app/vendors/[id]`
3. **Plan ERP module ถัดไป** — เลือกจาก: Sales / POS / Accounting / HR / BOM
4. **ทดสอบ import script กับ vendors** เมื่อมีไฟล์

---

### จุดเตือนพิเศษ ⚠️

1. **Supabase connection:** ต้องใช้ **pooler URL** เท่านั้น
   - ✅ `aws-1-ap-south-1.pooler.supabase.com:6543`
   - ❌ `db.utsjzrrezhdcdtxgppsb.supabase.co` (IPv6 only — timeout บนเครื่องนี้)

2. **Password encoding:** password มีอักษร `@` → ต้อง URL-encode เป็น `%40` ในทุก connection string

3. **xlsx package:** มี npm audit warnings — ใช้แค่ dev/scripts ไม่กระทบ production

4. **ไฟล์ `.env`** — อยู่ใน `.gitignore` แล้ว (credentials ไม่ขึ้น git) ✅

5. **GRN over-receipt:** fix แล้วทั้ง server + client ถ้าเพิ่ม GRN endpoint ใหม่ในอนาคต ต้องใส่ guard นี้ด้วยเสมอ

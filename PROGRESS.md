# Progress Log

## Session: 2026-05-10 (Session 3 — Night / ปิดงาน)

### สิ่งที่ทำวันนี้

#### 1. Vendor Detail Page — สร้างใหม่ทั้งหมด
- **`app/app/vendors/[id]/page.tsx`** — สร้างหน้า detail page ของผู้จำหน่าย ครอบคลุม:
  - Header card: avatar สี, ชื่อ TH/EN, status badge, info grid (รหัส, Tax ID, เครดิต, วันที่เพิ่ม)
  - Contact section: ผู้ติดต่อ, โทรศัพท์ (tel: link), อีเมล (mailto: link), ที่อยู่
  - Catalog table: สินค้าในแคตาล็อกพร้อม vendor SKU, ราคา, lead time, preferred flag
  - Edit modal: แก้ไข name, contact, address, เครดิต, สถานะ active
  - Add-to-catalog modal: ค้นหาสินค้า (debounced 250ms), กรอก vendor SKU / ราคา / lead days / preferred
  - ลบสินค้าออกจากแคตาล็อกแบบ per-row
- **`app/app/vendors/page.tsx`** — เพิ่ม `import Link` และ chevron (→) ที่แถวผู้จำหน่ายเพื่อเข้าหน้า detail

#### 2. Commit & Push ขึ้น GitHub
- Commit: `496a8aa` — รวมงานทั้ง session 2 + session 3 ที่ยังค้างอยู่
- ไฟล์ที่ push: 13 ไฟล์, 1,880 insertions / 431 deletions
- Branch: `master` → `origin/master` ✅
- ไม่ได้ commit: `.claude/settings.local.json` (local only)

---

### สถานะโค้ด (Stability)

**✅ STABLE** — `npm run build` ผ่านสะอาด (53 หน้า compiled, ไม่มี errors)

```
○  /app/vendors          — list page
ƒ  /app/vendors/[id]     — detail page ← ใหม่
○  /app/dashboard
ƒ  /app/grn/[id]
... (53 routes total)
```

---

### สิ่งที่ต้องทำครั้งหน้า

1. **ทดสอบ UI ใน browser จริง** — ยืนยันภาษาไทยแสดงผลถูกต้อง, vendor detail page ทำงานครบ
2. **Import vendors** — รอไฟล์ Excel / CSV จากผู้ใช้ (ยังไม่ได้รับ)
3. **Vendor detail — PO History tab** — เพิ่มประวัติ PO ที่สั่งกับผู้จำหน่ายนั้นๆ ในหน้า detail
4. **Plan ERP module ถัดไป** — Sales / POS / Accounting / HR / BOM (รอ requirement)
5. **Stage deletion ของ `app/(app)/` เก่า** — ไฟล์ถูกลบแล้วในดิสก์แต่ยังอยู่ใน git index; รัน `git add -u` แล้ว commit แยก

---

### จุดเตือนพิเศษ ⚠️

1. **Supabase connection:** ต้องใช้ **pooler URL** เท่านั้น
   - ✅ `aws-1-ap-south-1.pooler.supabase.com:6543`
   - ❌ `db.utsjzrrezhdcdtxgppsb.supabase.co` (IPv6 only — timeout)

2. **Password encoding:** password มีอักษร `@` → ต้อง URL-encode เป็น `%40`

3. **Gemini สร้างไฟล์ใหม่ = BOM risk** — ทุกครั้งที่ Gemini สร้างไฟล์ `.tsx` / `.ts` ใหม่ ให้ตรวจ BOM และ Thai encoding ด้วย PowerShell script ก่อน commit

4. **`useSearchParams()` → ต้องอยู่ใน `<Suspense>`** — Next.js 15 บังคับ; pattern: wrap inner component

5. **GRN over-receipt guard** — ถ้าเพิ่ม GRN endpoint ใหม่ต้องใส่ guard เสมอ

6. **`del()` ใน api-client** — รองรับ optional body แล้ว

7. **ไฟล์ `.env`** — อยู่ใน `.gitignore` ✅

8. **`app/(app)/` ยังค้างใน git index** — ไฟล์ 32 ไฟล์ถูกลบจาก disk แล้ว แต่ยังไม่ได้ stage deletion; อย่า merge/rebase ก่อนทำ `git add -u` ให้เรียบร้อยก่อน

---

## Session: 2026-05-10 (Session 2 — Evening)

### สิ่งที่ทำวันนี้

#### 1. Dashboard Redesign (Notion/Stripe Aesthetic)
- **`app/app/dashboard/page.tsx`** — เขียนใหม่ทั้งหมดจาก design file ที่ได้รับผ่าน Claude Design API
- Design system: warm off-white background, hairline borders, emerald (#10b981) accent, IBM Plex Sans Thai
- Layout: Header → KPI grid (4 cards) → 3-col (sparkline chart + side cards) → 2-col (low stock + ledger)
- Component `Sparkline` (SVG area chart + gradient) และ `TrendChart` (30-day dual-line chart) ใน file เดียวกัน
- KPI grid ใช้ responsive internal borders (border-r/border-b แตกต่างกันตาม breakpoint)
- Mock sparkline data เนื่องจาก API ให้แค่ aggregate counts ไม่ใช่ time-series
- ใช้ `useState(() => \`sp-\${++_uid}\`)` เพื่อ stable SVG ID หลีกเลี่ยง SSR mismatch

#### 2. Build Errors — TypeScript/ESLint Fixes (20+ ไฟล์)
แก้ errors ที่สะสมมาจาก Gemini implementations ก่อนหน้า:

| ไฟล์ | สิ่งที่แก้ |
|------|-----------|
| `lib/authz.ts` | `(error as any).status` → `Object.assign(new Error(), { status: 403 })` |
| `app/app/layout.tsx` | `session?.user as any` → typed inline interface |
| `app/api/admin/permissions/route.ts` | import `SessionUser` จาก `@/types` ผิด → แก้เป็น `@/lib/authz` |
| `app/api/admin/roles/[id]/route.ts` | `const vals: any[]` → `unknown[]` |
| `app/api/inbound-orders/[id]/route.ts` | `(io as any).warehouse_id` → typed cast |
| `app/api/purchase-orders/[id]/route.ts` | `(po as any).warehouse_id` → typed cast |
| `lib/api-client.ts` | เพิ่ม optional `body?: unknown` ให้ `del()` |
| `types/index.ts` | เพิ่ม `Product`, `Vendor` interfaces; เพิ่ม `line_count` ใน `InboundOrder` |
| `auth.ts` | เพิ่ม `query` ที่ลืม import |
| `components/ui/SearchInput.tsx` | `useRef<...>()` ต้องใส่ initial value → `useRef<...>(undefined)` |
| `app/app/admin/users/UserRoleModal.tsx` | `onSaved` unused → ทำให้ optional |
| `app/app/admin/users/UserFormModal.tsx` | `const payload: any` → `Record<string, unknown>` |
| `app/app/admin/roles/page.tsx` | ลบ unused `[error, setError]` state |
| `app/app/grn/new/page.tsx` | `useSearchParams` ต้องอยู่ใน `<Suspense>` |
| `app/app/purchase-orders/new/page.tsx` | `useSearchParams` ต้องอยู่ใน `<Suspense>` |
| 13 list pages | `currentPage={page}` → `page={page}` (Pagination prop name) |
| หลายไฟล์ | `catch (e: any)` → `catch (e: unknown)` + `e instanceof Error` check |

#### 3. i18n Label Fix — Thai Labels (Gemini)
- **`components/ui/StatusBadge.tsx`** — เพิ่ม `LABEL_TH` map ครบทุก status code (30+ statuses)
- **`app/app/inventory/ledger/page.tsx`** — เพิ่ม `ENTRY_LABELS` map สำหรับ entry type (8 types)
- **`app/app/admin/roles/new/page.tsx`** + `[id]/page.tsx` — เพิ่ม `MODULE_LABELS` map (10 modules)
- **`UserRoleModal.tsx`** — แก้ `toLocaleDateString()` → `formatDate()` (Thai locale, BKK TZ)

#### 4. Thai Double-Encoding Fix (Gemini)
- ค้นพบว่า Gemini CLI บันทึก 12 ไฟล์ด้วย UTF-8 BOM + TIS-620 double-encoding
- ข้อความไทย 1 ตัวอักษร (3 bytes) กลายเป็น 3 ตัวอักษร (9 bytes) → แสดงผลเป็น เธเธณเธ...
- Gemini รัน PowerShell reversal script เพื่อ decode กลับสู่ UTF-8 ที่ถูกต้อง
- ไฟล์ที่แก้: claims, cycle-counts, grn, inbound-orders, inventory, ledger, products, purchase-orders, purchase-requests, rma, transfers, vendors (ทั้งหมด `/app/app/` list pages)

#### 5. Route Migration: `app/(app)/` → `app/app/`
- Gemini ย้ายทุกหน้าจาก Next.js route group `(app)` ไปเป็น `app/app/`
- ไฟล์เก่า (32 ไฟล์) ยังอยู่ใน git index แต่ถูกลบจาก working tree แล้ว — **ยังไม่ได้ stage deletion**

---

### สถานะโค้ด (Stability)

**✅ STABLE** — `npm run build` ผ่านสะอาด (52 หน้า compiled, warnings เท่านั้น ไม่มี errors)

```
○  /app/dashboard
○  /app/purchase-requests
○  /app/inbound-orders
ƒ  /app/grn/[id]     ← dynamic
... (52 routes total)
```

---

### สิ่งที่ต้องทำครั้งหน้า

1. **Stage & verify route deletion** — `git add -u` เพื่อ stage การลบ `app/(app)/` ไฟล์เก่า 32 ไฟล์
2. **ทดสอบ UI ใน browser จริง** — ยืนยันว่าภาษาไทยแสดงผลถูกต้องหลัง encoding fix
3. **Import vendors** — รอไฟล์ Excel จากผู้ใช้
4. **Vendor detail page** — ยังไม่มี `/app/app/vendors/[id]`
5. **Plan ERP module ถัดไป** — Sales / POS / Accounting / HR / BOM

---

### จุดเตือนพิเศษ ⚠️

1. **Supabase connection:** ต้องใช้ **pooler URL** เท่านั้น
   - ✅ `aws-1-ap-south-1.pooler.supabase.com:6543`
   - ❌ `db.utsjzrrezhdcdtxgppsb.supabase.co` (IPv6 only — timeout)

2. **Password encoding:** password มีอักษร `@` → ต้อง URL-encode เป็น `%40`

3. **Gemini สร้างไฟล์ใหม่ = BOM risk** — ทุกครั้งที่ Gemini สร้างไฟล์ `.tsx` / `.ts` ใหม่ ให้ตรวจ BOM และ Thai encoding ด้วย PowerShell script ก่อน commit

4. **`useSearchParams()` → ต้องอยู่ใน `<Suspense>`** — Next.js 15 บังคับ; pattern: wrap inner component

5. **GRN over-receipt guard** — ถ้าเพิ่ม GRN endpoint ใหม่ต้องใส่ guard เสมอ

6. **`del()` ใน api-client** — รองรับ optional body แล้วตั้งแต่ session นี้

7. **ไฟล์ `.env`** — อยู่ใน `.gitignore` ✅

---

## Session: 2026-05-10 (Session 1 — Earlier)

### สิ่งที่ทำวันนี้

#### 1. Audit PR→PO→GRN Flow (ผ่านทุก phase)
- ทดสอบ flow ทั้งหมดตั้งแต่ต้นจนจบ: PR → Submit → Approve → PO → Send → GRN → QC → Stock
- ตรวจสอบ warehouse scope enforcement, document numbering, stock ledger, dashboard KPI
- ผลลัพธ์: ผ่านทุก checkpoint ยกเว้น BUG-001

#### 2. แก้ BUG-001: Over-receipt ไม่ถูกบล็อก (High severity)
- **`app/api/grn/route.ts`** — เพิ่ม server-side guard ตรวจ `qty_received ≤ qty_ordered - qty_already_received` ต่อ PO line ก่อน INSERT
- **`app/(app)/grn/new/page.tsx`** — เพิ่ม `max` attribute บน input + client-side validation ก่อน submit

#### 3. Gemini UI improvements (35 ไฟล์)
Gemini CLI ปรับปรุง UI หลายหน้าระหว่าง audit

#### 4. Import Script สำหรับ Products
- **`scripts/import-products.ts`** — อ่าน Excel → upsert UOMs, categories, products เข้า DB
- Import สำเร็จ: 4,761 products synced, 37 UOMs, 205 categories

#### 5. Responsive Design UI (30+ ไฟล์)
- Mobile-first Sidebar drawer + Hamburger menu
- Stack layouts, hidden columns, responsive modals

#### 6. GR Staff Workflow
- `storage_location` ใน GRN lines (Migration 013)
- Receiving Queue page
- Real-time stock level ในหน้า GRN new

#### 7. Inbound Order Workflow (LINE-based)
- Migration 014: `inbound_orders`, `inbound_order_lines`
- Full CRUD + Supervisor Verification flow
- Updated Receiving Queue (PO + IO combined)

#### 8. Employee Management + RBAC
- Migration 015: Employee fields + Permission/Role system
- RBAC permission filtering ใน Sidebar
- UserRoleModal สำหรับกำหนดบทบาท

#### 9. Sidebar Navigation Grouping
- จัดกลุ่มเมนูเป็น 7 กลุ่มตามโมดูลธุรกิจ

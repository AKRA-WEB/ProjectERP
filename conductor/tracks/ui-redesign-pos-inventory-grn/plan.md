---
track: ui-redesign-pos-inventory-grn
status: planned
aliases: ["UI Redesign — POS Terminal · Inventory · GRN Mobile"]
owner: Gemini CLI
module: POS, WMS, Inventory
updated: 2026-05-16
---

# UI Redesign — POS Terminal · Inventory · GRN Mobile

Pure UI implementation from design handoff at `docs/design/design_handoff_pos_inventory_grn/`.
No schema changes. All API contracts exist. Use existing component library only — do not reimplement.

## Source of Truth

- Design specs: `docs/design/design_handoff_pos_inventory_grn/README.md`
- JSX prototypes: `docs/design/design_handoff_pos_inventory_grn/files/apps/`
- Screenshots: `docs/design/design_handoff_pos_inventory_grn/screenshots/`

## Design Tokens (already in `app/globals.css` — use these classes)

```
Card:            bg-white border border-stone-200 rounded-[10px] shadow-sm
Primary button:  bg-stone-950 text-white hover:bg-stone-800 rounded-md
Accent button:   bg-emerald-600 hover:bg-emerald-700 text-white
Numbers:         font-mono tabular-nums
Active tab:      border-b-2 border-stone-950 text-stone-950 -mb-px
Filter chip on:  bg-emerald-600 text-white shadow-sm
Filter chip off: bg-stone-100 text-stone-600 px-3 py-1 rounded-full text-[11px] font-bold
Pill ok:         text-emerald-700 border-emerald-200 bg-emerald-50
Pill warn:       text-amber-700 border-amber-300 bg-amber-50
Pill danger:     text-red-700 border-red-200 bg-red-50
Pill info:       text-blue-700 border-blue-200 bg-blue-50
```

## Responsive Breakpoints

- `< 768px` — mobile: sidebar behind hamburger, tables → cards, sticky bottom CTA, bottom tab bar
- `≥ 768px (md)` — sidebar collapsed, no bottom tab bar, tables visible
- `≥ 1280px (xl)` — full 3-col POS, all columns, sidebar expanded
- Strategy: one file per route, use `md:hidden` / `hidden md:flex` pairs. No duplicate routes.
- Touch targets ≥ 44px on mobile (existing components already comply).

---

## Implementation Order

> Follow this order exactly. Each task builds on the previous.

---

## T-001 — GRN Receive Mobile Rewrite

**File:** `app/app/grn/new/page.tsx`  
**Priority:** P0 — staff-blocking  
**Reference:** README §7, `files/apps/grn-mobile-receive.jsx`, screenshot `grn-receive-mobile.png`

### What to build

The page already has `expiry_date` in `GRNLine` interface and state — surface it properly in the UI.

**Mobile layout (`< md:`):**

1. **Header** — `←` back arrow · centered `รับสินค้า · {io_number or po_number}` + vendor name subtitle · `⋯` menu icon
2. **Progress bar** — `h-1.5 w-full rounded-full bg-stone-100` container, `bg-emerald-500` fill at `(done/total * 100)%`. Right: `{done}/{total}` mono text (10px)
3. **Scan banner** — `bg-stone-900 text-white rounded-xl p-4` card with barcode icon + "สแกนบาร์โค้ดสินค้า" title + outlined "เปิดกล้อง" button (border-white text-white)
4. **Active line card** — `rounded-2xl bg-white border-2 border-emerald-300 ring-2 ring-emerald-100 p-4 space-y-3`:
   - SKU + UoM (10px mono emerald-700) · Name (14.5px semibold) · status pill (รับบางส่วน amber / รับครบ emerald)
   - **Qty stepper block** `rounded-xl bg-stone-50 border border-stone-200 p-3`:
     - Label row: "จำนวนที่รับ" left + "สั่ง {qty_ordered} {uom}" right
     - Stepper: `flex justify-center items-center gap-2.5` — `[−]` w-11 h-11 rounded-xl · `<input>` w-32 text-center text-2xl font-mono · `[+]` w-11 h-11 rounded-xl
     - Quick amounts row: 3 buttons — `10` / `รับครบ` (emerald outline) / `−1`
   - **2-col grid** inputs: "LOT NO." left · "ตำแหน่งเก็บ" right (h-11 each)
   - **วันหมดอายุ** row: calendar icon label + date display mono `dd/mm/yyyy (พ.ศ.)` + remaining-days chip (emerald ≥90d / amber 30–89d / red <30d) + "เปลี่ยน" button
   - Action buttons: `ข้ามไปก่อน` outline · `บันทึก →` emerald — side by side
5. **Line checklist** — header "รายการทั้งหมด · {N} SKU", then list:
   - Done: `w-5 h-5 rounded-full bg-emerald-500` with white checkmark · name + SKU mono · `{received}/{ordered}` emerald right · `opacity-70`
   - Partial: amber dot circle · amber numbers
   - Pending: empty stone border circle · stone-400 numbers
   - Active: `border border-emerald-300 ring-1 ring-emerald-100 rounded-lg`
6. **Sticky bottom** — `fixed bottom-0 inset-x-0 p-4 bg-white border-t border-stone-200`:
   - Disabled (pending > 0): `bg-stone-200 text-stone-400` "ส่งใบรับสินค้า · ยังเหลืออีก {N} รายการ"
   - Enabled (all done): `bg-emerald-600 text-white` "ส่งใบรับสินค้า ✓"

**Desktop (`≥ md:`):** Keep existing layout, add the lot/expiry fields if missing.

### Acceptance Criteria

- [ ] Progress bar updates as lines are saved
- [ ] Stepper buttons are exactly w-11 h-11, centered (not stretched)
- [ ] Expiry date chip color changes by remaining days (green/amber/red)
- [ ] Checklist status circles update correctly for done/partial/pending
- [ ] Submit button disabled until all lines done
- [ ] `ข้ามไปก่อน` advances to next pending line without saving current
- [ ] All touch targets ≥ 44px on mobile

---

## T-002 — GRN Receiving Queue Mobile Rewrite

**File:** `app/app/grn/receiving-queue/page.tsx`  
**Priority:** P0 — staff-blocking  
**Reference:** README §6, `files/apps/grn-mobile-queue.jsx`, screenshot `grn-queue-mobile.png`

### What to build

**Mobile layout (`< md:`):**

1. **Header** — `←` · "รายการรอรับ" + "Receiving Queue · {warehouse_code}" subtitle · filter icon
2. **Summary strip** — `grid grid-cols-3 gap-2`:
   - "ด่วน" (amber border, count of orders > 4hr old) · "IO (LINE)" (count + "N ชิ้น") · "PO" (count + "N ชิ้น")
3. **Segmented control** — full-width `bg-stone-100 rounded-full p-1 flex`:
   - "Inbound Orders" chip with count badge · "Purchase Orders" chip with count badge
   - Active: `bg-white shadow rounded-full font-semibold`
4. **Queue card list** — for each IO/PO:
   - Doc number (emerald mono for IO, blue mono for PO) + optional `ด่วน` amber chip · "ค้างรับ {N}" right big mono + "{N} รายการ" sub
   - Vendor name (13.5px medium)
   - Time since created (stone-400, e.g. "เมื่อ 30 น. ที่แล้ว")
   - **Big CTA**: `w-full h-10 bg-emerald-600 text-white rounded-lg` with barcode icon + "เริ่มรับสินค้า"
   - Urgent (>4hr): `border-amber-300 ring-1 ring-amber-200/50`
5. **Bottom tab bar** — `fixed bottom-0 inset-x-0 h-16 bg-white border-t border-stone-200`:
   - 4 tabs: หน้าหลัก / รับสินค้า (active emerald) / สต็อก / โปรไฟล์
   - Line icons (24px) + 10px label. Active tab: emerald icon + emerald dot indicator

**Desktop (`≥ md:`):** Centered max-width-xl layout of the same cards. No bottom tab bar.

### Acceptance Criteria

- [ ] Summary strip counts correct (ด่วน = orders created > 4hr ago)
- [ ] Segment switch between IO and PO lists works
- [ ] Urgent cards visually distinct (amber ring)
- [ ] CTA "เริ่มรับสินค้า" navigates to `grn/new?io_id={id}` or `grn/new?po_id={id}`
- [ ] Bottom tab bar fixed at bottom, does not overlap content (add `pb-20` to scroll area)

---

## T-003 — GRN List Desktop Refinements

**File:** `app/app/grn/page.tsx`  
**Priority:** P1  
**Reference:** README §5, `files/apps/grn-desktop.jsx`, screenshot `grn-list-desktop.png`

### What to change

1. **Header right area**: Add "รายการรอรับ" button with amber chip showing `{io_count} IO · {po_count} PO`. Links to `grn/receiving-queue`.
2. **Status tabs** — replace existing tab buttons with underline-style tabs:
   - 8 tabs: ทั้งหมด / ร่าง / รับแล้ว / รอ QC / QC ผ่าน / QC ไม่ผ่าน / ตรวจสอบแล้ว / นำเข้าคลัง
   - Each tab: `px-3.5 py-2.5` + small count pill `bg-stone-50 text-stone-600 text-xs px-1.5 rounded`
   - Active: `text-stone-950 border-b-2 border-stone-950 -mb-px`
   - "รอ QC" count pill: `bg-amber-50 text-amber-700` when count > 0
3. **Filter row**: Add warehouse select + date range select + receiver select next to existing search
4. **Table ref column**: IO ref = small emerald `●` dot prefix; PO ref = small blue `●` dot prefix

### Acceptance Criteria

- [ ] 8 status tabs with live counts from API
- [ ] "รายการรอรับ" button shows correct IO/PO counts
- [ ] IO/PO dots display correct colors in ref column
- [ ] Filter row fields functional (warehouse + date range + receiver)

---

## T-004 — POS Terminal Desktop Rewrite

**File:** `app/app/pos/session/[id]/page.tsx`  
**Priority:** P1  
**Reference:** README §1, `files/apps/pos-terminal.jsx`, screenshot `pos-terminal-desktop.png`

### What to build (desktop `≥ md:`)

1. **Status bar** — single horizontal Card `p-3 px-5 mb-4`:
   - 5 items separated by `<div className="h-4 w-px bg-stone-200" />`:
     - รอบการขาย: session_number mono bold + green OPEN pill
     - คลัง: warehouse name
     - กะ / SHIFT: shift name emerald-700 bold
     - แคชเชียร์: user name
     - เวลา: current time (update every minute)
   - Right: "ปิดรอบ / Close" `text-red-600 border border-stone-200 rounded-md px-3 py-1`

2. **3-column body** — `flex flex-1 gap-4`:
   - **Left `flex-[3]`** — Products column:
     - Tab strip: สินค้า / ประวัติ + "บิลที่พัก: N" amber chip right
     - Search input: full-width `h-10` with 🔍 icon, `F2` mono kbd chip right
     - Category chips: ทั้งหมด (emerald active) + API categories
     - Product grid: `grid grid-cols-4 gap-3` — each card:
       - `aspect-square` image area (fallback: category color bg with box icon)
       - Stock badge top-right: หมด `bg-red-500 text-white text-xs` / สต็อกต่ำ `bg-amber-500 text-white text-xs` / normal `bg-white/90 text-stone-600 border text-xs` showing qty
       - Name `text-xs line-clamp-2`
       - Price `text-emerald-600 font-bold text-sm` + SKU `font-mono text-[10px] text-stone-400`
       - Border: `border-red-200` out / `border-amber-200` low / `border-stone-200` normal
   
   - **Middle `flex-[2]`** — Cart column:
     - Header: "รายการสินค้า / Cart" + count pill + `⏸ พักบิล / Hold` amber button
     - Cart items: `divide-y divide-stone-50` — each item is a `div` (NOT `<tr>`):
       - Row 1 `flex items-start justify-between gap-3`: name+sku block `flex-1 min-w-0` + `✕` button `text-stone-300 hover:text-red-500 w-6 h-6`
       - Row 2 `flex items-center justify-between mt-2`:
         - Left: `[−]` w-7 h-7 rounded · qty w-8 text-center font-mono · `[+]` w-7 h-7 rounded · `× ฿{price}` stone-400 text-sm
         - Right: line total `font-mono font-bold text-[15px] text-stone-900 tabular-nums`
     - Footer: held cart chips (amber) + "รวม N บิล · M รายการ" muted right

   - **Right `flex-[2]`** — Totals + Member + Payment:
     - **Totals card** `p-4 space-y-2.5 bg-white border border-stone-200 rounded-[10px]`:
       - รวมสินค้า / Subtotal ↔ amount
       - ส่วนลดท้ายบิล / Discount ↔ inline-editable input right-aligned mono
       - `border-t border-stone-100`
       - ก่อนภาษี (excl. VAT) ↔ stone-400
       - VAT 7% ↔ stone-400
       - `border-t border-stone-100`
       - ยอดสุทธิ / Total (12px bold uppercase) ↔ `text-emerald-600 text-3xl font-black font-mono tabular-nums`
     - **Member card** `p-4 bg-white border border-stone-200 rounded-[10px]`:
       - Label "สมาชิก / MEMBER" stone-500 uppercase 11px
       - Empty: phone input + "ค้นหา" button
       - Linked: `bg-emerald-50 rounded-lg p-2 flex items-center justify-between` — name bold + tier/discount/pts text + `✕` unlink
     - **Payment card** `p-4 bg-white border border-stone-200 rounded-[10px] flex-1`:
       - 3-method picker `grid grid-cols-3 gap-2`: each `border rounded-lg p-2.5 text-center cursor-pointer` — active: `border-emerald-500 border-2 bg-emerald-50`
       - Cash tendered: `text-right font-mono text-2xl h-12 border-b border-stone-200`
       - Quick amounts: `grid grid-cols-4 gap-1.5` — 20/100/500/1000 buttons
       - Change panel `bg-amber-50 rounded-lg p-3`: เงินทอน label + `text-amber-800 font-mono font-black text-2xl`
       - Checkout: `w-full py-3.5 rounded-xl text-base font-semibold bg-emerald-600 hover:bg-emerald-700 text-white`

### Acceptance Criteria

- [ ] Status bar shows correct session/shift/cashier data
- [ ] Product grid loads from `GET /api/pos/products`, search + category filter work
- [ ] Cart stacked rows (no table). Add/remove/qty-change work correctly
- [ ] Discount field editable, recalculates totals live (VAT inclusive: `vat = total × 7/107`)
- [ ] Member lookup by phone calls `GET /api/pos/members?phone=...`
- [ ] Payment method picker switches correctly. Cash tendered → change calculated
- [ ] Checkout calls `POST /api/pos/transactions`, shows receipt modal on success
- [ ] Hold bill saves to `POST /api/pos/held-carts`
- [ ] Close session opens modal → calls session close API

---

## T-005 — Inventory Desktop KPI Strip + Mobile Cards

**File:** `app/app/inventory/page.tsx`  
**Priority:** P2  
**Reference:** README §3 §4, `files/apps/inventory.jsx` + `inventory-mobile.jsx`

### What to add (desktop)

1. **KPI strip** — single Card `flex divide-x divide-stone-100` before the filter row:
   - 4 segments `flex-1 px-6 py-4`:
     - SKU ทั้งหมด: `data.total` + "N คลัง · M หมวด" sub
     - ยอดคงเหลือ (มูลค่า): sum(qty_on_hand × unit_cost) formatted ฿ + "ราคาทุน · WAC" sub
     - ต่ำกว่า Reorder: count where `qty_available <= reorder_point` amber-700
     - สินค้าหมด: count where `qty_available <= 0` red-700
   - Value: `text-2xl font-mono font-bold tabular-nums`, sub: `text-xs text-stone-400 mt-0.5`

2. **Filter row**: Add view toggle `SegControl` at right: ตาราง / การ์ด

3. **Table**: Add "คลัง" column after SKU. Row `className` → `bg-red-50/40` when `qty_available <= reorder_point`.

4. **Export CSV button**: header right, calls `GET /api/stock?format=csv` or builds CSV from current data client-side.

### Mobile layout (`< md:`)

1. **Header** — `←` · "สต็อกสินค้า" + "1,842 SKU" subtitle · filter icon
2. **Search row**: full-width `h-11` input + black square scan button
3. **Filter chips** (horizontal scroll): warehouse chips + "ต่ำกว่า reorder" chip
4. **KPI scroll strip**: `flex gap-2 overflow-x-auto pb-2` — 4 `w-36 flex-shrink-0 p-3` cards
5. **Stock card list**: each card `bg-white border rounded-[10px] p-3 mb-2`:
   - Row 1: SKU + "WH-01" mono text-xs stone-400 · name_th semibold · status pill right
   - Row 2: `grid grid-cols-3 gap-0 border border-stone-100 rounded-lg overflow-hidden mt-2`:
     - Each cell: label text-[9px] stone-400 · value font-mono font-semibold text-sm · middle col `border-x border-stone-100`
   - Low/out: `border-red-200 bg-red-50/30`
6. **Bottom tab bar** — 4 tabs: หน้าหลัก / สต็อก (active) / โอนย้าย / นับสต็อก

### Acceptance Criteria

- [ ] KPI strip shows correct counts from loaded data
- [ ] Low-stock row highlight works in table view
- [ ] View toggle switches between table and card view
- [ ] Mobile cards show correct data with 3-col number grid
- [ ] Bottom tab bar visible only on mobile, navigates correctly

---

## T-006 — POS Mobile Responsive

**File:** `app/app/pos/session/[id]/page.tsx` (same file as T-004)  
**Priority:** P2 — do after T-004 is complete  
**Reference:** README §2, `files/apps/pos-mobile.jsx`, screenshot `pos-mobile.png`

### Mobile layout (`< md:`)

1. **Header** — `←` · centered "POS Terminal" + "{session_number} · {shift_name}" subtitle · `⋯`
2. **Tabs** — `flex border-b border-stone-200`:
   - "สินค้า" tab (active) · "ตะกร้า" tab with count badge `bg-emerald-600 text-white rounded-full text-xs px-1.5`
3. **สินค้า tab**: search row (h-11 input + emerald square barcode button) + category chips (horizontal scroll) + `grid grid-cols-2 gap-2.5` cards
4. **ตะกร้า tab**: same stacked-row cart design as desktop, scroll area filling screen above sticky bottom
5. **Sticky bottom** — `fixed bottom-0 inset-x-0 p-3 bg-white border-t border-stone-200`:
   - Full-width `h-14 bg-emerald-600 text-white rounded-xl` pill: cart icon + count badge + "ดูตะกร้า · ชำระเงิน" + total `font-mono font-bold text-lg` right
   - Tapping this switches to ตะกร้า tab

### Acceptance Criteria

- [ ] Tab switch สินค้า↔ตะกร้า works
- [ ] Cart total in sticky button updates live
- [ ] Product grid 2-col on mobile, 4-col on desktop
- [ ] Checkout flow works same as desktop

---

## Shared Constraints

- `formatCurrency()` from `@/lib/format` for all currency display
- `formatDate()` from `@/lib/format` for all dates (Buddhist Era, Asia/Bangkok)
- `font-mono tabular-nums` on every number (qty, price, SKU, dates)
- No new API routes. No schema changes.
- Do not import from `react` for View Transitions — use `lib/react-vts.tsx` bridge
- All pages `'use client'`
- Reuse `<StatusBadge>`, `<Button>`, `<Modal>`, `<Card>`, `<Table>`, `<Input>`, `<Select>`, `<Pagination>`, `<SearchInput>`, `<SegControl>` — do not reimplement

## Migration Required

None.

## Files Changed

| Task | File |
|------|------|
| T-001 | `app/app/grn/new/page.tsx` |
| T-002 | `app/app/grn/receiving-queue/page.tsx` |
| T-003 | `app/app/grn/page.tsx` |
| T-004 | `app/app/pos/session/[id]/page.tsx` |
| T-005 | `app/app/inventory/page.tsx` |
| T-006 | `app/app/pos/session/[id]/page.tsx` (additive to T-004) |

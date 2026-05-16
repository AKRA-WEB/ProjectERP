# Handoff: POS Terminal, Inventory & GRN

## Overview

Three modules of the **BUYMORETH ERP** redesigned with a clear desktop/mobile split:

| Module | Desktop (admin / cashier station) | Mobile (warehouse staff) |
| --- | --- | --- |
| **POS** | Full cashier terminal — 3-column layout | Scan + tap-to-add + sticky checkout |
| **Inventory** | Sortable table + KPI strip | Stock cards + bottom tab bar |
| **GRN (Goods Receive)** | List + status tabs + detail modal | 2-screen flow: Receiving Queue → Receive Items |

The **GRN module is the most responsive-critical** — admin reviews the GRN history on desktop while warehouse staff actually receive shipments on their phones. The mobile receive flow includes barcode scanning, partial-receipt support, lot/location/expiry capture, and a checklist of all lines.

## About the Design Files

The files in `files/` are **HTML/JSX design references**, not production code. They run in a standalone HTML host using React 18 + Babel + Tailwind via CDN, with a custom `<DesignCanvas>` wrapper that lets the user pan/zoom/focus each artboard.

> **You should not copy these files into the repo.** Instead, **recreate the designs in the target codebase** using its existing patterns, the existing component library, and proper Next.js routing.

## Target Codebase

This handoff targets **AKRA-WEB/ProjectERP** (the BUYMORETH ERP):

- **Framework:** Next.js 15 (App Router), TypeScript
- **Styling:** Tailwind CSS with custom tokens (`app/globals.css`, `tailwind.config.ts`)
- **Component library:** `components/ui/*` (Button, Modal, Card, Table, Input, Select, StatusBadge, KpiCard, Pagination, SearchInput, SegControl, Toast)
- **Layout chrome:** `components/layout/Sidebar.tsx`, `components/layout/TopBar.tsx`
- **Routes covered:**
  - `app/app/pos/page.tsx` (POS landing — kept as-is)
  - `app/app/pos/session/[id]/page.tsx` ← **rewrite** for new layout + responsive
  - `app/app/inventory/page.tsx` ← **enhance** with KPI strip + responsive cards
  - `app/app/grn/page.tsx` ← **refine** the existing admin list
  - `app/app/grn/receiving-queue/page.tsx` ← **redesign** mobile-first
  - `app/app/grn/new/page.tsx` ← **redesign** as mobile-first scan flow

Reuse the existing `<StatusBadge>`, `<Button>`, `<Modal>`, etc. — do not reimplement.

## Fidelity

**High-fidelity.** All colors, type scales, spacing, radii, and shadows in this handoff are drawn from the existing `app/globals.css` design tokens (the `--ink-*`, `--line-*`, `--accent-*` CSS custom properties) and Tailwind's `stone-*` / `emerald-*` / `amber-*` palettes used throughout the codebase. Recreate pixel-perfectly.

## Design Tokens (already in `app/globals.css`)

```css
/* Neutrals (warm stone) — already in globals.css */
--bg:        #ffffff;
--bg-soft:   #fafaf9;   /* page bg */
--bg-sunken: #f5f5f4;
--ink:       #0c0a09;
--ink-1:     #1c1917;   /* primary text */
--ink-2:     #44403c;   /* secondary text */
--ink-3:     #78716c;   /* muted */
--ink-4:     #a8a29e;   /* placeholder */
--line:      #e7e5e4;
--line-soft: #f1efee;
--line-strong:#d6d3d1;

/* Accent — emerald, used for primary CTAs, member chips, "ok" pills */
--accent:     #10b981;
--accent-ink: #047857;
--accent-soft:#ecfdf5;

/* Status colors */
--warn:   #d97706;  /* amber-600  — partial, low-stock, "ด่วน" */
--danger: #dc2626;  /* red-600    — out-of-stock, qc_failed */
--info:   #2563eb;  /* blue-600   — received, verified, PO link */
```

| Use | Tailwind classes |
| --- | --- |
| Card | `bg-white border border-stone-200 rounded-[10px] shadow-sm` |
| Card hover | `hover:bg-stone-50/60` |
| Filter chip (off) | `bg-stone-100 text-stone-600 px-3 py-1 rounded-full text-[11px] font-bold` |
| Filter chip (on) | `bg-emerald-600 text-white shadow-sm` |
| Primary button | `bg-stone-950 text-white hover:bg-stone-800 rounded-md` |
| Accent button (POS, mobile actions) | `bg-emerald-600 hover:bg-emerald-700 text-white` |
| Pill — ok | `text-emerald-700 border-emerald-200 bg-emerald-50` |
| Pill — warn | `text-amber-700 border-amber-300 bg-amber-50` |
| Pill — danger | `text-red-700 border-red-200 bg-red-50` |
| Pill — info | `text-blue-700 border-blue-200 bg-blue-50` |
| Pill — muted | `text-stone-500 border-stone-200 bg-stone-50` |

**Typography:** existing repo fonts (`--font-sans` = IBM Plex Sans Thai + IBM Plex Sans, `--font-mono` = IBM Plex Mono). Use `font-mono` + `tabular-nums` for every number (qty, SKU, currency, dates).

**Currency format:** `฿1,234.50` — `Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' })` or the existing `formatCurrency()` from `@/lib/format`.

**Date format:** Buddhist Era `dd/mm/yyyy` (existing `formatDate()` from `@/lib/format`).

---

# Screens

## 1 · POS Terminal — Desktop (1440×900)

**Route:** `app/app/pos/session/[id]/page.tsx`
**Purpose:** Cashier-side checkout. Scan or tap products, manage cart, take payment.
**Replaces:** current 3-column terminal page. Cart layout rewritten to a stacked row design (see §1.5).

### 1.1 Page chrome
- Existing `<Sidebar module="pos">` (left, 232px) — POS module nav.
- Existing `<TopBar>` (56px) with breadcrumb `ขายหน้าร้าน / POS Terminal / {session_number}`.

### 1.2 Status bar (top of content)
A single horizontal `Card` (`p-3 px-5`) with 5 inline status items separated by `<div className="h-4 w-px bg-stone-200" />` dividers:

| Label (uppercase 11px text-stone-400) | Value |
| --- | --- |
| รอบการขาย | `<span className="font-mono font-bold">PS-25051601</span>` + green `OPEN` pill |
| คลัง | warehouse name |
| กะ / SHIFT | shift name (emerald-700 bold) |
| แคชเชียร์ | current user name |
| เวลา | current time |

Right side: `ปิดรอบ / Close` button — `text-red-600 border border-stone-200`.

### 1.3 Three-column body — `flex flex-1 gap-4`

- Left **`flex-[3]`** — Products
- Middle **`flex-[2]`** — Cart
- Right **`flex-[2]`** — Totals + Member + Payment

### 1.4 Products column
- Tab strip: `สินค้า / Products` (active, white card top-rounded) · `ประวัติ / History` · right-aligned "บิลที่พัก: 2" amber chip.
- Search/scan card: full-width input with 🔍 icon left, `F2` mono-kbd-style chip right. Placeholder `ค้นหาสินค้าด้วย ชื่อ, SKU หรือ สแกนบาร์โค้ด…`.
- Category chips below: `ทั้งหมด / All` (emerald-600 white) + categories from API.
- Product grid: `grid-cols-4 gap-3`, each card:
  - Aspect-square swatch background (placeholder for image — fall back to product category color)
  - Stock badge top-right:
    - out → `bg-red-500 text-white` `หมด`
    - low → `bg-amber-500 text-white` `สต็อกต่ำ`
    - normal → `bg-white/90 text-stone-600 border` showing qty
  - Name (`line-clamp-2 h-8`)
  - Price (emerald-600 bold) + SKU mono (right)
  - Border tint: red-200 / amber-200 / stone-200 based on stock

### 1.5 Cart column (rewritten — stacked rows, NOT a table)

Each cart line is a `div` with 2 rows of content (not a table row). This was a deliberate redesign to handle long Thai product names that wrap badly in narrow cells.

```
+---------------------------------------------+
| Product name (full width, can wrap 2 lines) | ✕ |
| SKU (10.5px mono, stone-400)                |
|                                              |
| [−] 2 [+]  × ฿18.00            ฿36.00       |
+---------------------------------------------+
```

- Container: `divide-y divide-stone-50`, each row `px-4 py-3 hover:bg-stone-50/50`.
- Row 1 (`flex items-start justify-between gap-3`): name + sku block (`flex-1 min-w-0`) and a small `✕` delete button (`text-stone-300 hover:text-red-500`).
- Row 2 (`flex items-center justify-between mt-2`):
  - Left: qty stepper (`w-7 h-7` rounded buttons with `−`/`+`, w-8 centered mono number) + `× ฿{price}` in stone-400.
  - Right: line total — `font-mono font-bold text-[15px] text-stone-900 tabular-nums`.

Header: `รายการสินค้า / Cart` + count pill + `⏸ พักบิล / Hold` button (amber).
Footer strip: held cart numbers as amber chips, "รวม X บิล · Y รายการ" muted on right.

### 1.6 Totals card (top of right column, `p-4 space-y-2.5`)
- `รวมสินค้า / Subtotal` ↔ amount
- `ส่วนลดท้ายบิล / Discount` ↔ inline-editable number field (right-aligned, mono)
- divider
- `ก่อนภาษี (excl. VAT)` ↔ subtotal pre-vat (stone-400)
- `VAT 7%` ↔ vat amount (stone-400)
- divider
- `ยอดสุทธิ / Total` (12px bold uppercase) ↔ **emerald-600 30px font-black mono tabular-nums** — the visual anchor of the screen.

### 1.7 Member card
Label "สมาชิก / MEMBER" on top. When linked: emerald background pill showing name + `GOLD · ส่วนลด 5% · 1,240 pts` + `✕` to unlink. When empty: phone input + `ค้นหา` button.

### 1.8 Payment card (fills remaining height)
- 3-column method picker: `💵 เงินสด` / `💳 บัตร` / `🔀 ผสม`. Active = emerald-500 border-2 + emerald-50 bg.
- Cash tendered: large right-aligned mono input (22px). Quick amounts row: `20 / 100 / 500 / 1000`.
- (Card amount field — when method = card/mixed)
- **Bottom**: amber Change panel showing change amount (22px mono black amber-800), then big emerald `ชำระเงิน / Checkout →` button (`py-3.5 rounded-xl text-[16px]`).

### 1.9 Modals
Use existing `<Modal>` for:
- Receipt modal after checkout (thermal-printer-styled receipt, print button)
- Close Session modal (closing float input)

## 2 · POS — Mobile (390×844)

**Same route**, served responsively. Render the mobile variant below `md:` breakpoint (768px).

- Native-feel app shell: iOS-style status bar (system clock) at top, home indicator at bottom.
- Header bar: `←` back · centered title "POS Terminal" + session number/shift on subtitle line · `⋯` menu.
- **Tabs** under header: `สินค้า` (active) and `ตะกร้า` with a count badge. Cart becomes a separate screen instead of a side panel.
- Search row: pill input + emerald square scan button on the right (square barcode glyph).
- Category chips (horizontal scroll, no truncation).
- Product grid: `grid-cols-2 gap-2.5` — same card pattern but smaller (`aspect-square` image, 11.5px name).
- **Sticky bottom action**: full-width 56px-tall emerald pill button — `[cart icon + count badge] ดูตะกร้า · ชำระเงิน [total ฿]`. Pressing this opens the cart tab (which mirrors the desktop cart with the same stacked-row design).

## 3 · Inventory — Desktop (1440×900)

**Route:** `app/app/inventory/page.tsx`
**Adds to current page:** A KPI strip and a dual-view (table/cards) toggle. Table itself stays a `<Table>` from `@/components/ui` but you may need to add a "warehouse" column.

### Page header
Title `สต็อกสินค้า / Inventory` (26px font-display semibold) + subtitle showing last update. Right: `Export CSV` button (white) + `+ ปรับปรุงสต็อก` (primary black).

### KPI strip — flex Card with 4 segments, `border-r` between them
| Label | Value | Sub | Accent |
| --- | --- | --- | --- |
| SKU ทั้งหมด | 1,842 รายการ | "3 คลัง · 7 หมวด" | — |
| ยอดคงเหลือ (มูลค่า) | ฿1.28M | "ราคาทุน · WAC" | — |
| ต่ำกว่า Reorder | 6 SKU | "ต้องสั่งซื้อเพิ่ม" | amber-700 |
| สินค้าหมด | 3 SKU | "ขาดส่งใน 7 วัน" | red-700 |

Each KPI uses the existing `<KpiCard>` pattern but inlined into one flex card for tighter visual rhythm.

### Filter row
- SearchInput (max-w-md)
- Warehouse select
- Category select
- "ต่ำกว่า reorder point" checkbox (rendered as a bordered label)
- Right-aligned segmented control: `ตาราง` (active) / `การ์ด`

### Table (`<Table>`)
9 columns: SKU · สินค้า (th+en) · คลัง · คงเหลือ · จอง · พร้อมใช้ · Reorder · หน่วย · สถานะ
- Numeric columns right-aligned, `font-mono tabular-nums`.
- `พร้อมใช้` is the emphasis column: emerald-700 normal / amber-700 low / red-600 out.
- **Whole row highlighted `bg-red-50/40` when low/out.**
- Status pill in last column: existing `<StatusBadge>` or the local Pill helper (see tokens).

Pagination follows the existing `<Pagination>` component.

## 4 · Inventory — Mobile (390×844)

Same route, mobile variant via `md:` breakpoint. Table → cards.

- Header: `←` · `สต็อกสินค้า` + count subtitle · filter icon (`☰`).
- Search row: input + black square scan button.
- Filter chips (warehouse + "ต่ำกว่า reorder").
- **KPI scroll strip** — 4 mini KPI cards (`w-[150px]` each) in a horizontal scroll. Same numbers as desktop.
- **Stock card list** — each card has 2 sections:
  - Top row: SKU + warehouse code (10px mono) · name th/en · status pill on the right.
  - Bottom: 3-column grid (`คงเหลือ` / `พร้อมใช้` / `Reorder`) with 15px mono semibold numbers; middle col has `border-x border-stone-100`.
- Low-stock rows: `border-red-200 bg-red-50/30`.
- **Bottom tab bar**: 4 tabs (`หน้าหลัก` / `สต็อก` active / `โอนย้าย` / `นับสต็อก`) with line icons + 10px label.

## 5 · GRN List — Desktop (1440×900)

**Route:** `app/app/grn/page.tsx`
**Refines the existing page** to add a status count to each tab, a filter row, and a more visible PO/IO ref column.

### Header
Title `ใบรับสินค้า` + subtitle "Goods Receipt Notes · 142 รายการ · 12 รอ QC".
Right: `Export CSV` · `รายการรอรับ [3 IO · 3 PO amber chip]` · `+ สร้าง GRN` (primary).

### Status tabs (border-bottom underline pattern, no buttons)
8 tabs: `ทั้งหมด` / `ร่าง` / `รับแล้ว` / `รอ QC` (hot — amber count badge) / `QC ผ่าน` / `QC ไม่ผ่าน` / `ตรวจสอบแล้ว` / `นำเข้าคลัง`.
Each tab: `px-3.5 py-2.5` label + small `bg-stone-50` count pill. Active = `text-stone-950 border-b-2 border-stone-950 -mb-px`. Hot count: `bg-amber-50 text-amber-700`.

### Filter row
Search (เลข GRN / PO / IO) + warehouse select + date range select + receiver select.

### Table (existing `<Table>`)
Cols: เลข GRN · เอกสารอ้างอิง · คลังสินค้า · ผู้รับ · วันที่รับ · รายการ · สถานะ · `›`.
- Ref column shows IO with a small emerald dot prefix; PO with a blue dot prefix. Empty → muted dash.
- Click row → open existing `<GRNDetailModal>`.
- Footer: range + page list + prev/next.

## 6 · GRN Receiving Queue — Mobile (390×844)

**Route:** `app/app/grn/receiving-queue/page.tsx` (rewrite mobile-first; admin can still see this stretched on desktop)
**Purpose:** Staff lands here from the warehouse floor to pick the next IO/PO to receive.

### Sections
1. **Status bar** (system clock).
2. **Header** — `←` · `รายการรอรับ` + `Receiving Queue · WH-01` subtitle · filter icon.
3. **Summary strip** — 3 KPI mini-cards in a `grid-cols-3 gap-2`:
   - `ด่วน` (amber border) — 1 — "เกิน 4 ชม."
   - `IO (LINE)` — 3 — "234 ชิ้น"
   - `PO` — 3 — "456 ชิ้น"
4. **Segmented control** — `Inbound Orders` (with count chip) / `Purchase Orders` (with count chip) — full-width pill `bg-stone-100`.
5. **List of queue cards** — each card:
   - Top: PO/IO number (emerald/blue mono) + optional `ด่วน` amber chip · "ค้างรับ N" right-aligned big mono number · "X รายการ" sub.
   - Vendor name (13.5px medium).
   - Time-since-created subtitle (stone-400).
   - **Big emerald CTA at bottom**: `[barcode icon] เริ่มรับสินค้า` — 40px tall.
   - Urgent (>4 hr) cards get `border-amber-300 ring-1 ring-amber-200/50`.
6. **Bottom tab bar** — 4 tabs: `หน้าหลัก` / `รับสินค้า` (active emerald) / `สต็อก` / `โปรไฟล์`.

## 7 · GRN Receive Items — Mobile (390×844)

**Route:** `app/app/grn/new/page.tsx` (rewrite mobile-first, with `po_id` / `io_id` query params as today)
**Purpose:** The actual receiving flow. One IO mid-receipt with: 2 lines done, 1 partial in progress (the "active" card), 3 pending.

### Sections (top to bottom)

1. **Status bar.**
2. **Header** — `←` · centered `รับสินค้า · IO-25051502` + vendor name subtitle · `⋯`.
3. **Progress bar** — `h-1.5 rounded-full bg-stone-100` filled by `bg-emerald-500`. Right: `done/total` mono.
4. **Scan banner** — dark `bg-stone-900 text-white` card with barcode icon + `สแกนบาร์โค้ดสินค้า` + secondary subtitle + outlined `เปิดกล้อง` button.
5. **Active line card** — the focus of the screen. `rounded-2xl bg-white border-2 border-emerald-300 ring-2 ring-emerald-100 p-4 space-y-3`:
   - SKU · UoM (10px mono emerald-700) + name (14.5px semibold) + `รับบางส่วน` amber pill.
   - **Qty stepper block** (`rounded-xl bg-stone-50 border border-stone-200 p-3`):
     - Label row: "จำนวนที่รับ" + "สั่ง 36 ลัง" right.
     - **Stepper centered**: `[−] [w-32 input 24px mono] [+]` — `justify-center gap-2.5`. Buttons `w-11 h-11`. The input is fixed-width (NOT `flex-1`) so the group sits centered, not stretched to edges. (This was the explicit fix in the latest iteration.)
     - 3 quick-amount buttons: `10` / `รับครบ` / `−1 ลัง`.
   - **Lot No + ตำแหน่งเก็บ** — 2-col grid, each a labeled input.
   - **วันหมดอายุ** — full-width row with calendar icon label. Shows `dd/mm/yyyy` (พ.ศ.) in mono + emerald chip showing remaining days + `เปลี่ยน` button. The chip color shifts amber under 90 days and red under 30.
   - 2 action buttons: `ข้ามไปก่อน` (outline) · `บันทึก →` (emerald).
6. **Line checklist** — `รายการทั้งหมด · 6 SKU` label, then a list of every line item with:
   - Status circle: emerald ✓ for done, amber dot for partial, empty stone border for pending.
   - Name + SKU (mono).
   - Right: `{received}/{ordered}` mono — colored emerald / amber / stone-400 per status.
   - Active line: `border-emerald-300 ring-1 ring-emerald-100`. Done lines: `opacity-70`.
7. **Sticky bottom** — disabled gray submit button until all lines are done: `ส่งใบรับสินค้า · ยังเหลืออีก 4 รายการ`. When 0 left: emerald, label changes to `ส่งใบรับสินค้า ✓`.
8. **Home indicator.**

### Receive-flow state model

```ts
type LineStatus = 'pending' | 'partial' | 'done';
interface ReceiveLine {
  inbound_order_line_id?: string;
  po_line_item_id?: string;
  product_id: string;
  sku: string;
  name: string;
  uom: string;
  qty_ordered: number;
  qty_received: number;        // user-entered
  lot_number: string;          // required when qty_received > 0 (admin-configurable)
  storage_location: string;
  expiry_date: string | null;  // ISO, required for food/medicine categories
  status: LineStatus;          // derived: received===ordered → done; >0 → partial; 0 → pending
}

// Active line index — driven by the most recent scan or manual tap.
// On scan: if barcode matches a pending or partial line, jump to it.
// On "บันทึก →": persist line, advance to next pending.
```

Submit endpoint: existing `POST /api/grn` from `app/app/grn/new/page.tsx`.

---

## Responsive Strategy (read this section)

**Don't build separate mobile-only routes.** Each of the 7 designs is a different *breakpoint* of one of the existing routes. Approach:

| Breakpoint | What it shows |
| --- | --- |
| `< 768px` (mobile) | Single column. Sidebar collapses behind hamburger. Tables become card lists. Sticky bottom CTA replaces in-line submit buttons. |
| `≥ 768px` (`md`) | Show sidebar (collapsed). Hide bottom tab bar. Tables expand. |
| `≥ 1280px` (`xl`) | Full POS 3-column layout. All table columns visible. Sidebar fully expanded. |

Use existing Tailwind responsive prefixes. Avoid duplicating components — write one component per route with conditional class names. For complex layout swaps (e.g. POS terminal's 3-column → tabbed-mobile), use a single component with two conditionally-rendered subtrees gated on `useIsMobile()` or a CSS-only `md:hidden` / `hidden md:flex` pair.

**Touch targets:** ≥ 44px on all mobile screens. Mobile inputs are `h-11`, mobile action buttons `h-12+`. Existing components already meet this; don't override down.

**Mobile-first GRN:** Build `/app/grn/new` and `/app/grn/receiving-queue` mobile-first. They're staff-primary. Admin reviewing them on desktop just sees a centered max-width version.

---

## State / Data

All API contracts already exist in the repo. The redesigned screens are pure view changes — no schema changes. Specifically:

- POS uses `GET /api/pos/sessions/:id`, `GET /api/pos/products`, `POST /api/pos/transactions`, `POST /api/pos/held-carts`, etc. — see existing terminal file.
- Inventory uses `GET /api/stock` (existing).
- GRN uses `GET /api/grn`, `GET /api/grn/:id`, `POST /api/grn`, `GET /api/grn/receiving-queue` (existing).

**The one new requirement: `expiry_date` is now surfaced on mobile receive.** The DB column exists. UI must collect it for any product flagged `requires_expiry` (add this category flag if not already present, or always show it).

---

## Files in this bundle

### Screenshots (`screenshots/`)

| File | Screen |
| --- | --- |
| `pos-terminal-desktop.png` | §1 · POS Terminal (admin) |
| `pos-mobile.png` | §2 · POS mobile (cashier on phone) |
| `inventory-desktop.png` | §3 · Inventory list (admin) |
| `inventory-mobile.png` | §4 · Inventory cards (staff) |
| `grn-list-desktop.png` | §5 · GRN list (admin) |
| `grn-queue-mobile.png` | §6 · Receiving queue (staff) |
| `grn-receive-mobile.png` | §7 · Receive items active card (staff) — partial crop; full layout in the HTML |

Screenshots are scaled overview renders. For pixel-accurate inspection, **open the HTML files**.

### HTML / JSX prototypes (`files/`)

| File | What it shows |
| --- | --- |
| `ERP Apps - POS & Inventory.html` | Main canvas — open in browser to see all 7 artboards |
| `apps/erp-shell.jsx` | Sidebar + TopBar chrome (matches `components/layout/*`) |
| `apps/erp-mock-data.jsx` | All mock data (products, cart, stock, GRN rows, queue, receive flow) |
| `apps/pos-terminal.jsx` | Desktop POS terminal — §1 |
| `apps/pos-mobile.jsx` | Mobile POS — §2 |
| `apps/inventory.jsx` | Desktop Inventory list — §3 |
| `apps/inventory-mobile.jsx` | Mobile Inventory cards — §4 |
| `apps/grn-desktop.jsx` | Desktop GRN list — §5 |
| `apps/grn-mobile-queue.jsx` | Mobile receiving queue — §6 |
| `apps/grn-mobile-receive.jsx` | Mobile receive-items flow — §7 |
| `design-canvas.jsx` | The host canvas component — not part of the implementation |

Open `ERP Apps - POS & Inventory.html` in any modern browser to see all designs side by side. Use the focus button on any artboard to enter fullscreen.

---

## Recommended Implementation Order

1. **Design tokens already in place** — no work.
2. **GRN mobile receive flow** (§7) — biggest UX win, staff-blocking. Build first.
3. **GRN mobile queue** (§6) — small, completes the staff flow.
4. **GRN desktop list refinements** (§5) — incremental polish over existing.
5. **POS cart row rewrite** (§1.5) — single component change, big visual win.
6. **Inventory KPI strip + mobile cards** (§3, §4) — purely additive.
7. **POS mobile** (§2) — largest engineering effort; ship after the cart row fix lands.

---

If anything is unclear, refer back to the HTML files — every line of the mockups is annotated with comments pointing back to the real repo file they originate from.

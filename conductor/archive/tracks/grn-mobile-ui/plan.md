---
track: grn-mobile-ui
status: Completed
owner: puka
module: WMS
updated: 2026-05-21
---

# GRN Mobile UI

## Objective

Make all three GRN surfaces fully usable on mobile (320px–767px). PC layout (`md:` and above) already acceptable — do not regress it. No backend changes. Pure UI rework.

**Surfaces in scope:**
1. `app/(wms)/grn/page.tsx` — GRN Receiving Queue list
2. `app/(wms)/grn/[id]/page.tsx` — GRN Detail (ใบรับสินค้า)
3. `app/(wms)/grn/[id]/edit/page.tsx` — Create/Edit GRN (lines, warehouse, header)

---

## Current Problems

### Queue list (`page.tsx`)
- `<table>` with `bg-gray-50/50 text-gray-500` — low contrast on mobile
- All columns (GRN#, supplier, PO ref, date, status) in fixed-width → horizontal scroll at 375px
- No card layout; table wrapped in `overflow-x-auto` only

### Detail page (`[id]/page.tsx`)
- Header (GRN#, PO, supplier, dates, warehouse, notes) consumes ~40% of mobile viewport
- Line items `<table>` below header → only 1–2 rows visible before scroll on 667px height (iPhone SE)
- Action buttons (Edit / Mark Received) float at bottom but not sticky — scroll away on long lists

### Edit page (`[id]/edit/page.tsx`)
- Table-based line editor — unusable on phone
- Warehouse `<select>` buried in header, hard to find mid-scroll
- Delete line icon is small table-cell icon — below 44px tap target
- Add Line button is inline below table — not reachable without scrolling past all lines
- No mobile layout at all

---

## Design Rules

### Breakpoints (Tailwind)
- Mobile: base (no prefix) — `< 768px`
- Tablet+: `md:` — `≥ 768px`
- Desktop: `lg:` — `≥ 1024px`

Write mobile-first. Use `md:hidden` / `hidden md:block` / `hidden md:table` to fork layouts.

### Color correction (all three pages)
- Page background: `bg-white`
- Card border: `border border-gray-200 rounded-xl`
- Secondary text: `text-gray-600` (not `text-gray-400` or `text-gray-500`)
- Section headers: `text-gray-900 font-semibold`
- Status badges: keep existing color logic; ensure `text-white` on colored badges, `text-sm font-medium` minimum

### Bilingual labels
Thai first, English secondary. Examples: `ใบรับสินค้า (GRN)`, `คลังสินค้า (Warehouse)`, `เพิ่มรายการ (Add Line)`. Mobile tight space: Thai-only acceptable.

### iOS zoom prevention
All `<input>` and `<select>`: minimum `text-base` (16px). iOS auto-zooms when font-size < 16px on focus.

### Tap targets
All interactive elements on mobile: minimum 44px height.

---

## Task 1 — Queue List: Mobile Card Layout + Color Fix

**File:** `app/(wms)/grn/page.tsx`

### What to build

Add a mobile card stack parallel to the existing table. Do not change table logic.

**Table:** wrap in `<div className="hidden md:block overflow-x-auto">` — hides on mobile, shows on md+.

**Card stack:** add below the table div:
```jsx
<div className="md:hidden space-y-3">
  {grns.map(grn => (
    <Link href={`/wms/grn/${grn.id}`} key={grn.id}>
      <div className="bg-white border border-gray-200 rounded-xl p-4 active:bg-gray-50">
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-gray-900">{grn.grn_number}</span>
          <StatusBadge status={grn.status} />  {/* existing badge component */}
        </div>
        <div className="text-sm text-gray-600">{grn.supplier_name}</div>
        <div className="text-sm text-gray-600">PO: {grn.po_number ?? '—'}</div>
        <div className="text-sm text-gray-500">{formatDate(grn.created_at)}</div>
      </div>
    </Link>
  ))}
</div>
```

**Filter bar:** stack filters vertically on mobile, horizontal on md+:
```jsx
<div className="flex flex-col md:flex-row gap-2 mb-4">
  {/* existing search input and status filter */}
</div>
```

**Page background:** change any `bg-gray-50` or `bg-gray-100` wrapper to `bg-white`.

### Constraints
- Same `grns` array used for both blocks — no duplicate fetch
- No change to pagination, filter state, or fetch logic
- Desktop table: zero changes to columns, sorting, or logic

### Acceptance criteria
- At 375px: cards render, table hidden, status badges readable, tapping card navigates to detail
- At 768px+: table renders, cards hidden — no regression
- `npx tsc --noEmit` passes, `npm run lint` passes

---

## Task 2 — Detail Page: Compact Header + 3 Line Items Visible

**File:** `app/(wms)/grn/[id]/page.tsx`

### What to build

**Collapsible header (mobile only):**

```jsx
const [headerExpanded, setHeaderExpanded] = useState(false);

{/* Mobile compact header */}
<div className="md:hidden">
  <div className="flex items-center justify-between">
    <div>
      <span className="font-semibold text-gray-900 text-lg">{grn.grn_number}</span>
      <StatusBadge status={grn.status} className="ml-2" />
    </div>
    <button
      onClick={() => setHeaderExpanded(v => !v)}
      className="p-2 text-gray-500"
      aria-label="ขยายรายละเอียด"
    >
      <ChevronDownIcon className={`w-5 h-5 transition-transform ${headerExpanded ? 'rotate-180' : ''}`} />
    </button>
  </div>
  <div className="text-sm text-gray-600">{grn.supplier_name} · {formatDate(grn.created_at)}</div>

  {headerExpanded && (
    <div className="mt-3 space-y-1 text-sm text-gray-600 border-t border-gray-100 pt-3">
      <div>PO: {grn.po_number ?? '—'}</div>
      <div>คลัง: {grn.warehouse_name}</div>
      <div>ผู้รับ: {grn.received_by_name ?? '—'}</div>
      {grn.notes && <div>หมายเหตุ: {grn.notes}</div>}
    </div>
  )}
</div>

{/* Desktop full header — unchanged */}
<div className="hidden md:block">
  {/* existing header JSX */}
</div>
```

**Line items — card per line (mobile only):**

```jsx
{/* Mobile line cards */}
<div className="md:hidden space-y-2 mt-4">
  {lines.map(line => (
    <div key={line.id} className="border border-gray-200 rounded-xl p-3 bg-white">
      <div className="font-medium text-gray-900 text-sm">{line.product_name}</div>
      <div className="text-xs text-gray-500">{line.sku}</div>
      <div className="flex justify-between mt-2 text-sm">
        <span className="text-gray-500">รับ {line.qty_received} / สั่ง {line.qty_ordered}</span>
        <span className="text-gray-900">{formatCurrency(line.unit_price)}</span>
      </div>
    </div>
  ))}
</div>

{/* Desktop table — unchanged */}
<div className="hidden md:block overflow-x-auto">
  {/* existing <table> JSX */}
</div>
```

**Sticky action bar (mobile only):**

Wrap existing action buttons (Edit / Mark Received / etc.):
```jsx
<div className="sticky bottom-0 bg-white border-t border-gray-200 p-3 -mx-4 mt-4 md:static md:mx-0 md:mt-0 md:border-none md:p-0">
  {/* existing action buttons */}
</div>
```

### Acceptance criteria
- At 375×667 (iPhone SE): compact header (2 lines visible), expand toggle works, minimum 3 line cards visible above fold, sticky action bar at bottom
- At 768px+: full header, table, no sticky bar — no regression
- `npx tsc --noEmit` passes

---

## Task 3 — Edit Form: Mobile-First Design

**File:** `app/(wms)/grn/[id]/edit/page.tsx`

### 3a — Status gate (verify only, do not change)

Confirm the following logic is present and unchanged:
```typescript
if (grn.status !== 'draft' && grn.status !== 'pending') {
  // show read-only notice
}
```
If status is non-editable, show: `<p className="text-gray-500 text-sm">ดูข้อมูลเท่านั้น (View Only)</p>`

### 3b — Warehouse selector: sticky header on mobile

```jsx
{/* Mobile sticky warehouse bar */}
<div className="sticky top-0 z-10 bg-white border-b border-gray-200 py-2 px-4 md:hidden">
  <label className="text-sm font-medium text-gray-700 block mb-1">คลังสินค้า (Warehouse)</label>
  <select
    value={warehouseId}
    onChange={e => setWarehouseId(e.target.value)}
    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base"
  >
    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
  </select>
</div>

{/* Desktop warehouse in header — unchanged */}
```

### 3c — Line items: card editor on mobile

```jsx
{/* Mobile line cards */}
<div className="md:hidden space-y-3">
  {lines.map((line, idx) => (
    <div key={line.id ?? idx} className="border border-gray-200 rounded-xl p-4 bg-white">
      <div className="font-medium text-gray-900 text-sm mb-3">{line.product_name}</div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">จำนวนสั่ง (Ordered)</label>
          <div className="text-sm text-gray-600 py-2">{line.qty_ordered}</div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">จำนวนรับ (Received)</label>
          <input
            type="number"
            min="0"
            value={line.qty_received}
            onChange={e => updateLine(idx, 'qty_received', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base"
          />
        </div>
      </div>

      <div className="mb-3">
        <label className="text-xs text-gray-500 block mb-1">ราคา/หน่วย (Unit Price)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={line.unit_price}
          onChange={e => updateLine(idx, 'unit_price', e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base"
        />
      </div>

      <button
        onClick={() => removeLine(idx)}
        className="w-full border border-red-200 rounded-lg py-3 text-red-600 text-sm font-medium min-h-[44px]"
      >
        ลบรายการนี้ (Remove)
      </button>
    </div>
  ))}
</div>

{/* Desktop table — unchanged */}
<div className="hidden md:block overflow-x-auto">
  {/* existing <table> with inline inputs */}
</div>
```

### 3d — Fixed bottom bar (mobile only)

Place as last child of the top-level component div (outside scroll content):

```jsx
<div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 p-3 flex gap-2 md:hidden">
  <button
    onClick={handleSave}
    className="flex-1 bg-green-600 text-white rounded-xl py-3 text-base font-semibold min-h-[44px]"
  >
    บันทึก (Save)
  </button>
  <button
    onClick={addLine}
    className="flex-1 bg-blue-600 text-white rounded-xl py-3 text-base font-semibold min-h-[44px]"
  >
    + เพิ่มรายการ (Add Line)
  </button>
</div>
```

Add `pb-24` to scroll content container on mobile to prevent last card hidden under fixed bar:
```jsx
<div className="pb-24 md:pb-0">
  {/* line cards + table */}
</div>
```

### Acceptance criteria
- At 375px: warehouse sticky bar at top, line cards render, delete button ≥44px, fixed bottom bar (Save + Add Line) visible
- Status gate: draft/pending → form renders; received/cancelled → read-only notice, form hidden
- All inputs have `text-base` class (iOS zoom prevention)
- At 768px+: existing table-based editor renders, no fixed bar, no regression
- `npx tsc --noEmit` passes, `npm run lint` passes

---

## Shared Constraints

1. **No backend changes.** No API routes, migrations, or schema changes.
2. **No regression on desktop.** `md:hidden` for mobile-only. `hidden md:block` / `hidden md:table` for desktop-only.
3. **`formatCurrency()` and `formatDate()`** on all money/date values — no inline formatting.
4. **`text-base` minimum** on all inputs — iOS zoom prevention.
5. **44px minimum tap target height** on all interactive elements.
6. **Do not change business logic** — status gates, fetch calls, submit handlers, Zod validation, state management.
7. **View transitions:** preserve `lib/react-vts.tsx` usage if present; never import directly from `react`.

---

## QA Checklist

- [x] `npx tsc --noEmit` — zero errors
- [x] `npm run lint` — zero errors
- [x] Queue list 375px: cards render, table hidden, badges readable, tap navigates to detail
- [x] Queue list 768px+: table renders, cards hidden — no regression
- [x] Detail page 375×667: compact header (2 rows), expand toggle works, 3+ line cards above fold, sticky action bar
- [x] Detail page 768px+: full header, table, no sticky bar — no regression
- [x] Edit form 375px: warehouse sticky top, line cards with delete ≥44px, fixed bottom bar with Save+Add
- [x] Edit form draft/pending: full edit form renders
- [x] Edit form received/cancelled: read-only notice, form hidden
- [x] Edit form 768px+: table editor renders, no fixed bar — no regression
- [x] All money: `formatCurrency()` used, no inline format
- [x] All dates: `formatDate()` used, no inline format
- [x] No `any` types introduced
- [x] All new labels have Thai text

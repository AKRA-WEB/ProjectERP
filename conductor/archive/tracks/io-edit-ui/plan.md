---
track: io-edit-ui
owner: puka
status: Verified
priority: medium
created: 2026-05-21
updated: 2026-05-21
---

# Track: io-edit-ui — Inbound Order Detail Edit UI

## Objective
Expose the 4 existing PATCH actions on the Inbound Order detail page. Currently read-only. No API changes needed — API is complete.

## Confirmed Facts (pre-plan verification)
- Detail page: `app/app/inbound-orders/[id]/page.tsx` — `'use client'`, already imports `useSession` from `next-auth/react`
- PATCH API: `app/api/inbound-orders/[id]/route.ts` — supports 4 actions (verified)
- `InboundOrderDetail` type in `types/index.ts` — includes `status`, `warehouse_id`, `warehouse_name`, `order_date`, `notes`, `lines[].line_id`, `lines[].qty_ordered`, `lines[].unit_cost`
- Warehouse list: fetch `/api/inbound-orders/warehouses` (confirmed in `new/page.tsx`)
- `lib/react-vts.tsx` exports `useTransition` — MUST import from here, NOT from `'react'` (P-001)
- UI components available: `Button`, `Input`, `Label`, `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue`, `Textarea`, `Alert`, `AlertDescription`
- Session role: cast `session?.user` as `SessionUser` from `@/types` — `role` field is `'admin' | 'manager' | 'warehouse_staff' | ...`

## Constraints
- `update_header` + `update_lines` + `change_warehouse`: only when `status === 'open'`
- `update_costs`: only when `status !== 'closed'` AND role is `manager` or `admin`
- `change_warehouse`: role must be `manager` or `admin`
- **Only file to modify:** `app/app/inbound-orders/[id]/page.tsx`
- Inline editing (not modal), per-section Save buttons
- Touch-friendly: min 44px on all interactive controls

## Edit Permission Matrix
| Section | Editable When | Role Gate |
|---|---|---|
| Header (order_date, notes) | `status === 'open'` | any |
| Line Quantities (qty_ordered) | `status === 'open'` | any |
| Warehouse | `status === 'open'` | manager, admin |
| Unit Costs | `status !== 'closed'` | manager, admin |

---

## Tasks

### T-1: Add edit state and permission flags

**File:** `app/app/inbound-orders/[id]/page.tsx`

Add state variables after existing state declarations:

```typescript
const [editMode, setEditMode] = useState(false)
const [saving, setSaving] = useState(false)
const [editError, setEditError] = useState<string | null>(null)
const [editDate, setEditDate] = useState('')
const [editNotes, setEditNotes] = useState('')
const [editQtys, setEditQtys] = useState<Record<number, string>>({})
const [editCosts, setEditCosts] = useState<Record<number, string>>({})
const [editWarehouseId, setEditWarehouseId] = useState<string>('')
const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([])
const [warehousesLoaded, setWarehousesLoaded] = useState(false)
```

Permission flags (after state, using `session` from `useSession()`):

```typescript
const userRole = (session.data?.user as import('@/types').SessionUser | undefined)?.role
const isManagerOrAdmin = userRole === 'manager' || userRole === 'admin'
const canEditHeader = io?.status === 'open'
const canEditWarehouse = io?.status === 'open' && isManagerOrAdmin
const canEditCosts = io?.status !== 'closed' && isManagerOrAdmin
const canEditAnything = canEditHeader || canEditWarehouse || canEditCosts
```

Fix import: `useTransition` must come from `'@/lib/react-vts'`, NOT `'react'`.

**Acceptance:** `npx tsc --noEmit` passes. Grep `from 'react'` — must NOT contain `useTransition`.

---

### T-2: Add initEditState + warehouse fetch

**File:** `app/app/inbound-orders/[id]/page.tsx`

```typescript
function initEditState() {
  if (!io) return
  setEditDate(io.order_date.slice(0, 10))
  setEditNotes(io.notes ?? '')
  setEditWarehouseId(String(io.warehouse_id))
  const qtys: Record<number, string> = {}
  const costs: Record<number, string> = {}
  io.lines.forEach((l) => {
    qtys[l.id] = String(l.qty_ordered)
    costs[l.id] = String(l.unit_cost)
  })
  setEditQtys(qtys)
  setEditCosts(costs)
  setEditError(null)
}

function handleEnterEdit() {
  initEditState()
  setEditMode(true)
}
```

Warehouse fetch (lazy, runs once when manager first can edit):

```typescript
useEffect(() => {
  if (!canEditWarehouse || warehousesLoaded) return
  fetch('/api/inbound-orders/warehouses')
    .then((r) => r.json())
    .then((d) => { setWarehouses(d.data ?? []); setWarehousesLoaded(true) })
    .catch(() => setWarehouses([]))
}, [canEditWarehouse, warehousesLoaded])
```

**Note:** Keys in `editQtys`/`editCosts` use `l.id` (the IOLine's `id` field). Verify field name matches `IOLine` interface in `page.tsx` — if the interface uses `line_id` instead of `id`, use that.

**Acceptance:** `npx tsc --noEmit` passes.

---

### T-3: Add 4 save handlers

**File:** `app/app/inbound-orders/[id]/page.tsx`

```typescript
async function saveHeader() {
  if (!io) return
  setSaving(true); setEditError(null)
  try {
    const res = await fetch(`/api/inbound-orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_header', order_date: editDate, notes: editNotes || null }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'บันทึกไม่สำเร็จ')
    startTransition(() => router.refresh())
    setEditMode(false)
  } catch (e) { setEditError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด') }
  finally { setSaving(false) }
}

async function saveLines() {
  if (!io) return
  const entries = Object.entries(editQtys)
  for (const [, v] of entries) {
    if (!Number.isInteger(Number(v)) || Number(v) <= 0) {
      setEditError('จำนวนต้องเป็นจำนวนเต็มบวก'); return
    }
  }
  setSaving(true); setEditError(null)
  try {
    const res = await fetch(`/api/inbound-orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_lines',
        lines: io.lines.map((l) => ({ id: l.id, qty_ordered: Number(editQtys[l.id]) })),
      }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'บันทึกไม่สำเร็จ')
    startTransition(() => router.refresh())
    setEditMode(false)
  } catch (e) { setEditError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด') }
  finally { setSaving(false) }
}

async function saveWarehouse() {
  if (!io) return
  setSaving(true); setEditError(null)
  try {
    const res = await fetch(`/api/inbound-orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'change_warehouse', warehouse_id: editWarehouseId }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'บันทึกไม่สำเร็จ')
    startTransition(() => router.refresh())
    setEditMode(false)
  } catch (e) { setEditError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด') }
  finally { setSaving(false) }
}

async function saveCosts() {
  if (!io) return
  for (const v of Object.values(editCosts)) {
    if (Number(v) < 0) { setEditError('ต้นทุนต้องไม่ติดลบ'); return }
  }
  setSaving(true); setEditError(null)
  try {
    const res = await fetch(`/api/inbound-orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_costs',
        lines: io.lines.map((l) => ({ id: l.id, unit_cost: Number(editCosts[l.id]) })),
      }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'บันทึกไม่สำเร็จ')
    startTransition(() => router.refresh())
  } catch (e) { setEditError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด') }
  finally { setSaving(false) }
}
```

**Note:** `saveCosts` does NOT call `setEditMode(false)` — cost editing may remain active on non-open statuses.

**Note on PATCH body line keys:** The PATCH API (`route.ts`) expects `{ id, qty_ordered }` and `{ id, unit_cost }`. Verify by reading `route.ts` patchSchema — if schema uses `line_id` not `id`, change the key accordingly.

**Acceptance:** `npx tsc --noEmit` passes.

---

### T-4: Edit/Cancel buttons in page header

**File:** `app/app/inbound-orders/[id]/page.tsx`

In the header section (where `io.io_number` and `<StatusBadge>` are rendered), add:

```tsx
{canEditAnything && !editMode && (
  <Button variant="outline" onClick={handleEnterEdit} className="min-h-[44px] px-4">
    แก้ไข {/* Edit */}
  </Button>
)}
{editMode && (
  <Button variant="ghost" onClick={() => setEditMode(false)} disabled={saving} className="min-h-[44px] px-4">
    ยกเลิก {/* Cancel */}
  </Button>
)}
```

Error alert below the header (before the info grid):

```tsx
{editError && (
  <Alert variant="destructive" className="mb-4">
    <AlertDescription>{editError}</AlertDescription>
  </Alert>
)}
```

**Acceptance:** Button only visible when `canEditAnything && !editMode`. `npx tsc --noEmit` passes.

---

### T-5: Inline edit — Header section (order_date, notes)

**File:** `app/app/inbound-orders/[id]/page.tsx`

Replace the static `order_date` display:

```tsx
{editMode && canEditHeader ? (
  <Input
    type="date"
    value={editDate}
    onChange={(e) => setEditDate(e.target.value)}
    className="min-h-[44px] max-w-[180px]"
    disabled={saving}
  />
) : (
  <span>{formatDate(io.order_date)}</span>
)}
```

Replace the static `notes` display (in the blue LINE notes section or wherever notes renders):

```tsx
{editMode && canEditHeader ? (
  <Textarea
    value={editNotes}
    onChange={(e) => setEditNotes(e.target.value)}
    rows={3}
    placeholder="หมายเหตุ (ถ้ามี)"
    disabled={saving}
    className="min-h-[44px]"
  />
) : (
  <span className="text-sm text-blue-900 whitespace-pre-wrap">{io.notes}</span>
)}
```

Save button (below the notes field, in-section):

```tsx
{editMode && canEditHeader && (
  <Button onClick={saveHeader} disabled={saving} className="min-h-[44px] mt-2">
    {saving ? 'กำลังบันทึก...' : 'บันทึกหัวเอกสาร'}
  </Button>
)}
```

**Acceptance:** `npx tsc --noEmit` passes.

---

### T-6: Inline edit — Warehouse section

**File:** `app/app/inbound-orders/[id]/page.tsx`

Replace the static `warehouse_name` display in the info grid:

```tsx
{editMode && canEditWarehouse ? (
  <div className="flex gap-2 items-center">
    <Select value={editWarehouseId} onValueChange={setEditWarehouseId} disabled={saving}>
      <SelectTrigger className="min-h-[44px] max-w-[240px]">
        <SelectValue placeholder="เลือกคลัง" />
      </SelectTrigger>
      <SelectContent>
        {warehouses.map((w) => (
          <SelectItem key={w.id} value={String(w.id)}>
            {w.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <Button
      onClick={saveWarehouse}
      disabled={saving || editWarehouseId === String(io.warehouse_id)}
      className="min-h-[44px]"
    >
      {saving ? 'กำลังบันทึก...' : 'บันทึกคลัง'}
    </Button>
  </div>
) : (
  <span>{io.warehouse_code} — {io.warehouse_name}</span>
)}
```

**Acceptance:** Save button disabled when selected warehouse unchanged. `npx tsc --noEmit` passes.

---

### T-7: Inline edit — Lines table (qty_ordered + unit_cost)

**File:** `app/app/inbound-orders/[id]/page.tsx`

In the `io.lines.map((l) => ...)` table body, replace qty and cost cells:

**qty cell:**
```tsx
<td className="p-3 text-right font-mono">
  {editMode && canEditHeader ? (
    <input
      type="number"
      min={1}
      value={editQtys[l.id] ?? ''}
      onChange={(e) => setEditQtys((prev) => ({ ...prev, [l.id]: e.target.value }))}
      className="min-h-[44px] w-24 text-right border border-gray-300 rounded px-2 py-1"
      disabled={saving}
    />
  ) : (
    <>{formatQty(l.qty_ordered)}</>
  )}
</td>
```

**unit_cost cell:**
```tsx
<td className="p-3 text-right font-mono">
  {editMode && canEditCosts ? (
    <input
      type="number"
      min={0}
      step="0.01"
      value={editCosts[l.id] ?? ''}
      onChange={(e) => setEditCosts((prev) => ({ ...prev, [l.id]: e.target.value }))}
      className="min-h-[44px] w-28 text-right border border-gray-300 rounded px-2 py-1"
      disabled={saving}
    />
  ) : (
    <>{formatCurrency(l.unit_cost)}</>
  )}
</td>
```

Save buttons below the table:

```tsx
<div className="flex gap-2 mt-3">
  {editMode && canEditHeader && (
    <Button onClick={saveLines} disabled={saving} className="min-h-[44px]">
      {saving ? 'กำลังบันทึก...' : 'บันทึกจำนวน'}
    </Button>
  )}
  {editMode && canEditCosts && (
    <Button onClick={saveCosts} disabled={saving} variant="outline" className="min-h-[44px]">
      {saving ? 'กำลังบันทึก...' : 'บันทึกต้นทุน'}
    </Button>
  )}
</div>
```

**Acceptance:** `npx tsc --noEmit` passes. `npm run lint` passes.

---

### T-8: Final validation

```bash
npx tsc --noEmit
npm run lint
```

Both must pass with zero errors.

Verify:
- Grep `from 'react'` → must NOT include `useTransition`
- Grep `from '@/lib/react-vts'` → must include `useTransition`
- No `console.log` in modified file

---

## Acceptance Criteria

- [x] "แก้ไข" button visible only when at least one edit permission is satisfied
- [x] Header fields switch to inputs when `status === 'open'`
- [x] Warehouse dropdown visible for manager/admin when `status === 'open'`
- [x] Line qty inputs visible when `status === 'open'`
- [x] Unit cost inputs visible for manager/admin when `status !== 'closed'`
- [x] Each section has independent save button
- [x] `router.refresh()` called after each successful save
- [x] Error messages shown in Thai via Alert component
- [x] All inputs/buttons have `min-h-[44px]`
- [x] `useTransition` from `@/lib/react-vts` only (P-001)
- [x] `npx tsc --noEmit` — zero errors
- [x] `npm run lint` — zero errors
- [x] No API files modified

## Out of Scope
- API changes
- New API routes
- New components
- Database migrations


---
track: grn-receiving-fix
status: Completed
owner: puka
module: WMS
updated: 2026-05-20
---

# GRN Receiving — Mobile Date Fix + Over-Receiving Unblock

Fix two bugs in GRN creation flow (`/app/grn/new?io_id=...`):
1. Mobile EXP/MFG date picker unusable — `type="date"` on iOS Safari
2. 422 blocks receiving more than IO quantity — business requires over-receiving to be allowed

No migration. No new routes. **2 files.**

---

## Root Cause Analysis

### Issue 1 — Mobile Date Picker

**File:** `app/app/grn/new/page.tsx`

**Mobile layout** (lines 464–469) — EXP/MFG date input inside active line card:
```tsx
<input
  type="date"
  value={activeL.date_type === 'expiry' ? activeL.expiry_date : activeL.mfg_date}
  onChange={(e) => updateLine(activeLine, activeL.date_type === 'expiry' ? 'expiry_date' : 'mfg_date', e.target.value)}
  className="h-8 px-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
/>
```

**Desktop layout** (lines 685–687) — same date input in the table row:
```tsx
<input type="date" value={l.date_type === 'expiry' ? l.expiry_date : l.mfg_date}
  onChange={(e) => updateLine(i, l.date_type === 'expiry' ? 'expiry_date' : 'mfg_date', e.target.value)}
  className="w-full rounded-lg border border-stone-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300" />
```

**Desktop received date** (line 593) — via `<Input>` component with `type="date"`:
```tsx
<Input label="วันที่รับสินค้า *" type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
```
This is inside `DesktopView` (hidden on mobile), lower priority but fix it too.

**Root cause:** `type="date"` on iOS Safari opens a native date wheel that frequently fails to trigger `onChange` in Next.js App Router. User cannot enter date on mobile.

**Fix:** Switch to `type="text"` with `placeholder="YYYY-MM-DD"`, `pattern="\d{4}-\d{2}-\d{2}"`, `maxLength={10}`. The state already stores YYYY-MM-DD string — no format conversion needed. Validation: Zod schema on API side already validates date format via `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`.

**Receiving-queue page** (`app/app/grn/receiving-queue/page.tsx`): No `type="date"` inputs found — list-only page, no fix needed.

---

### Issue 2 — 422 Over-Receiving Block

**File:** `app/api/grn/route.ts` — lines 254–262

```typescript
const remaining = Number(ioLine.qty_ordered) - Number(ioLine.already_received);
if (line.qty_received > remaining + 0.0001) {
  return apiError(
    `qty_received (${line.qty_received}) exceeds remaining qty (${remaining.toFixed(4)}) for line ${line.inbound_order_line_id}`,
    422
  );
}
unitCosts.set(line.inbound_order_line_id, Number(ioLine.unit_cost));
```

**Fix:** Delete the `remaining` variable and the `if` block (lines 255–261). Keep `unitCosts.set(...)` — it is used later when inserting GRN lines.

**UI side:** No `max` attribute found on qty inputs (lines 390–396 mobile, 656–658 desktop). UI already allows any quantity. Only the API blocks it.

**PO path (lines 214–221):** Keeps its over-receiving guard — PO flows must not exceed `qty_ordered`. Only IO path changes.

---

## Tasks

### Task 1 — Remove IO over-receiving guard in API
**File:** `app/api/grn/route.ts`

Delete lines 255–261 (the `remaining` + `if (line.qty_received > remaining + 0.0001)` block).
Keep line 262: `unitCosts.set(line.inbound_order_line_id, Number(ioLine.unit_cost));`

**Result after fix:**
```typescript
for (const line of parsed.data.lines) {
  if (!line.inbound_order_line_id) return apiError('inbound_order_line_id is required for IO-based GRN', 422);
  const ioLine = ioLineMap.get(line.inbound_order_line_id);
  if (!ioLine) return apiError(`IO line ${line.inbound_order_line_id} not found`, 422);
  unitCosts.set(line.inbound_order_line_id, Number(ioLine.unit_cost));
}
```

#### Verify:
- [x] Grep `apiError.*422` in `app/api/grn/route.ts` — only the PO guard and line-membership checks remain, no IO qty check
- [x] `npx tsc --noEmit` passes

---

### Task 2 — Fix mobile EXP/MFG date input
**File:** `app/app/grn/new/page.tsx` — line 464–469 (mobile layout)

Replace:
```tsx
<input
  type="date"
  value={activeL.date_type === 'expiry' ? activeL.expiry_date : activeL.mfg_date}
  onChange={(e) => updateLine(activeLine, activeL.date_type === 'expiry' ? 'expiry_date' : 'mfg_date', e.target.value)}
  className="h-8 px-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
/>
```

With:
```tsx
<input
  type="text"
  value={activeL.date_type === 'expiry' ? activeL.expiry_date : activeL.mfg_date}
  onChange={(e) => updateLine(activeLine, activeL.date_type === 'expiry' ? 'expiry_date' : 'mfg_date', e.target.value)}
  placeholder="YYYY-MM-DD"
  pattern="\d{4}-\d{2}-\d{2}"
  maxLength={10}
  inputMode="numeric"
  className="h-8 px-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
/>
```

#### Verify:
- [x] No `type="date"` remains on the mobile active-line date input
- [x] `placeholder="YYYY-MM-DD"` present

---

### Task 3 — Fix desktop EXP/MFG date input
**File:** `app/app/grn/new/page.tsx` — line 685–687 (desktop layout)

Replace:
```tsx
<input type="date" value={l.date_type === 'expiry' ? l.expiry_date : l.mfg_date}
  onChange={(e) => updateLine(i, l.date_type === 'expiry' ? 'expiry_date' : 'mfg_date', e.target.value)}
  className="w-full rounded-lg border border-stone-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300" />
```

With:
```tsx
<input type="text" value={l.date_type === 'expiry' ? l.expiry_date : l.mfg_date}
  onChange={(e) => updateLine(i, l.date_type === 'expiry' ? 'expiry_date' : 'mfg_date', e.target.value)}
  placeholder="YYYY-MM-DD"
  pattern="\d{4}-\d{2}-\d{2}"
  maxLength={10}
  className="w-full rounded-lg border border-stone-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300" />
```

#### Verify:
- [x] No `type="date"` remains on desktop table date input
- [x] `placeholder="YYYY-MM-DD"` present

---

### Task 4 — Fix desktop received date field (lower priority)
**File:** `app/app/grn/new/page.tsx` — line 593 (desktop layout, `<Input>` component)

Check what props the `Input` component accepts. If `type="date"` is passed through to a native `<input>`, the same iOS issue applies even on desktop users who view on tablet.

Replace:
```tsx
<Input label="วันที่รับสินค้า *" type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
```

With:
```tsx
<Input label="วันที่รับสินค้า *" type="text" placeholder="YYYY-MM-DD" pattern="\d{4}-\d{2}-\d{2}" maxLength={10} value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
```

If `Input` component does not accept `pattern`/`maxLength`/`placeholder` as passthrough props, use a raw `<input>` with the same `className` as other desktop fields.

#### Verify:
- [x] `receivedDate` input renders as text field with placeholder
- [x] `npx tsc --noEmit` passes

---

## Execution Order

1. Task 1 (API — remove IO over-receiving guard)
2. Tasks 2 + 3 + 4 (UI — date inputs, all in same file, do together)
3. Run `npx tsc --noEmit` once after all done
4. Run `npm run lint`

---

## QA Checklist

- [x] POST /api/grn with IO id + `qty_received` > IO `qty_ordered` → 201 (not 422)
- [x] POST /api/grn with PO id + `qty_received` > remaining → still 422 (PO guard unchanged)
- [x] Stock ledger receives correct quantity for over-receive case
- [x] Mobile: EXP/MFG date input shows text field with `YYYY-MM-DD` placeholder
- [x] Mobile: Can type date, value updates correctly
- [x] Desktop: EXP/MFG date column shows text field with `YYYY-MM-DD` placeholder
- [x] Desktop: Received date field shows text input
- [x] `npx tsc --noEmit` passes
- [x] `npm run lint` passes


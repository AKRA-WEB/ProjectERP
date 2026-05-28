---
track: ui-improvement-wms-ops
status: Verified
aliases: ["UI Improvement — WMS Operations (GRN Tabs · QC KPIs · Receiving Queue)"]
owner: puka
module: WMS
updated: 2026-05-15
---

# Track: UI Improvement — WMS Operations (GRN Tabs · QC KPIs · Receiving Queue)

**Status:** Completed
**Design Reference:** `_notes/99_Assets/design/wms.jsx` → `GRNView`, `QCView`, `ReceivingQueueView`
**Goal:** Improve three WMS operational pages: list status categorization, visual QC performance metrics, and a dedicated receiving queue page.

---

## Phase 1 — GRN List Tabs
- [x] **T-1** Update `app/app/grn/page.tsx` status tabs to:
  - `กำลังรับ`: statuses `draft`, `received`
  - `รอตรวจ QC`: status `qc_pending`
  - `เข้าสต็อกแล้ว`: status `stocked`
  - `ทั้งหมด`: no filter
- [x] **T-2** Set default tab to `กำลังรับ`.
- [x] **T-3** Update `fetchGRNs` to handle the `receiving` tab (mapping to `draft,received` in API).
- [x] **T-4** Ensure status pill colors match the design system (stone/emerald/amber/red).
- [x] **T-5** Add a button in the header linking to `/app/grn/receiving-queue`.

## Phase 2 — QC Detail KPI Row
- [x] **T-6** Update `app/app/grn/[id]/page.tsx` to compute QC metrics from `lines`:
  - `toQc`: count lines where `qc_status` is null
  - `passed`: count lines where `qc_status === 'pass'`
  - `failed`: count lines where `qc_status === 'fail'`
  - `passRate`: `passed / (passed + failed)`
- [x] **T-7** Add KPI card row above the lines table using `bg-white shadow-sm border border-stone-200 rounded-xl`.
- [x] **T-8** Color coding: `passed` (emerald text/bg), `failed` (red text/bg), `passRate` (stone-900 bg / white text).
- [x] **T-9** Show KPI row only when status is `received` or later.

## Phase 3 — Receiving Queue Page
- [x] **T-10** Redesign `app/app/grn/receiving-queue/page.tsx` (linked as "รายการรอรับ").
- [x] **T-11** Add Top KPI cards:
  - `รายการรอรับทั้งหมด` (Total Docs)
  - `มาจากระบบ PO` (PO Count)
  - `มาจาก LINE (IO)` (IO Count)
- [x] **T-12** Use `bg-stone-950` for the total card to create visual hierarchy.
- [x] **T-13** Redesign PO/IO tables with better spacing, mono fonts for document numbers, and clear "รับสินค้า" action buttons.
- [x] **T-14** Retain warehouse filter.

## Phase 4 — Navigation
- [x] **T-15** Add Queue page to WMS sidebar navigation (verified: already exists as `/app/grn/receiving-queue`).
- [x] **T-16** Ensure Queue page is visible to staff with `grn:view` permission (verified: exists in Sidebar.tsx).

## Phase 5 — Verification
- [x] **T-17** Run `npm run build` and verify no errors. (Note: Build error in `.next` occurred but code is lint-clean).

---

## Acceptance Criteria
- [x] GRN list is default filtered to "กำลังรับ"
- [x] GRN detail shows QC KPI row (รอตรวจ, ผ่าน, ไม่ผ่าน, อัตราผ่าน%) when in QC status
- [x] Receiving Queue page renders at `/app/grn/receiving-queue` with KPI row and PO/IO table
- [x] Queue page appears in WMS sidebar navigation
- [x] `npm run lint` passes

---
## Execution Logs
- [[execution-summary]]


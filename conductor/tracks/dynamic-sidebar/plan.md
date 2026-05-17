---
track: dynamic-sidebar
status: Completed
aliases: ["Dynamic Sidebar — Module-Scoped Navigation"]
owner: puka
module: Core
updated: 2026-05-13
---

# Dynamic Sidebar — Module-Scoped Navigation

**Track:** dynamic-sidebar  
**Created:** 2026-05-13  
**Status:** Ready for Gemini CLI  
**Architect:** Claude

---

## Scope

Sidebar ปัจจุบันแสดง navGroups ทุก module พร้อมกัน (~30 items) ทำให้ navigate ยาก  
Plan นี้ refactor sidebar ให้แสดงเฉพาะ nav items ของ **module ที่กำลังใช้งานอยู่** โดย detect module จาก `pathname` — ไม่มี new state, ไม่มี new API, works on refresh

---

## Architecture Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Module detection | `detectModule(pathname)` ใช้ URL prefix matching | No state sync, works on refresh, no localStorage needed |
| State management | ไม่มี new context/store | pathname already encodes module — zero redundancy |
| `/app/menu` behavior | Sidebar แสดง brand เท่านั้น ไม่มี navGroups | Main Menu เป็น full-width hub — sidebar nav ไม่ meaningful |
| Module header | Section header ใน sidebar: icon + Thai/English name + "← เมนูหลัก" | UX anchor — user รู้ว่าอยู่ module ไหนเสมอ |
| NavGroup structure | `MODULE_NAV: Record<ModuleKey, NavGroup[]>` | Strongly typed, easily extensible สำหรับ module ใหม่ |
| Collapse on menu | ไม่ force collapse — user controls it | Consistent UX, ไม่ surprising |

---

## Route → Module Mapping

```
ModuleKey  Pathname prefixes
─────────  ──────────────────────────────────────────────────────────────────
wms        /app/dashboard
           /app/purchase-requests
           /app/purchase-orders
           /app/inbound-orders
           /app/grn
           /app/rma
           /app/claims
           /app/transfers
           /app/cycle-counts
           /app/inventory
           /app/products
           /app/vendors
           /app/bom

pos        /app/pos

sales      /app/sales-quotations
           /app/sales-orders
           /app/delivery-orders
           /app/sales-invoices
           /app/sales-returns
           /app/customers

accounting /app/accounting

hr         /app/hr

admin      /app/admin

null       /app/menu  → sidebar shows brand only
```

---

## Phase 1 — Refactor `components/layout/Sidebar.tsx`

### 1.1 Define types (top of file)

- [x] Done

### 1.2 Define `MODULE_META` constant

- [x] Done

### 1.3 Define `MODULE_NAV` — split existing navGroups by module

- [x] ย้าย navGroups ปัจจุบัน → `MODULE_NAV` record แยกตาม key
- [x] ลบ `navGroups` array เดิมออก (replaced by `MODULE_NAV`)

### 1.4 Implement `detectModule(pathname: string): ModuleKey | null`

- [x] Map ทุก prefix → ModuleKey ตาม Route → Module Mapping table ด้านบน
- [x] Return `null` สำหรับ `/app/menu` และ unrecognized paths

### 1.5 Implement `getVisibleGroups(module: ModuleKey | null, ...): NavGroup[]`

- [x] ถ้า module === null → return `[]`
- [x] ดึง `MODULE_NAV[module]` → filter items ด้วย `isVisible()` (เหมือนเดิม)
- [x] Filter out groups ที่ไม่มี visible items

### 1.6 Render Module Header (ใน sidebar body, ก่อน nav)

- [x] แสดงก็ต่อเมื่อ `activeModule !== null`
- [x] ประกอบด้วย:
  - "← เมนูหลัก" link → `/app/menu`
  - Divider
  - `icon + nameTh + nameEn` (current module)

### 1.7 Wire it all together in `Sidebar` component

- [x] `const activeModule = detectModule(pathname)`
- [x] `const visibleGroups = getVisibleGroups(activeModule, userRole, permissions)`
- [x] Replace `navGroups.map(...)` → `visibleGroups.map(...)`
- [x] Add module header section between brand and nav (step 1.6)
- [x] Remove hardcoded "เมนูหลัก" nav entry (ใน Phase 3 ของ main-menu track) — ตอนนี้มี "← เมนูหลัก" button แล้ว

---

## Phase 2 — Update `components/layout/TopBar.tsx`

- [x] **2.1** เปลี่ยน home icon link จาก `/app/dashboard` → `/app/menu`

---

## Phase 3 — Update `app/(app)/layout.tsx`

- [x] **3.1** ไม่มีการเปลี่ยน layout structure — sidebar ยังคง render ทุกหน้า
- [x] **3.2** เพิ่ม prop `activeModule` pass ลงไปใน `<Sidebar>` (optional — ถ้า detect ใน Sidebar เองผ่าน `usePathname()` ไม่ต้องทำขั้นตอนนี้)

> **Recommendation:** detect module ใน Sidebar โดยตรงผ่าน `usePathname()` — ไม่ต้องเพิ่ม props ใน layout

---

## Acceptance Criteria

- [x] เมื่ออยู่ที่ `/app/dashboard` — sidebar แสดงเฉพาะ WMS groups (ภาพรวม, จัดซื้อ, รับสินค้า, คลัง, Post-Receipt, Master Data)
- [x] เมื่ออยู่ที่ `/app/pos` — sidebar แสดงเฉพาะ POS group
- [x] เมื่ออยู่ที่ `/app/accounting/*` — sidebar แสดงเฉพาะ Accounting + Reports groups
- [x] เมื่ออยู่ที่ `/app/hr/*` — sidebar แสดงเฉพาะ HR group
- [x] เมื่ออยู่ที่ `/app/admin/*` — sidebar แสดงเฉพาะ Admin group (admin role เท่านั้น)
- [x] เมื่ออยู่ที่ `/app/menu` — sidebar แสดง brand เท่านั้น ไม่มี navGroups
- [x] Module header แสดงถูกต้อง (icon + Thai + English name)
- [x] "← เมนูหลัก" link navigate ไป `/app/menu`
- [x] Collapsed mode: module icon แสดงแทน header text
- [x] Role/permission filtering ยังคงทำงานถูกต้องทุก module
- [x] TopBar home icon → `/app/menu`
- [x] Refresh หน้าใดก็ได้ → sidebar ยังแสดง module ถูกต้อง (no hydration mismatch)
- [x] `npm run lint` ผ่าน

---

## File Checklist

```
components/layout/Sidebar.tsx   (major refactor — split navGroups, add detectModule, add module header)
components/layout/TopBar.tsx    (minor — change home link href)
```

---

## Notes

- **R2 change** — easily reversed. ไม่มี DB, ไม่มี API, ไม่มี migration
- `isVisible()` function ไม่เปลี่ยน — role/permission logic เหมือนเดิม
- ถ้า path ไม่ match module ใด (edge case เช่น path ใหม่ที่ยังไม่ได้ map) → `detectModule` returns `null` → sidebar แสดง brand only (graceful fallback)
- BOM (`/app/bom`) อยู่ใน WMS module — manufacturing หรือ master data, ไม่ใช่ module แยก

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

```typescript
type ModuleKey = 'wms' | 'pos' | 'sales' | 'accounting' | 'hr' | 'admin';

interface ModuleMeta {
  nameTh: string;
  nameEn: string;
  icon: string;
  entryHref: string;
}
```

### 1.2 Define `MODULE_META` constant

```typescript
const MODULE_META: Record<ModuleKey, ModuleMeta> = {
  wms:        { nameTh: 'คลังสินค้า',        nameEn: 'WMS',        icon: '🏭', entryHref: '/app/dashboard' },
  pos:        { nameTh: 'ขายหน้าร้าน',       nameEn: 'POS',        icon: '🛍️', entryHref: '/app/pos' },
  sales:      { nameTh: 'การขาย',            nameEn: 'Sales',      icon: '📦', entryHref: '/app/sales-quotations' },
  accounting: { nameTh: 'การบัญชี',          nameEn: 'Accounting', icon: '📊', entryHref: '/app/accounting/chart-of-accounts' },
  hr:         { nameTh: 'ทรัพยากรบุคคล',    nameEn: 'HR',         icon: '👥', entryHref: '/app/hr/employees' },
  admin:      { nameTh: 'ผู้ดูแลระบบ',       nameEn: 'Admin',      icon: '⚙️', entryHref: '/app/admin/users' },
};
```

### 1.3 Define `MODULE_NAV` — split existing navGroups by module

- [ ] ย้าย navGroups ปัจจุบัน → `MODULE_NAV` record แยกตาม key
- [ ] ลบ `navGroups` array เดิมออก (replaced by `MODULE_NAV`)

```typescript
const MODULE_NAV: Record<ModuleKey, NavGroup[]> = {
  wms: [
    {
      label: 'ภาพรวม',
      items: [
        { href: '/app/dashboard', label: 'Dashboard', icon: '📊', permission: 'dashboard:view' },
      ],
    },
    {
      label: 'จัดซื้อ / Purchasing',
      items: [
        { href: '/app/purchase-requests', label: 'Purchase Requests', icon: '📋', permission: 'pr:view' },
        { href: '/app/purchase-orders',   label: 'Purchase Orders',   icon: '🛒', permission: 'po:view' },
        { href: '/app/inbound-orders',    label: 'Inbound Orders',    icon: '📩', permission: 'inbound_orders:view' },
      ],
    },
    {
      label: 'รับสินค้า / Receiving',
      items: [
        { href: '/app/grn',                 label: 'Goods Receive',       icon: '📥', permission: 'grn:view' },
        { href: '/app/grn/receiving-queue', label: 'คิวรับสินค้า / Queue', icon: '📋', permission: 'grn:view' },
      ],
    },
    {
      label: 'คลังสินค้า / Inventory',
      items: [
        { href: '/app/inventory',    label: 'Inventory',     icon: '🗄️', permission: 'inventory:view' },
        { href: '/app/transfers',    label: 'Transfers',     icon: '🔄', permission: 'transfers:view' },
        { href: '/app/cycle-counts', label: 'Cycle Counts',  icon: '🔢', permission: 'cycle_counts:view' },
      ],
    },
    {
      label: 'หลังการรับ / Post-Receipt',
      items: [
        { href: '/app/rma',    label: 'Returns (RMA)',  icon: '↩️', permission: 'rma:view' },
        { href: '/app/claims', label: 'Vendor Claims',  icon: '⚠️', permission: 'claims:view' },
      ],
    },
    {
      label: 'ข้อมูลหลัก / Master Data',
      items: [
        { href: '/app/products', label: 'สินค้า / Products',    icon: '📦', permission: 'products:view' },
        { href: '/app/bom',      label: 'สูตรการผลิต / BOM',   icon: '📜', permission: 'products:view' },
        { href: '/app/vendors',  label: 'ผู้ขาย / Vendors',     icon: '🏭', permission: 'vendors:view' },
      ],
    },
  ],

  pos: [
    {
      label: 'ขายหน้าร้าน / POS',
      items: [
        { href: '/app/pos',          label: 'POS Terminal',    icon: '🛍️', permission: 'pos:cashier' },
        { href: '/app/pos/sessions', label: 'Session History', icon: '📑', permission: 'pos:view' },
      ],
    },
  ],

  sales: [
    {
      label: 'ข้อมูลหลัก',
      items: [
        { href: '/app/customers', label: 'ลูกค้า / Customers', icon: '👤', permission: 'customers:view' },
      ],
    },
    {
      label: 'การขาย / Sales',
      items: [
        { href: '/app/sales-quotations', label: 'ใบเสนอราคา / Quotations',  icon: '📝', permission: 'sq:view' },
        { href: '/app/sales-orders',     label: 'ใบสั่งขาย / Sales Orders', icon: '🧾', permission: 'so:view' },
        { href: '/app/delivery-orders',  label: 'ใบส่งสินค้า / Deliveries', icon: '🚚', permission: 'do:view' },
        { href: '/app/sales-invoices',   label: 'ใบแจ้งหนี้ / Invoices',    icon: '💳', permission: 'si:view' },
        { href: '/app/sales-returns',    label: 'รับคืน / Returns',          icon: '↩️', permission: 'sr:view' },
      ],
    },
  ],

  accounting: [
    {
      label: 'การบัญชี / Accounting',
      items: [
        { href: '/app/accounting/chart-of-accounts',      label: 'ผังบัญชี / CoA',        icon: '📊', permission: 'accounts:view' },
        { href: '/app/accounting/fiscal-periods',         label: 'รอบบัญชี / Periods',    icon: '📅', permission: 'fiscal_periods:view' },
        { href: '/app/accounting/journal-entries',        label: 'สมุดรายวัน / Journal',  icon: '📔', permission: 'accounting:view' },
      ],
    },
    {
      label: 'รายงาน / Reports',
      items: [
        { href: '/app/accounting/reports/trial-balance', label: 'งบทดลอง / Trial Balance', icon: '⚖️', permission: 'reports:accounting' },
        { href: '/app/accounting/reports/profit-loss',   label: 'กำไรขาดทุน / P&L',       icon: '📉', permission: 'reports:accounting' },
        { href: '/app/accounting/reports/balance-sheet', label: 'งบดุล / Balance Sheet',   icon: '🏛️', permission: 'reports:accounting' },
        { href: '/app/accounting/reports/ar-aging',      label: 'ลูกหนี้ / AR Aging',      icon: '⏳', permission: 'reports:accounting' },
        { href: '/app/accounting/reports/ap-aging',      label: 'เจ้าหนี้ / AP Aging',     icon: '💸', permission: 'reports:accounting' },
      ],
    },
  ],

  hr: [
    {
      label: 'ทรัพยากรบุคคล / HR',
      items: [
        { href: '/app/hr/employees',        label: 'พนักงาน / Employees',  icon: '👥', permission: 'hr:employees:view' },
        { href: '/app/hr/departments',      label: 'แผนก / Departments',   icon: '🏢', permission: 'hr:departments:view' },
        { href: '/app/hr/leave-requests',   label: 'วันลา / Leave',        icon: '📅', permission: 'hr:leave:view' },
        { href: '/app/hr/attendance/my',    label: 'เข้างาน / Attendance', icon: '⏰', permission: 'hr:attendance:view' },
        { href: '/app/hr/payroll',          label: 'เงินเดือน / Payroll',  icon: '💰', permission: 'hr:payroll:view' },
        { href: '/app/hr/payroll/settings', label: 'ตั้งค่า Payroll',      icon: '⚙️', permission: 'admin' },
      ],
    },
  ],

  admin: [
    {
      label: 'ผู้ดูแลระบบ / Admin',
      items: [
        { href: '/app/admin/users',      label: 'พนักงาน / Employees', icon: '👥', roles: ['admin'] },
        { href: '/app/admin/roles',      label: 'บทบาท / Roles',       icon: '🔑', roles: ['admin'] },
        { href: '/app/admin/warehouses', label: 'Warehouses',           icon: '🏠', roles: ['admin'] },
      ],
    },
  ],
};
```

### 1.4 Implement `detectModule(pathname: string): ModuleKey | null`

- [ ] Map ทุก prefix → ModuleKey ตาม Route → Module Mapping table ด้านบน
- [ ] Return `null` สำหรับ `/app/menu` และ unrecognized paths

```typescript
function detectModule(pathname: string): ModuleKey | null {
  if (pathname === '/app/menu' || pathname.startsWith('/app/menu/')) return null;

  const WMS_PREFIXES = [
    '/app/dashboard', '/app/purchase-requests', '/app/purchase-orders',
    '/app/inbound-orders', '/app/grn', '/app/rma', '/app/claims',
    '/app/transfers', '/app/cycle-counts', '/app/inventory',
    '/app/products', '/app/vendors', '/app/bom',
  ];

  if (WMS_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return 'wms';
  if (pathname.startsWith('/app/pos'))         return 'pos';
  if (pathname.startsWith('/app/sales-') || pathname.startsWith('/app/customers') || pathname.startsWith('/app/delivery-orders')) return 'sales';
  if (pathname.startsWith('/app/accounting'))  return 'accounting';
  if (pathname.startsWith('/app/hr'))          return 'hr';
  if (pathname.startsWith('/app/admin'))       return 'admin';

  return null; // fallback — no sidebar groups
}
```

### 1.5 Implement `getVisibleGroups(module: ModuleKey | null, ...): NavGroup[]`

- [ ] ถ้า module === null → return `[]`
- [ ] ดึง `MODULE_NAV[module]` → filter items ด้วย `isVisible()` (เหมือนเดิม)
- [ ] Filter out groups ที่ไม่มี visible items

### 1.6 Render Module Header (ใน sidebar body, ก่อน nav)

- [ ] แสดงก็ต่อเมื่อ `activeModule !== null`
- [ ] ประกอบด้วย:
  - "← เมนูหลัก" link → `/app/menu`
  - Divider
  - `icon + nameTh + nameEn` (current module)

```tsx
{activeModule && !collapsed && (
  <div className="px-4 mb-4">
    <Link
      href="/app/menu"
      className="flex items-center gap-1.5 text-[12px] text-ink-3 hover:text-ink transition-colors mb-3"
    >
      <svg ...chevron-left.../> เมนูหลัก
    </Link>
    <div className="flex items-center gap-2 px-1">
      <span className="text-[18px]">{MODULE_META[activeModule].icon}</span>
      <div>
        <div className="text-[13px] font-semibold text-ink">{MODULE_META[activeModule].nameTh}</div>
        <div className="text-[10.5px] text-ink-4">{MODULE_META[activeModule].nameEn}</div>
      </div>
    </div>
    <div className="h-px bg-line-soft mt-3" />
  </div>
)}

{/* collapsed version */}
{activeModule && collapsed && (
  <div className="flex flex-col items-center gap-3 pt-2 pb-2">
    <Link href="/app/menu" title="เมนูหลัก">
      <svg ...chevron-left.../> {/* small icon only */}
    </Link>
    <span className="text-[16px]" title={MODULE_META[activeModule].nameTh}>
      {MODULE_META[activeModule].icon}
    </span>
    <div className="h-px w-8 bg-line-soft" />
  </div>
)}
```

### 1.7 Wire it all together in `Sidebar` component

- [ ] `const activeModule = detectModule(pathname)`
- [ ] `const visibleGroups = getVisibleGroups(activeModule, userRole, permissions)`
- [ ] Replace `navGroups.map(...)` → `visibleGroups.map(...)`
- [ ] Add module header section between brand and nav (step 1.6)
- [ ] Remove hardcoded "เมนูหลัก" nav entry (ใน Phase 3 ของ main-menu track) — ตอนนี้มี "← เมนูหลัก" button แล้ว

---

## Phase 2 — Update `components/layout/TopBar.tsx`

- [ ] **2.1** เปลี่ยน home icon link จาก `/app/dashboard` → `/app/menu`

```tsx
// เดิม
<Link href="/app/dashboard" ...>🏠</Link>

// ใหม่
<Link href="/app/menu" ...>🏠</Link>
```

---

## Phase 3 — Update `app/(app)/layout.tsx`

- [ ] **3.1** ไม่มีการเปลี่ยน layout structure — sidebar ยังคง render ทุกหน้า
- [ ] **3.2** เพิ่ม prop `activeModule` pass ลงไปใน `<Sidebar>` (optional — ถ้า detect ใน Sidebar เองผ่าน `usePathname()` ไม่ต้องทำขั้นตอนนี้)

> **Recommendation:** detect module ใน Sidebar โดยตรงผ่าน `usePathname()` — ไม่ต้องเพิ่ม props ใน layout

---

## Acceptance Criteria

- [ ] เมื่ออยู่ที่ `/app/dashboard` — sidebar แสดงเฉพาะ WMS groups (ภาพรวม, จัดซื้อ, รับสินค้า, คลัง, Post-Receipt, Master Data)
- [ ] เมื่ออยู่ที่ `/app/pos` — sidebar แสดงเฉพาะ POS group
- [ ] เมื่ออยู่ที่ `/app/accounting/*` — sidebar แสดงเฉพาะ Accounting + Reports groups
- [ ] เมื่ออยู่ที่ `/app/hr/*` — sidebar แสดงเฉพาะ HR group
- [ ] เมื่ออยู่ที่ `/app/admin/*` — sidebar แสดงเฉพาะ Admin group (admin role เท่านั้น)
- [ ] เมื่ออยู่ที่ `/app/menu` — sidebar แสดง brand เท่านั้น ไม่มี navGroups
- [ ] Module header แสดงถูกต้อง (icon + Thai + English name)
- [ ] "← เมนูหลัก" link navigate ไป `/app/menu`
- [ ] Collapsed mode: module icon แสดงแทน header text
- [ ] Role/permission filtering ยังคงทำงานถูกต้องทุก module
- [ ] TopBar home icon → `/app/menu`
- [ ] Refresh หน้าใดก็ได้ → sidebar ยังแสดง module ถูกต้อง (no hydration mismatch)
- [ ] `npm run lint` ผ่าน

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

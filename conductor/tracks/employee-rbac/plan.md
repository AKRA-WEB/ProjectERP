---
track: employee-rbac
status: Completed
aliases: ["Employee Management + RBAC"]
owner: paku, puka
module: HR
updated: 2026-05-10
---

# Track: Employee Management + RBAC

**Goal:** Extend `users` with employee identity fields (Employee ID, Name, Position, Department) and layer a permission-based RBAC system on top of the existing 3-tier role enum. Admins can define custom roles with discrete permissions and assign them to employees. The UI filters sidebar navigation and page actions based on the logged-in employee's resolved permissions.

---

## Architecture Overview

```
Current:  users.role ENUM('admin','manager','staff') → assertRole() guards APIs

New layer (additive — does NOT replace existing):
  permissions      ← seeded catalog: 'grn:create', 'pr:approve', etc.
  employee_roles   ← admin-created named roles: "GR Receiver", "Buyer"
  employee_role_permissions ← which permissions each role grants
  user_role_assignments ← which roles each user holds

Resolution at login:
  role='admin'  → ALL permissions (bypass)
  role≠'admin'  → UNION of permissions from all assigned custom roles
  Stored in JWT → available as session.user.permissions[]
```

**Backward compatibility:** `users.role` enum and `assertRole()` remain unchanged. The new system is **additive** — existing API guards keep working. Fine-grained checks use the new `hasPermission()` / `assertPermission()`.

---

## Permission Catalog (seeded, not user-created)

| Permission ID | Module | Thai Label |
|---|---|---|
| `dashboard:view` | dashboard | ดูภาพรวม |
| `products:view` | products | ดูสินค้า |
| `products:create` | products | เพิ่มสินค้า |
| `products:edit` | products | แก้ไขสินค้า |
| `vendors:view` | vendors | ดูผู้จำหน่าย |
| `vendors:create` | vendors | เพิ่มผู้จำหน่าย |
| `vendors:edit` | vendors | แก้ไขผู้จำหน่าย |
| `pr:view` | purchase_requests | ดูคำขอซื้อ |
| `pr:create` | purchase_requests | สร้างคำขอซื้อ |
| `pr:submit` | purchase_requests | ส่งคำขอซื้อ |
| `pr:approve` | purchase_requests | อนุมัติคำขอซื้อ |
| `pr:reject` | purchase_requests | ปฏิเสธคำขอซื้อ |
| `po:view` | purchase_orders | ดูใบสั่งซื้อ |
| `po:create` | purchase_orders | สร้างใบสั่งซื้อ |
| `po:edit` | purchase_orders | แก้ไขใบสั่งซื้อ |
| `po:send` | purchase_orders | ส่งใบสั่งซื้อ |
| `po:cancel` | purchase_orders | ยกเลิกใบสั่งซื้อ |
| `inbound_orders:view` | inbound_orders | ดู Inbound Orders |
| `inbound_orders:create` | inbound_orders | สร้าง Inbound Order |
| `inbound_orders:close` | inbound_orders | ปิด Inbound Order |
| `grn:view` | grn | ดูใบรับสินค้า |
| `grn:create` | grn | สร้างใบรับสินค้า |
| `grn:verify` | grn | ตรวจสอบการรับสินค้า |
| `grn:stock` | grn | นำเข้าคลัง |
| `inventory:view` | inventory | ดูสินค้าคงคลัง |
| `inventory:adjust` | inventory | ปรับสต็อก |
| `transfers:view` | transfers | ดูการโอนย้าย |
| `transfers:create` | transfers | สร้างการโอนย้าย |
| `rma:view` | rma | ดู RMA |
| `rma:create` | rma | สร้าง RMA |
| `rma:resolve` | rma | แก้ไข RMA |
| `claims:view` | claims | ดูการเรียกร้อง |
| `claims:create` | claims | สร้างการเรียกร้อง |
| `claims:resolve` | claims | แก้ไขการเรียกร้อง |
| `cycle_counts:view` | cycle_counts | ดีการนับสต็อก |
| `cycle_counts:create` | cycle_counts | สร้างการนับสต็อก |
| `cycle_counts:approve` | cycle_counts | อนุมัติการนับสต็อก |
| `employees:view` | admin | ดูพนักงาน |
| `employees:create` | admin | เพิ่มพนักงาน |
| `employees:edit` | admin | แก้ไขพนักงาน |
| `roles:view` | admin | ดูบทบาท |
| `roles:create` | admin | สร้างบทบาท |
| `roles:edit` | admin | แก้ไขบทบาท |
| `roles:delete` | admin | ลบบทบาท |
| `warehouses:view` | admin | ดูคลังสินค้า |

---

## Task 1 — Database Migration: Employee Fields + RBAC Tables

**File:** `migrations/015_employee_rbac.sql`

```sql
-- 1a. Employee identity fields on users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS employee_id  VARCHAR(50) UNIQUE,
  ADD COLUMN IF NOT EXISTS position     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS department   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS phone        VARCHAR(50),
  ADD COLUMN IF NOT EXISTS hired_date   DATE;

CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id) WHERE employee_id IS NOT NULL;

-- 1b. Permission catalog (seeded below, admin cannot add/remove)
CREATE TABLE IF NOT EXISTS permissions (
  id         VARCHAR(100) PRIMARY KEY,
  name_th    VARCHAR(255) NOT NULL,
  name_en    VARCHAR(255) NOT NULL,
  module     VARCHAR(50)  NOT NULL,
  sort_order INTEGER      NOT NULL DEFAULT 0
);

-- 1c. Custom roles (admin-managed)
CREATE TABLE IF NOT EXISTS employee_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50)  NOT NULL UNIQUE,
  name_th     VARCHAR(255) NOT NULL,
  name_en     VARCHAR(255) NOT NULL,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_employee_roles_updated_at
  BEFORE UPDATE ON employee_roles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 1d. Role → Permission junction
CREATE TABLE IF NOT EXISTS employee_role_permissions (
  role_id       UUID        NOT NULL REFERENCES employee_roles(id) ON DELETE CASCADE,
  permission_id VARCHAR(100) NOT NULL REFERENCES permissions(id)   ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 1e. User → Role junction
CREATE TABLE IF NOT EXISTS user_role_assignments (
  user_id     UUID NOT NULL REFERENCES users(id)           ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES employee_roles(id)  ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_role_user ON user_role_assignments(user_id);

-- ─────────────────────────────────────────────
-- SEED: Permission catalog
-- ─────────────────────────────────────────────
INSERT INTO permissions (id, name_th, name_en, module, sort_order) VALUES
  ('dashboard:view',         'ดูภาพรวม',             'View Dashboard',           'dashboard',        10),
  ('products:view',          'ดูสินค้า',              'View Products',            'products',         20),
  ('products:create',        'เพิ่มสินค้า',           'Create Products',          'products',         21),
  ('products:edit',          'แก้ไขสินค้า',           'Edit Products',            'products',         22),
  ('vendors:view',           'ดูผู้จำหน่าย',          'View Vendors',             'vendors',          30),
  ('vendors:create',         'เพิ่มผู้จำหน่าย',       'Create Vendors',           'vendors',          31),
  ('vendors:edit',           'แก้ไขผู้จำหน่าย',       'Edit Vendors',             'vendors',          32),
  ('pr:view',                'ดูคำขอซื้อ',            'View Purchase Requests',   'purchase_requests',40),
  ('pr:create',              'สร้างคำขอซื้อ',         'Create Purchase Requests', 'purchase_requests',41),
  ('pr:submit',              'ส่งคำขอซื้อ',           'Submit Purchase Requests', 'purchase_requests',42),
  ('pr:approve',             'อนุมัติคำขอซื้อ',       'Approve Purchase Requests','purchase_requests',43),
  ('pr:reject',              'ปฏิเสธคำขอซื้อ',        'Reject Purchase Requests', 'purchase_requests',44),
  ('po:view',                'ดูใบสั่งซื้อ',          'View Purchase Orders',     'purchase_orders',  50),
  ('po:create',              'สร้างใบสั่งซื้อ',       'Create Purchase Orders',   'purchase_orders',  51),
  ('po:edit',                'แก้ไขใบสั่งซื้อ',       'Edit Purchase Orders',     'purchase_orders',  52),
  ('po:send',                'ส่งใบสั่งซื้อ',         'Send Purchase Orders',     'purchase_orders',  53),
  ('po:cancel',              'ยกเลิกใบสั่งซื้อ',      'Cancel Purchase Orders',   'purchase_orders',  54),
  ('inbound_orders:view',    'ดู Inbound Orders',     'View Inbound Orders',      'inbound_orders',   60),
  ('inbound_orders:create',  'สร้าง Inbound Order',   'Create Inbound Orders',    'inbound_orders',   61),
  ('inbound_orders:close',   'ปิด Inbound Order',     'Close Inbound Orders',     'inbound_orders',   62),
  ('grn:view',               'ดูใบรับสินค้า',         'View GRN',                 'grn',              70),
  ('grn:create',             'สร้างใบรับสินค้า',      'Create GRN',               'grn',              71),
  ('grn:verify',             'ตรวจสอบการรับสินค้า',   'Verify GRN',               'grn',              72),
  ('grn:stock',              'นำเข้าคลัง',             'Stock GRN',                'grn',              73),
  ('inventory:view',         'ดูสินค้าคงคลัง',        'View Inventory',           'inventory',        80),
  ('inventory:adjust',       'ปรับสต็อก',              'Adjust Inventory',         'inventory',        81),
  ('transfers:view',         'ดูการโอนย้าย',          'View Transfers',           'transfers',        90),
  ('transfers:create',       'สร้างการโอนย้าย',        'Create Transfers',         'transfers',        91),
  ('rma:view',               'ดู RMA',                'View RMA',                 'rma',             100),
  ('rma:create',             'สร้าง RMA',             'Create RMA',               'rma',             101),
  ('rma:resolve',            'แก้ไข RMA',             'Resolve RMA',              'rma',             102),
  ('claims:view',            'ดูการเรียกร้อง',        'View Claims',              'claims',          110),
  ('claims:create',          'สร้างการเรียกร้อง',     'Create Claims',            'claims',          111),
  ('claims:resolve',         'แก้ไขการเรียกร้อง',     'Resolve Claims',           'claims',          112),
  ('cycle_counts:view',      'ดีการนับสต็อก',         'View Cycle Counts',        'cycle_counts',    120),
  ('cycle_counts:create',    'สร้างการนับสต็อก',       'Create Cycle Counts',      'cycle_counts',    121),
  ('cycle_counts:approve',   'อนุมัติการนับสต็อก',    'Approve Cycle Counts',     'cycle_counts',    122),
  ('employees:view',         'ดูพนักงาน',              'View Employees',           'admin',           130),
  ('employees:create',       'เพิ่มพนักงาน',           'Create Employees',         'admin',           131),
  ('employees:edit',         'แก้ไขพนักงาน',           'Edit Employees',           'admin',           132),
  ('roles:view',             'ดูบทบาท',                'View Roles',               'admin',           140),
  ('roles:create',           'สร้างบทบาท',             'Create Roles',             'admin',           141),
  ('roles:edit',             'แก้ไขบทบาท',             'Edit Roles',               'admin',           142),
  ('roles:delete',           'ลบบทบาท',                'Delete Roles',             'admin',           143),
  ('warehouses:view',        'ดูคลังสินค้า',           'View Warehouses',          'admin',           150)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
-- SEED: Three system roles mirroring the enum
-- ─────────────────────────────────────────────
INSERT INTO employee_roles (id, code, name_th, name_en, description, is_system) VALUES
  ('00000000-0000-0000-0000-000000000001', 'system_admin',    'ผู้ดูแลระบบ',  'System Administrator', 'All permissions',      TRUE),
  ('00000000-0000-0000-0000-000000000002', 'system_manager',  'ผู้จัดการ',    'System Manager',       'Operational approvals', TRUE),
  ('00000000-0000-0000-0000-000000000003', 'system_staff',    'พนักงานทั่วไป','General Staff',        'View + basic operations', TRUE)
ON CONFLICT (id) DO NOTHING;

-- system_admin: all permissions
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000001', id FROM permissions
ON CONFLICT DO NOTHING;

-- system_manager: operational permissions (no admin module except view)
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000002', id FROM permissions
  WHERE id NOT IN ('roles:create','roles:edit','roles:delete','employees:create','employees:edit')
ON CONFLICT DO NOTHING;

-- system_staff: view + basic create operations
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000003', id FROM permissions
  WHERE id IN (
    'dashboard:view',
    'products:view', 'vendors:view',
    'pr:view', 'pr:create', 'pr:submit',
    'po:view',
    'inbound_orders:view', 'inbound_orders:create',
    'grn:view', 'grn:create',
    'inventory:view',
    'transfers:view', 'transfers:create',
    'rma:view', 'rma:create',
    'claims:view', 'claims:create',
    'cycle_counts:view', 'cycle_counts:create'
  )
ON CONFLICT DO NOTHING;
```

- [x] Create `migrations/015_employee_rbac.sql` with all DDL + seeds above
- [x] Run `npm run migrate`

---

## Task 2 — Auth Layer: Load Permissions into JWT

**Files:** `auth.ts`, `auth.config.ts`, `lib/authz.ts`

### 2a. `auth.ts` — Load permissions in `authorize`

After the existing warehouse query, also load permissions:

```typescript
// After fetching the user + warehouse assignments:
const perms = await query<{ permission_id: string }>(
  `SELECT erp.permission_id
   FROM user_role_assignments ura
   JOIN employee_role_permissions erp ON erp.role_id = ura.role_id
   WHERE ura.user_id = $1`,
  [user.id]
);

return {
  id: user.id,
  email: user.email,
  name: user.name_en,
  role: user.role,
  assignedWarehouseIds: (user as any).assigned_warehouse_ids ?? [],
  permissions: perms.map((p) => p.permission_id),
  // Employee fields for display:
  employeeId: user.employee_id ?? null,
  position: user.position ?? null,
};
```

> **Note:** `admin` users still bypass permission checks server-side regardless of this array. But for frontend UI filtering, admin sees all nav items by checking `role === 'admin'`.

> **JWT size warning:** With ~45 permissions, the JWT adds ~2KB. This is within the default NextAuth JWT limits. No action needed.

### 2b. `auth.config.ts` — Propagate to JWT and session

```typescript
async jwt({ token, user }) {
  if (user) {
    token.id = user.id;
    token.role = (user as any).role;
    token.assignedWarehouseIds = (user as any).assignedWarehouseIds;
    token.permissions = (user as any).permissions;       // NEW
    token.employeeId = (user as any).employeeId;         // NEW
    token.position = (user as any).position;             // NEW
  }
  return token;
},
async session({ session, token }) {
  if (session.user) {
    session.user.id = token.id as string;
    (session.user as any).role = token.role;
    (session.user as any).assignedWarehouseIds = token.assignedWarehouseIds;
    (session.user as any).permissions = token.permissions;    // NEW
    (session.user as any).employeeId = token.employeeId;     // NEW
    (session.user as any).position = token.position;         // NEW
  }
  return session;
},
```

### 2c. `lib/authz.ts` — Extend `SessionUser` + add helpers

```typescript
export interface SessionUser {
  id: string;
  role: UserRole;
  assignedWarehouseIds: string[];
  permissions: string[];     // NEW — union of all assigned custom role permissions
}

/** Returns true if user has the permission, or if user is admin (bypass). */
export function hasPermission(user: SessionUser, permission: string): boolean {
  if (user.role === 'admin') return true;
  return user.permissions.includes(permission);
}

/** Throws 403 if user lacks the permission. */
export function assertPermission(user: SessionUser, permission: string): void {
  if (!hasPermission(user, permission)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
}
```

- [x] Update `auth.ts` to load permissions in authorize
- [x] Update `auth.config.ts` to pass permissions through JWT/session
- [x] Update `lib/authz.ts` to add `permissions` to `SessionUser`, add `hasPermission` and `assertPermission`

---

## Task 3 — API: Role Management CRUD

### `app/api/admin/roles/route.ts`

**GET** — list all roles (admin only)
```sql
SELECT er.id, er.code, er.name_th, er.name_en, er.description, er.is_system, er.created_at,
       COUNT(erp.permission_id) AS permission_count,
       COUNT(ura.user_id) AS user_count
FROM employee_roles er
LEFT JOIN employee_role_permissions erp ON erp.role_id = er.id
LEFT JOIN user_role_assignments ura ON ura.role_id = er.id
GROUP BY er.id
ORDER BY er.is_system DESC, er.name_en
```

**POST** — create new role (admin only)
```typescript
const schema = z.object({
  code: z.string().min(2).max(50).regex(/^[a-z0-9_]+$/),
  name_th: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  description: z.string().optional(),
  permission_ids: z.array(z.string()).min(1),
});
// INSERT into employee_roles, then bulk INSERT into employee_role_permissions
```

### `app/api/admin/roles/[id]/route.ts`

**GET** — role detail with its permissions
```sql
SELECT er.*, array_agg(erp.permission_id) AS permission_ids
FROM employee_roles er
LEFT JOIN employee_role_permissions erp ON erp.role_id = er.id
WHERE er.id = $1
GROUP BY er.id
```

**PATCH** — update role (blocked if `is_system = true` for code/name changes; always allow permission update)
```typescript
// Allow updating: name_th, name_en, description, permission_ids
// Block: changing code on system roles
// If permission_ids provided: DELETE existing, INSERT new (full replace)
```

**DELETE** — delete role (blocked if `is_system = true` or if users are assigned)
```typescript
// Check: is_system → 409 'System roles cannot be deleted'
// Check: COUNT(user_role_assignments) > 0 → 409 'Role has assigned users'
// Then: DELETE FROM employee_roles WHERE id = $1 (CASCADE handles permissions)
```

- [x] Create `app/api/admin/roles/route.ts` (GET + POST)
- [x] Create `app/api/admin/roles/[id]/route.ts` (GET + PATCH + DELETE)

---

## Task 4 — API: Permissions List + User-Role Assignments

### `app/api/admin/permissions/route.ts`

**GET** — returns full permission catalog grouped by module (admin only)
```sql
SELECT id, name_th, name_en, module, sort_order
FROM permissions
ORDER BY sort_order
```
Response: `{ [module: string]: Permission[] }` (grouped for the UI matrix)

### `app/api/admin/users/[id]/roles/route.ts`

**GET** — list roles assigned to a user
```sql
SELECT er.id, er.code, er.name_th, er.name_en, ura.assigned_at, u.name_en AS assigned_by_name
FROM user_role_assignments ura
JOIN employee_roles er ON er.id = ura.role_id
LEFT JOIN users u ON u.id = ura.assigned_by
WHERE ura.user_id = $1
```

**POST** — assign a role to a user
```typescript
const schema = z.object({ role_id: z.string().uuid() });
// Check: role exists
// INSERT INTO user_role_assignments (user_id, role_id, assigned_by) VALUES ($1, $2, $3)
// ON CONFLICT DO NOTHING
```

**DELETE** — remove a role from a user (role_id in request body)
```typescript
// DELETE FROM user_role_assignments WHERE user_id = $1 AND role_id = $2
```

- [x] Create `app/api/admin/permissions/route.ts`
- [x] Create `app/api/admin/users/[id]/roles/route.ts` (GET + POST + DELETE)

---

## Task 5 — Extend Users API: Employee Fields

### `app/api/admin/users/route.ts` — POST

Add employee fields to `createUserSchema` and INSERT:
```typescript
const createUserSchema = z.object({
  email: z.string().email(),
  name_en: z.string().min(1).max(255),
  name_th: z.string().max(255).optional(),
  role: z.enum(['admin', 'manager', 'staff']),
  password: z.string().min(8),
  // NEW:
  employee_id: z.string().max(50).optional(),
  position: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  hired_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
// Insert includes new columns
// Check employee_id uniqueness before insert: if duplicate → 409
```

Also update the GET query to return new fields:
```sql
SELECT u.id, u.email, u.name_th, u.name_en, u.role, u.is_active, u.created_at,
       u.employee_id, u.position, u.department, u.phone, u.hired_date,  -- NEW
       COUNT(uwa.warehouse_id) AS warehouse_count
FROM users u ...
```

### `app/api/admin/users/[id]/route.ts` — PATCH

Add new fields to `updateSchema`:
```typescript
const updateSchema = z.object({
  name_en: z.string().min(1).max(255).optional(),
  name_th: z.string().max(255).nullable().optional(),
  role: z.enum(['admin', 'manager', 'staff']).optional(),
  is_active: z.boolean().optional(),
  // NEW:
  employee_id: z.string().max(50).nullable().optional(),
  position: z.string().max(100).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  hired_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});
```

- [x] Update `app/api/admin/users/route.ts` POST + GET to include employee fields
- [x] Update `app/api/admin/users/[id]/route.ts` GET + PATCH to include employee fields

---

## Task 6 — Page: Role Management

### `app/app/admin/roles/page.tsx`

Role list page (admin only). Pattern: same as other list pages.

```
┌──────────────────────────────────────────────────────────┐
│ บทบาทพนักงาน / Employee Roles      [+ สร้างบทบาทใหม่]  │
├──────────────┬──────────────────┬────────────┬──────────┤
│ รหัส / Code  │ ชื่อ / Name       │ Permissions│ Users   │
├──────────────┼──────────────────┼────────────┼──────────┤
│ system_admin │ ผู้ดูแลระบบ      │ 45         │ 1       │ [System]
│ gr_receiver  │ ผู้รับสินค้า     │ 8          │ 3       │ [แก้ไข] [ลบ]
└──────────────┴──────────────────┴────────────┴──────────┘
```

System roles show a "System" badge instead of edit/delete buttons.

### `app/app/admin/roles/[id]/page.tsx`

Role detail page with **permission matrix editor**.

Layout:
```
บทบาท: GR Receiver         [is_system badge if applicable]
Code: gr_receiver
─────────────────────────────────────────────────────────
สิทธิ์การใช้งาน / Permissions

Module: Goods Receipt (GRN)
  [✓] grn:view     ดูใบรับสินค้า
  [✓] grn:create   สร้างใบรับสินค้า
  [✓] grn:verify   ตรวจสอบการรับสินค้า
  [ ] grn:stock    นำเข้าคลัง

Module: Inbound Orders
  [✓] inbound_orders:view
  [✓] inbound_orders:create
  [ ] inbound_orders:close

... (all modules)

[บันทึก / Save]
```

The permission matrix is a set of checkboxes grouped by `module`. On save:
`PATCH /api/admin/roles/:id` with `{ permission_ids: [...checked ids] }`.

### `app/app/admin/roles/new/page.tsx`

Simplified version of the detail page (create mode): Name (TH/EN), Code, Description, then the same permission matrix.

- [x] Create `app/app/admin/roles/page.tsx` (list)
- [x] Create `app/app/admin/roles/new/page.tsx` (create form)
- [x] Create `app/app/admin/roles/[id]/page.tsx` (detail + permission matrix editor)

---

## Task 7 — Page: Employee Management (Extend Existing)

### `app/app/admin/users/page.tsx`

Rename header to "พนักงาน / Employees". Add columns:
- **Employee ID** (always visible, font-mono)
- **ตำแหน่ง / Position** (hidden sm:table-cell)
- **แผนก / Department** (hidden sm:table-cell, was previously missing)
- Add a "บทบาท / Roles" button alongside "คลังสินค้า"

Update `UserWithStats`:
```typescript
interface UserWithStats extends User {
  employee_id: string | null;
  position: string | null;
  department: string | null;
  warehouse_count?: number;
}
```

Also add `role` filter dropdown (already exists in API, add to UI).

### `app/app/admin/users/UserFormModal.tsx`

Add employee fields section below existing name/role fields:

```
─── ข้อมูลพนักงาน / Employee Info ──────────────────
Employee ID     │ Position
Department      │ Phone
Hired Date
```

All optional. Save via existing `PATCH /api/admin/users/:id` (now includes new fields).

### New: `app/app/admin/users/UserRoleModal.tsx`

A modal that manages role assignments for a specific user.

```
บทบาทของ: สมชาย สุขดี
────────────────────────────────
บทบาทปัจจุบัน:
  ● GR Receiver   [ลบออก]
  ● Buyer         [ลบออก]

เพิ่มบทบาท:
  [dropdown: available roles not yet assigned] [+ เพิ่ม]
```

Fetches from `GET /api/admin/users/:id/roles`.
Add: `POST /api/admin/users/:id/roles`
Remove: `DELETE /api/admin/users/:id/roles` with `{ role_id }` in body.

- [x] Update `app/app/admin/users/page.tsx`: rename, add employee columns, add Roles button
- [x] Update `app/app/admin/users/UserFormModal.tsx`: add employee fields section
- [x] Create `app/app/admin/users/UserRoleModal.tsx`: role assignment modal

---

## Task 8 — Frontend RBAC: Sidebar + Types + Permission Hook

### `types/index.ts`

Add:
```typescript
export interface Permission {
  id: string;
  name_th: string;
  name_en: string;
  module: string;
  sort_order: number;
}

export interface EmployeeRole {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  description: string | null;
  is_system: boolean;
  permission_count?: number;
  user_count?: number;
  permission_ids?: string[];
  created_at: string;
}

// Extend User:
export interface User {
  id: string;
  email: string;
  name_th: string | null;
  name_en: string;
  role: UserRole;
  is_active: boolean;
  employee_id: string | null;     // NEW
  position: string | null;        // NEW
  department: string | null;      // NEW
  phone: string | null;           // NEW
  hired_date: string | null;      // NEW
  created_at: string;
  updated_at: string;
}
```

### `lib/permissions.ts` (new file — client-safe helper)

```typescript
// Client-side permission check (mirrors server-side hasPermission)
export function clientHasPermission(
  role: string | undefined,
  permissions: string[] | undefined,
  permission: string
): boolean {
  if (role === 'admin') return true;
  return (permissions ?? []).includes(permission);
}
```

### `components/layout/Sidebar.tsx`

Extend `NavItem` type:
```typescript
interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles?: string[];
  permission?: string;  // NEW: hide if user lacks this permission
}
```

Add `permission` field to nav items:
```typescript
const navItems: NavItem[] = [
  { href: '/app/dashboard',        label: 'Dashboard',         icon: '📊', permission: 'dashboard:view' },
  { href: '/app/products',         label: 'Products',          icon: '📦', permission: 'products:view' },
  { href: '/app/vendors',          label: 'Vendors',           icon: '🏭', permission: 'vendors:view' },
  { href: '/app/purchase-requests',label: 'Purchase Requests', icon: '📋', permission: 'pr:view' },
  { href: '/app/purchase-orders',  label: 'Purchase Orders',   icon: '🛒', permission: 'po:view' },
  { href: '/app/inbound-orders',   label: 'Inbound Orders',    icon: '📩', permission: 'inbound_orders:view' },
  { href: '/app/grn',              label: 'Goods Receive',     icon: '📥', permission: 'grn:view' },
  { href: '/app/inventory',        label: 'Inventory',         icon: '🗄️', permission: 'inventory:view' },
  { href: '/app/rma',              label: 'Returns (RMA)',     icon: '↩️', permission: 'rma:view' },
  { href: '/app/claims',           label: 'Vendor Claims',     icon: '⚠️', permission: 'claims:view' },
  { href: '/app/transfers',        label: 'Transfers',         icon: '🔄', permission: 'transfers:view' },
  { href: '/app/cycle-counts',     label: 'Cycle Counts',      icon: '🔢', permission: 'cycle_counts:view' },
  { href: '/app/admin',            label: 'Admin',             icon: '⚙️', roles: ['admin'] },
];
```

Update `Sidebar` props to accept `userRole` and `permissions`:
```typescript
interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  userRole?: string;
  permissions?: string[];   // NEW
}

const visibleItems = navItems.filter((item) => {
  if (item.roles && !item.roles.includes(userRole ?? '')) return false;
  if (item.permission) {
    if (userRole === 'admin') return true;           // admin sees all
    if (!(permissions ?? []).includes(item.permission)) return false;
  }
  return true;
});
```

### `app/app/layout.tsx`

Pass `permissions` to Sidebar from session:
```tsx
'use client';
import { useSession } from 'next-auth/react';

// In component:
const { data: session } = useSession();
const userRole = (session?.user as any)?.role;
const permissions: string[] = (session?.user as any)?.permissions ?? [];

// Pass to Sidebar:
<Sidebar
  open={sidebarOpen}
  onClose={() => setSidebarOpen(false)}
  userRole={userRole}
  permissions={permissions}
/>
```

### `components/layout/Sidebar.tsx` — `/app/admin/roles` nav item

Add "Roles" under the admin section. The Admin nav item (`/app/admin`) is the section root. Add a sub-item:
```typescript
{ href: '/app/admin/roles', label: 'บทบาท / Roles', icon: '🔑', roles: ['admin'] },
```

### `middleware.ts` — No change needed

The existing middleware already blocks `/app/admin/*` for non-admin users. Fine-grained checks remain in API routes and pages.

- [x] Update `types/index.ts` with new types and extended `User`
- [x] Create `lib/permissions.ts` with `clientHasPermission`
- [x] Update `components/layout/Sidebar.tsx` with `permission` field on nav items
- [x] Update `app/app/layout.tsx` to pass `permissions` and `userRole` to Sidebar
- [x] Add `/app/admin/roles` nav item to Sidebar

---

## Task 9 — Admin Navigation: Add Roles Page to Admin Section

**File:** `app/app/admin/warehouses/page.tsx`

The admin section currently has Users and Warehouses. The Roles page is at `/app/admin/roles`. No changes needed to the warehouses page — just ensure the sidebar picks it up.

Optionally, update the admin dashboard or nav section header to include a card/link to the Roles page.

- [x] Verify `/app/admin/roles` is reachable and sidebar item links correctly

---

## Verification Checklist

### Migration
- [x] `npm run migrate` applies `015_employee_rbac.sql` cleanly
- [x] `SELECT COUNT(*) FROM permissions` returns 45
- [x] Three system roles exist in `employee_roles`

### Auth
- [x] Staff user with GR Receiver role logs in → `session.user.permissions` includes `grn:create`
- [x] Admin user logs in → `session.user.permissions` is empty or full (bypass applies)

### Role Management
- [x] `/app/admin/roles` lists system + custom roles
- [x] Create custom role "GR Receiver" with `grn:view`, `grn:create`, `grn:verify`
- [x] Permission matrix shows checkboxes grouped by module
- [x] Deleting a system role returns 409

### Employee Management
- [x] Create user with Employee ID "EMP001", Position "Warehouse Staff", Department "Operations"
- [x] Edit user → employee fields editable
- [x] Assign GR Receiver role to user via UserRoleModal
- [x] Remove role from user

### Frontend RBAC
- [x] Staff user with only `grn:view` permission: sidebar shows only GRN (and any other permitted items); PR, PO, etc. are hidden
- [x] Admin user: sees all sidebar items
- [x] `npm run build` passes — no TypeScript errors

### Important Note on Session Refresh
> Permissions are loaded at login and stored in the JWT (8-hour session). If an admin changes a user's role assignments, the user must **re-login** for the new permissions to take effect. Display a note in the UserRoleModal: "การเปลี่ยนบทบาทจะมีผลหลังจากผู้ใช้ล็อกอินใหม่ / Changes take effect after the user re-logs in."

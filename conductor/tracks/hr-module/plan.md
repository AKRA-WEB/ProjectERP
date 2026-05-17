---
track: hr-module
status: Completed
aliases: ["HR Module"]
owner: paku, puka
module: HR
updated: 2026-05-13
---

# Track: HR Module

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task.

**Created:** 2026-05-12  
**Status:** Active  
**Architect:** Claude

**Goal:** Full HR module — Employee Profiles, Leave Management, Attendance (self clock-in), Full Thai Payroll with auto Journal Entry to Accounting.

**Architecture:** Phased MVP (4 phases). Each phase produces independently usable functionality. All API routes follow existing project pattern: auth → SessionUser cast → Zod validation → warehouse scope (where relevant) → pg query. All pages are `'use client'` fetching via `lib/api-client.ts`.

**Tech Stack:** Next.js 15 App Router · TypeScript 5 · PostgreSQL (raw pg) · Zod · Tailwind · `@react-pdf/renderer` (payroll slips)

---

## Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Employee identity | Extend `users` table with FK columns | Employees ARE users; avoid data duplication |
| Old text columns | Keep `position`/`department` text columns | Backward compat with existing admin UI |
| Leave request numbering | `next_doc_number('LR','seq_lr')` | Consistent with project pattern |
| Payroll run numbering | `next_doc_number('PYR','seq_pyr')` | Consistent with project pattern |
| Thai SSO calc | `MIN(gross, 15000) × 5%` cap 750 THB | Per Thai Social Security Act |
| Income tax | Annualized then ÷12 monthly withholding | Standard Thai WHT method |
| OT source | Read from `attendance_records.ot_hours` | Single source of truth |
| Payroll → JE | On `approve` action, create JE in `journal_entries` | Matches existing accounting module |
| PDF slip | `@react-pdf/renderer` server-side in API route | No browser dependency |
| Singleton payroll config | `hr_payroll_accounts` — enforced by PK=1 | One config row only |

---

## Phase 1: Employee Profiles + Departments

### Task 1: Migration `019_hr_departments.sql`

**File:** `migrations/019_hr_departments.sql`

- [x] Create migration file with this exact content:

```sql
-- ─────────────────────────────────────────────
-- HR Phase 1: Departments, Positions, Salary Grades, Employee Documents
-- ─────────────────────────────────────────────

-- 1. Departments
CREATE TABLE IF NOT EXISTS departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50)  NOT NULL UNIQUE,
  name_th     VARCHAR(255) NOT NULL,
  name_en     VARCHAR(255) NOT NULL,
  parent_id   UUID REFERENCES departments(id),
  manager_id  UUID REFERENCES users(id),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_departments_parent ON departments(parent_id) WHERE parent_id IS NOT NULL;

-- 2. Salary grades
CREATE TABLE IF NOT EXISTS salary_grades (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             VARCHAR(50)  NOT NULL UNIQUE,
  name_th          VARCHAR(255) NOT NULL,
  name_en          VARCHAR(255) NOT NULL,
  base_salary_min  NUMERIC(12,2) NOT NULL DEFAULT 0,
  base_salary_max  NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_salary_grades_updated_at
  BEFORE UPDATE ON salary_grades
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Positions
CREATE TABLE IF NOT EXISTS positions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             VARCHAR(50)  NOT NULL UNIQUE,
  name_th          VARCHAR(255) NOT NULL,
  name_en          VARCHAR(255) NOT NULL,
  department_id    UUID REFERENCES departments(id),
  salary_grade_id  UUID REFERENCES salary_grades(id),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_positions_updated_at
  BEFORE UPDATE ON positions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_positions_dept ON positions(department_id);

-- 4. Extend users with HR FK columns
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS department_id     UUID REFERENCES departments(id),
  ADD COLUMN IF NOT EXISTS position_id       UUID REFERENCES positions(id),
  ADD COLUMN IF NOT EXISTS salary_grade_id   UUID REFERENCES salary_grades(id),
  ADD COLUMN IF NOT EXISTS base_salary       NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS employment_type   VARCHAR(20) NOT NULL DEFAULT 'full_time',
  ADD COLUMN IF NOT EXISTS employee_status   VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS resignation_date  DATE;

-- 5. Employee documents
CREATE TABLE IF NOT EXISTS employee_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_type     VARCHAR(50) NOT NULL,  -- id_card | passport | degree | contract | other
  filename     VARCHAR(500) NOT NULL,
  storage_url  VARCHAR(1000) NOT NULL,
  issued_date  DATE,
  expiry_date  DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emp_docs_employee ON employee_documents(employee_id);

-- 6. Seed sample departments
INSERT INTO departments (code, name_th, name_en) VALUES
  ('MGMT', 'ผู้บริหาร', 'Management'),
  ('WH',   'คลังสินค้า', 'Warehouse'),
  ('SALES','ขาย', 'Sales'),
  ('ACCT', 'บัญชี', 'Accounting'),
  ('IT',   'ไอที', 'IT')
ON CONFLICT (code) DO NOTHING;
```

- [x] Run migration: `npm run migrate`
- [x] Verify: `\d departments` and `\d users` show new columns in psql

---

### Task 2: Types for Phase 1

**File:** `types/index.ts` (append)

- [x] Add to `types/index.ts`:

```typescript
export type EmploymentType = 'full_time' | 'part_time' | 'contract';
export type EmployeeStatus = 'active' | 'inactive' | 'resigned';

export interface Department {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  parent_id: string | null;
  manager_id: string | null;
  manager_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  department_id: string | null;
  department_name_th?: string;
  salary_grade_id: string | null;
  salary_grade_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalaryGrade {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  base_salary_min: number;
  base_salary_max: number;
  created_at: string;
  updated_at: string;
}

export interface HrEmployee {
  id: string;
  employee_id: string | null;
  name: string;
  email: string;
  role: string;
  department_id: string | null;
  department_name_th: string | null;
  department_name_en: string | null;
  position_id: string | null;
  position_name_th: string | null;
  position_name_en: string | null;
  salary_grade_id: string | null;
  salary_grade_name: string | null;
  base_salary: number | null;
  employment_type: EmploymentType;
  employee_status: EmployeeStatus;
  hired_date: string | null;
  resignation_date: string | null;
  phone: string | null;
  created_at: string;
}
```

- [x] Commit: `git add types/index.ts && git commit -m "feat(hr): add Phase 1 types — Department, Position, SalaryGrade, HrEmployee"`

---

### Task 3: API — Departments

**Files:**
- Create: `app/api/hr/departments/route.ts`
- Create: `app/api/hr/departments/[id]/route.ts`

- [x] Create `app/api/hr/departments/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const CreateSchema = z.object({
  code: z.string().min(1).max(50),
  name_th: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  parent_id: z.string().uuid().nullable().optional(),
  manager_id: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const rows = await query<{
    id: string; code: string; name_th: string; name_en: string;
    parent_id: string | null; manager_id: string | null; manager_name: string | null;
    is_active: boolean; created_at: string; updated_at: string;
  }>(`
    SELECT d.*, u.name_en AS manager_name
    FROM departments d
    LEFT JOIN users u ON u.id = d.manager_id
    WHERE d.is_active = TRUE
    ORDER BY d.name_th
  `, []);

  return apiSuccess(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  if (!['admin', 'manager'].includes(u.role)) return apiError('Forbidden', 403);

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);
  const d = parsed.data;

  const rows = await query<{ id: string }>(`
    INSERT INTO departments (code, name_th, name_en, parent_id, manager_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `, [d.code, d.name_th, d.name_en, d.parent_id ?? null, d.manager_id ?? null]);

  return apiSuccess({ id: rows[0].id }, 201);
}
```

- [x] Create `app/api/hr/departments/[id]/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { queryOne } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const UpdateSchema = z.object({
  name_th: z.string().min(1).max(255).optional(),
  name_en: z.string().min(1).max(255).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  manager_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const { id } = await params;

  const row = await queryOne<object>(`
    SELECT d.*, u.name_en AS manager_name
    FROM departments d
    LEFT JOIN users u ON u.id = d.manager_id
    WHERE d.id = $1
  `, [id]);
  if (!row) return apiError('Not found', 404);
  return apiSuccess(row);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  if (!['admin', 'manager'].includes(u.role)) return apiError('Forbidden', 403);
  const { id } = await params;

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);
  const d = parsed.data;

  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  if (d.name_th !== undefined) { sets.push(`name_th = $${idx++}`); vals.push(d.name_th); }
  if (d.name_en !== undefined) { sets.push(`name_en = $${idx++}`); vals.push(d.name_en); }
  if (d.parent_id !== undefined) { sets.push(`parent_id = $${idx++}`); vals.push(d.parent_id); }
  if (d.manager_id !== undefined) { sets.push(`manager_id = $${idx++}`); vals.push(d.manager_id); }
  if (d.is_active !== undefined) { sets.push(`is_active = $${idx++}`); vals.push(d.is_active); }
  if (sets.length === 0) return apiError('No fields to update', 400);

  vals.push(id);
  await queryOne(`UPDATE departments SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
  return apiSuccess({ ok: true });
}
```

- [x] Commit: `git add app/api/hr/departments/ && git commit -m "feat(hr): departments API routes"`

---

### Task 4: API — Positions + Salary Grades

**Files:**
- Create: `app/api/hr/positions/route.ts`
- Create: `app/api/hr/salary-grades/route.ts`

- [x] Create `app/api/hr/positions/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const CreateSchema = z.object({
  code: z.string().min(1).max(50),
  name_th: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  department_id: z.string().uuid().nullable().optional(),
  salary_grade_id: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const rows = await query(`
    SELECT p.*, d.name_th AS department_name_th, sg.name_th AS salary_grade_name
    FROM positions p
    LEFT JOIN departments d ON d.id = p.department_id
    LEFT JOIN salary_grades sg ON sg.id = p.salary_grade_id
    WHERE p.is_active = TRUE
    ORDER BY p.name_th
  `, []);
  return apiSuccess(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  if (!['admin', 'manager'].includes(u.role)) return apiError('Forbidden', 403);

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);
  const d = parsed.data;

  const rows = await query<{ id: string }>(`
    INSERT INTO positions (code, name_th, name_en, department_id, salary_grade_id)
    VALUES ($1, $2, $3, $4, $5) RETURNING id
  `, [d.code, d.name_th, d.name_en, d.department_id ?? null, d.salary_grade_id ?? null]);
  return apiSuccess({ id: rows[0].id }, 201);
}
```

- [x] Create `app/api/hr/salary-grades/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const CreateSchema = z.object({
  code: z.string().min(1).max(50),
  name_th: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  base_salary_min: z.number().min(0),
  base_salary_max: z.number().min(0),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const rows = await query(`SELECT * FROM salary_grades ORDER BY base_salary_min`, []);
  return apiSuccess(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  if (u.role !== 'admin') return apiError('Forbidden', 403);

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);
  const d = parsed.data;

  const rows = await query<{ id: string }>(`
    INSERT INTO salary_grades (code, name_th, name_en, base_salary_min, base_salary_max)
    VALUES ($1, $2, $3, $4, $5) RETURNING id
  `, [d.code, d.name_th, d.name_en, d.base_salary_min, d.base_salary_max]);
  return apiSuccess({ id: rows[0].id }, 201);
}
```

- [x] Commit: `git add app/api/hr/positions/ app/api/hr/salary-grades/ && git commit -m "feat(hr): positions and salary-grades API"`

---

### Task 5: API — HR Employees

**Files:**
- Create: `app/api/hr/employees/route.ts`
- Create: `app/api/hr/employees/[id]/route.ts`

- [x] Create `app/api/hr/employees/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') ?? '';
  const dept = searchParams.get('department_id') ?? '';
  const status = searchParams.get('employee_status') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (search) {
    conditions.push(`(u.name_en ILIKE $${idx} OR u.name_th ILIKE $${idx} OR u.employee_id ILIKE $${idx} OR u.email ILIKE $${idx})`);
    params.push(`%${search}%`); idx++;
  }
  if (dept) { conditions.push(`u.department_id = $${idx++}`); params.push(dept); }
  if (status) { conditions.push(`u.employee_status = $${idx++}`); params.push(status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query(`
    SELECT
      u.id, u.employee_id, u.name_en AS name, u.name_th, u.email, u.role,
      u.department_id, d.name_th AS department_name_th, d.name_en AS department_name_en,
      u.position_id, p.name_th AS position_name_th, p.name_en AS position_name_en,
      u.salary_grade_id, sg.name_th AS salary_grade_name,
      u.base_salary, u.employment_type, u.employee_status,
      u.hired_date, u.resignation_date, u.phone, u.created_at
    FROM users u
    LEFT JOIN departments d ON d.id = u.department_id
    LEFT JOIN positions p ON p.id = u.position_id
    LEFT JOIN salary_grades sg ON sg.id = u.salary_grade_id
    ${where}
    ORDER BY u.name_en
    LIMIT $${idx} OFFSET $${idx + 1}
  `, [...params, limit, offset]);

  const [{ count }] = await query<{ count: string }>(`
    SELECT COUNT(*) FROM users u ${where}
  `, params);

  return apiSuccess({ employees: rows, total: parseInt(count), page, limit });
}
```

- [x] Create `app/api/hr/employees/[id]/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { queryOne } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const UpdateSchema = z.object({
  employee_id: z.string().max(50).optional(),
  department_id: z.string().uuid().nullable().optional(),
  position_id: z.string().uuid().nullable().optional(),
  salary_grade_id: z.string().uuid().nullable().optional(),
  base_salary: z.number().min(0).nullable().optional(),
  employment_type: z.enum(['full_time', 'part_time', 'contract']).optional(),
  employee_status: z.enum(['active', 'inactive', 'resigned']).optional(),
  hired_date: z.string().nullable().optional(),
  resignation_date: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const { id } = await params;

  const row = await queryOne(`
    SELECT
      u.*, d.name_th AS department_name_th, d.name_en AS department_name_en,
      p.name_th AS position_name_th, p.name_en AS position_name_en,
      sg.name_th AS salary_grade_name, sg.base_salary_min, sg.base_salary_max
    FROM users u
    LEFT JOIN departments d ON d.id = u.department_id
    LEFT JOIN positions p ON p.id = u.position_id
    LEFT JOIN salary_grades sg ON sg.id = u.salary_grade_id
    WHERE u.id = $1
  `, [id]);
  if (!row) return apiError('Not found', 404);
  return apiSuccess(row);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  if (!['admin', 'manager'].includes(u.role)) return apiError('Forbidden', 403);
  const { id } = await params;

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);
  const d = parsed.data;

  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  const fields = ['employee_id','department_id','position_id','salary_grade_id',
    'base_salary','employment_type','employee_status','hired_date','resignation_date','phone'] as const;
  for (const f of fields) {
    if (d[f] !== undefined) { sets.push(`${f} = $${idx++}`); vals.push(d[f]); }
  }
  if (sets.length === 0) return apiError('No fields', 400);
  vals.push(id);
  await queryOne(`UPDATE users SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
  return apiSuccess({ ok: true });
}
```

- [x] Commit: `git add app/api/hr/employees/ && git commit -m "feat(hr): employees API routes"`

---

### Task 6: Pages — HR Employees + Departments

**Files:**
- Create: `app/app/hr/employees/page.tsx`
- Create: `app/app/hr/employees/[id]/page.tsx`
- Create: `app/app/hr/departments/page.tsx`

- [x] Create `app/app/hr/employees/page.tsx` — list page with search, dept filter, status filter, pagination. Follow pattern of `app/app/vendors/page.tsx` — `'use client'`, `useEffect` fetch from `/api/hr/employees`, render `<Table>` with columns: Employee ID, Name, Department, Position, Employment Type, Status, Hired Date. Badge for `employee_status` (active=green, inactive=yellow, resigned=gray).

- [x] Create `app/app/hr/employees/[id]/page.tsx` — detail page with tabs:
  - **Tab: ข้อมูล (Info)** — name, email, employee_id, dept, position, salary grade, base salary, employment type, status, hired date, phone. Edit button opens inline fields (admin/manager only).
  - **Tab: วันลา (Leave)** — table of leave_requests for this employee (populated in Phase 2; show empty state now).
  - **Tab: การเข้างาน (Attendance)** — attendance calendar (populated in Phase 3; show empty state now).
  - **Tab: เงินเดือน (Payroll)** — payroll line history (populated in Phase 4; show empty state now).

- [x] Create `app/app/hr/departments/page.tsx` — list all departments as cards showing dept name, manager name, member count. Inline create form for admin/manager. Follow `app/app/admin/warehouses/page.tsx` pattern.

- [x] Commit: `git add app/app/hr/ && git commit -m "feat(hr): Phase 1 pages — employees list/detail, departments"`

---

### Task 7: Sidebar — Add HR Group

**File:** `components/layout/Sidebar.tsx`

- [x] Add HR nav group after the Accounting group (around line 94):

```typescript
{
  label: 'ทรัพยากรบุคคล / HR',
  items: [
    { href: '/app/hr/employees',      label: 'พนักงาน / Employees',     icon: '👥', permission: 'hr:employees:view' },
    { href: '/app/hr/departments',    label: 'แผนก / Departments',      icon: '🏢', permission: 'hr:departments:view' },
    { href: '/app/hr/leave-requests', label: 'วันลา / Leave',           icon: '📅', permission: 'hr:leave:view' },
    { href: '/app/hr/attendance/my',  label: 'เข้างาน / Attendance',    icon: '⏰', permission: 'hr:attendance:view' },
    { href: '/app/hr/payroll',        label: 'เงินเดือน / Payroll',     icon: '💰', permission: 'hr:payroll:view' },
  ],
},
```

- [x] Commit: `git add components/layout/Sidebar.tsx && git commit -m "feat(hr): add HR nav group to sidebar"`

---

## Phase 2: Leave Management

### Task 8: Migration `020_hr_leave.sql`

**File:** `migrations/020_hr_leave.sql`

- [x] Create with this exact content:

```sql
-- ─────────────────────────────────────────────
-- HR Phase 2: Leave Management
-- ─────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS seq_lr START 1;

CREATE TABLE IF NOT EXISTS leave_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(50)  NOT NULL UNIQUE,
  name_th       VARCHAR(255) NOT NULL,
  name_en       VARCHAR(255) NOT NULL,
  days_per_year INT          NOT NULL DEFAULT 0,
  is_paid       BOOLEAN      NOT NULL DEFAULT TRUE,
  carry_over    BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_leave_types_updated_at
  BEFORE UPDATE ON leave_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS leave_balances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type_id   UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  year            INT  NOT NULL,
  days_entitled   INT  NOT NULL DEFAULT 0,
  days_used       NUMERIC(4,1) NOT NULL DEFAULT 0,
  UNIQUE(employee_id, leave_type_id, year)
);

CREATE INDEX IF NOT EXISTS idx_leave_bal_emp ON leave_balances(employee_id);

CREATE TABLE IF NOT EXISTS leave_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number  VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('LR','seq_lr'),
  employee_id     UUID NOT NULL REFERENCES users(id),
  leave_type_id   UUID NOT NULL REFERENCES leave_types(id),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  days_requested  NUMERIC(4,1) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  notes           TEXT,
  reject_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_leave_status CHECK (status IN ('draft','submitted','approved','rejected','cancelled'))
);

CREATE OR REPLACE TRIGGER trg_leave_requests_updated_at
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_leave_req_emp ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_req_status ON leave_requests(status);

-- Seed standard Thai leave types
INSERT INTO leave_types (code, name_th, name_en, days_per_year, is_paid, carry_over) VALUES
  ('SICK',     'ลาป่วย',    'Sick Leave',     30, TRUE,  FALSE),
  ('VACATION', 'ลาพักร้อน', 'Annual Leave',   10, TRUE,  TRUE),
  ('PERSONAL', 'ลากิจ',     'Personal Leave',  3, FALSE, FALSE),
  ('MATERNITY','ลาคลอด',    'Maternity Leave', 98, TRUE, FALSE),
  ('ORDAIN',   'ลาบวช',     'Ordination Leave',15, TRUE, FALSE)
ON CONFLICT (code) DO NOTHING;
```

- [x] Run `npm run migrate`
- [x] Commit: `git add migrations/020_hr_leave.sql && git commit -m "feat(hr): Phase 2 migration — leave tables"`

---

### Task 9: Types for Phase 2

**File:** `types/index.ts` (append)

- [x] Add:

```typescript
export type LeaveRequestStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveType {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  days_per_year: number;
  is_paid: boolean;
  carry_over: boolean;
  is_active: boolean;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  leave_type_name_th: string;
  leave_type_name_en: string;
  year: number;
  days_entitled: number;
  days_used: number;
  days_remaining: number;
}

export interface LeaveRequest {
  id: string;
  request_number: string;
  employee_id: string;
  employee_name: string;
  leave_type_id: string;
  leave_type_name_th: string;
  leave_type_name_en: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  status: LeaveRequestStatus;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  notes: string | null;
  reject_reason: string | null;
  created_at: string;
}
```

- [x] Commit: `git add types/index.ts && git commit -m "feat(hr): add Phase 2 leave types"`

---

### Task 10: API — Leave

**Files:**
- Create: `app/api/hr/leave-types/route.ts`
- Create: `app/api/hr/leave-requests/route.ts`
- Create: `app/api/hr/leave-requests/[id]/route.ts`
- Create: `app/api/hr/leave-balances/route.ts`

- [x] Create `app/api/hr/leave-types/route.ts`:

```typescript
import { auth } from '@/auth';
import { query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const rows = await query(`SELECT * FROM leave_types WHERE is_active = TRUE ORDER BY name_th`, []);
  return apiSuccess(rows);
}
```

- [x] Create `app/api/hr/leave-balances/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get('employee_id');
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()));

  if (!employeeId) return apiError('employee_id required', 400);

  const rows = await query(`
    SELECT lb.*,
      lt.name_th AS leave_type_name_th, lt.name_en AS leave_type_name_en,
      (lb.days_entitled - lb.days_used) AS days_remaining
    FROM leave_balances lb
    JOIN leave_types lt ON lt.id = lb.leave_type_id
    WHERE lb.employee_id = $1 AND lb.year = $2
    ORDER BY lt.name_th
  `, [employeeId, year]);
  return apiSuccess(rows);
}
```

- [x] Create `app/api/hr/leave-requests/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const CreateSchema = z.object({
  leave_type_id: z.string().uuid(),
  start_date: z.string(),
  end_date: z.string(),
  days_requested: z.number().min(0.5),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? '';
  const empId = searchParams.get('employee_id') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  // Staff/manager only see own; admin sees all (or can filter by employee_id)
  if (u.role === 'staff') {
    conditions.push(`lr.employee_id = $${idx++}`); params.push(u.id);
  } else if (empId) {
    conditions.push(`lr.employee_id = $${idx++}`); params.push(empId);
  }
  if (status) { conditions.push(`lr.status = $${idx++}`); params.push(status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query(`
    SELECT lr.*, u.name_en AS employee_name,
      lt.name_th AS leave_type_name_th, lt.name_en AS leave_type_name_en,
      a.name_en AS approved_by_name
    FROM leave_requests lr
    JOIN users u ON u.id = lr.employee_id
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    LEFT JOIN users a ON a.id = lr.approved_by
    ${where}
    ORDER BY lr.created_at DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `, [...params, limit, offset]);

  const [{ count }] = await query<{ count: string }>(`
    SELECT COUNT(*) FROM leave_requests lr ${where}
  `, params);

  return apiSuccess({ requests: rows, total: parseInt(count), page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);
  const d = parsed.data;

  const rows = await query<{ id: string; request_number: string }>(`
    INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, days_requested, notes)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, request_number
  `, [u.id, d.leave_type_id, d.start_date, d.end_date, d.days_requested, d.notes ?? null]);

  return apiSuccess(rows[0], 201);
}
```

- [x] Create `app/api/hr/leave-requests/[id]/route.ts`:

Actions: `submit` | `approve` | `reject` | `cancel`

```typescript
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { pool, queryOne } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('submit') }),
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('reject'), reject_reason: z.string().min(1) }),
  z.object({ action: z.literal('cancel') }),
]);

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const { id } = await params;

  const row = await queryOne(`
    SELECT lr.*, u.name_en AS employee_name,
      lt.name_th AS leave_type_name_th, lt.name_en AS leave_type_name_en,
      a.name_en AS approved_by_name
    FROM leave_requests lr
    JOIN users u ON u.id = lr.employee_id
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    LEFT JOIN users a ON a.id = lr.approved_by
    WHERE lr.id = $1
  `, [id]);
  if (!row) return apiError('Not found', 404);
  return apiSuccess(row);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  const { id } = await params;

  const body = await req.json();
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);

  const lr = await queryOne<{ status: string; employee_id: string; leave_type_id: string; days_requested: number; start_date: string }>(
    `SELECT status, employee_id, leave_type_id, days_requested, start_date FROM leave_requests WHERE id = $1`, [id]
  );
  if (!lr) return apiError('Not found', 404);

  const { action } = parsed.data;

  if (action === 'submit') {
    if (lr.status !== 'draft') return apiError('Can only submit draft requests', 400);
    await queryOne(`UPDATE leave_requests SET status = 'submitted' WHERE id = $1`, [id]);
  }

  if (action === 'approve') {
    if (!['admin','manager'].includes(u.role)) return apiError('Forbidden', 403);
    if (lr.status !== 'submitted') return apiError('Can only approve submitted requests', 400);

    const year = new Date(lr.start_date).getFullYear();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE leave_requests SET status='approved', approved_by=$1, approved_at=NOW() WHERE id=$2`,
        [u.id, id]
      );
      // Upsert balance and increment days_used
      await client.query(`
        INSERT INTO leave_balances (employee_id, leave_type_id, year, days_entitled, days_used)
        VALUES ($1, $2, $3,
          (SELECT days_per_year FROM leave_types WHERE id = $2),
          $4
        )
        ON CONFLICT (employee_id, leave_type_id, year)
        DO UPDATE SET days_used = leave_balances.days_used + $4
      `, [lr.employee_id, lr.leave_type_id, year, lr.days_requested]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  if (action === 'reject') {
    if (!['admin','manager'].includes(u.role)) return apiError('Forbidden', 403);
    if (lr.status !== 'submitted') return apiError('Can only reject submitted requests', 400);
    const d = parsed.data as { action: 'reject'; reject_reason: string };
    await queryOne(
      `UPDATE leave_requests SET status='rejected', reject_reason=$1 WHERE id=$2`,
      [d.reject_reason, id]
    );
  }

  if (action === 'cancel') {
    if (lr.employee_id !== u.id && u.role !== 'admin') return apiError('Forbidden', 403);
    if (!['draft','submitted'].includes(lr.status)) return apiError('Cannot cancel this request', 400);
    await queryOne(`UPDATE leave_requests SET status='cancelled' WHERE id=$1`, [id]);
  }

  return apiSuccess({ ok: true });
}
```

- [x] Commit: `git add app/api/hr/leave-types/ app/api/hr/leave-requests/ app/api/hr/leave-balances/ && git commit -m "feat(hr): leave management API routes"`

---

### Task 11: Pages — Leave Requests

**Files:**
- Create: `app/app/hr/leave-requests/page.tsx`
- Create: `app/app/hr/leave-requests/new/page.tsx`
- Create: `app/app/hr/leave-requests/[id]/page.tsx`

- [x] `app/app/hr/leave-requests/page.tsx` — list with status filter tabs (All / Pending / Approved / Rejected). HR/manager sees all; staff sees own. Columns: Request #, Employee, Leave Type, Dates, Days, Status. `<StatusBadge>` for status.

- [x] `app/app/hr/leave-requests/new/page.tsx` — form: select leave type (GET `/api/hr/leave-types`), date range picker, days auto-computed, notes. Show current balance for selected type. Submit → POST `/api/hr/leave-requests` → redirect to list.

- [x] `app/app/hr/leave-requests/[id]/page.tsx` — detail view. Show request info, leave balance for type/year. Action buttons: **Submit** (draft), **Approve** / **Reject** (manager/admin on submitted), **Cancel** (employee on draft/submitted).

- [x] Commit: `git add app/app/hr/leave-requests/ && git commit -m "feat(hr): Phase 2 pages — leave requests"`

---

## Phase 3: Attendance

### Task 12: Migration `021_hr_attendance.sql`

**File:** `migrations/021_hr_attendance.sql`

- [x] Create with this exact content:

```sql
-- ─────────────────────────────────────────────
-- HR Phase 3: Attendance
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS work_schedules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_th      VARCHAR(255) NOT NULL,
  name_en      VARCHAR(255) NOT NULL,
  shift_start  TIME NOT NULL DEFAULT '08:00',
  shift_end    TIME NOT NULL DEFAULT '17:00',
  days_of_week INT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  is_default   BOOLEAN NOT NULL DEFAULT FALSE,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_work_schedules_updated_at
  BEFORE UPDATE ON work_schedules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS attendance_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES users(id),
  work_date    DATE NOT NULL,
  clock_in     TIMESTAMPTZ,
  clock_out    TIMESTAMPTZ,
  status       VARCHAR(20) NOT NULL DEFAULT 'present',
  ot_hours     NUMERIC(5,2) NOT NULL DEFAULT 0,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, work_date),
  CONSTRAINT chk_attendance_status CHECK (status IN ('present','absent','late','half_day','holiday'))
);

CREATE OR REPLACE TRIGGER trg_attendance_records_updated_at
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance_records(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(work_date);

-- Add work_schedule_id to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS work_schedule_id UUID REFERENCES work_schedules(id);

-- Seed default schedule
INSERT INTO work_schedules (name_th, name_en, shift_start, shift_end, days_of_week, is_default)
VALUES ('มาตรฐาน จ-ศ', 'Standard Mon-Fri', '08:00', '17:00', ARRAY[1,2,3,4,5], TRUE)
ON CONFLICT DO NOTHING;
```

- [x] Run `npm run migrate`
- [x] Commit: `git add migrations/021_hr_attendance.sql && git commit -m "feat(hr): Phase 3 migration — attendance tables"`

---

### Task 13: Types for Phase 3

**File:** `types/index.ts` (append)

- [x] Add:

```typescript
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'holiday';

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name?: string;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: AttendanceStatus;
  ot_hours: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkSchedule {
  id: string;
  name_th: string;
  name_en: string;
  shift_start: string;
  shift_end: string;
  days_of_week: number[];
  is_default: boolean;
  is_active: boolean;
}
```

- [x] Commit: `git add types/index.ts && git commit -m "feat(hr): add Phase 3 attendance types"`

---

### Task 14: API — Attendance

**Files:**
- Create: `app/api/hr/attendance/route.ts`
- Create: `app/api/hr/attendance/clock-in/route.ts`
- Create: `app/api/hr/attendance/clock-out/route.ts`
- Create: `app/api/hr/attendance/today/route.ts`

- [x] Create `app/api/hr/attendance/today/route.ts`:

```typescript
import { auth } from '@/auth';
import { queryOne } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import type { SessionUser } from '@/lib/authz';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const today = new Date().toISOString().split('T')[0];
  const row = await queryOne(
    `SELECT * FROM attendance_records WHERE employee_id = $1 AND work_date = $2`,
    [u.id, today]
  );
  return apiSuccess(row ?? null);
}
```

- [x] Create `app/api/hr/attendance/clock-in/route.ts`:

```typescript
import { auth } from '@/auth';
import { pool, queryOne } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import type { SessionUser } from '@/lib/authz';

export async function POST() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const today = new Date().toISOString().split('T')[0];
  const existing = await queryOne(
    `SELECT id, clock_in FROM attendance_records WHERE employee_id = $1 AND work_date = $2`,
    [u.id, today]
  );
  if (existing && (existing as { clock_in: string | null }).clock_in) {
    return apiError('Already clocked in today', 400);
  }

  // Determine late status by comparing with work schedule
  const schedule = await queryOne<{ shift_start: string }>(
    `SELECT COALESCE(
       (SELECT ws.shift_start FROM work_schedules ws
        JOIN users usr ON usr.work_schedule_id = ws.id WHERE usr.id = $1),
       (SELECT shift_start FROM work_schedules WHERE is_default = TRUE LIMIT 1)
     ) AS shift_start`,
    [u.id]
  );
  const now = new Date();
  let status = 'present';
  if (schedule) {
    const [sh, sm] = (schedule as { shift_start: string }).shift_start.split(':').map(Number);
    const shiftStart = new Date(now);
    shiftStart.setHours(sh, sm + 15, 0); // 15 min grace
    if (now > shiftStart) status = 'late';
  }

  await pool.query(`
    INSERT INTO attendance_records (employee_id, work_date, clock_in, status)
    VALUES ($1, $2, NOW(), $3)
    ON CONFLICT (employee_id, work_date)
    DO UPDATE SET clock_in = NOW(), status = $3
  `, [u.id, today, status]);

  return apiSuccess({ ok: true, status });
}
```

- [x] Create `app/api/hr/attendance/clock-out/route.ts`:

```typescript
import { auth } from '@/auth';
import { pool, queryOne } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import type { SessionUser } from '@/lib/authz';

export async function POST() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const today = new Date().toISOString().split('T')[0];
  const rec = await queryOne<{ id: string; clock_in: string | null; clock_out: string | null }>(
    `SELECT id, clock_in, clock_out FROM attendance_records WHERE employee_id = $1 AND work_date = $2`,
    [u.id, today]
  );
  if (!rec || !rec.clock_in) return apiError('Must clock in first', 400);
  if (rec.clock_out) return apiError('Already clocked out', 400);

  // Compute OT hours
  const schedule = await queryOne<{ shift_end: string }>(
    `SELECT COALESCE(
       (SELECT ws.shift_end FROM work_schedules ws
        JOIN users usr ON usr.work_schedule_id = ws.id WHERE usr.id = $1),
       (SELECT shift_end FROM work_schedules WHERE is_default = TRUE LIMIT 1)
     ) AS shift_end`,
    [u.id]
  );

  const now = new Date();
  let otHours = 0;
  if (schedule) {
    const [eh, em] = (schedule as { shift_end: string }).shift_end.split(':').map(Number);
    const shiftEnd = new Date(now);
    shiftEnd.setHours(eh, em, 0);
    if (now > shiftEnd) {
      otHours = Math.round(((now.getTime() - shiftEnd.getTime()) / 3600000) * 2) / 2; // round to 0.5
    }
  }

  await pool.query(
    `UPDATE attendance_records SET clock_out = NOW(), ot_hours = $1 WHERE id = $2`,
    [otHours, rec.id]
  );
  return apiSuccess({ ok: true, ot_hours: otHours });
}
```

- [x] Create `app/api/hr/attendance/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import type { SessionUser } from '@/lib/authz';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  const { searchParams } = new URL(req.url);
  const empId = searchParams.get('employee_id') ?? (u.role === 'staff' ? u.id : '');
  const month = searchParams.get('month'); // YYYY-MM
  if (!month) return apiError('month required (YYYY-MM)', 400);

  const conditions = [`work_date >= $1`, `work_date <= $2`];
  const params: unknown[] = [`${month}-01`, `${month}-31`];
  let idx = 3;
  if (empId) { conditions.push(`employee_id = $${idx++}`); params.push(empId); }

  const rows = await query(`
    SELECT ar.*, u.name_en AS employee_name
    FROM attendance_records ar
    JOIN users u ON u.id = ar.employee_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY ar.work_date, u.name
  `, params);
  return apiSuccess(rows);
}
```

- [x] Commit: `git add app/api/hr/attendance/ && git commit -m "feat(hr): attendance API — clock-in, clock-out, today, list"`

---

### Task 15: Pages — Attendance

**Files:**
- Create: `app/app/hr/attendance/my/page.tsx`
- Create: `app/app/hr/attendance/page.tsx`

- [x] `app/app/hr/attendance/my/page.tsx` — Employee self-view:
  - Top: **Clock In / Clock Out** button (toggle based on today's `GET /api/hr/attendance/today`)
  - Shows today's clock_in time, clock_out time, OT hours
  - Below: monthly calendar grid showing each day's status with color (present=green, late=yellow, absent=red)

- [x] `app/app/hr/attendance/page.tsx` — HR/manager view:
  - Filter by employee (select from `/api/hr/employees`) + month picker
  - Table: Date, Employee, Clock In, Clock Out, OT Hours, Status
  - Admin/manager can manually edit note/status via inline edit

- [x] Commit: `git add app/app/hr/attendance/ && git commit -m "feat(hr): Phase 3 pages — attendance"`

---

## Phase 4: Payroll + Accounting Integration

### Task 16: Migration `022_hr_payroll.sql`

**File:** `migrations/022_hr_payroll.sql`

- [x] Create with this exact content:

```sql
-- ─────────────────────────────────────────────
-- HR Phase 4: Payroll
-- ─────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS seq_pyr START 1;

-- Thai income tax brackets (2024)
CREATE TABLE IF NOT EXISTS tax_brackets (
  id          SERIAL PRIMARY KEY,
  income_from NUMERIC(15,2) NOT NULL,
  income_to   NUMERIC(15,2),             -- NULL = no upper bound
  rate        NUMERIC(5,4) NOT NULL
);

INSERT INTO tax_brackets (income_from, income_to, rate) VALUES
  (0,           150000,  0.00),
  (150000.01,   300000,  0.05),
  (300000.01,   500000,  0.10),
  (500000.01,   750000,  0.15),
  (750000.01,  1000000,  0.20),
  (1000000.01, 2000000,  0.25),
  (2000000.01, 5000000,  0.30),
  (5000000.01,  NULL,    0.35)
ON CONFLICT DO NOTHING;

-- Requires migration 018_accounting.sql: accounts table must exist
CREATE TABLE IF NOT EXISTS hr_payroll_accounts (
  id                        INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  salary_expense_account_id UUID REFERENCES accounts(id),
  sso_expense_account_id    UUID REFERENCES accounts(id),
  salary_payable_account_id UUID REFERENCES accounts(id),
  sso_payable_account_id    UUID REFERENCES accounts(id),
  tax_payable_account_id    UUID REFERENCES accounts(id),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payroll runs
CREATE TABLE IF NOT EXISTS payroll_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_number      VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('PYR','seq_pyr'),
  period_month    INT  NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year     INT  NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  total_gross     NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_net       NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_sso_emp   NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_sso_co    NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_tax       NUMERIC(15,2) NOT NULL DEFAULT 0,
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(period_month, period_year),
  CONSTRAINT chk_payroll_status CHECK (status IN ('draft','processing','approved','paid','void'))
);

CREATE OR REPLACE TRIGGER trg_payroll_runs_updated_at
  BEFORE UPDATE ON payroll_runs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Payroll lines (one per employee per run)
CREATE TABLE IF NOT EXISTS payroll_lines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES users(id),
  base_salary       NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowances        JSONB NOT NULL DEFAULT '[]',
  ot_pay            NUMERIC(12,2) NOT NULL DEFAULT 0,
  absence_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
  gross_pay         NUMERIC(12,2) NOT NULL DEFAULT 0,
  sso_employee      NUMERIC(10,2) NOT NULL DEFAULT 0,
  sso_employer      NUMERIC(10,2) NOT NULL DEFAULT 0,
  taxable_income    NUMERIC(12,2) NOT NULL DEFAULT 0,
  income_tax        NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_deductions  NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_pay           NUMERIC(12,2) NOT NULL DEFAULT 0,
  slip_url          TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(run_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_lines_run ON payroll_lines(run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_lines_emp ON payroll_lines(employee_id);
```

- [x] Run `npm run migrate`
- [x] Commit: `git add migrations/022_hr_payroll.sql && git commit -m "feat(hr): Phase 4 migration — payroll tables"`

---

### Task 17: Types for Phase 4

**File:** `types/index.ts` (append)

- [x] Add:

```typescript
export type PayrollRunStatus = 'draft' | 'processing' | 'approved' | 'paid' | 'void';

export interface PayrollAllowance {
  name_th: string;
  name_en: string;
  amount: number;
}

export interface PayrollLine {
  id: string;
  run_id: string;
  employee_id: string;
  employee_name: string;
  employee_id_code: string | null;
  base_salary: number;
  allowances: PayrollAllowance[];
  ot_pay: number;
  absence_deduction: number;
  gross_pay: number;
  sso_employee: number;
  sso_employer: number;
  taxable_income: number;
  income_tax: number;
  total_deductions: number;
  net_pay: number;
  slip_url: string | null;
}

export interface PayrollRun {
  id: string;
  run_number: string;
  period_month: number;
  period_year: number;
  status: PayrollRunStatus;
  total_gross: number;
  total_net: number;
  total_sso_emp: number;
  total_sso_co: number;
  total_tax: number;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  journal_entry_id: string | null;
  created_by: string;
  created_by_name: string;
  created_at: string;
  lines?: PayrollLine[];
}
```

- [x] Commit: `git add types/index.ts && git commit -m "feat(hr): add Phase 4 payroll types"`

---

### Task 18: Payroll Calculation Helper

**File:** `lib/hr/payroll-calc.ts` (create new file)

- [x] Create `lib/hr/payroll-calc.ts`:

```typescript
// Thai Social Security: 5% of min(gross, 15000), max 750 THB
export function calcSSO(grossPay: number): number {
  const base = Math.min(grossPay, 15000);
  return Math.round(base * 0.05 * 100) / 100;
}

// Thai progressive income tax (annual)
const TAX_BRACKETS = [
  { from: 0, to: 150000, rate: 0 },
  { from: 150000, to: 300000, rate: 0.05 },
  { from: 300000, to: 500000, rate: 0.10 },
  { from: 500000, to: 750000, rate: 0.15 },
  { from: 750000, to: 1000000, rate: 0.20 },
  { from: 1000000, to: 2000000, rate: 0.25 },
  { from: 2000000, to: 5000000, rate: 0.30 },
  { from: 5000000, to: Infinity, rate: 0.35 },
];

function calcAnnualTax(taxableAnnual: number): number {
  let tax = 0;
  for (const bracket of TAX_BRACKETS) {
    if (taxableAnnual <= bracket.from) break;
    const inBracket = Math.min(taxableAnnual - bracket.from, bracket.to - bracket.from);
    tax += inBracket * bracket.rate;
  }
  return Math.round(tax * 100) / 100;
}

export interface CalcInput {
  baseSalary: number;
  allowancesTotal: number;
  otPay: number;
  absenceDeduction: number;
}

export interface CalcResult {
  grossPay: number;
  ssoEmployee: number;
  ssoEmployer: number;
  taxableIncome: number;
  incomeTax: number;
  totalDeductions: number;
  netPay: number;
}

export function calcPayroll(input: CalcInput): CalcResult {
  const grossPay = input.baseSalary + input.allowancesTotal + input.otPay - input.absenceDeduction;

  const ssoEmployee = calcSSO(grossPay);
  const ssoEmployer = calcSSO(grossPay);

  // Annualized withholding tax
  const annualGross = grossPay * 12;
  const expenseDeduction = Math.min(annualGross * 0.5, 100000);
  const personalExemption = 60000;
  const taxableAnnual = Math.max(0, annualGross - expenseDeduction - personalExemption);
  const annualTax = calcAnnualTax(taxableAnnual);
  const incomeTax = Math.round((annualTax / 12) * 100) / 100;

  const taxableIncome = taxableAnnual / 12;
  const totalDeductions = ssoEmployee + incomeTax;
  const netPay = grossPay - totalDeductions;

  return { grossPay, ssoEmployee, ssoEmployer, taxableIncome, incomeTax, totalDeductions, netPay };
}

// OT pay computation
// otType: 'weekday' (×1.5) | 'weekend' (×3)
export function calcOTPay(baseSalary: number, otHours: number, otType: 'weekday' | 'weekend' = 'weekday'): number {
  const hourlyRate = baseSalary / 26 / 8;
  const multiplier = otType === 'weekend' ? 3 : 1.5;
  return Math.round(hourlyRate * otHours * multiplier * 100) / 100;
}
```

- [x] Commit: `git add lib/hr/ && git commit -m "feat(hr): Thai payroll calculation helper"`

---

### Task 19: API — Payroll Runs

**Files:**
- Create: `app/api/hr/payroll-runs/route.ts`
- Create: `app/api/hr/payroll-runs/[id]/route.ts`
- Create: `app/api/hr/payroll-runs/[id]/slip/[employee_id]/route.ts`

- [x] Create `app/api/hr/payroll-runs/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { pool, query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';
import { calcPayroll, calcOTPay } from '@/lib/hr/payroll-calc';

const CreateSchema = z.object({
  period_month: z.number().int().min(1).max(12),
  period_year: z.number().int().min(2020),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const rows = await query(`
    SELECT pr.*, u.name_en AS created_by_name, a.name_en AS approved_by_name
    FROM payroll_runs pr
    JOIN users u ON u.id = pr.created_by
    LEFT JOIN users a ON a.id = pr.approved_by
    ORDER BY pr.period_year DESC, pr.period_month DESC
  `, []);
  return apiSuccess(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  if (u.role !== 'admin') return apiError('Forbidden', 403);

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);
  const { period_month, period_year } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create payroll run
    const runRes = await client.query<{ id: string; run_number: string }>(
      `INSERT INTO payroll_runs (period_month, period_year, created_by)
       VALUES ($1, $2, $3) RETURNING id, run_number`,
      [period_month, period_year, u.id]
    );
    const runId = runRes.rows[0].id;

    // Get all active employees
    const employees = await client.query<{
      id: string; base_salary: number | null;
    }>(`SELECT id, base_salary FROM users WHERE employee_status = 'active' AND base_salary IS NOT NULL`);

    let totalGross = 0, totalNet = 0, totalSsoEmp = 0, totalSsoCo = 0, totalTax = 0;

    for (const emp of employees.rows) {
      const baseSalary = emp.base_salary ?? 0;

      // Sum OT split by weekday/weekend (DOW 0=Sun, 6=Sat → 3×; Mon-Fri → 1.5×)
      const otRes = await client.query<{ ot_hours: string; is_weekend: boolean }>(
        `SELECT ot_hours, EXTRACT(DOW FROM work_date) IN (0,6) AS is_weekend
         FROM attendance_records
         WHERE employee_id = $1
           AND EXTRACT(MONTH FROM work_date) = $2
           AND EXTRACT(YEAR FROM work_date) = $3
           AND ot_hours > 0`,
        [emp.id, period_month, period_year]
      );
      let otPay = 0;
      for (const row of otRes.rows) {
        otPay += calcOTPay(baseSalary, Number(row.ot_hours), row.is_weekend ? 'weekend' : 'weekday');
      }

      // Absence deduction: count absent days × daily rate
      const absentRes = await client.query<{ absent_count: number }>(
        `SELECT COUNT(*) AS absent_count FROM attendance_records
         WHERE employee_id = $1 AND status = 'absent'
           AND EXTRACT(MONTH FROM work_date) = $2
           AND EXTRACT(YEAR FROM work_date) = $3`,
        [emp.id, period_month, period_year]
      );
      const absentDays = Number(absentRes.rows[0].absent_count);
      const absenceDeduction = Math.round((baseSalary / 26) * absentDays * 100) / 100;

      const result = calcPayroll({
        baseSalary,
        allowancesTotal: 0, // TODO: allowances per employee when implemented
        otPay,
        absenceDeduction,
      });

      await client.query(
        `INSERT INTO payroll_lines
          (run_id, employee_id, base_salary, ot_pay, absence_deduction,
           gross_pay, sso_employee, sso_employer, taxable_income, income_tax, total_deductions, net_pay)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [runId, emp.id, baseSalary, otPay, absenceDeduction,
         result.grossPay, result.ssoEmployee, result.ssoEmployer,
         result.taxableIncome, result.incomeTax, result.totalDeductions, result.netPay]
      );

      totalGross += result.grossPay;
      totalNet += result.netPay;
      totalSsoEmp += result.ssoEmployee;
      totalSsoCo += result.ssoEmployer;
      totalTax += result.incomeTax;
    }

    // Update run totals
    await client.query(
      `UPDATE payroll_runs SET total_gross=$1, total_net=$2, total_sso_emp=$3, total_sso_co=$4, total_tax=$5, status='processing'
       WHERE id=$6`,
      [totalGross, totalNet, totalSsoEmp, totalSsoCo, totalTax, runId]
    );

    await client.query('COMMIT');
    return apiSuccess({ id: runId, run_number: runRes.rows[0].run_number }, 201);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
```

- [x] Create `app/api/hr/payroll-runs/[id]/route.ts` — GET (with lines) + PATCH (actions: `approve` | `void`):

```typescript
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { pool, queryOne, query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('void') }),
]);

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const { id } = await params;

  const run = await queryOne(`
    SELECT pr.*, u.name_en AS created_by_name, a.name_en AS approved_by_name
    FROM payroll_runs pr
    JOIN users u ON u.id = pr.created_by
    LEFT JOIN users a ON a.id = pr.approved_by
    WHERE pr.id = $1
  `, [id]);
  if (!run) return apiError('Not found', 404);

  const lines = await query(`
    SELECT pl.*, u.name_en AS employee_name, u.employee_id AS employee_id_code
    FROM payroll_lines pl
    JOIN users u ON u.id = pl.employee_id
    WHERE pl.run_id = $1
    ORDER BY u.name_en
  `, [id]);

  return apiSuccess({ ...(run as object), lines });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  if (u.role !== 'admin') return apiError('Forbidden', 403);
  const { id } = await params;

  const body = await req.json();
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);

  const run = await queryOne<{ status: string; total_gross: number; total_net: number; total_sso_emp: number; total_sso_co: number; total_tax: number }>(
    `SELECT status, total_gross, total_net, total_sso_emp, total_sso_co, total_tax FROM payroll_runs WHERE id = $1`, [id]
  );
  if (!run) return apiError('Not found', 404);

  if (parsed.data.action === 'void') {
    if (!['draft','processing'].includes(run.status)) return apiError('Cannot void approved run', 400);
    await queryOne(`UPDATE payroll_runs SET status='void' WHERE id=$1`, [id]);
    return apiSuccess({ ok: true });
  }

  if (parsed.data.action === 'approve') {
    if (run.status !== 'processing') return apiError('Run must be in processing status', 400);

    // Load payroll account config
    const cfg = await queryOne<{
      salary_expense_account_id: string | null;
      sso_expense_account_id: string | null;
      salary_payable_account_id: string | null;
      sso_payable_account_id: string | null;
      tax_payable_account_id: string | null;
    }>(`SELECT * FROM hr_payroll_accounts WHERE id = 1`, []);

    if (!cfg || !cfg.salary_expense_account_id) {
      return apiError('Payroll account config not set. Go to HR > Payroll Settings to configure accounts.', 400);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Find open fiscal period
      const periodRes = await client.query<{ id: string }>(
        `SELECT id FROM fiscal_periods
         WHERE status = 'open'
           AND EXTRACT(YEAR FROM start_date) = (SELECT period_year FROM payroll_runs WHERE id = $1)
           AND EXTRACT(MONTH FROM start_date) = (SELECT period_month FROM payroll_runs WHERE id = $1)
         LIMIT 1`,
        [id]
      );
      if (!periodRes.rows.length) {
        throw new Error('No open fiscal period found for this payroll period. Create and open it in Accounting first.');
      }
      const fiscalPeriodId = periodRes.rows[0].id;

      // Create Journal Entry
      const jeRes = await client.query<{ id: string }>(
        `INSERT INTO journal_entries (fiscal_period_id, entry_date, entry_type, reference_type, reference_id, description, status, posted_by, posted_at, created_by)
         VALUES ($1, NOW()::DATE, 'manual', 'payroll_run', $2, 'Payroll run ' || (SELECT run_number FROM payroll_runs WHERE id=$2), 'posted', $3, NOW(), $3)
         RETURNING id`,
        [fiscalPeriodId, id, u.id]
      );
      const jeId = jeRes.rows[0].id;

      // JE Lines
      const lines = [
        { account_id: cfg.salary_expense_account_id, debit: run.total_gross, credit: 0, desc: 'Salary expense' },
        { account_id: cfg.sso_expense_account_id,    debit: run.total_sso_co, credit: 0, desc: 'SSO employer contribution' },
        { account_id: cfg.salary_payable_account_id, debit: 0, credit: run.total_net, desc: 'Salary payable' },
        { account_id: cfg.sso_payable_account_id,    debit: 0, credit: run.total_sso_emp + run.total_sso_co, desc: 'SSO payable' },
        { account_id: cfg.tax_payable_account_id,    debit: 0, credit: run.total_tax, desc: 'Withholding tax payable' },
      ];

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        await client.query(
          `INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount, line_number)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [jeId, l.account_id, l.desc, l.debit, l.credit, i + 1]
        );
      }

      // Approve run and link JE
      await client.query(
        `UPDATE payroll_runs SET status='approved', approved_by=$1, approved_at=NOW(), journal_entry_id=$2 WHERE id=$3`,
        [u.id, jeId, id]
      );

      await client.query('COMMIT');
      return apiSuccess({ ok: true, journal_entry_id: jeId });
    } catch (e) {
      await client.query('ROLLBACK');
      const msg = e instanceof Error ? e.message : 'Payroll approval failed';
      return apiError(msg, 500);
    } finally {
      client.release();
    }
  }

  return apiError('Unknown action', 400);
}
```

- [x] Commit: `git add app/api/hr/payroll-runs/ && git commit -m "feat(hr): payroll runs API — create, get, approve with auto JE"`

---

### Task 20: Payroll Slip PDF

**Install dependency first:**

- [x] Run: `npm install @react-pdf/renderer`

- [x] Create `app/api/hr/payroll-runs/[id]/slip/[employee_id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { queryOne } from '@/lib/db/client';
import { apiError } from '@/lib/api-response';
import { renderToBuffer, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { SessionUser } from '@/lib/authz';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10 },
  title: { fontSize: 16, marginBottom: 12, textAlign: 'center' },
  section: { marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  label: { color: '#555' },
  divider: { borderBottom: 1, borderColor: '#ddd', marginVertical: 6 },
  total: { fontSize: 12, fontWeight: 'bold' },
});

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string; employee_id: string }> }
) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  const { id, employee_id } = await params;

  // Staff can only get own slip
  if (u.role === 'staff' && u.id !== employee_id) return apiError('Forbidden', 403);

  const line = await queryOne<{
    employee_name: string; employee_id_code: string | null;
    base_salary: number; allowances: string; ot_pay: number;
    absence_deduction: number; gross_pay: number; sso_employee: number;
    income_tax: number; net_pay: number;
  }>(`
    SELECT pl.*, u.name_en AS employee_name, u.employee_id AS employee_id_code
    FROM payroll_lines pl
    JOIN users u ON u.id = pl.employee_id
    WHERE pl.run_id = $1 AND pl.employee_id = $2
  `, [id, employee_id]);
  if (!line) return apiError('Not found', 404);

  const run = await queryOne<{ run_number: string; period_month: number; period_year: number }>(
    `SELECT run_number, period_month, period_year FROM payroll_runs WHERE id = $1`, [id]
  );
  if (!run) return apiError('Not found', 404);

  const allowances: { name_th: string; amount: number }[] = JSON.parse(String(line.allowances) || '[]');

  const SlipDoc = () => (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>ใบเงินเดือน / Payslip</Text>
        <Text style={{ textAlign: 'center', marginBottom: 12, color: '#666' }}>
          {`${run.period_month}/${run.period_year}  •  ${run.run_number}`}
        </Text>

        <View style={styles.section}>
          <View style={styles.row}><Text style={styles.label}>พนักงาน / Employee</Text><Text>{line.employee_name}</Text></View>
          {line.employee_id_code && <View style={styles.row}><Text style={styles.label}>รหัสพนักงาน</Text><Text>{line.employee_id_code}</Text></View>}
        </View>

        <View style={styles.divider} />
        <Text style={{ marginBottom: 4, fontWeight: 'bold' }}>รายได้ / Earnings</Text>
        <View style={styles.row}><Text>เงินเดือน</Text><Text>{line.base_salary.toFixed(2)}</Text></View>
        {allowances.map((a, i) => <View key={i} style={styles.row}><Text>{a.name_th}</Text><Text>{a.amount.toFixed(2)}</Text></View>)}
        {line.ot_pay > 0 && <View style={styles.row}><Text>ค่าล่วงเวลา (OT)</Text><Text>{line.ot_pay.toFixed(2)}</Text></View>}
        {line.absence_deduction > 0 && <View style={styles.row}><Text style={{ color: 'red' }}>หักขาด</Text><Text style={{ color: 'red' }}>-{line.absence_deduction.toFixed(2)}</Text></View>}
        <View style={[styles.row, { marginTop: 4 }]}><Text style={{ fontWeight: 'bold' }}>รายได้รวม</Text><Text style={{ fontWeight: 'bold' }}>{line.gross_pay.toFixed(2)}</Text></View>

        <View style={styles.divider} />
        <Text style={{ marginBottom: 4, fontWeight: 'bold' }}>รายหัก / Deductions</Text>
        <View style={styles.row}><Text>ประกันสังคม (5%)</Text><Text>-{line.sso_employee.toFixed(2)}</Text></View>
        <View style={styles.row}><Text>ภาษีหัก ณ ที่จ่าย</Text><Text>-{line.income_tax.toFixed(2)}</Text></View>

        <View style={styles.divider} />
        <View style={[styles.row, styles.total]}>
          <Text>เงินเดือนสุทธิ / Net Pay</Text>
          <Text>{line.net_pay.toFixed(2)} THB</Text>
        </View>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(<SlipDoc />);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="slip-${line.employee_name}-${run.period_year}-${String(run.period_month).padStart(2,'0')}.pdf"`,
    },
  });
}
```

- [x] Commit: `git add app/api/hr/payroll-runs/ && git commit -m "feat(hr): payroll slip PDF generation"`

---

### Task 21: Pages — Payroll

**Files:**
- Create: `app/app/hr/payroll/page.tsx`
- Create: `app/app/hr/payroll/new/page.tsx`
- Create: `app/app/hr/payroll/[id]/page.tsx`
- Create: `app/app/hr/payroll/settings/page.tsx`

- [x] `app/app/hr/payroll/page.tsx` — list of payroll runs. Columns: Run #, Period (MM/YYYY), Total Gross, Total Net, Status, Created By, Actions. `<StatusBadge>` for status. "สร้างรอบเงินเดือน" button → `/app/hr/payroll/new`.

- [x] `app/app/hr/payroll/new/page.tsx` — form with month/year selector. Submit → POST `/api/hr/payroll-runs` → redirect to run detail. Show confirmation that it will compute for all active employees.

- [x] `app/app/hr/payroll/[id]/page.tsx` — run detail:
  - Header: run number, period, status, totals summary cards (Gross / Net / SSO / Tax)
  - Lines table: Employee, Base Salary, OT, Deductions, Gross, Net. Download slip button per row (`GET /api/hr/payroll-runs/[id]/slip/[employee_id]` in new tab)
  - Footer actions: **Approve** (admin, when processing) / **Void** (admin, when draft/processing)
  - If approved: show link to Journal Entry

- [x] `app/app/hr/payroll/settings/page.tsx` — form to set `hr_payroll_accounts`: 5 account selectors (salary expense, SSO expense, salary payable, SSO payable, tax payable). Loads accounts from `/api/accounting/chart-of-accounts`. PATCH to `/api/hr/payroll-accounts`.

- [x] Add `GET/PATCH /api/hr/payroll-accounts/route.ts` for the settings page:

```typescript
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { queryOne } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const row = await queryOne(`SELECT * FROM hr_payroll_accounts WHERE id = 1`, []);
  return apiSuccess(row ?? {});
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  if (u.role !== 'admin') return apiError('Forbidden', 403);

  const Schema = z.object({
    salary_expense_account_id: z.string().uuid().nullable(),
    sso_expense_account_id: z.string().uuid().nullable(),
    salary_payable_account_id: z.string().uuid().nullable(),
    sso_payable_account_id: z.string().uuid().nullable(),
    tax_payable_account_id: z.string().uuid().nullable(),
  });
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);
  const d = parsed.data;

  await queryOne(`
    INSERT INTO hr_payroll_accounts (id, salary_expense_account_id, sso_expense_account_id, salary_payable_account_id, sso_payable_account_id, tax_payable_account_id)
    VALUES (1, $1, $2, $3, $4, $5)
    ON CONFLICT (id) DO UPDATE SET
      salary_expense_account_id = $1,
      sso_expense_account_id    = $2,
      salary_payable_account_id = $3,
      sso_payable_account_id    = $4,
      tax_payable_account_id    = $5,
      updated_at = NOW()
  `, [d.salary_expense_account_id, d.sso_expense_account_id,
      d.salary_payable_account_id, d.sso_payable_account_id, d.tax_payable_account_id]);

  return apiSuccess({ ok: true });
}
```

- [x] Add payroll settings link to sidebar HR group: `{ href: '/app/hr/payroll/settings', label: 'ตั้งค่า Payroll', icon: '⚙️', roles: ['admin'] }`

- [x] Commit: `git add app/app/hr/payroll/ app/api/hr/payroll-accounts/ && git commit -m "feat(hr): Phase 4 pages — payroll runs + settings"`

---

## Phase 5: Permissions + Seed

### Task 22: Migration `023_hr_permissions.sql`

**File:** `migrations/023_hr_permissions.sql`

- [x] Create:

```sql
-- ─────────────────────────────────────────────
-- HR Permissions
-- ─────────────────────────────────────────────

INSERT INTO permissions (id, name_th, name_en, module, sort_order) VALUES
  ('hr:employees:view',    'ดูพนักงาน',          'View Employees',       'hr', 200),
  ('hr:employees:create',  'เพิ่มพนักงาน',        'Create Employees',     'hr', 201),
  ('hr:employees:edit',    'แก้ไขพนักงาน',        'Edit Employees',       'hr', 202),
  ('hr:departments:view',  'ดูแผนก',              'View Departments',     'hr', 210),
  ('hr:departments:edit',  'แก้ไขแผนก',           'Edit Departments',     'hr', 211),
  ('hr:leave:view',        'ดูวันลา',             'View Leave',           'hr', 220),
  ('hr:leave:create',      'ขอลา',                'Request Leave',        'hr', 221),
  ('hr:leave:approve',     'อนุมัติวันลา',        'Approve Leave',        'hr', 222),
  ('hr:attendance:view',   'ดูการเข้างาน',        'View Attendance',      'hr', 230),
  ('hr:attendance:edit',   'แก้ไขการเข้างาน',     'Edit Attendance',      'hr', 231),
  ('hr:payroll:view',      'ดูเงินเดือน',         'View Payroll',         'hr', 240),
  ('hr:payroll:run',       'คำนวณเงินเดือน',      'Run Payroll',          'hr', 241),
  ('hr:payroll:approve',   'อนุมัติเงินเดือน',    'Approve Payroll',      'hr', 242)
ON CONFLICT (id) DO NOTHING;

-- system_admin: all HR permissions
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000001', id FROM permissions WHERE module = 'hr'
ON CONFLICT DO NOTHING;

-- system_manager: view + leave:approve + attendance:view
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000002', id FROM permissions
  WHERE id IN ('hr:employees:view','hr:departments:view','hr:leave:view','hr:leave:approve',
               'hr:attendance:view')
ON CONFLICT DO NOTHING;

-- system_staff: own attendance + own leave
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000003', id FROM permissions
  WHERE id IN ('hr:attendance:view','hr:leave:view','hr:leave:create')
ON CONFLICT DO NOTHING;
```

- [x] Run `npm run migrate`
- [x] Commit: `git add migrations/023_hr_permissions.sql && git commit -m "feat(hr): Phase 5 — HR permissions migration"`

---

## Verification Checklist

After all tasks complete, run:

- [x] `npm run lint` — no errors
- [x] `npm run build` — no TypeScript errors
- [x] Manual test Phase 1:
  - Visit `/app/hr/departments` — list loads, create dept works
  - Visit `/app/hr/employees` — list loads with dept/position filters
  - Open employee detail → tabs visible
- [x] Manual test Phase 2:
  - Submit leave request as staff → shows in list
  - Approve as manager → balance updated
- [x] Manual test Phase 3:
  - Clock in → status shown on `/app/hr/attendance/my`
  - Clock out → OT hours computed if after shift
- [x] Manual test Phase 4:
  - Create payroll run → lines computed for all active employees
  - Set payroll accounts in settings
  - Approve run → Journal Entry created in Accounting
  - Download PDF slip → renders correctly
- [x] Create `execution-summary.md` in this track folder

---

## Phase 6: QA Critical Fixes (Billy Audit — 2026-05-13)

> **Context:** Billy QA found real bugs after Phase 1-5 implementation. Tasks below fix confirmed issues.
> MF-3/MF-5/MF-6/SF-1/SF-3/SF-7 were **already correct** in actual code — no action needed.

### Task 23: Fix `u.name` → `u.name_th`/`u.name_en` (MF-4)

**Problem:** `users` table has no `name` column — only `name_th` and `name_en`. All HR API routes using `u.name` will throw PostgreSQL runtime errors.

**Files to edit:**

- [ ] `app/api/hr/employees/route.ts`
  - Line 23: replace `u.name ILIKE $${idx}` → `(u.name_th ILIKE $${idx} OR u.name_en ILIKE $${idx} OR u.employee_id ILIKE $${idx} OR u.email ILIKE $${idx})`
  - Line 33: replace `u.name,` → `u.name_th, u.name_en,`
  - Line 44: replace `ORDER BY u.name` → `ORDER BY u.name_th`

- [ ] `app/api/hr/attendance/route.ts`
  - Line 22: replace `u.name AS employee_name` → `u.name_th AS employee_name_th, u.name_en AS employee_name_en`
  - Line 26: replace `ORDER BY ar.work_date, u.name` → `ORDER BY ar.work_date, u.name_th`

- [ ] `app/api/hr/leave-requests/route.ts`
  - Line 42: replace `u.name AS employee_name,` → `u.name_th AS employee_name_th, u.name_en AS employee_name_en,`
  - Line 44: replace `a.name AS approved_by_name` → `a.name_th AS approved_by_name_th, a.name_en AS approved_by_name_en`

- [ ] `app/api/hr/leave-requests/[id]/route.ts`
  - Line 21: replace `u.name AS employee_name,` → `u.name_th AS employee_name_th, u.name_en AS employee_name_en,`
  - Line 23: replace `a.name AS approved_by_name` → `a.name_th AS approved_by_name_th, a.name_en AS approved_by_name_en`

- [ ] `app/api/hr/payroll-runs/route.ts`
  - Line 21: replace `u.name AS created_by_name` → `u.name_th AS created_by_name_th, u.name_en AS created_by_name_en`

- [ ] `app/api/hr/payroll-runs/[id]/route.ts`
  - Line 13: replace `u.name AS created_by_name, a.name AS approved_by_name` → `u.name_th AS created_by_name_th, u.name_en AS created_by_name_en, a.name_th AS approved_by_name_th, a.name_en AS approved_by_name_en`
  - Line 22: replace `u.name AS employee_name` → `u.name_th AS employee_name_th, u.name_en AS employee_name_en`
  - Line 26: replace `ORDER BY u.name` → `ORDER BY u.name_th`

- [ ] `app/api/hr/payroll-runs/[id]/slip/[employee_id]/route.tsx`
  - Line 37: replace `u.name AS employee_name` → `COALESCE(u.name_th, u.name_en) AS employee_name`

- [ ] `app/api/hr/departments/route.ts`
  - Replace `u.name AS manager_name` → `u.name_th AS manager_name_th, u.name_en AS manager_name_en`

- [ ] `app/api/hr/departments/[id]/route.ts`
  - Replace `u.name AS manager_name` → `u.name_th AS manager_name_th, u.name_en AS manager_name_en`

- [ ] Update TypeScript interfaces in UI pages/components that read `employee_name`, `created_by_name`, `approved_by_name` to use `_th`/`_en` variants. Display: use `name_th || name_en` pattern.

- [ ] Commit: `git add app/api/hr/ && git commit -m "fix(hr): replace u.name with u.name_th/name_en — users table has no name column"`

---

### Task 24: Remove FK to `accounts` table in migration 022 (MF-1)

**Problem:** `migrations/022_hr_payroll.sql` lines 29-34 have `REFERENCES accounts(id)` on 5 columns. Fresh `npm run migrate` fails if accounting module not deployed.

**Sub-task A — edit the migration (fresh deploys):**

- [ ] Edit `migrations/022_hr_payroll.sql`: replace lines 27-35 (`hr_payroll_accounts` CREATE TABLE block) with:

```sql
-- Payroll account mapping (singleton)
-- account_id columns reference accounts(id) when accounting module deployed — no FK enforced
CREATE TABLE IF NOT EXISTS hr_payroll_accounts (
  id                        INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  salary_expense_account_id UUID,  -- references accounts(id)
  sso_expense_account_id    UUID,  -- references accounts(id)
  salary_payable_account_id UUID,  -- references accounts(id)
  sso_payable_account_id    UUID,  -- references accounts(id)
  tax_payable_account_id    UUID,  -- references accounts(id)
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Sub-task B — migration for existing DBs:**

- [ ] Create `migrations/024_hr_fix_accounting_fk.sql`:

```sql
-- Drop FK constraints added by 022_hr_payroll.sql against accounts table.
-- These FKs break if accounting module is not deployed.
-- account_id columns remain; app-level referential integrity only.

ALTER TABLE hr_payroll_accounts
  DROP CONSTRAINT IF EXISTS hr_payroll_accounts_salary_expense_account_id_fkey,
  DROP CONSTRAINT IF EXISTS hr_payroll_accounts_sso_expense_account_id_fkey,
  DROP CONSTRAINT IF EXISTS hr_payroll_accounts_salary_payable_account_id_fkey,
  DROP CONSTRAINT IF EXISTS hr_payroll_accounts_sso_payable_account_id_fkey,
  DROP CONSTRAINT IF EXISTS hr_payroll_accounts_tax_payable_account_id_fkey;
```

- [ ] Run `npm run migrate`
- [ ] Commit: `git add migrations/ && git commit -m "fix(hr): remove accounts FK from hr_payroll_accounts — deferred dependency"`

---

### Task 25: Add warehouse scope to payroll-runs GET + pagination to attendance/payroll-runs (MF-2, MF-7)

**Problem:** `payroll-runs/route.ts` GET has no warehouse scope. `attendance/route.ts` GET has no pagination (returns all rows for month). Both violate CLAUDE.md rules.

- [ ] Edit `app/api/hr/payroll-runs/route.ts` GET handler — add `buildWarehouseScopeClause` via employee subquery and add pagination:

```typescript
import { buildWarehouseScopeClause } from '@/lib/authz';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  const { searchParams } = new URL(req.url);
  const year = searchParams.get('year') ?? String(new Date().getFullYear());
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  const conditions: string[] = ['pr.period_year = $1'];
  const params: unknown[] = [year];
  let idx = 2;

  // Warehouse scope via employees in this run
  const scope = buildWarehouseScopeClause(u, 'u2.warehouse_id', idx);
  if (scope) {
    conditions.push(`EXISTS (
      SELECT 1 FROM payroll_lines pl2
      JOIN users u2 ON u2.id = pl2.employee_id
      WHERE pl2.run_id = pr.id AND ${scope.clause}
    )`);
    params.push(...scope.params);
    idx += scope.params.length;
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const rows = await query(`
    SELECT pr.*, u.name_th AS created_by_name_th, u.name_en AS created_by_name_en
    FROM payroll_runs pr
    JOIN users u ON u.id = pr.created_by
    ${where}
    ORDER BY pr.period_year DESC, pr.period_month DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `, [...params, limit, offset]);

  const [{ count }] = await query<{ count: string }>(`
    SELECT COUNT(*) FROM payroll_runs pr ${where}
  `, params);

  return apiSuccess({ runs: rows, total: parseInt(count), page, limit });
}
```

- [ ] Edit `app/api/hr/attendance/route.ts` GET handler — add pagination:

```typescript
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  const { searchParams } = new URL(req.url);
  const empId = searchParams.get('employee_id') ?? (u.role === 'staff' ? u.id : '');
  const month = searchParams.get('month');
  if (!month) return apiError('month required (YYYY-MM)', 400);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  const conditions = [`work_date >= $1`, `work_date <= $2`];
  const params: unknown[] = [`${month}-01`, `${month}-31`];
  let idx = 3;
  if (empId) { conditions.push(`ar.employee_id = $${idx++}`); params.push(empId); }

  const rows = await query(`
    SELECT ar.*, u.name_th AS employee_name_th, u.name_en AS employee_name_en
    FROM attendance_records ar
    JOIN users u ON u.id = ar.employee_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY ar.work_date DESC, u.name_th
    LIMIT $${idx} OFFSET $${idx + 1}
  `, [...params, limit, offset]);

  const [{ count }] = await query<{ count: string }>(`
    SELECT COUNT(*) FROM attendance_records ar WHERE ${conditions.join(' AND ')}
  `, params);

  return apiSuccess({ records: rows, total: parseInt(count), page, limit });
}
```

- [ ] Update attendance UI page (`app/app/hr/attendance/page.tsx`) to read `employee_name_th` instead of `employee_name` and handle paginated `{ records, total, page }` response shape.
- [ ] Update payroll page (`app/app/hr/payroll/page.tsx`) to handle `{ runs, total, page }` response shape.
- [ ] Commit: `git add app/api/hr/attendance/ app/api/hr/payroll-runs/ app/app/hr/ && git commit -m "fix(hr): add pagination to attendance API, warehouse scope + pagination to payroll-runs API"`

---

## Phase 7: QA Should-Fix (Billy Audit — 2026-05-13)

### Task 26: Self-approval guard on leave requests (SF-4)

- [ ] Edit `app/api/hr/leave-requests/[id]/route.ts` — add guard inside `approve` block after `lr` is fetched:

```typescript
if (action === 'approve') {
  if (!['admin','manager'].includes(u.role)) return apiError('Forbidden', 403);
  if (lr.employee_id === u.id) return apiError('Cannot approve own leave request', 403);
  if (lr.status !== 'submitted') return apiError('Can only approve submitted requests', 400);
  // ... rest unchanged
}
```

- [ ] Commit: `git add app/api/hr/leave-requests/ && git commit -m "fix(hr): prevent self-approval of leave requests"`

---

### Task 27: DB indexes for HR query columns (SF-5)

- [ ] Create `migrations/025_hr_indexes.sql`:

```sql
-- HR performance indexes
CREATE INDEX IF NOT EXISTS idx_employees_dept ON users(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance_records(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_leave_emp_status ON leave_requests(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_payroll_lines_run ON payroll_lines(run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_lines_emp ON payroll_lines(employee_id);
```

- [ ] Run `npm run migrate`
- [ ] Commit: `git add migrations/025_hr_indexes.sql && git commit -m "fix(hr): add indexes on HR query columns"`

---

### Task 28: SSO constants to lib/constants.ts (SF-6)

- [ ] Edit `lib/constants.ts` — append:

```typescript
// Thai Social Security
export const SSO_WAGE_CAP = 15000;
export const SSO_RATE = 0.05;
```

- [ ] Edit `lib/hr/payroll-calc.ts` — use constants:

```typescript
import { SSO_WAGE_CAP, SSO_RATE } from '@/lib/constants';

export function calcSSO(grossPay: number): number {
  const base = Math.min(grossPay, SSO_WAGE_CAP);
  return Math.round(base * SSO_RATE * 100) / 100;
}
```

- [ ] Commit: `git add lib/constants.ts lib/hr/payroll-calc.ts && git commit -m "fix(hr): extract SSO constants to lib/constants.ts"`

---

### Task 29: Replace inline date/currency formatters in HR UI (SF-2)

**Problem:** HR pages use `toLocaleDateString()` and `toLocaleString()` instead of project-standard `formatDate()` / `formatCurrency()`.

- [ ] Edit `app/app/hr/attendance/page.tsx:74` → `formatDate(r.work_date)`
- [ ] Edit `app/app/hr/attendance/my/page.tsx:139` → `formatDate(r.work_date)`
- [ ] Edit `app/app/hr/leave-requests/page.tsx:109` → `{formatDate(r.start_date)} - {formatDate(r.end_date)}`
- [ ] Edit `app/app/hr/leave-requests/[id]/page.tsx:70-73` → `formatDate(request.start_date)`, `formatDate(request.end_date)`, `formatDate(request.created_at)`
- [ ] Edit `app/app/hr/employees/[id]/page.tsx:169` → `formatCurrency(employee.base_salary ?? 0)`
- [ ] Edit `app/app/hr/payroll/page.tsx:76-77` → `formatCurrency(r.total_gross)`, `formatCurrency(r.total_net)`
- [ ] Edit `app/app/hr/payroll/[id]/page.tsx:98-103, 118` → `formatCurrency(...)` for all monetary values

Import pattern (add to each file that lacks it):
```typescript
import { formatDate, formatCurrency } from '@/lib/utils';
```

- [ ] Commit: `git add app/app/hr/ && git commit -m "fix(hr): use formatDate/formatCurrency in all HR UI pages"`

---

## QA Checklist (Phase 6+7)

After Gemini completes tasks 23-29:

- [ ] `npm run migrate` — no errors (test both fresh DB and existing DB)
- [ ] `npm run lint` — no errors
- [ ] `npm run build` — no TypeScript errors
- [ ] Manual: load `/app/hr/employees` as staff → only sees own warehouse employees
- [ ] Manual: load `/app/hr/payroll` → pagination works
- [ ] Manual: approve own leave request → gets 403
- [ ] Manual: payroll slip PDF renders with correct employee name

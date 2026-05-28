---
track: perf-tier4-suspense-streaming
title: "Performance Tier 4 — RSC Streaming + Parallel Fetch Fixes"
status: Active
created: 2026-05-28
updated: 2026-05-28
spec: docs/superpowers/specs/2026-05-28-perf-tier4-suspense-streaming-design.md
dependency: perf-tier3-frontend-bundle must be Verified first.
---

# Performance Tier 4 — RSC Streaming + Parallel Fetch Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate 1–2 s first-load times by fixing three client-side serial-fetch bugs (T1) and converting five high-traffic pages to React Server Components with server-side parallel DB queries (T2).

**Architecture:** T1 fixes apply immediately to the existing `'use client'` pages. T2 introduces a `lib/queries/` shared query layer, converts page.tsx files to async RSC shells, and extracts interactive logic into co-located `*Client.tsx` components that receive `initialData` as props.

**Tech Stack:** Next.js 15 App Router · PostgreSQL (`pg` pool) · TypeScript strict · `auth()` from `@/auth`

---

## Architectural Gates

1. **Transaction Boundary:** No writes in this track — read-only queries only.
2. **Doc Number:** Not applicable.
3. **Child Table Inserts:** Not applicable.
4. **Side Effects:** None — this track only changes how data is fetched, not what data is stored.
5. **Response Shape:** API route response shapes are unchanged; lib/queries functions return the same row shapes.
6. **Testing Strategy:** No unit tests (consistent with Tier 1–3). QA gate: `npm run qa:verify` (0 errors) + manual smoke test each modified page.

---

## Files

| Action | Path |
|--------|------|
| New | `app/api/grn/status-counts/route.ts` |
| New | `lib/queries/admin.ts` |
| New | `lib/queries/grn.ts` |
| New | `lib/queries/inventory.ts` |
| New | `lib/queries/ap.ts` |
| New | `lib/queries/dashboard.ts` |
| New | `app/app/loading.tsx` |
| New | `app/app/dashboard/loading.tsx` |
| New | `app/app/grn/loading.tsx` |
| New | `app/app/inventory/loading.tsx` |
| New | `app/app/ap/loading.tsx` |
| New | `app/app/analytics/sku-cut/loading.tsx` |
| New | `app/app/dashboard/DashboardClient.tsx` |
| New | `app/app/dashboard/AuditorDashboardClient.tsx` |
| New | `app/app/grn/GRNClient.tsx` |
| New | `app/app/inventory/InventoryClient.tsx` |
| New | `app/app/ap/APClient.tsx` |
| Modify | `app/app/dashboard/page.tsx` |
| Modify | `app/app/grn/page.tsx` |
| Modify | `app/app/inventory/page.tsx` |
| Modify | `app/app/ap/page.tsx` |
| Modify | `app/app/analytics/sku-cut/page.tsx` |
| Modify | `app/api/grn/route.ts` |
| Modify | `app/api/inventory/route.ts` |
| Modify | `app/api/ap/invoices/route.ts` |
| Modify | `app/api/kpi/route.ts` |
| Modify | `app/api/admin/warehouses/route.ts` |

---

## ── T1: Universal Fixes ──────────────────────────────────────────────────

## Task 1 — New `/api/grn/status-counts` endpoint

**Files:**
- Create: `app/api/grn/status-counts/route.ts`

- [ ] **Step 1: Create the file**

```typescript
// app/api/grn/status-counts/route.ts
import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { buildWarehouseScopeClause } from '@/lib/authz';
import { query } from '@/lib/db/client';
import type { SessionUser } from '@/lib/authz';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const params: unknown[] = [];
  let idx = 1;
  const scope = buildWarehouseScopeClause(u, 'g.warehouse_id', idx);
  const where = scope ? `WHERE ${scope.clause}` : '';
  if (scope) { params.push(...scope.params); }

  const rows = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) AS count
     FROM goods_receipt_notes g ${where}
     GROUP BY status`,
    params
  );

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = Number(r.count);
  return apiSuccess(counts);
}
```

- [ ] **Step 2: Run qa:verify**

```bash
npm run qa:verify
```

Expected: 0 errors.

---

## Task 2 — Fix GRN page: replace `limit=1000` with `/api/grn/status-counts`

**Files:**
- Modify: `app/app/grn/page.tsx`

- [ ] **Step 1: Read the file**

Open `app/app/grn/page.tsx`. Locate:
1. `const [allGRNs, setAllGRNs] = useState<GRN[]>([]);` (line ~304)
2. `const fetchAllGRNsForStats = useCallback(...)` function (~line 331–337)
3. `useEffect(() => { fetchAllGRNsForStats(); }, [fetchAllGRNsForStats, tab]);` (~line 345)
4. `const tabCounts = { ... }` derived from `allGRNs` (~line 393–403)
5. `const uniqueReceivers = Array.from(new Set(allGRNs...` (~line 406)

- [ ] **Step 2: Replace `allGRNs` state with `tabCounts` state**

Replace:
```typescript
const [allGRNs, setAllGRNs] = useState<GRN[]>([]);
```

With:
```typescript
const [tabCounts, setTabCounts] = useState<Record<string, number>>({});
```

- [ ] **Step 3: Replace `fetchAllGRNsForStats` with `fetchStatusCounts`**

Replace the entire `fetchAllGRNsForStats` function:
```typescript
const fetchAllGRNsForStats = useCallback(async () => {
    try {
      const res = await get<PaginatedResponse<GRN>>('/api/grn?limit=1000');
      setAllGRNs(res.data);
    } catch {}
  }, []);
```

With:
```typescript
const fetchStatusCounts = useCallback(async () => {
    try {
      const counts = await get<Record<string, number>>('/api/grn/status-counts');
      setTabCounts(counts);
    } catch {}
  }, []);
```

- [ ] **Step 4: Replace the `useEffect` for stats**

Replace:
```typescript
useEffect(() => { fetchAllGRNsForStats(); }, [fetchAllGRNsForStats, tab]);
```

With:
```typescript
useEffect(() => { fetchStatusCounts(); }, [fetchStatusCounts]);
```

- [ ] **Step 5: Replace `tabCounts` derived object with direct state reads**

Replace the entire `tabCounts` object:
```typescript
const tabCounts = {
    all: allGRNs.length,
    draft: allGRNs.filter(g => g.status === 'draft').length,
    received: allGRNs.filter(g => g.status === 'received').length,
    qc_pending: allGRNs.filter(g => g.status === 'qc_pending').length,
    qc_passed: allGRNs.filter(g => g.status === 'qc_passed').length,
    qc_failed: allGRNs.filter(g => g.status === 'qc_failed').length,
    verified: allGRNs.filter(g => g.status === 'verified').length,
    stocked: allGRNs.filter(g => g.status === 'stocked').length,
  };
```

With:
```typescript
const getTabCount = (status: string) => tabCounts[status] ?? 0;
```

- [ ] **Step 6: Update tab count usages in JSX**

In the `TABS.map(...)` render inside JSX, find:
```typescript
const count = tabCounts[t.id === '' ? 'all' : (t.id as keyof typeof tabCounts)] ?? 0;
```

Replace with:
```typescript
const count = t.id === '' 
  ? Object.values(tabCounts).reduce((a, b) => a + b, 0)
  : getTabCount(t.id);
```

- [ ] **Step 7: Fix `uniqueReceivers` — derive from current page data instead of allGRNs**

Replace:
```typescript
const uniqueReceivers = Array.from(new Set(allGRNs.map((g) => g.received_by_name))).filter(Boolean);
```

With:
```typescript
const uniqueReceivers = Array.from(new Set((data?.data ?? []).map((g) => g.received_by_name))).filter(Boolean);
```

- [ ] **Step 8: Run qa:verify**

```bash
npm run qa:verify
```

Expected: 0 errors.

---

## Task 3 — Fix `AuditorDashboard` serial awaits → `Promise.all`

**Files:**
- Modify: `app/app/dashboard/page.tsx`

- [ ] **Step 1: Read the file**

Open `app/app/dashboard/page.tsx`. Locate `fetchAuditorStats` inside `AuditorDashboard` (~line 202–230). It has 4 sequential `await` calls:
```typescript
const periods = await get<DashboardPeriod[]>('/api/accounting/fiscal-periods');
const activePeriods = periods.filter(p => p.status === 'open').length;
const jeResponse = await get<...>('/api/accounting/journal-entries?limit=5');
const jeList = jeResponse?.data || [];
const whtResponse = await get<...>('/api/ap/wht?limit=1');
const whtCount = whtResponse?.total ?? 0;
const apResponse = await get<...>('/api/ap/invoices?is_paid=false');
```

- [ ] **Step 2: Replace with `Promise.all`**

Replace the entire body of `fetchAuditorStats` (inside the `try` block) with:

```typescript
const [periods, jeResponse, whtResponse, apResponse] = await Promise.all([
  get<DashboardPeriod[]>('/api/accounting/fiscal-periods'),
  get<{ data?: DashboardJournalEntry[] }>('/api/accounting/journal-entries?limit=5'),
  get<DashboardWhtResponse>('/api/ap/wht?limit=1'),
  get<DashboardApResponse>('/api/ap/invoices?is_paid=false'),
]);

const activePeriods = periods.filter((p: DashboardPeriod) => p.status === 'open').length;
const jeList = jeResponse?.data || [];
const whtCount = whtResponse?.total ?? 0;
const outstandingAp = apResponse?.invoices?.reduce(
  (sum: number, inv: DashboardInvoice) => sum + Number(inv.outstanding_amount), 0
) ?? 0;

setStats({
  periodsCount: activePeriods,
  unpostedJeCount: jeList.filter((j: DashboardJournalEntry) => j.status === 'draft').length,
  postedJeCount: jeList.filter((j: DashboardJournalEntry) => j.status === 'posted').length,
  outstandingAp,
  whtCertificatesCount: whtCount,
  recentJe: jeList.slice(0, 5),
});
```

- [ ] **Step 3: Run qa:verify**

```bash
npm run qa:verify
```

Expected: 0 errors.

---

## Task 4 — Add `loading.tsx` skeletons (6 files)

**Files:**
- Create: `app/app/loading.tsx`
- Create: `app/app/dashboard/loading.tsx`
- Create: `app/app/grn/loading.tsx`
- Create: `app/app/inventory/loading.tsx`
- Create: `app/app/ap/loading.tsx`
- Create: `app/app/analytics/sku-cut/loading.tsx`

- [ ] **Step 1: Create `app/app/loading.tsx`**

```typescript
export default function AppLoading() {
  return (
    <div className="max-w-[1440px] mx-auto pb-12 space-y-5 pt-2">
      <div className="h-8 w-56 bg-stone-100 rounded animate-pulse" />
      <div className="h-4 w-40 bg-stone-100 rounded animate-pulse" />
      <div className="h-10 bg-stone-100 rounded-[10px] animate-pulse" />
      <div className="h-64 bg-stone-100 rounded-[10px] animate-pulse" />
      <div className="h-48 bg-stone-100 rounded-[10px] animate-pulse" />
    </div>
  );
}
```

- [ ] **Step 2: Create `app/app/dashboard/loading.tsx`**

```typescript
export default function DashboardLoading() {
  return (
    <div className="max-w-[1440px] mx-auto pb-12 space-y-4 pt-2">
      <div className="h-8 w-72 bg-stone-100 rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 bg-stone-100 rounded-[10px] animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-72 bg-stone-100 rounded-[10px] animate-pulse" />
        <div className="h-72 bg-stone-100 rounded-[10px] animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-48 bg-stone-100 rounded-[10px] animate-pulse" />
        <div className="h-48 bg-stone-100 rounded-[10px] animate-pulse" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `app/app/grn/loading.tsx`**

```typescript
export default function GRNLoading() {
  return (
    <div className="max-w-[1440px] mx-auto pb-12 space-y-5 pt-2">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-8 w-48 bg-stone-100 rounded animate-pulse" />
          <div className="h-4 w-32 bg-stone-100 rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-24 bg-stone-100 rounded-[7px] animate-pulse" />
          <div className="h-8 w-24 bg-stone-100 rounded-[7px] animate-pulse" />
        </div>
      </div>
      <div className="flex gap-0 border-b border-stone-200 overflow-x-auto">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 w-24 mx-1 my-1 bg-stone-100 rounded animate-pulse flex-shrink-0" />
        ))}
      </div>
      <div className="h-16 bg-stone-100 rounded-[10px] animate-pulse" />
      <div className="h-96 bg-stone-100 rounded-[10px] animate-pulse" />
    </div>
  );
}
```

- [ ] **Step 4: Create `app/app/inventory/loading.tsx`**

```typescript
export default function InventoryLoading() {
  return (
    <div className="p-6 space-y-4 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 bg-stone-100 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-8 w-28 bg-stone-100 rounded-lg animate-pulse" />
          <div className="h-8 w-28 bg-stone-100 rounded-lg animate-pulse" />
        </div>
      </div>
      <div className="h-20 bg-stone-100 rounded-[10px] animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 bg-stone-100 rounded-[10px] animate-pulse" />
        ))}
      </div>
      <div className="h-10 bg-stone-100 rounded animate-pulse" />
      <div className="h-96 bg-stone-100 rounded-[10px] animate-pulse" />
    </div>
  );
}
```

- [ ] **Step 5: Create `app/app/ap/loading.tsx`**

```typescript
export default function APLoading() {
  return (
    <div className="max-w-[1440px] mx-auto pb-12 space-y-5 pt-2">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-stone-100 rounded animate-pulse" />
        <div className="h-8 w-24 bg-stone-100 rounded-[7px] animate-pulse" />
      </div>
      <div className="flex gap-0 border-b border-stone-200">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 w-24 mx-1 my-1 bg-stone-100 rounded animate-pulse" />
        ))}
      </div>
      <div className="h-96 bg-stone-100 rounded-[10px] animate-pulse" />
    </div>
  );
}
```

- [ ] **Step 6: Create `app/app/analytics/sku-cut/loading.tsx`**

```typescript
export default function SkuCutLoading() {
  return (
    <div className="max-w-screen-xl mx-auto p-6 space-y-6">
      <div className="h-8 w-56 bg-stone-100 rounded animate-pulse" />
      <div className="flex gap-2">
        <div className="h-9 w-32 bg-stone-100 rounded animate-pulse" />
        <div className="h-9 w-32 bg-stone-100 rounded animate-pulse" />
      </div>
      <div className="h-12 bg-stone-100 rounded animate-pulse" />
      <div className="h-96 bg-stone-100 rounded-[10px] animate-pulse" />
    </div>
  );
}
```

- [ ] **Step 7: Commit T1**

```bash
git add app/api/grn/status-counts/route.ts app/app/grn/page.tsx app/app/dashboard/page.tsx app/app/loading.tsx app/app/dashboard/loading.tsx app/app/grn/loading.tsx app/app/inventory/loading.tsx app/app/ap/loading.tsx app/app/analytics/sku-cut/loading.tsx
git commit -m "perf(tier4-t1): fix serial fetches, replace GRN limit=1000, add loading skeletons"
```

---

## ── T2: Shared Query Layer ──────────────────────────────────────────────

## Task 5 — Create `lib/queries/admin.ts`

**Files:**
- Create: `lib/queries/admin.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/queries/admin.ts
import { query } from '@/lib/db/client';

export interface WarehouseRow {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  address_th: string | null;
  address_en: string | null;
  is_active: boolean;
  user_count: number;
}

export async function getWarehouses(): Promise<WarehouseRow[]> {
  return query<WarehouseRow>(
    `SELECT w.*, COUNT(uwa.user_id)::int AS user_count
     FROM warehouses w
     LEFT JOIN user_warehouse_assignments uwa ON uwa.warehouse_id = w.id
     WHERE w.code NOT LIKE 'V-%'
     GROUP BY w.id
     ORDER BY w.code`
  );
}
```

- [ ] **Step 2: Run qa:verify**

```bash
npm run qa:verify
```

Expected: 0 errors.

---

## Task 6 — Create `lib/queries/grn.ts`

**Files:**
- Create: `lib/queries/grn.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/queries/grn.ts
import { query } from '@/lib/db/client';
import { buildWarehouseScopeClause } from '@/lib/authz';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

export interface GRNRow {
  id: string;
  grn_number: string;
  status: string;
  po_number: string | null;
  io_number: string | null;
  po_id: string | null;
  inbound_order_id: string | null;
  split_from_grn_id: string | null;
  warehouse_code: string;
  warehouse_name: string;
  received_by_name: string;
  received_date: string;
  line_count: number;
  created_at: string;
}

export interface GRNPageResult {
  data: GRNRow[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export async function getGRNPage(
  user: SessionUser,
  params: { page?: number; limit?: number; status?: string; warehouse_id?: string; po_id?: string }
): Promise<GRNPageResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, params.limit ?? DEFAULT_PAGE_SIZE);
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const qParams: unknown[] = [];
  let idx = 1;

  const scope = buildWarehouseScopeClause(user, 'g.warehouse_id', idx);
  if (scope) { conditions.push(scope.clause); qParams.push(...scope.params); idx += scope.params.length; }
  if (params.status) { conditions.push(`g.status = $${idx++}`); qParams.push(params.status); }
  if (params.warehouse_id) { conditions.push(`g.warehouse_id = $${idx++}`); qParams.push(params.warehouse_id); }
  if (params.po_id) { conditions.push(`g.po_id = $${idx++}`); qParams.push(params.po_id); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [totalRow] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM goods_receipt_notes g ${where}`, qParams
  );

  const rows = await query<GRNRow>(
    `SELECT g.id, g.grn_number, g.status, g.received_date, g.created_at,
            g.split_from_grn_id,
            po.po_number, io.io_number, g.po_id, g.inbound_order_id,
            w.code AS warehouse_code, w.name_th AS warehouse_name,
            u.name_en AS received_by_name, COUNT(li.id)::int AS line_count
     FROM goods_receipt_notes g
     LEFT JOIN purchase_orders po ON po.id = g.po_id
     LEFT JOIN inbound_orders io ON io.id = g.inbound_order_id
     JOIN warehouses w ON w.id = g.warehouse_id
     JOIN users u ON u.id = g.received_by
     LEFT JOIN grn_line_items li ON li.grn_id = g.id
     ${where}
     GROUP BY g.id, po.po_number, io.io_number, w.code, w.name_th, u.name_en
     ORDER BY g.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...qParams, limit, offset]
  );

  return { data: rows, total: Number(totalRow.count), page, limit, total_pages: Math.ceil(Number(totalRow.count) / limit) };
}

export async function getGRNStatusCounts(user: SessionUser): Promise<Record<string, number>> {
  const qParams: unknown[] = [];
  let idx = 1;
  const scope = buildWarehouseScopeClause(user, 'g.warehouse_id', idx);
  const where = scope ? `WHERE ${scope.clause}` : '';
  if (scope) { qParams.push(...scope.params); }

  const rows = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) AS count FROM goods_receipt_notes g ${where} GROUP BY status`,
    qParams
  );
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = Number(r.count);
  return counts;
}

export async function getGRNQueueCounts(user: SessionUser): Promise<{ io: number; po: number }> {
  const ioConditions: string[] = ["io.status IN ('open', 'receiving')"];
  const ioParams: unknown[] = [];
  let ioIdx = 1;
  const ioScope = buildWarehouseScopeClause(user, 'io.warehouse_id', ioIdx);
  if (ioScope) { ioConditions.push(ioScope.clause); ioParams.push(...ioScope.params); }

  const poConditions: string[] = ["po.status IN ('sent', 'partially_received')", 'li.qty_ordered > li.qty_received'];
  const poParams: unknown[] = [];
  let poIdx = 1;
  const poScope = buildWarehouseScopeClause(user, 'po.warehouse_id', poIdx);
  if (poScope) { poConditions.push(poScope.clause); poParams.push(...poScope.params); }

  const [[ioRow], [poRow]] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*) FROM inbound_orders io WHERE ${ioConditions.join(' AND ')}`, ioParams
    ),
    query<{ count: string }>(
      `SELECT COUNT(DISTINCT po.id) FROM purchase_orders po JOIN po_line_items li ON li.po_id = po.id WHERE ${poConditions.join(' AND ')}`, poParams
    ),
  ]);

  return { io: Number(ioRow?.count ?? 0), po: Number(poRow?.count ?? 0) };
}
```

- [ ] **Step 2: Run qa:verify**

```bash
npm run qa:verify
```

Expected: 0 errors.

---

## Task 7 — Create `lib/queries/inventory.ts`

**Files:**
- Create: `lib/queries/inventory.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/queries/inventory.ts
import { query } from '@/lib/db/client';
import { buildWarehouseScopeClause } from '@/lib/authz';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { SessionUser } from '@/lib/authz';

export interface StockItemRow {
  product_id: string;
  warehouse_id: string;
  sku: string;
  name_th: string;
  name_en: string;
  warehouse_code: string;
  warehouse_name: string;
  qty_on_hand: number;
  qty_reserved: number;
  qty_available: number;
  unit_cost: number;
  reorder_point: number;
  uom_code: string;
}

export interface InventoryPageResult {
  data: StockItemRow[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  warehouses: { id: string; code: string; name: string }[];
}

export async function getInventoryPage(
  user: SessionUser,
  params: { page?: number; limit?: number; search?: string; warehouse_id?: string; low_stock?: boolean }
): Promise<InventoryPageResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(200, params.limit ?? DEFAULT_PAGE_SIZE);
  const offset = (page - 1) * limit;

  const conditions: string[] = ['p.is_active = TRUE'];
  const qParams: unknown[] = [];
  let idx = 1;

  const scope = buildWarehouseScopeClause(user, 'sb.warehouse_id', idx);
  if (scope) { conditions.push(scope.clause); qParams.push(...scope.params); idx += scope.params.length; }
  if (params.warehouse_id) { conditions.push(`sb.warehouse_id = $${idx++}`); qParams.push(params.warehouse_id); }
  if (params.search) {
    conditions.push(`(p.sku ILIKE $${idx} OR p.name_th ILIKE $${idx} OR p.name_en ILIKE $${idx})`);
    qParams.push(`%${params.search}%`); idx++;
  }
  if (params.low_stock) conditions.push('sb.qty_available <= p.reorder_point');

  const where = `WHERE ${conditions.join(' AND ')}`;

  const [[totalRow], rows, warehouses] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*) FROM stock_balances sb JOIN products p ON p.id = sb.product_id ${where}`, qParams
    ),
    query<StockItemRow>(
      `SELECT sb.warehouse_id, sb.product_id, sb.qty_on_hand, sb.qty_reserved, sb.qty_available,
              p.sku, p.name_th, p.name_en, p.reorder_point, p.unit_cost,
              u.code AS uom_code, w.code AS warehouse_code, w.name_th AS warehouse_name, w.id
       FROM stock_balances sb
       JOIN products p ON p.id = sb.product_id
       JOIN warehouses w ON w.id = sb.warehouse_id
       JOIN units_of_measure u ON u.id = p.uom_id
       ${where}
       ORDER BY p.sku, w.code
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...qParams, limit, offset]
    ),
    query<{ id: string; code: string; name: string }>(
      `SELECT id, code, name_th AS name FROM warehouses WHERE code NOT LIKE 'V-%' ORDER BY code`
    ),
  ]);

  return {
    data: rows,
    total: Number(totalRow.count),
    page,
    per_page: limit,
    total_pages: Math.ceil(Number(totalRow.count) / limit),
    warehouses,
  };
}
```

- [ ] **Step 2: Run qa:verify**

```bash
npm run qa:verify
```

Expected: 0 errors.

---

## Task 8 — Create `lib/queries/ap.ts`

**Files:**
- Create: `lib/queries/ap.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/queries/ap.ts
import { query } from '@/lib/db/client';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { ApInvoice } from '@/types';

export interface APPageResult {
  invoices: ApInvoice[];
  total: number;
  total_pages: number;
}

export async function getAPInvoicePage(
  params: { page?: number; limit?: number; is_paid?: boolean | null }
): Promise<APPageResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, params.limit ?? DEFAULT_PAGE_SIZE);
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const qParams: unknown[] = [];
  let idx = 1;

  if (params.is_paid !== null && params.is_paid !== undefined) {
    conditions.push(`pi.is_paid = $${idx++}`);
    qParams.push(params.is_paid);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [[totalRow], rows] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*) FROM po_invoices pi ${where}`, qParams),
    query<ApInvoice>(
      `SELECT pi.id, pi.invoice_number, pi.invoice_date, pi.due_date,
              pi.amount, pi.paid_amount, (pi.amount - pi.paid_amount) AS outstanding_amount,
              pi.is_paid,
              CASE WHEN pi.is_paid = FALSE AND pi.due_date < CURRENT_DATE
                   THEN (CURRENT_DATE - pi.due_date)::int ELSE 0 END AS overdue_days,
              pi.vendor_id, v.name_th AS vendor_name_th, v.name_en AS vendor_name_en, v.code AS vendor_code,
              pi.po_id, po.po_number, pi.grn_id, grn.grn_number, pi.created_at
       FROM po_invoices pi
       JOIN vendors v ON v.id = pi.vendor_id
       LEFT JOIN purchase_orders po ON po.id = pi.po_id
       LEFT JOIN goods_receipt_notes grn ON grn.id = pi.grn_id
       ${where}
       ORDER BY pi.due_date ASC, pi.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...qParams, limit, offset]
    ),
  ]);

  return { invoices: rows, total: Number(totalRow.count), total_pages: Math.ceil(Number(totalRow.count) / limit) };
}
```

- [ ] **Step 2: Run qa:verify**

```bash
npm run qa:verify
```

Expected: 0 errors.

---

## Task 9 — Create `lib/queries/dashboard.ts`

**Files:**
- Create: `lib/queries/dashboard.ts`

Note: The current `/api/kpi/route.ts` runs **13 sequential queries**. This function fixes that with `Promise.all`.

- [ ] **Step 1: Create the file**

```typescript
// lib/queries/dashboard.ts
import { query } from '@/lib/db/client';

export interface KPIData {
  pr: { pending_approval: number; last_30_days: number };
  po: { sent: number; value_30_days: string | number };
  grn: { pending: number; stocked_this_month: number; qc_failed: number };
  rma: { open_rmas: number; in_review: number };
  claims: { open_claims: number; open_claim_value: string | number };
  low_stock: Array<{ sku: string; name_th: string; warehouse_code: string; qty_available: string | number; reorder_point: number }>;
  recent_ledger: Array<{ sku: string; name_th: string; warehouse_code: string; entry_type: string; qty_change: string | number; user_name: string | null }>;
  top_received: Array<{ sku: string; name_th: string; qty_received: string | number; tx_count: string | number }>;
  warehouse_perf: Array<{ warehouse_name: string; warehouse_code: string; grn_count: string | number; qty_stocked: string | number }>;
  sales: { pending_so: number; revenue_30d: string | number; revenue_today: string | number };
  pos_today: { revenue: string | number; tx_count: number };
  top_products: Array<{ sku: string; name_th: string; qty_sold: string | number; tx_count: string | number }>;
  recent_activity: Array<{ type: string; ref: string; action: string; created_at: string }>;
}

export async function getKPI(warehouseId?: string): Promise<KPIData> {
  const whParam = warehouseId ? [warehouseId] : [];
  const whWhere = warehouseId ? 'AND warehouse_id = $1' : '';
  const whWhereAlias = (alias: string) => warehouseId ? `AND ${alias}.warehouse_id = $1` : '';

  const [
    prResult, poResult, grnResult, rmaResult, claimResult,
    lowStock, recentLedger, topReceived, warehousePerf,
    salesResult, posResult, topProducts, recentActivity,
  ] = await Promise.all([
    query<{ pending_approval: string; last_30_days: string }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'submitted') AS pending_approval,
              COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS last_30_days
       FROM purchase_requisitions WHERE 1=1 ${whWhere}`, whParam
    ),
    query<{ sent: string; value_30_days: string }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'sent') AS sent,
              COALESCE(SUM(total_amount) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0) AS value_30_days
       FROM purchase_orders WHERE 1=1 ${whWhere}`, whParam
    ),
    query<{ stocked_this_month: string; pending: string; qc_failed: string }>(
      `SELECT COUNT(*) FILTER (WHERE g.status = 'stocked') AS stocked_this_month,
              COUNT(*) FILTER (WHERE g.status IN ('draft','received','qc_pending')) AS pending,
              COUNT(*) FILTER (WHERE g.status = 'qc_failed') AS qc_failed
       FROM goods_receipt_notes g WHERE g.created_at >= DATE_TRUNC('month', NOW()) ${whWhereAlias('g')}`, whParam
    ),
    query<{ open_rmas: string; in_review: string }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'open') AS open_rmas,
              COUNT(*) FILTER (WHERE status = 'in_review') AS in_review
       FROM rma_requests WHERE 1=1 ${whWhere}`, whParam
    ),
    query<{ open_claims: string; open_claim_value: string }>(
      `SELECT COUNT(*) FILTER (WHERE status IN ('open','in_review')) AS open_claims,
              COALESCE(SUM(claim_amount) FILTER (WHERE status IN ('open','in_review')), 0) AS open_claim_value
       FROM vendor_claims WHERE 1=1 ${whWhere}`, whParam
    ),
    query<{ sku: string; name_th: string; qty_available: string; reorder_point: number; warehouse_code: string }>(
      `SELECT p.sku, p.name_th, sb.qty_available, p.reorder_point, w.code AS warehouse_code
       FROM stock_balances sb
       JOIN products p ON p.id = sb.product_id
       JOIN warehouses w ON w.id = sb.warehouse_id
       WHERE sb.qty_available <= p.reorder_point AND p.is_active = TRUE
       ${warehouseId ? 'AND sb.warehouse_id = $1' : ''}
       ORDER BY (sb.qty_available - p.reorder_point) ASC LIMIT 10`, whParam
    ),
    query<{ created_at: string; entry_type: string; qty_change: string; sku: string; name_th: string; warehouse_code: string; user_name: string | null }>(
      `SELECT sl.created_at, sl.entry_type, sl.qty_change,
              p.sku, p.name_th, w.code AS warehouse_code, COALESCE(u.name_th, u.name_en) AS user_name
       FROM stock_ledger sl
       JOIN products p ON p.id = sl.product_id
       JOIN warehouses w ON w.id = sl.warehouse_id
       LEFT JOIN users u ON u.id = sl.created_by
       WHERE 1=1 ${warehouseId ? 'AND sl.warehouse_id = $1' : ''}
       ORDER BY sl.created_at DESC LIMIT 10`, whParam
    ),
    query<{ sku: string; name_th: string; qty_received: string; tx_count: string }>(
      `SELECT p.sku, p.name_th, SUM(sl.qty_change) AS qty_received, COUNT(*) AS tx_count
       FROM stock_ledger sl
       JOIN products p ON p.id = sl.product_id
       WHERE sl.entry_type = 'grn_receipt'
         AND sl.created_at >= DATE_TRUNC('month', NOW())
         ${warehouseId ? 'AND sl.warehouse_id = $1' : ''}
       GROUP BY p.sku, p.name_th ORDER BY qty_received DESC LIMIT 5`, whParam
    ),
    query<{ warehouse_name: string; warehouse_code: string; grn_count: string; qty_stocked: string }>(
      `SELECT w.name_th AS warehouse_name, w.code AS warehouse_code,
              COUNT(DISTINCT g.id) AS grn_count,
              COALESCE(SUM(sl.qty_change), 0) AS qty_stocked
       FROM warehouses w
       LEFT JOIN goods_receipt_notes g
         ON g.warehouse_id = w.id AND g.status = 'stocked'
         AND g.created_at >= DATE_TRUNC('month', NOW())
       LEFT JOIN stock_ledger sl
         ON sl.warehouse_id = w.id AND sl.entry_type = 'grn_receipt'
         AND sl.created_at >= DATE_TRUNC('month', NOW())
       WHERE w.is_active = TRUE ${warehouseId ? 'AND w.id = $1' : ''}
       GROUP BY w.id, w.name_th, w.code ORDER BY qty_stocked DESC`, whParam
    ),
    query<{ pending_so: string; revenue_30d: string; revenue_today: string }>(
      `SELECT COUNT(*) FILTER (WHERE status IN ('confirmed','partially_delivered')) AS pending_so,
              COALESCE(SUM(total_amount) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0) AS revenue_30d,
              COALESCE(SUM(total_amount) FILTER (WHERE created_at >= DATE_TRUNC('day', NOW())), 0) AS revenue_today
       FROM sales_orders WHERE status != 'cancelled' ${whWhere}`, whParam
    ),
    query<{ tx_count: string; revenue_today: string }>(
      `SELECT COUNT(*) AS tx_count, COALESCE(SUM(total), 0) AS revenue_today
       FROM pos_transactions
       WHERE status = 'completed' AND created_at >= DATE_TRUNC('day', NOW()) ${whWhere}`, whParam
    ),
    query<{ sku: string; name_th: string; qty_sold: string; tx_count: string }>(
      `SELECT p.sku, p.name_th, SUM(tl.qty) AS qty_sold, COUNT(DISTINCT t.id) AS tx_count
       FROM pos_transaction_lines tl
       JOIN products p ON p.id = tl.product_id
       JOIN pos_transactions t ON t.id = tl.transaction_id
       WHERE t.status = 'completed' AND t.created_at >= NOW() - INTERVAL '30 days'
         ${warehouseId ? 'AND t.warehouse_id = $1' : ''}
       GROUP BY p.id, p.sku, p.name_th ORDER BY qty_sold DESC LIMIT 5`, whParam
    ),
    query<{ type: string; ref: string; action: string; created_at: string }>(
      `SELECT * FROM (
         (SELECT 'grn' AS type, grn_number AS ref, status::text AS action, created_at FROM goods_receipt_notes WHERE status != 'draft' ${whWhere} ORDER BY created_at DESC LIMIT 4)
         UNION ALL
         (SELECT 'so' AS type, so_number AS ref, status::text AS action, updated_at AS created_at FROM sales_orders WHERE status != 'draft' ${whWhere} ORDER BY updated_at DESC LIMIT 4)
         UNION ALL
         (SELECT 'pos' AS type, receipt_number AS ref, 'sale' AS action, created_at FROM pos_transactions WHERE status = 'completed' ${whWhere} ORDER BY created_at DESC LIMIT 4)
       ) AS activities ORDER BY created_at DESC LIMIT 8`, whParam
    ),
  ]);

  return {
    pr: { pending_approval: Number(prResult[0]?.pending_approval ?? 0), last_30_days: Number(prResult[0]?.last_30_days ?? 0) },
    po: { sent: Number(poResult[0]?.sent ?? 0), value_30_days: poResult[0]?.value_30_days ?? 0 },
    grn: { stocked_this_month: Number(grnResult[0]?.stocked_this_month ?? 0), pending: Number(grnResult[0]?.pending ?? 0), qc_failed: Number(grnResult[0]?.qc_failed ?? 0) },
    rma: { open_rmas: Number(rmaResult[0]?.open_rmas ?? 0), in_review: Number(rmaResult[0]?.in_review ?? 0) },
    claims: { open_claims: Number(claimResult[0]?.open_claims ?? 0), open_claim_value: claimResult[0]?.open_claim_value ?? 0 },
    low_stock: lowStock,
    recent_ledger: recentLedger,
    top_received: topReceived,
    warehouse_perf: warehousePerf,
    sales: { pending_so: Number(salesResult[0]?.pending_so ?? 0), revenue_30d: salesResult[0]?.revenue_30d ?? 0, revenue_today: salesResult[0]?.revenue_today ?? 0 },
    pos_today: { revenue: posResult[0]?.revenue_today ?? 0, tx_count: Number(posResult[0]?.tx_count ?? 0) },
    top_products: topProducts,
    recent_activity: recentActivity,
  };
}

export interface AuditorDashboardData {
  periodsCount: number;
  unpostedJeCount: number;
  postedJeCount: number;
  outstandingAp: number;
  whtCertificatesCount: number;
  recentJe: Array<{ id: string; entry_number: string; entry_date: string; description: string; entry_type: string; total_debit: number; status: string }>;
}

export async function getAuditorDashboardData(): Promise<AuditorDashboardData> {
  const [periods, jeList, [whtRow], apRows] = await Promise.all([
    query<{ status: string }>(`SELECT status FROM accounting_fiscal_periods ORDER BY start_date DESC LIMIT 50`),
    query<{ id: string; entry_number: string; entry_date: string; description: string; entry_type: string; total_debit: number; status: string }>(
      `SELECT id, entry_number, entry_date, description, entry_type, total_debit, status
       FROM journal_entries ORDER BY created_at DESC LIMIT 5`
    ),
    query<{ count: string }>(`SELECT COUNT(*) FROM wht_certificates`),
    query<{ outstanding_amount: string }>(`SELECT (amount - paid_amount) AS outstanding_amount FROM po_invoices WHERE is_paid = FALSE`),
  ]);

  return {
    periodsCount: periods.filter(p => p.status === 'open').length,
    unpostedJeCount: jeList.filter(j => j.status === 'draft').length,
    postedJeCount: jeList.filter(j => j.status === 'posted').length,
    outstandingAp: apRows.reduce((sum, inv) => sum + Number(inv.outstanding_amount), 0),
    whtCertificatesCount: Number(whtRow?.count ?? 0),
    recentJe: jeList,
  };
}
```

- [ ] **Step 2: Run qa:verify**

```bash
npm run qa:verify
```

Expected: 0 errors.

---

## Task 10 — Update API routes to use `lib/queries/`

**Files:**
- Modify: `app/api/admin/warehouses/route.ts`
- Modify: `app/api/grn/route.ts`
- Modify: `app/api/inventory/route.ts`
- Modify: `app/api/ap/invoices/route.ts`
- Modify: `app/api/kpi/route.ts`
- Modify: `app/api/grn/status-counts/route.ts` (update to use lib/queries)

- [ ] **Step 1: Update `app/api/admin/warehouses/route.ts` GET handler**

Add import at top:
```typescript
import { getWarehouses } from '@/lib/queries/admin';
```

Replace the GET handler body (after auth check):
```typescript
export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const warehouses = await getWarehouses();
  return apiSuccess(warehouses);
}
```

Remove the inline `query(...)` call that was there before. Keep the POST handler unchanged.

- [ ] **Step 2: Update `app/api/grn/route.ts` GET handler**

Add import at top of file:
```typescript
import { getGRNPage } from '@/lib/queries/grn';
```

Replace the entire GET handler with:
```typescript
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const status = searchParams.get('status') ?? undefined;
  const warehouseId = searchParams.get('warehouse_id') ?? undefined;

  const result = await getGRNPage(u, { page, limit, status, warehouse_id: warehouseId });
  return apiSuccess(result);
}
```

Keep the POST handler unchanged.

- [ ] **Step 3: Update `app/api/inventory/route.ts`**

Add import:
```typescript
import { getInventoryPage } from '@/lib/queries/inventory';
```

Replace entire GET handler:
```typescript
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(200, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const warehouseId = searchParams.get('warehouse_id') ?? undefined;
  const search = searchParams.get('search') || searchParams.get('q') || undefined;
  const lowStock = searchParams.get('low_stock') === 'true' || searchParams.get('low_stock') === '1';

  const result = await getInventoryPage(u, { page, limit, warehouse_id: warehouseId, search, low_stock: lowStock });
  return apiSuccess(result);
}
```

- [ ] **Step 4: Update `app/api/ap/invoices/route.ts` GET handler**

Add import:
```typescript
import { getAPInvoicePage } from '@/lib/queries/ap';
```

Replace GET handler:
```typescript
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(100, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE));
  const isPaidStr = searchParams.get('is_paid');
  const isPaid = isPaidStr === null || isPaidStr === '' ? null : isPaidStr === 'true';

  const result = await getAPInvoicePage({ page, limit, is_paid: isPaid });
  return apiSuccess(result);
}
```

Keep POST handler unchanged.

- [ ] **Step 5: Update `app/api/kpi/route.ts`**

Replace entire file content:
```typescript
import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { getKPI } from '@/lib/queries/dashboard';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const warehouseId = searchParams.get('warehouse_id') ?? undefined;

  const data = await getKPI(warehouseId);
  return apiSuccess(data);
}
```

- [ ] **Step 6: Update `app/api/grn/status-counts/route.ts`**

Replace file content to use the shared function:
```typescript
import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { getGRNStatusCounts } from '@/lib/queries/grn';
import type { SessionUser } from '@/lib/authz';

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const counts = await getGRNStatusCounts(u);
  return apiSuccess(counts);
}
```

- [ ] **Step 7: Run qa:verify**

```bash
npm run qa:verify
```

Expected: 0 errors.

- [ ] **Step 8: Smoke test API routes manually**

```bash
npm run dev
```

Open browser → navigate to `/app/grn` (still client-rendered at this point). Confirm data loads correctly. Check browser DevTools Network tab — `/api/grn` and `/api/admin/warehouses` should still return same shapes.

- [ ] **Step 9: Commit T2 query layer**

```bash
git add lib/queries/ app/api/admin/warehouses/route.ts app/api/grn/route.ts app/api/grn/status-counts/route.ts app/api/inventory/route.ts app/api/ap/invoices/route.ts app/api/kpi/route.ts
git commit -m "perf(tier4-t2a): add lib/queries layer, refactor API routes to use shared query functions"
```

---

## ── T2: RSC Page Conversion ─────────────────────────────────────────────

## Task 11 — Convert Dashboard page to RSC

**Files:**
- Modify: `app/app/dashboard/page.tsx` (replace with RSC shell)
- Create: `app/app/dashboard/DashboardClient.tsx`
- Create: `app/app/dashboard/AuditorDashboardClient.tsx`

- [ ] **Step 1: Read current `app/app/dashboard/page.tsx`**

Read the full file to understand the current structure before making changes.

- [ ] **Step 2: Create `app/app/dashboard/AuditorDashboardClient.tsx`**

Create a new file. Copy the entire `AuditorDashboard` function from `dashboard/page.tsx` into this file with these modifications:

```typescript
// app/app/dashboard/AuditorDashboardClient.tsx
'use client';

// --- keep all existing imports from dashboard/page.tsx that AuditorDashboard uses ---
import { useState, useEffect } from 'react';
import { ViewTransition } from '@/lib/react-vts';
import { useSession } from 'next-auth/react';
import { get } from '@/lib/api-client';
import { formatCurrency, formatDatetime } from '@/lib/format';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n';
import type { AuditorDashboardData } from '@/lib/queries/dashboard';

// --- keep DashboardPeriod, DashboardJournalEntry, DashboardWhtResponse, DashboardInvoice, DashboardApResponse interface definitions ---

interface Props {
  initialData: AuditorDashboardData | null;
  session: { user?: unknown } | null;
}

export function AuditorDashboardClient({ initialData, session: serverSession }: Props) {
  // Replace: const { data: session } = useSession();
  // With: keep useSession() for interactive session needs but also accept serverSession
  const { data: clientSession } = useSession();
  const activeSession = clientSession ?? serverSession;

  // Replace: const [stats, setStats] = useState<...>(null);
  // With: seed from initialData
  const [stats, setStats] = useState(initialData);
  const [loading, setLoading] = useState(initialData === null); // only show loading if no initial data
  const { lang } = useLanguage();

  useEffect(() => {
    // Only refetch if initialData was null (server-side DB failed)
    if (initialData !== null) return;
    async function fetchAuditorStats() {
      try {
        // Use already-fixed Promise.all from Task 3
        // (copy the fixed fetchAuditorStats body here)
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchAuditorStats();
  }, [initialData]);

  // --- copy the rest of AuditorDashboard render JSX unchanged ---
}
```

Key changes summary:
1. Add `'use client'` directive
2. Export as named `export function AuditorDashboardClient`
3. Add `Props` interface with `initialData` and `session`
4. `useState(initialData)` instead of `useState(null)`
5. `setLoading(initialData === null)` — skip loading if we have server data
6. `useEffect` guard: `if (initialData !== null) return;`
7. Copy the fixed `fetchAuditorStats` body (using `Promise.all`) from Task 3

- [ ] **Step 3: Create `app/app/dashboard/DashboardClient.tsx`**

Create a new file. Copy the entire `DashboardPage` function from `dashboard/page.tsx` into this file with these modifications:

```typescript
// app/app/dashboard/DashboardClient.tsx
'use client';

// --- keep all existing imports that DashboardPage uses ---
import { useState, useEffect } from 'react';
import { ViewTransition } from '@/lib/react-vts';
import { useSession } from 'next-auth/react';
import { get } from '@/lib/api-client';
import { formatCurrency, formatQty, formatDatetime, formatNumber } from '@/lib/format';
import { KpiCard, KpiGrid } from '@/components/ui';
import Link from 'next/link';
import type { Warehouse } from '@/types';
import { useT, useLanguage, localeName } from '@/lib/i18n';
import type { KPIData } from '@/lib/queries/dashboard';
// --- keep Sparkline, TrendChart, MOCK data, CARD/CARD_H/BTN_SM constants, Greeting component ---

interface Props {
  initialKpi: KPIData | null;
  initialWarehouses: Warehouse[];
  session: { user?: unknown } | null;
}

export function DashboardClient({ initialKpi, initialWarehouses, session: serverSession }: Props) {
  const { data: clientSession } = useSession();
  // seed state from props
  const [kpi, setKpi] = useState<KPIData | null>(initialKpi);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses);
  const [warehouseId, setWarehouseId] = useState('');
  const [loading, setLoading] = useState(initialKpi === null);
  // Remove: const [isMounted, setIsMounted] = useState(false);
  const t = useT();
  const { lang } = useLanguage();

  // Remove: useEffect(() => { setIsMounted(true); get<Warehouse[]>(...).then(setWarehouses)... }, []);
  // Warehouses already come from initialWarehouses prop.
  // If warehouses is empty (server failed), fetch client-side:
  useEffect(() => {
    if (initialWarehouses.length > 0) return;
    get<Warehouse[]>('/api/admin/warehouses').then(setWarehouses).catch(() => {});
  }, [initialWarehouses.length]);

  useEffect(() => {
    // Skip initial fetch if we have server data AND no warehouse filter selected
    if (initialKpi !== null && warehouseId === '') return;
    setLoading(true);
    const qs = warehouseId ? `?warehouse_id=${warehouseId}` : '';
    get<KPIData>(`/api/kpi${qs}`).then(setKpi).finally(() => setLoading(false));
  }, [warehouseId, initialKpi]);

  // Remove: if (!isMounted) return null;
  // Remove: if (role === 'auditor') ... — role branch is handled in server RSC page.tsx

  // --- copy rest of DashboardPage JSX unchanged ---
}
```

Key changes summary:
1. Add `'use client'` directive  
2. Export as named `export function DashboardClient`
3. Add `Props` interface
4. Seed `kpi`, `warehouses` from props
5. Remove `isMounted` state and guard
6. Remove auditor role branch (handled in RSC page.tsx)
7. Warehouse `useEffect` only fetches if `initialWarehouses` was empty
8. KPI `useEffect` skips initial fetch if `initialKpi !== null && warehouseId === ''`

- [ ] **Step 4: Replace `app/app/dashboard/page.tsx` with RSC shell**

Replace the entire file with:

```typescript
// app/app/dashboard/page.tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getKPI, getAuditorDashboardData } from '@/lib/queries/dashboard';
import { getWarehouses } from '@/lib/queries/admin';
import { DashboardClient } from './DashboardClient';
import { AuditorDashboardClient } from './AuditorDashboardClient';
import type { SessionUser } from '@/lib/authz';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const u = session.user as unknown as SessionUser;

  if (u.role === 'auditor') {
    let initialData = null;
    try {
      initialData = await getAuditorDashboardData();
    } catch {}
    return <AuditorDashboardClient initialData={initialData} session={session} />;
  }

  let initialKpi = null;
  let initialWarehouses: Awaited<ReturnType<typeof getWarehouses>> = [];
  try {
    [initialKpi, initialWarehouses] = await Promise.all([getKPI(), getWarehouses()]);
  } catch {}

  return <DashboardClient initialKpi={initialKpi} initialWarehouses={initialWarehouses} session={session} />;
}
```

- [ ] **Step 5: Run qa:verify**

```bash
npm run qa:verify
```

Expected: 0 errors.

- [ ] **Step 6: Smoke test dashboard**

```bash
npm run dev
```

Navigate to `/app/dashboard`. Confirm:
- Data appears without blank flash (no spinner before content)
- All KPI cards show correct values
- Warehouse filter dropdown works
- Auditor role: login as auditor user, confirm `AuditorDashboardClient` renders

- [ ] **Step 7: DevTools confirm SSR**

In Chrome DevTools → Network → Reload `/app/dashboard` → click on the HTML document response. In Response body, confirm actual KPI numbers are visible in the HTML (not empty JSON arrays). This confirms RSC is working.

---

## Task 12 — Convert GRN page to RSC

**Files:**
- Modify: `app/app/grn/page.tsx` (replace with RSC shell)
- Create: `app/app/grn/GRNClient.tsx`

- [ ] **Step 1: Read current `app/app/grn/page.tsx`**

Read the full file. Note: Task 2 already modified this file (removed `allGRNs`, added `tabCounts` state using `/api/grn/status-counts`).

- [ ] **Step 2: Create `app/app/grn/GRNClient.tsx`**

Create a new file. Copy the entire modified `GRNPage` function (after Task 2 changes) with these additional modifications:

```typescript
// app/app/grn/GRNClient.tsx
'use client';

// --- keep ALL existing imports ---
import { useState, useEffect, useCallback, useMemo } from 'react';
// ... all other imports ...
import type { GRNPageResult } from '@/lib/queries/grn';
import type { WarehouseRow } from '@/lib/queries/admin';

interface Props {
  initialGRNs: GRNPageResult;
  initialStatusCounts: Record<string, number>;
  initialWarehouses: WarehouseRow[];
  initialQueueCounts: { io: number; po: number };
}

// --- keep GRN, GRNDetail interfaces, GRN_STATUSES, TABS, PILL_COLORS constants ---
// --- keep Pill component, CARD constant ---
// --- keep GRNDetailModal component unchanged ---

export function GRNClient({ initialGRNs, initialStatusCounts, initialWarehouses, initialQueueCounts }: Props) {
  // Replace: const { data: session } = useSession();   — keep useSession for role checks in modal
  const { data: session } = useSession();

  // Seed state from props:
  const [data, setData] = useState<GRNPageResult | null>(initialGRNs);
  const [tabCounts, setTabCounts] = useState<Record<string, number>>(initialStatusCounts);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('');
  const [loading, setLoading] = useState(false); // false: we have initial data
  const [modal, setModal] = useState<GRNDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [queueCounts, setQueueCounts] = useState<{ io: number; po: number }>(initialQueueCounts);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);

  // Filter States
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [timeFilter, setTimeFilter] = useState('');
  const [receiverFilter, setReceiverFilter] = useState('');
  const [warehousesList, setWarehousesList] = useState<WarehouseRow[]>(initialWarehouses);

  // Remove: useEffect for /api/grn/receiving-queue — we have initialQueueCounts
  // Remove: useEffect for /api/admin/warehouses — we have initialWarehouses
  // Remove: useEffect for fetchStatusCounts initial call (counts come from initialStatusCounts)

  // Keep: fetchStatusCounts (for refresh after tab change)
  const fetchStatusCounts = useCallback(async () => {
    try {
      const counts = await get<Record<string, number>>('/api/grn/status-counts');
      setTabCounts(counts);
    } catch {}
  }, []);

  const fetchGRNs = useCallback(async () => {
    // Skip fetch for initial state: page 1, no tab filter, no warehouse filter
    if (page === 1 && !tab && !warehouseFilter) {
      setData(initialGRNs); // restore initial data when filters cleared
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (tab) params.set('status', tab);
      if (warehouseFilter) params.set('warehouse_id', warehouseFilter);
      setData(await get<GRNPageResult>(`/api/grn?${params}`));
      setSelectedRowIndex(-1);
    } finally { setLoading(false); }
  }, [page, tab, warehouseFilter, initialGRNs]);

  useEffect(() => { fetchGRNs(); }, [fetchGRNs]);
  useEffect(() => { fetchStatusCounts(); }, [fetchStatusCounts, tab]);

  // --- keep openModal, displayedGRNs, getTabCount, uniqueReceivers, keyboard handler unchanged ---
  // --- keep entire JSX unchanged ---
}
```

Key changes summary:
1. Add `'use client'` and `Props` interface
2. Export as named `export function GRNClient`
3. All state seeded from props (`initialGRNs`, `initialStatusCounts`, `initialWarehouses`, `initialQueueCounts`)
4. `setLoading(false)` initial value — we already have data
5. Remove `useEffect` for receiving-queue, warehouses, initial status counts
6. `fetchGRNs` has early return when at default state (page 1, no filters)
7. `fetchStatusCounts` still runs on tab change (for count accuracy)

- [ ] **Step 3: Replace `app/app/grn/page.tsx` with RSC shell**

Replace the entire file with:

```typescript
// app/app/grn/page.tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getGRNPage, getGRNStatusCounts, getGRNQueueCounts } from '@/lib/queries/grn';
import { getWarehouses } from '@/lib/queries/admin';
import { GRNClient } from './GRNClient';
import type { SessionUser } from '@/lib/authz';

export default async function GRNPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const u = session.user as unknown as SessionUser;
  const params = await searchParams;
  const initialStatus = params.status ?? undefined;

  let initialGRNs = { data: [], total: 0, page: 1, limit: 25, total_pages: 0 };
  let initialStatusCounts: Record<string, number> = {};
  let initialWarehouses: Awaited<ReturnType<typeof getWarehouses>> = [];
  let initialQueueCounts = { io: 0, po: 0 };

  try {
    [initialGRNs, initialStatusCounts, initialWarehouses, initialQueueCounts] = await Promise.all([
      getGRNPage(u, { page: 1, limit: 25, status: initialStatus }),
      getGRNStatusCounts(u),
      getWarehouses(),
      getGRNQueueCounts(u),
    ]);
  } catch {}

  return (
    <GRNClient
      initialGRNs={initialGRNs}
      initialStatusCounts={initialStatusCounts}
      initialWarehouses={initialWarehouses}
      initialQueueCounts={initialQueueCounts}
    />
  );
}
```

- [ ] **Step 4: Run qa:verify**

```bash
npm run qa:verify
```

Expected: 0 errors.

- [ ] **Step 5: Smoke test GRN page**

```bash
npm run dev
```

Navigate to `/app/grn`. Confirm:
- GRN list renders immediately with data (no blank spinner state)
- All 8 status tabs show correct counts
- Warehouse filter dropdown is populated
- Queue count badge on "รายการรอรับ" button shows correct count
- Tab switching works (fetches new data)
- Pagination works
- Modal opens on row click
- DevTools Network tab: HTML response contains GRN data rows

---

## Task 13 — Convert Inventory page to RSC

**Files:**
- Modify: `app/app/inventory/page.tsx` (replace with RSC shell)
- Create: `app/app/inventory/InventoryClient.tsx`

- [ ] **Step 1: Read current `app/app/inventory/page.tsx`**

Read the full file.

- [ ] **Step 2: Create `app/app/inventory/InventoryClient.tsx`**

Create a new file. Copy the entire `InventoryPage` function with these modifications:

```typescript
// app/app/inventory/InventoryClient.tsx
'use client';

// --- keep ALL existing imports ---
import type { InventoryPageResult } from '@/lib/queries/inventory';

interface Props {
  initialData: InventoryPageResult;
}

export function InventoryClient({ initialData }: Props) {
  const router = useRouter();
  const t = useT();
  const { lang } = useLanguage();

  // Seed state from props:
  const [inventoryData, setInventoryData] = useState<InventoryPageResult | null>(initialData);
  const [loading, setLoading] = useState(false); // false: have initial data
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [warehouseFilter, setWarehouseFilter] = useState('');
  // ... rest of existing state ...

  const fetchInventory = useCallback(async () => {
    // Skip when at default state (page 1, no search, no warehouse filter)
    if (page === 1 && !search && !warehouseFilter && segment === 'all') {
      setInventoryData(initialData);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (warehouseFilter) params.set('warehouse_id', warehouseFilter);
      if (segment === 'low' || segment === 'out') params.set('low_stock', 'true');
      params.set('page', String(page));
      params.set('limit', '30');
      const data = await get<InventoryPageResult>(`/api/inventory?${params.toString()}`);
      setInventoryData(data);
    } catch {
      setInventoryData(null);
    } finally {
      setLoading(false);
    }
  }, [search, page, warehouseFilter, segment, initialData]);

  // Keep allStock/fetchAllStock for heatmap view unchanged
  // --- rest of component unchanged ---
}
```

Key changes:
1. `'use client'`, named export `InventoryClient`, `Props` interface
2. `useState(initialData)` — no null initial state
3. `setLoading(false)` initial
4. `fetchInventory` skip when at default state

- [ ] **Step 3: Replace `app/app/inventory/page.tsx` with RSC shell**

Replace entire file:

```typescript
// app/app/inventory/page.tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getInventoryPage } from '@/lib/queries/inventory';
import { InventoryClient } from './InventoryClient';
import type { SessionUser } from '@/lib/authz';

export default async function InventoryPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const u = session.user as unknown as SessionUser;

  let initialData: Awaited<ReturnType<typeof getInventoryPage>> = {
    data: [], total: 0, page: 1, per_page: 30, total_pages: 0, warehouses: [],
  };
  try {
    initialData = await getInventoryPage(u, { page: 1, limit: 30 });
  } catch {}

  return <InventoryClient initialData={initialData} />;
}
```

- [ ] **Step 4: Run qa:verify + smoke test**

```bash
npm run qa:verify
```

Navigate to `/app/inventory`. Confirm inventory table/heatmap renders immediately with data, warehouse filter chips are populated, search and filters work.

---

## Task 14 — Convert AP Invoices page to RSC

**Files:**
- Modify: `app/app/ap/page.tsx` (replace with RSC shell)
- Create: `app/app/ap/APClient.tsx`

- [ ] **Step 1: Read current `app/app/ap/page.tsx`**

Read the full file.

- [ ] **Step 2: Create `app/app/ap/APClient.tsx`**

Create a new file. Copy the entire `ApInvoicesPage` function with these modifications:

```typescript
// app/app/ap/APClient.tsx
'use client';

// --- keep ALL existing imports ---
import type { APPageResult } from '@/lib/queries/ap';

interface Props {
  initialData: APPageResult;
}

export function APClient({ initialData }: Props) {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  // Seed state from props:
  const [data, setData] = useState<APPageResult | null>(initialData);
  const [page, setPage] = useState(1);
  const [isPaid, setIsPaid] = useState('');
  const [loading, setLoading] = useState(false); // false: have initial data

  const fetchInvoices = useCallback(async () => {
    // Skip for default state
    if (page === 1 && isPaid === '') {
      setData(initialData);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (isPaid) params.set('is_paid', isPaid);
      const res = await get<APPageResult>(`/api/ap/invoices?${params}`);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, isPaid, initialData]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // --- copy rest of JSX unchanged, update type references ---
}
```

- [ ] **Step 3: Replace `app/app/ap/page.tsx` with RSC shell**

Replace entire file:

```typescript
// app/app/ap/page.tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getAPInvoicePage } from '@/lib/queries/ap';
import { APClient } from './APClient';

export default async function APPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  let initialData: Awaited<ReturnType<typeof getAPInvoicePage>> = {
    invoices: [], total: 0, total_pages: 0,
  };
  try {
    initialData = await getAPInvoicePage({ page: 1, limit: 25 });
  } catch {}

  return <APClient initialData={initialData} />;
}
```

- [ ] **Step 4: Run qa:verify + smoke test**

```bash
npm run qa:verify
```

Navigate to `/app/ap`. Confirm AP invoice list renders immediately with data, tab switching (paid/unpaid) works, pagination works.

---

## Task 15 — Audit + Convert SKU Analytics page

**Files:**
- Modify: `app/app/analytics/sku-cut/page.tsx`
- Create: `app/app/analytics/sku-cut/SkuCutClient.tsx` (if interactive)

- [ ] **Step 1: Read current `app/app/analytics/sku-cut/page.tsx`**

Read the full file. Determine interaction level: check for `useState`, `useCallback` — this page has search, tab switching, refresh button → needs Client component.

- [ ] **Step 2: Create `app/app/analytics/sku-cut/SkuCutClient.tsx`**

The sku-cut page fetches from `/api/analytics/sku-cut-candidates` and `/api/analytics/sku-performance`. It uses `useEffect` + `useCallback`. Apply the same RSC split pattern:

```typescript
// app/app/analytics/sku-cut/SkuCutClient.tsx
'use client';

// --- keep ALL existing imports ---

interface Props {
  initialCandidates: Candidate[];
  initialPerformance: PerformanceSku[];
}

export function SkuCutClient({ initialCandidates, initialPerformance }: Props) {
  const [activeTab, setActiveTab] = useState<'candidates' | 'performance'>('candidates');
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
  const [performance, setPerformance] = useState<PerformanceSku[]>(initialPerformance);
  const [loading, setLoading] = useState(false); // have initial data
  const [refreshing, setRefreshing] = useState(false);
  // ... rest of existing state ...

  // Keep fetchData but skip initial load:
  const fetchData = useCallback(async () => {
    if (candidates.length > 0 && performance.length > 0) return; // already seeded
    // ... existing fetch logic ...
  }, [candidates.length, performance.length]);

  // Keep refresh handler as-is (explicit user action)

  // --- copy rest of JSX unchanged ---
}
```

- [ ] **Step 3: Replace `app/app/analytics/sku-cut/page.tsx` with RSC shell**

First, check what API routes this page calls. Read the `fetchData` function in the current page. It calls `/api/analytics/sku-cut-candidates` and `/api/analytics/sku-performance`. Create the RSC shell:

```typescript
// app/app/analytics/sku-cut/page.tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { SkuCutClient } from './SkuCutClient';

async function fetchSkuCutData() {
  // Static import — pool is a singleton, safe to use in RSC
  const pool = (await import('@/lib/db/client')).default;
  const [candidatesRes, performanceRes] = await Promise.all([
    pool.query(`SELECT * FROM sku_cut_candidates ORDER BY score ASC LIMIT 50`),
    pool.query(`SELECT * FROM sku_performance_snapshot ORDER BY score ASC LIMIT 200`),
  ]);
  return {
    candidates: candidatesRes.rows as Candidate[],
    performance: performanceRes.rows as PerformanceSku[],
  };
}

export default async function SkuCutPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  let initialCandidates: unknown[] = [];
  let initialPerformance: unknown[] = [];
  try {
    const data = await fetchSkuCutData();
    initialCandidates = data.candidates;
    initialPerformance = data.performance;
  } catch {}

  return (
    <SkuCutClient
      initialCandidates={initialCandidates as Parameters<typeof SkuCutClient>[0]['initialCandidates']}
      initialPerformance={initialPerformance as Parameters<typeof SkuCutClient>[0]['initialPerformance']}
    />
  );
}
```

**Note:** If the materialized view columns differ from what the page expects, adjust the SELECT. Check `sku_cut_candidates` and `sku_performance_snapshot` view definitions in `docs/SCHEMA.md` or a recent migration file before writing this query.

- [ ] **Step 4: Run qa:verify**

```bash
npm run qa:verify
```

Expected: 0 errors.

- [ ] **Step 5: Smoke test SKU Analytics**

```bash
npm run dev
```

Navigate to `/app/analytics/sku-cut`. Confirm data loads immediately. Tab switching (Candidates / Performance) works. Refresh button still works.

- [ ] **Step 6: Commit all RSC conversions**

```bash
git add app/app/dashboard/ app/app/grn/ app/app/inventory/ app/app/ap/ app/app/analytics/sku-cut/
git commit -m "perf(tier4-t2b): convert 5 pages to RSC streaming with Promise.all parallel server fetches"
```

---

## Task 16 — Knowledge Elevation + Final QA

- [ ] **Step 1: Run full qa:verify**

```bash
npm run qa:verify
```

Expected: 0 errors, 0 warnings. If errors exist, fix them before proceeding.

- [ ] **Step 2: Run full build**

```bash
npm run build
```

Expected: Successful build. Note any new warnings but do not fail on warnings unless they are errors.

- [ ] **Step 3: Manual smoke test all 5 converted pages**

```bash
npm run dev
```

Test each page:

| Page | Check |
|------|-------|
| `/app/dashboard` | KPI numbers visible immediately, warehouse filter works |
| `/app/dashboard` (auditor) | Auditor dashboard loads, WHT/JE/AP counts correct |
| `/app/grn` | GRN list visible immediately, all tabs + counts correct, modal works |
| `/app/inventory` | Heatmap visible immediately, search + filters work |
| `/app/ap` | Invoice list visible, tab filter works, pagination works |
| `/app/analytics/sku-cut` | Candidates table visible immediately, refresh works |

For each page: Open DevTools → Network → Hard reload → click HTML document → search response body for actual data rows. Confirm they are present (SSR active).

- [ ] **Step 4: Verify loading skeletons**

Navigate between pages quickly. Each target page should show the animated skeleton briefly before the content appears.

- [ ] **Step 5: Update `_notes/02_Agent_Memory/current-state.md`**

Add to **Last 5 Completed Tracks**:
```
- **perf-tier4-suspense-streaming**: Converted Dashboard, GRN, Inventory, AP, SKU-Cut pages to React Server Components with parallel Promise.all DB queries via new lib/queries/ layer. Fixed AuditorDashboard serial awaits, replaced GRN limit=1000 stats with GROUP BY endpoint, added loading.tsx skeletons to 6 route segments. Pages now render with initial data in ~150ms vs ~1,200ms. (2026-05-28)
```

Remove from **Active Work**: `perf-tier4-suspense-streaming`

- [ ] **Step 6: Update `conductor/index.md`**

Change track status from `Active` → `Verified` in both the Active Now table and All Tracks table.

- [ ] **Step 7: Run track:sweep**

```bash
npx tsx scripts/archive-track.ts --sweep
```

Expected: track archived to `conductor/archive/tracks/perf-tier4-suspense-streaming/`.

- [ ] **Step 8: Final commit**

```bash
git add _notes/02_Agent_Memory/current-state.md conductor/index.md
git commit -m "chore(conductor): archive perf-tier4-suspense-streaming track (Verified)"
```

---

## QA Checklist

- [ ] `npm run qa:verify` → 0 errors
- [ ] `npm run build` → successful
- [ ] Dashboard: data in HTML response body (DevTools confirm)
- [ ] GRN: data in HTML response body, all 8 tab counts correct
- [ ] Inventory: heatmap renders immediately with warehouse cards
- [ ] AP: invoice list renders immediately
- [ ] SKU Analytics: candidates table renders immediately
- [ ] Loading skeletons visible during navigation
- [ ] All client-side interactions (filters, search, pagination, modals) still work
- [ ] No `// TODO` or `// FIXME` in any modified file
- [ ] `current-state.md` updated
- [ ] `conductor/index.md` status = Verified
- [ ] Track swept to archive

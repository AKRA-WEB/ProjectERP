---
title: "Performance Tier 4 — RSC Streaming + Parallel Fetch Fixes"
date: 2026-05-28
status: Approved
author: Claude (Architect)
tracks:
  - perf-tier4-suspense-streaming
---

# Performance Tier 4 — RSC Streaming + Parallel Fetch Fixes

## Context

BUYMORE ERP pages show 1–2 second first-load times despite Tiers 1–3 having optimised the connection layer, database indexes, and bundle size. Tier 3 bundle analysis confirmed client JS is clean (112 KB shared). The remaining bottleneck is **architectural**: every page is `'use client'` and fetches data in `useEffect` after hydration, producing a double round-trip on every navigation:

```
Browser → Server: GET /app/grn          (empty HTML shell, ~50 ms)
Browser runs JS, mounts component
Browser → Server: GET /api/grn          (client fetch)
Browser → Server: GET /api/admin/warehouses  (client fetch)
Server queries DB × N
                                         ← user sees content ~1,000–1,500 ms
```

Three additional bugs compound the problem:

1. `AuditorDashboard.fetchAuditorStats()` makes 4 sequential `await` calls — each waits for the previous to finish before firing the next (~200 ms × 4 = ~800 ms waterfall).
2. `app/app/grn/page.tsx` fetches `GET /api/grn?limit=1000` on every mount solely to count per-status tabs — transferring up to 1,000 full GRN rows for what is a simple `GROUP BY COUNT`.
3. No `loading.tsx` files exist anywhere — Next.js cannot show a skeleton during route segment transitions; users see a blank page.

---

## Target State

```
Browser → Server: GET /app/grn
Server: auth() + DB × 3 (parallel) → ~80–150 ms
Server → Browser: HTML with initial data already embedded
React hydrates GRNClient with initialData → zero additional fetch needed for page 1
                                         ← user sees content ~150 ms
```

---

## Two-Tier Execution Plan

### Tier 1 — Universal Fixes (all pages improve, no architecture change)

| Fix | File(s) | Expected gain |
|-----|---------|---------------|
| Fix `AuditorDashboard` 4 serial awaits → `Promise.all` | `app/app/dashboard/page.tsx` | −600 ms on auditor dashboard |
| New `GET /api/grn/status-counts` endpoint (SQL `GROUP BY`) | `app/api/grn/status-counts/route.ts` (new) | −400 ms on GRN page |
| Replace `limit=1000` fetch in GRN page → `/api/grn/status-counts` | `app/app/grn/page.tsx` | part of above |
| Add `loading.tsx` to 6 route segments | 6 new files (see list below) | skeleton visible instantly on nav |

`loading.tsx` files to create:
- `app/app/loading.tsx`
- `app/app/dashboard/loading.tsx`
- `app/app/grn/loading.tsx`
- `app/app/inventory/loading.tsx`
- `app/app/ap/loading.tsx`
- `app/app/analytics/sku-cut/loading.tsx`

Each skeleton mirrors the page's primary layout shape using `animate-pulse` divs. No real data needed.

---

### Tier 2 — RSC Conversion (5 highest-traffic pages)

#### Shared Query Layer

Create `lib/queries/` with pure async DB functions used by both API routes and RSC pages. This eliminates SQL duplication.

```
lib/queries/
  admin.ts      getWarehouses()
  grn.ts        getGRNPage(params), getGRNStatusCounts(), getGRNQueueCounts()
  inventory.ts  getInventoryPage(params)
  ap.ts         getAPInvoicePage(params)
  dashboard.ts  getKPI(warehouseId?), getAuditorDashboardData()
```

All functions:
- Use `pool.query(sql, [$1, $2])` parameterized queries only
- Return typed results matching existing `types/index.ts` interfaces
- Throw on DB error (caller handles)

Existing API routes must be updated to import from `lib/queries/` instead of inlining SQL, to avoid duplication.

#### RSC Page Pattern

Each of the 5 pages follows the same pattern:

```typescript
// page.tsx — RSC (no 'use client')
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PageNameClient } from './PageNameClient';

// Next.js 15: searchParams is a Promise — must await before use
export default async function PageNamePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  if (!session) redirect('/login');

  let initialData = { /* safe empty defaults */ };
  try {
    initialData = await fetchData(searchParams);  // Promise.all internally
  } catch {
    // DB failure → empty initial data; client component retries via API route on mount
  }

  return <PageNameClient initialData={initialData} session={session} />;
}
```

```typescript
// PageNameClient.tsx — 'use client'
'use client';
export function PageNameClient({ initialData, session }) {
  const [data, setData] = useState(initialData);  // server data used immediately

  const fetch = useCallback(async () => {
    // page 1 + no filters: skip fetch, already have initialData
    if (isDefaultState) return;
    // otherwise: fetch /api/... normally
  }, [deps]);
  // ... all existing interactive logic unchanged
}
```

#### Per-Page Scope

**Dashboard** (`app/app/dashboard/`)
- `page.tsx` → RSC: reads `session.role`, branches to auditor vs standard path, fetches appropriate initial data via `Promise.all`
- `DashboardClient.tsx` (new): entire current `DashboardPage` function body
- `AuditorDashboardClient.tsx` (new): entire current `AuditorDashboard` function body
- Eliminates `isMounted` guard and role-switch flash

**GRN** (`app/app/grn/`)
- `page.tsx` → RSC: `Promise.all([getGRNPage({page:1}), getGRNStatusCounts(), getGRNQueueCounts(), getWarehouses()])`
- `GRNClient.tsx` (new): entire current `GRNPage` body
- `page.tsx` reads `searchParams.status` to pre-filter initial fetch if URL has a tab

**Inventory** (`app/app/inventory/`)
- `page.tsx` → RSC: `Promise.all([getInventoryPage({page:1}), getWarehouses()])`
- `InventoryClient.tsx` (new): entire current `InventoryPage` body

**AP Invoices** (`app/app/ap/`)
- `page.tsx` → RSC: `getAPInvoicePage({page:1})`
- `APClient.tsx` (new): entire current `ApInvoicesPage` body

**SKU Analytics** (`app/app/analytics/sku-cut/`)
- Audit current page before converting: if mostly read-only display, may not need a client component
- If interactive (filters, pagination): same RSC + Client split as above

---

## Error Handling Rules

1. RSC page must **never throw** to the user. Wrap all DB calls in `try/catch`. On failure, pass empty/default `initialData` to the client component. The client component will show its own loading state and retry via API route on mount.
2. If `auth()` returns null in RSC, call `redirect('/login')` — do not render.
3. Client component must tolerate `initialData` being empty (same as current behavior when `useState(null)`).
4. `lib/queries/` functions may throw — callers handle.

---

## Edge Cases

| Case | Handling |
|------|----------|
| User bookmarks `/app/grn?status=stocked` | RSC reads `searchParams.status`, passes to `getGRNPage` and as `initialTab` prop to `GRNClient` |
| `useSession()` still needed in client components | Keep — next-auth provides session cookie to client for role-gated UI actions |
| TypeScript strict mode | Shared interfaces from `types/index.ts` used for both query return types and client `useState` types — no `as any` |
| Hydration mismatch | Server-rendered HTML matches client initial render because `initialData` is the same object both sides use |

---

## Constraints

1. **Auth:** Every RSC page must call `const session = await auth()` — per `universal_agent_rules.md`.
2. **SQL:** Parameterized only (`$1, $2`) — no string concatenation.
3. **No new migrations** — zero schema changes in this track.
4. **Surgical scope:** only the 5 listed pages convert to RSC. Other pages are untouched.
5. **No TODOs or FIXMEs** in committed files.
6. **`npm run qa:verify` must pass 0 errors** before marking Verified.

---

## Testing Strategy

No automated test suite (consistent with Tier 1–3). QA gate:

1. `npm run qa:verify` → 0 errors (lint + `tsc --noEmit`)
2. Manual smoke test each modified page:
   - Page loads and shows data (not blank/spinner) on first visit
   - Filter, search, pagination still work
   - Role-gated actions still work (QC approve, stock action, etc.)
3. DevTools Network tab: HTML response body must contain actual data rows (not empty JSON arrays) confirming SSR is active.
4. `loading.tsx` verification: navigate between pages — skeleton must appear briefly before content.

---

## Files Summary

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
| Modify | `app/app/analytics/sku-cut/page.tsx` (after audit) |
| Modify | `app/api/grn/route.ts` (import from lib/queries/grn) |
| Modify | `app/api/inventory/route.ts` (import from lib/queries/inventory) |
| Modify | `app/api/ap/invoices/route.ts` (import from lib/queries/ap) |
| Modify | `app/api/kpi/route.ts` (import from lib/queries/dashboard) |
| Modify | `app/api/admin/warehouses/route.ts` (import from lib/queries/admin) |

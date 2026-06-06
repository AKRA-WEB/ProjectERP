---
track: hardening-t4-route-guard-and-errors
phase: hardening-stabilization
sequence: 4
status: Planned
owner: Chen
created: 2026-06-06
updated: 2026-06-06
depends_on: [hardening-t1-test-foundation]
estimate: M
tags: [bugfix, middleware, error-handling, performance, medium]
spec: conductor/qa-reports/full-audit-2026-06-06.md
---

# Hardening T4 — Route Guard, Silent Errors, Unbounded Query (Medium)

## Goal

Fix three confirmed defects from the audit:
- **M1** — top-level routes outside `/app` (`/dispatch`, `/wms`, `/sales`) bypass the middleware auth redirect.
- **M2** — server pages swallow DB errors with empty `catch {}`, hiding outages.
- **M3** — `getSkuCutCandidates` has no `LIMIT/OFFSET`, violating the hard rule (unbounded result).

Depends on T1 so the formatter/authz safety net exists before touching shared paths.

## Architecture

- M1: extend `middleware.ts` matcher logic to treat `/dispatch`, `/wms`, `/sales` as protected (redirect unauth → `/login`), OR migrate those 4 pages under `/app`. **Decision:** extend middleware (lower blast radius than moving routes + their API/import paths).
- M2: replace `catch {}` with `catch (e) { console.error(...) }` and surface an error flag to the client component so the user sees a retry state, not a blank page.
- M3: add capped `LIMIT/OFFSET` mirroring `getSkuPerformance` in the same file.

## Tech Stack

Next.js middleware, App Router server components, `lib/queries`.

## Acceptance Criteria

1. Unauthenticated GET to `/dispatch/scan`, `/wms/picking-slips`, `/sales/credit-holds` → redirect to `/login` (not a rendered shell).
2. Authenticated access to those pages still works.
3. The 4 server pages (`dashboard`, `grn`, `inventory`, `ap`) log prefetch failures and the client shows an error/empty-with-retry state.
4. `getSkuCutCandidates` accepts `limit`/`offset`, defaults capped (≤ 200), and emits `LIMIT $n OFFSET $n+1`.
5. `npm run qa:verify` passes.

---

## Files

| Action | Path |
|--------|------|
| Modify | `middleware.ts` |
| Modify | `app/app/dashboard/page.tsx`, `app/app/grn/page.tsx`, `app/app/inventory/page.tsx`, `app/app/ap/page.tsx` |
| Modify | client components that consume `initialData` (DashboardClient/GRNClient/InventoryClient/APClient) — add error prop |
| Modify | `lib/queries/analytics.ts` (`getSkuCutCandidates`) |
| Modify | caller of `getSkuCutCandidates` (`app/api/analytics/sku-cut/*` route + page) to pass paging |

---

## Tasks

### Task 1: M1 — middleware guard for top-level routes

- [ ] **1.1** Read `middleware.ts`. Current `isAppPage = pathname.startsWith('/app')`.
- [ ] **1.2** Add a protected-prefix check:
```ts
const PROTECTED_TOP = ['/dispatch', '/wms', '/sales'];
const isProtectedTop = PROTECTED_TOP.some((p) => pathname === p || pathname.startsWith(p + '/'));
```
- [ ] **1.3** Include `isProtectedTop` in the unauthenticated redirect branch (page → redirect `/login`).
- [ ] **1.4** Confirm `matcher` already covers these (it does — excludes only `_next`/static). No matcher change needed.
- [ ] **1.5** Manual: log out, hit `/dispatch/scan` → redirected to `/login`.

### Task 2: M2 — surface DB prefetch errors

- [ ] **2.1** For each of the 4 pages, change `catch {}` to:
```ts
let prefetchError = false;
try { /* existing await */ } catch (e) { console.error('<page> prefetch failed', e); prefetchError = true; }
```
- [ ] **2.2** Pass `prefetchError` (or `initialError`) into the client component; render a non-blocking banner + retry (re-fetch via existing `get()` path) when true and data is empty.
- [ ] **2.3** Read each client component first to match its existing prop/state shape — no scope creep beyond the error path.

### Task 3: M3 — bound `getSkuCutCandidates`

- [ ] **3.1** Read `lib/queries/analytics.ts` lines 40-52.
- [ ] **3.2** Add paging mirroring `getSkuPerformance` (cap 200):
```ts
export async function getSkuCutCandidates(
  params: { search?: string; limit?: number; offset?: number } = {}
): Promise<Candidate[]> {
  const limit = Math.min(200, params.limit ?? 100);
  const offset = Math.max(0, params.offset ?? 0);
  let where = '1=1';
  const qParams: unknown[] = [];
  let i = 1;
  if (params.search) { where += ` AND (sku ILIKE $${i} OR name_th ILIKE $${i} OR name_en ILIKE $${i})`; qParams.push(`%${params.search}%`); i++; }
  return query<Candidate>(
    `SELECT * FROM sku_cut_candidates WHERE ${where} ORDER BY score ASC, sku ASC LIMIT $${i} OFFSET $${i + 1}`,
    [...qParams, limit, offset]
  );
}
```
- [ ] **3.3** Update the caller (sku-cut API route / page) to pass through `limit`/`offset` from query params; keep response shape backward-compatible.

### Task 4: Verify + commit

- [ ] **4.1** `npm run qa:verify`.
- [ ] **4.2** Commit per concern:
```bash
git add middleware.ts && git commit -m "fix(security): guard /dispatch /wms /sales routes in middleware"
git add app/app/dashboard app/app/grn app/app/inventory app/app/ap && git commit -m "fix(ux): surface DB prefetch errors instead of silent empty pages"
git add lib/queries/analytics.ts app/api/analytics && git commit -m "fix(perf): add LIMIT/OFFSET to getSkuCutCandidates"
```

---

## Verification

```bash
npm run qa:verify
```
Manual: logged-out access to the 3 top-level routes redirects to `/login`; kill DB → the 4 pages show an error banner, not a blank screen.

## Notes

- No `stock_ledger` / multi-table writes here → transaction gates N/A.
- `getSkuCutCandidates` change is read-only SQL; verify the materialized source `sku_cut_candidates` column names against `migrations/*.sql` before editing (`git grep "sku_cut_candidates" migrations/`).

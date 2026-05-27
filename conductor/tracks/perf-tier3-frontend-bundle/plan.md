---
track: perf-tier3-frontend-bundle
title: "Performance Tier 3 — Frontend Bundle Audit + Dynamic Imports"
status: Planned
created: 2026-05-27
updated: 2026-05-27
spec: docs/superpowers/specs/2026-05-27-performance-optimization-design.md
dependency: perf-tier2-materialized-views must be Verified first. Measure Tier 1-2 gains before starting Tier 3.
---

# Performance Tier 3 — Frontend Bundle Audit + Selective Dynamic Imports

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> **Do not start until `perf-tier2-materialized-views` is Verified AND the bundle analyzer report confirms chunks > 100 KB that are not explained by business logic.**

**Goal:** Identify and lazy-load client-side chunks confirmed heavy by bundle analyzer. Apply `next/dynamic` only to components with measurable impact.

**Architecture:** Gated by bundle analysis — do not apply dynamic imports speculatively. Next.js App Router already does route-level code splitting automatically. This track handles component-level splitting for heavy widgets that are not above-the-fold.

**Tech Stack:** Next.js 15 · `@next/bundle-analyzer` · `next/dynamic`

**No test suite.** QA gate = `npm run qa:verify` + visual smoke test in browser — must be 0 errors before marking done.

---

## Files

| Action | Path |
|--------|------|
| Modify | `next.config.ts` (add analyzer wrapper, then remove after analysis) |
| Modify | `package.json` (add `@next/bundle-analyzer` devDependency) |
| Modify | TBD pages/components (determined by analyzer output — see Task 2) |

---

## Task 1 — Install Bundle Analyzer

- [ ] **Step 1: Install devDependency**

  ```bash
  npm install --save-dev @next/bundle-analyzer
  ```

- [ ] **Step 2: Wrap next.config.ts**

  Open `next.config.ts`. Current content:
  ```typescript
  import type { NextConfig } from "next";

  const securityHeaders = [...];

  const nextConfig: NextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
    experimental: { viewTransition: true },
    async headers() { ... },
  };

  export default nextConfig;
  ```

  Replace with:
  ```typescript
  import type { NextConfig } from "next";
  import bundleAnalyzer from '@next/bundle-analyzer';

  const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
  });

  const securityHeaders = [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ];

  const nextConfig: NextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
    experimental: {
      viewTransition: true,
    },
    async headers() {
      return [
        {
          source: "/(.*)",
          headers: securityHeaders,
        },
      ];
    },
  };

  export default withBundleAnalyzer(nextConfig);
  ```

- [ ] **Step 3: Run qa:verify**

  ```bash
  npm run qa:verify
  ```

  Expected: 0 errors.

---

## Task 2 — Run Analysis + Document Findings

- [ ] **Step 1: Run bundle analyzer**

  ```bash
  $env:ANALYZE = "true"; npm run build
  ```

  This opens two HTML reports in your browser: `client.html` and `server.html`. Focus on **`client.html`** — server chunks do not affect browser load time.

- [ ] **Step 2: Identify heavy chunks**

  In the client bundle report, look for rectangles > 100 KB (parsed size). Note:
  - `@react-pdf/renderer` should NOT appear in client chunks (it is API route only). If it does, that is a bug — flag it.
  - `lucide-react` icons should be small if using named imports. If it appears as a large block, some file is doing `import * as Icons from 'lucide-react'`.
  - Analytics pages (`/analytics/sku-cut`, `/analytics/npd-trials`) may have large chart components.
  - HR calendar component may be large if it imports a date library.

- [ ] **Step 3: Record findings**

  Write findings in this plan (append below this task), listing:
  ```
  | Component/Chunk | Parsed size | Route | Decision |
  |----------------|-------------|-------|----------|
  | example         | 120 KB      | /analytics | Apply dynamic import |
  ```

  **Decision rule:** Apply `next/dynamic` only if:
  1. Chunk is > 50 KB parsed
  2. Component is not visible above the fold on initial load
  3. Component is not needed for interaction within 2 seconds of page load

  If no chunks meet these criteria → **skip Task 3, commit analyzer removal only.**

---

## Task 3 — Apply Dynamic Imports (only if Task 2 identifies candidates)

For each confirmed heavy component, apply this pattern in the parent page file:

- [ ] **Step 1: Replace static import with dynamic**

  For each component identified in Task 2, in the page file that imports it:

  ```typescript
  // Before (static import — included in initial bundle):
  import HeavyComponent from '@/components/path/HeavyComponent';

  // After (dynamic import — loaded only when component mounts):
  import dynamic from 'next/dynamic';

  const HeavyComponent = dynamic(() => import('@/components/path/HeavyComponent'), {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse bg-stone-100 rounded-lg" />,
  });
  ```

  Apply one component at a time. Run `npm run qa:verify` after each.

- [ ] **Step 2: Verify no visual regression**

  ```bash
  npm run dev
  ```

  Navigate to the affected page. Confirm:
  - Loading skeleton appears briefly then replaces with real component ✓
  - No hydration mismatch errors in browser console ✓
  - Component functions correctly after load ✓

- [ ] **Step 3: Re-run analyzer to confirm savings**

  ```bash
  $env:ANALYZE = "true"; npm run build
  ```

  Confirm the chunk size decreased. If no change, the dynamic import was not effective (component may have been included by another import path). Revert that specific change.

---

## Task 4 — Remove Analyzer from Production Config

- [ ] **Step 1: Revert next.config.ts to clean state**

  Replace `next.config.ts` with the original content + `withBundleAnalyzer` wrapper kept (it is conditional on `ANALYZE=true` env var, so it is harmless in production — `ANALYZE` is never set in Vercel env):

  ```typescript
  import type { NextConfig } from "next";
  import bundleAnalyzer from '@next/bundle-analyzer';

  const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
  });

  const securityHeaders = [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ];

  const nextConfig: NextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
    experimental: {
      viewTransition: true,
    },
    async headers() {
      return [
        {
          source: "/(.*)",
          headers: securityHeaders,
        },
      ];
    },
  };

  export default withBundleAnalyzer(nextConfig);
  ```

  The `withBundleAnalyzer` wrapper is a no-op when `ANALYZE !== 'true'` — safe to leave in.

- [ ] **Step 2: Final qa:verify + build**

  ```bash
  npm run qa:verify
  npm run build
  ```

  Expected: 0 errors, successful build.

- [ ] **Step 3: Commit**

  ```bash
  git add next.config.ts package.json package-lock.json
  # Add any modified page files:
  git add app/(app)/analytics/... # if dynamic imports were applied
  git commit -m "perf(tier3): add bundle analyzer, apply dynamic imports to confirmed heavy components"
  ```

---

## QA Checklist

- [ ] `npm run qa:verify` → 0 errors
- [ ] `npm run build` → successful production build
- [ ] `ANALYZE=true npm run build` shows reduced bundle size for affected chunks
- [ ] Affected pages load correctly in browser with loading skeleton
- [ ] No hydration errors in browser console
- [ ] No `// TODO` or placeholder comments in modified files

---

## Bundle Analyzer Findings (fill in during Task 2)

> Record actual findings here after running the analyzer.

| Component/Chunk | Parsed Size | Route | Decision |
|----------------|-------------|-------|----------|
| (pending analysis) | — | — | — |

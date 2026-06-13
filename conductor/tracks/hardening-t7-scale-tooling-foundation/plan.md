---
track: hardening-t7-scale-tooling-foundation
phase: hardening-stabilization
sequence: 7
status: Planned
owner: Chen
created: 2026-06-13
updated: 2026-06-13
depends_on: [hardening-t1-test-foundation, hardening-t2-ci-gate]
estimate: L
tags: [scale-tooling, api-contract, e2e, observability, architecture-boundaries]
spec: user-request-2026-06-13
---

# Hardening T7 — Scale Tooling Foundation

## Goal

BUYMORE ERP has grown into a large modular monolith with many API routes, business domains, and critical workflows. Add tooling that improves change safety at scale without forcing a premature microservice or monorepo migration.

The first foundation layer is:

1. API contract visibility.
2. Browser smoke coverage for critical flows.
3. Production observability readiness.
4. Domain boundary audit and adoption path for Nx/module-boundary tooling.

## Architecture

- Preserve the current Next.js app structure. Do not split services or move folders in this track.
- Prefer additive documentation, scripts, and test harnesses before adding heavy framework-level tooling.
- Keep external services optional and environment-gated. No committed DSNs, tokens, or production credentials.
- Treat Nx/Turborepo as an adoption decision after the API/test/CI foundations are measurable. This track may produce the decision record, but should not migrate the repo to Nx unless the decision record explicitly accepts the blast radius.

## Dependencies

- **Depends on T1:** Playwright smoke tests are only valuable after the unit-test baseline exists.
- **Depends on T2:** New scale tooling must run under enforced CI/local gate so it cannot rot.
- **Coordinates with i18n-t6-menu-remaining:** E2E smoke tests must not rely on hardcoded Thai text that the i18n rework will later replace.

## Tooling Decisions

| Area | Tool | Decision |
| --- | --- | --- |
| API contracts | OpenAPI 3.1 + generated route inventory | Adopt now |
| Type generation | `openapi-typescript` | Adopt after OpenAPI baseline exists |
| E2E smoke | Playwright | Adopt now, minimal critical smoke only |
| Observability | Sentry-ready config + Postgres slow-query runbook | Prepare now, enable only when env is configured |
| Module boundaries | Nx or dependency-cruiser | Audit now, defer install/migration decision to evidence |
| Component catalog | Storybook | Defer to a UI-system track after i18n rework |

## Acceptance Criteria

1. `docs/api/route-inventory.md` lists all `app/api/**/route.ts` routes and detected HTTP methods.
2. `docs/api/openapi.yaml` exists with at least the critical ERP surfaces documented:
   - Auth/session override flows.
   - GRN receive/verify/cancel.
   - POS products/sessions/transactions/picking slips.
   - Sales quotation/order/invoice lifecycle.
   - AP match/payment lifecycle.
3. A script verifies route inventory drift and runs in `npm run check:notes` or a dedicated `npm run check:api-contract`.
4. `openapi-typescript` generation is wired only if the OpenAPI baseline validates cleanly.
5. Playwright is configured with smoke tests that assert high-value behavior without requiring production secrets.
6. Observability setup is documented and environment-gated:
   - Sentry env vars documented, no DSN committed.
   - Postgres `pg_stat_statements` runbook/query added for slow query review.
7. A domain-boundary audit document maps current folders/imports to ERP domains and recommends either:
   - adopt Nx boundary rules,
   - adopt dependency-cruiser,
   - or defer with concrete reasons.
8. `npm run qa:verify` passes after all changes.
9. `npm run agent:closeout` passes after status/docs updates.

## Files

| Action | Path |
| --- | --- |
| Create | `docs/api/route-inventory.md` |
| Create | `docs/api/openapi.yaml` |
| Create | `scripts/generate-api-route-inventory.ts` |
| Create/Modify | `scripts/check-notes.ts` or new `scripts/check-api-contract.ts` |
| Modify | `package.json` |
| Create | `playwright.config.ts` |
| Create | `tests/e2e/*.spec.ts` |
| Create | `docs/observability.md` |
| Create | `docs/db/slow-query-runbook.md` |
| Create | `docs/architecture/domain-boundaries.md` |
| Modify | `_notes/02_Agent_Memory/current-state.md` |
| Modify | `conductor/index.md` |

## Tasks

### Task 1: API Route Inventory

- [ ] **1.1** Scan `app/api/**/route.ts` and generate `docs/api/route-inventory.md`.
- [ ] **1.2** Detect exported HTTP methods (`GET`, `POST`, `PATCH`, `PUT`, `DELETE`) per route.
- [ ] **1.3** Add a drift check that fails when a route exists in code but is missing from the inventory.
- [ ] **1.4** Run the drift check locally and capture output in `execution-summary.md`.

### Task 2: OpenAPI Baseline

- [ ] **2.1** Create `docs/api/openapi.yaml` with project metadata, auth assumptions, shared response envelope, and shared error envelope.
- [ ] **2.2** Document critical route groups listed in Acceptance Criteria #2.
- [ ] **2.3** Add schemas for request/response bodies where current route code exposes stable shapes.
- [ ] **2.4** Add `npm run check:api-contract` to validate that the OpenAPI file parses.
- [ ] **2.5** If clean, add `openapi-typescript` generation to produce a type-only artifact under `types/api-contract.d.ts`.

### Task 3: Playwright Smoke Harness

- [ ] **3.1** Install and configure Playwright with TypeScript.
- [ ] **3.2** Add tests that verify:
  - unauthenticated protected app routes redirect or deny access correctly,
  - login shell renders without client exceptions,
  - at least one critical dashboard or API-backed page renders its loading/error state coherently.
- [ ] **3.3** Avoid brittle text assertions against Thai copy; prefer role/label/test-id assertions that survive i18n migration.
- [ ] **3.4** Add `npm run test:e2e` and document how to run headed/debug mode.

### Task 4: Observability Readiness

- [ ] **4.1** Add `docs/observability.md` describing Sentry env vars, source map policy, release tags, and privacy constraints.
- [ ] **4.2** Add Sentry setup only if it can be fully environment-gated and verified without production credentials.
- [ ] **4.3** Add `docs/db/slow-query-runbook.md` with `pg_stat_statements` enablement notes and read-only SQL for top slow queries.
- [ ] **4.4** Document which ERP flows should be monitored first: GRN, POS checkout, SO/SI lifecycle, AP match/payment.

### Task 5: Domain Boundary Audit

- [ ] **5.1** Create `docs/architecture/domain-boundaries.md`.
- [ ] **5.2** Map current folders to domains: WMS, Inventory, POS, Sales, Accounting/AP, HR, Admin/IAM, Shared UI, Shared infrastructure.
- [ ] **5.3** Identify high-risk import directions, such as UI importing DB utilities, domain code crossing accounting/POS boundaries, or route handlers duplicating validation logic.
- [ ] **5.4** Recommend Nx vs dependency-cruiser vs local ESLint rules with a concrete next track.

### Task 6: Verification and Closeout

- [ ] **6.1** Run `npm run qa:verify`.
- [ ] **6.2** Run `npm run agent:closeout`.
- [ ] **6.3** Write `execution-summary.md`.
- [ ] **6.4** Set this plan and `conductor/index.md` to `Completed` only after all acceptance criteria pass.

## Verification

```bash
npm run check:api-contract
npm run test:e2e
npm run qa:verify
npm run agent:closeout
```

## Non-Goals

- Do not split the ERP into microservices.
- Do not migrate the repo to Nx/Turborepo in this track.
- Do not add Storybook in this track.
- Do not require external Sentry credentials for local development or CI.
- Do not rewrite existing API handlers solely to satisfy OpenAPI completeness; document gaps and create follow-up tracks.

## Future Tracks

- **hardening-t8-boundary-enforcement:** adopt Nx/dependency-cruiser/local ESLint rules based on the boundary audit.
- **hardening-t9-critical-e2e-flows:** expand Playwright from smoke tests to GRN, POS, Sales, and AP lifecycle tests.
- **hardening-t10-ui-component-catalog:** add Storybook after i18n menu rework is completed.

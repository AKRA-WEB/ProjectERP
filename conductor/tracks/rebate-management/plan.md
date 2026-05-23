---
track: rebate-management
phase: V2.2
sequence: 25
status: planned
owner: Chen
created: 2026-05-23
depends_on: []
estimate: M
assigned_to: [Paku]
tags: [v2-orion, rebate, vendor, ap]
---

# Rebate Management

## Goal
Track vendor rebate contracts (volume-tier or period-based) and accrue earned rebates automatically. When a milestone is met, auto-post an AR-Rebate-Receivable entry so finance can chase or net it against the next vendor invoice.

## Scope IN
- New tables `vendor_rebate_contracts(id, vendor_id, threshold_amount NUMERIC, rebate_rate NUMERIC, period ENUM('monthly','quarterly','annual'), valid_from, valid_to, created_at)` and `vendor_rebate_accruals(id, vendor_id, contract_id, period_label TEXT, eligible_purchases NUMERIC, accrued_rebate NUMERIC, status ENUM('pending','accrued','realised','expired'), created_at, posted_je_id)`.
- Nightly aggregation job: sum eligible purchases per vendor per period; create/update accruals.
- On reaching threshold: auto-post JE: DR AR-Rebate-Receivable / CR COGS or Rebate-Income (configurable).
- Manager review of accruals before realization.

## Scope OUT
- Customer-side rebate (sales rebates). V2.3.
- Mid-period contract changes. Closed-period only in V2.2.

## Acceptance Criteria
1. Configure a contract: $100k threshold, 2% rebate. After eligible purchases cross threshold, accrual row appears.
2. JE auto-posts on realization with the correct amount; `posted_je_id` set.
3. Re-running the job is idempotent.
4. Expired periods are closed and not retroactively recalculated.
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `063_rebate_management.sql` — create both tables + index by `(vendor_id, period_label)`.

## API routes
- New: `GET/POST /api/rebate/contracts`, `PATCH /api/rebate/contracts/[id]`.
- New: `GET /api/rebate/accruals`, `POST /api/rebate/accruals/[id]/realise`.

## UI screens
- New: `app/rebate/contracts/page.tsx`, `app/rebate/accruals/page.tsx`.

## Test plan
- Manual: set up contract, post purchases until threshold, verify accrual + JE.
- Lint + tsc.

## Risks
- Eligible-purchase definition (gross vs net of returns) must be signed off with finance.
- Late-arriving invoices may retroactively change accruals — agree on a cut-off rule.

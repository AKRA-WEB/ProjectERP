---
status: accepted
date: 2026-06-28
owner: Chen
module: HR
---

# Prioritize HR Before D1-D7 Workflow Sign-Off

## Context

D1-D7 sales lifecycle work depends on Project Manager confirmation for workflow boundaries and business-state transitions. Implementing those modules before the workflow is settled would create a high risk of rework in schema, route contracts, and UI assumptions.

HR has an existing verified foundation: employee records, departments, positions, leave, attendance, payroll, and dashboard pages already exist. The remaining HR gaps are operational and mostly independent from sales lifecycle decisions.

## Decision

Prioritize an HR operations track before continuing D1-D7 implementation.

First track: `hr-employee-ops-foundation`.

Scope is limited to HR Employee 360, emergency contacts, employee document review, leave-balance adjustments, attendance adjustment review, and HR audit events.

## Boundaries

- D1-D7 stay planned until PM workflow sign-off.
- HR work must not alter sales, POS, dispatch, payment, official document, WMS, or stock-ledger behavior.
- Payroll remains limited to existing read/summary behavior in this track; no new statutory or accounting-posting workflow is introduced.
- HR implementation may add HR-owned tables and APIs only.

## Consequences

- The project can keep moving with low workflow-decision risk.
- HR gets a usable operational surface rather than only dashboards and stubs.
- D1-D7 can resume later with a cleaner context and without HR scope pressure.


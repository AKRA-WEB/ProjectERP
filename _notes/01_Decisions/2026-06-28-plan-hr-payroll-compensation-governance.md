---
date: 2026-06-28
decision: "Continue HR with payroll and compensation governance"
status: Accepted
track: hr-payroll-compensation-governance
---

# Continue HR With Payroll And Compensation Governance

## Context

`hr-employee-ops-foundation` has been QA-verified and archived. D1-D7 sales lifecycle implementation remains paused until Project Manager workflow sign-off.

The next highest-risk HR surface is compensation and payroll governance. Employee 360 now exposes sensitive HR context safely, but salary mutation policy, payroll workflow auditability, payroll adjustment traceability, and endpoint-level masking tests should be made explicit before expanding HR further.

## Decision

Create and activate `hr-payroll-compensation-governance`.

The track will:

- enforce admin-only compensation mutation unless a later policy explicitly grants broader access;
- harden employee creation so managers cannot set salary fields by accident;
- add auditable compensation changes and payroll adjustments;
- add payroll workflow guards and audit events;
- keep accounting formulas and D1-D7 workflows out of scope.

## Consequences

- HR can continue independently while sales workflows are unsettled.
- Payroll/compensation risk is reduced before broader HR automation.
- A future payroll statutory/formula redesign can build on a safer workflow and audit foundation.

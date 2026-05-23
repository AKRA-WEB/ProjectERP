---
track: field-sales-geo-tracking
phase: V2.2
sequence: 26
status: planned
owner: Chen
created: 2026-05-23
depends_on: [channel-on-order-header]
estimate: M
assigned_to: [Paku, Puka]
tags: [v2-orion, sales, geo, mobile]
---

# Field-Sales Geo Tracking

## Goal
For Akra Wholesale field agents, require a geo-tagged customer check-in before they can create an order from the mobile-responsive web UI. Stops "phantom orders" booked from the office under a different agent's name.

## Scope IN
- New table `field_sales_checkins(id, agent_user_id, customer_id, gps_lat NUMERIC, gps_lng NUMERIC, accuracy_m INT, checked_in_at, ended_at)`.
- Mobile-web UI prompts for geolocation permission; persists check-in.
- Order create endpoint (when `source='mobile_field'`) requires an active (not yet ended) check-in for that agent + customer within the last 4 hours.
- Manager dashboard with map view of today's check-ins.

## Scope OUT
- Native mobile app. Web responsive only (per V2.0 out-of-scope rule).
- Geofence enforcement on customer locations. V2.3.

## Acceptance Criteria
1. Order POST from mobile without a valid recent check-in returns 412 `CHECKIN_REQUIRED`.
2. Agent check-in persists GPS, accuracy, and timestamp.
3. Manager dashboard map shows pins; clicking a pin reveals the agent + customer.
4. Check-in older than 4 hours is treated as ended for guard purposes.
5. `npm run lint` and `npx tsc --noEmit` pass.

## Migrations
- `064_field_sales_geo.sql` — create table + index `(agent_user_id, checked_in_at DESC)`.

## API routes
- New: `POST /api/field-sales/checkin`, `POST /api/field-sales/checkout`.
- Touched: `app/api/oms/orders/route.ts` (additional guard for mobile source).
- New: `GET /api/field-sales/today`.

## UI screens
- New: `app/m/field/checkin/page.tsx` — mobile-first UI.
- New: `app/sales/field-map/page.tsx` — manager dashboard with map.

## Test plan
- Manual: deny geolocation, confirm guard error. Allow, check in, place order, confirm success.
- Manager dashboard displays pins.
- Lint + tsc.

## Risks
- Indoor GPS accuracy poor — display warning when `accuracy_m > 50`, allow but flag.
- PDPA: store only what's necessary; document retention policy in `_notes/01_Decisions/`.

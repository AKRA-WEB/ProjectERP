# Rework Plan — hr-ui-redesign

**QA Date:** 2026-05-20
**Auditor:** Billy
**Verdict:** Completed

---

## 🔴 Must Fix

- [x] **MF-1 · Restore View Transitions (Regression)**
  The HR module redesign lost the View Transitions implemented in the previous `view-transitions` track.
  **Fix:** Wrap the main content of these pages in `<ViewTransition>` or `<DirectionalTransition>` from `@/lib/react-vts` or `@/components/ui/directional-transition`.
  - `app/app/hr/page.tsx`
  - `app/app/hr/employees/page.tsx`
  - `app/app/hr/leave-requests/page.tsx`
  - `app/app/hr/payroll/[id]/page.tsx`

- [x] **MF-2 · Missing Probation Stats**
  `/api/hr/employees/stats` is missing `probation_days_remaining` which was required by the plan (Task 5b).
  **Fix:** Add the query to calculate the minimum days remaining for employees in probation (hired within 120 days).

- [x] **MF-3 · Leave Calendar UI deviates from Design (Gantt Chart)**
  The `app/app/hr/leave-requests/page.tsx` implements a classic 7-column monthly grid, but the architectural decision and design (`docs/design/hr-bundle/apps/hr-leave.jsx`) dictate a Gantt-chart style timeline: `gridTemplateColumns: 160px repeat(N, 30px)` with absolute-positioned leave bars.
  **Fix:** Rewrite the Calendar section in `app/app/hr/leave-requests/page.tsx` to match the exact Gantt layout specified in the plan.

---

## 🟡 Should Fix

- [x] **SF-1 · Pass Locale to formatCurrency**
  In `app/app/hr/employees/page.tsx` and other redesigned HR pages, `formatCurrency()` is called without the `lang` parameter. While it defaults to Thai, it should respect the user's selected language.
  **Fix:** Use `formatCurrency(value, lang)` where `lang` comes from `useLanguage()`.

- [x] **SF-2 · Attendance Status Logic**
  `app/api/hr/stats/route.ts` hardcodes '09:00:00' for late calculation. While this matches the current business rule, it should ideally be more flexible or at least documented as a known limitation.

- [x] **SF-3 · Missing Department Colored Dot**
  In `app/app/hr/employees/page.tsx` (around line 297), the department colored dot (`DEPT_COLORS`) was omitted from the department name cell, which was explicitly requested in the plan.
  **Fix:** Add the `<span className="w-2 h-2 rounded-full"... />` dot using `DEPT_COLORS` indexed by the department.

---

## 🔵 Suggestions

- [x] **S-1 · Employee Detail Page**
  The "View Detail" button in the employee list (`app/app/hr/employees/page.tsx`) links to `/app/hr/employees/[id]`, but this page might still be a stub or old version. It should be redesigned to match the new aesthetic.

---

## Batch 8 QA Rework

### [MUST FIX] 🔴

- [x] **MF-4 · Employee Edit API uses raw update**
  - **Problem:** `PATCH /api/hr/employees/[id]` route does not use the mandatory `body.action` discriminated union pattern per `GEMINI.md`.
  - **Fix:** Implement `{ action: 'update', ... }` discriminated union schema, and update `app/app/hr/employees/[id]/page.tsx`'s `handleSave` to pass `{ action: 'update', ...form }`.


# Rework Plan — hr-ui-redesign

**QA Date:** 2026-05-20
**Auditor:** Billy
**Verdict:** Rework Required

---

## 🔴 Must Fix

- [ ] **MF-1 · Restore View Transitions (Regression)**
  The HR module redesign lost the View Transitions implemented in the previous `view-transitions` track.
  **Fix:** Wrap the main content of these pages in `<ViewTransition>` or `<DirectionalTransition>` from `@/lib/react-vts` or `@/components/ui/directional-transition`.
  - `app/app/hr/page.tsx`
  - `app/app/hr/employees/page.tsx`
  - `app/app/hr/leave-requests/page.tsx`
  - `app/app/hr/payroll/[id]/page.tsx`

- [ ] **MF-2 · Missing Probation Stats**
  `/api/hr/employees/stats` is missing `probation_days_remaining` which was required by the plan (Task 5b).
  **Fix:** Add the query to calculate the minimum days remaining for employees in probation (hired within 120 days).

---

## 🟡 Should Fix

- [ ] **SF-1 · Pass Locale to formatCurrency**
  In `app/app/hr/employees/page.tsx` and other redesigned HR pages, `formatCurrency()` is called without the `lang` parameter. While it defaults to Thai, it should respect the user's selected language.
  **Fix:** Use `formatCurrency(value, lang)` where `lang` comes from `useLanguage()`.

- [ ] **SF-2 · Attendance Status Logic**
  `app/api/hr/stats/route.ts` hardcodes '09:00:00' for late calculation. While this matches the current business rule, it should ideally be more flexible or at least documented as a known limitation.

---

## 🔵 Suggestions

- [ ] **S-1 · Employee Detail Page**
  The "View Detail" button in the employee list (`app/app/hr/employees/page.tsx`) links to `/app/hr/employees/[id]`, but this page might still be a stub or old version. It should be redesigned to match the new aesthetic.

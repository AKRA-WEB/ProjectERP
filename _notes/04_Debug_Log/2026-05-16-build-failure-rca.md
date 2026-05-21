# 🚨 Build Failure Root Cause Analysis (RCA)

**Date:** 2026-05-16
**Status:** Fixed & Stabilized — key lessons extracted to skill files
**Target Audience:** Historical record only

> ⚠️ **Agents: do NOT load this file for rules.** All actionable lessons from this RCA have been extracted to:
> - `GEMINI.md` → Critical Build Traps section
> - `docs/skills/frontend_ui_rules.md` → ViewTransition traps
> - `docs/skills/backend_api_rules.md` → SessionUser circular import trap
> - `docs/skills/database_sql_rules.md` → strict null violation trap
> This file is a historical incident record only.

## 📊 Summary
The project experienced a massive build failure with over 130+ type and compilation errors. These errors were not isolated bugs but structural collisions between experimental features and strict TypeScript enforcement.

---

## 🔍 Key Issues Identified

### 1. View Transitions Prop Injection (Cascade Error)
*   **Symptom:** `Property 'transitionTypes' does not exist on type 'LinkProps'`.
*   **Root Cause:** The `apply-view-transitions.js` script injected `transitionTypes={['nav-forward']}` into every `<Link>` component across dozens of files. However, the global TypeScript definitions for `next/link` were not augmented to support this custom prop.
*   **Resolution:** Implemented **Global Type Augmentation** in `types/next.d.ts` to allow `transitionTypes` on all React attributes.

### 2. React 19 compatibility (Experimental Exports)
*   **Symptom:** `Attempted import error: 'ViewTransition' is not exported from 'react'`.
*   **Root Cause:** The codebase relied on direct imports of `ViewTransition` and `addTransitionType` from the `react` package. In the current environment, these experimental features are either missing or exposed differently, causing fatal Webpack errors during production builds.
*   **Resolution:** Created `lib/react-vts.tsx` as a **Compatibility Bridge**. It safely detects the presence of these features and provides functional stubs (fallback to rendering children) if they are missing, ensuring build stability.

### 3. Circular Type Dependencies & Fragmentation
*   **Symptom:** `Module declares 'SessionUser' locally, but it is not exported`.
*   **Root Cause:** Core types like `SessionUser` and `UserRole` were defined in `lib/authz.ts`. As more files imported these types, a circular dependency chain was created between `authz` and the types it relied on, causing TypeScript to lose track of the exports during the build's optimization phase.
*   **Resolution:** Centralized all core interfaces and roles into `types/index.ts`. Re-exported them from `lib/authz.ts` only for backward compatibility.

### 4. Strict Safety Violations in New Features
*   **Symptom:** `Property 'bucket' does not exist on type 'ApAgingRow'` / `Object is possibly 'undefined'`.
*   **Root Cause:** New modules (AP Aging Report, HR Stats, POS Terminal) were implemented with "loose" logic that didn't account for the project's `strict: true` configuration in `tsconfig.json`. Accessing nested properties on API responses without null checks caused build-blocking errors.
*   **Resolution:** Refactored data handling logic with **Nullish Coalescing (`??`)** and explicit property checks.

---

## 🛠️ Actions Taken for Stabilization
1.  **Centralized Types:** Cleaned up `types/index.ts` and synced interfaces with actual database/API structures.
2.  **Safety First:** Patched the AP Aging and HR modules to handle empty/loading states gracefully without crashing the compiler.
3.  **Experimental Guard:** Wrapped all View Transition logic in the new `lib/react-vts.tsx` utility.
4.  **Verification:** Validated the fix using `npx tsc --noEmit` and `npm run lint`.

## 💡 Recommendation for Architect
-   **Avoid Direct React Exports:** Use the `lib/react-vts.tsx` bridge for any future View Transition features.
-   **Centralize Early:** Always place shared interfaces in `types/index.ts` to avoid circular import issues.
-   **Enforce Strictness:** Test new UI logic with `npx tsc --noEmit` before finishing a task to catch null-safety issues early.

---
*Reported by Gemini CLI (Implementer)*

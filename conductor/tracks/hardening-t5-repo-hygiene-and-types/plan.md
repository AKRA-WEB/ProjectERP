---
track: hardening-t5-repo-hygiene-and-types
phase: hardening-stabilization
sequence: 5
status: Planned
owner: Chen
created: 2026-06-06
updated: 2026-06-06
depends_on: [hardening-t1-test-foundation]
estimate: S
tags: [hygiene, types, cleanup, low]
spec: conductor/qa-reports/full-audit-2026-06-06.md
---

# Hardening T5 — Repo Hygiene + Type Safety (Low)

## Goal

Reduce repo clutter and remove `as any` debt:
- **L1** — `scratch/` dev throwaways, `data/` binaries (PDF/jpg), and `HH-Project manager/` (space in folder name) are committed.
- **L2** — 16 `as any` casts (12 in `auth.config.ts`) violate the CLAUDE.md hard rule.
- **L3** — the only test lived in `scratch/` (handled by T1; verify it no longer does before ignoring scratch).

Depends on T1 (must have moved `scratch/sanity.test.ts` out first, else gitignoring scratch deletes the only test).

## Architecture

- NextAuth typing: add `types/next-auth.d.ts` module augmentation so `Session.user` and JWT carry `role`, `permissions`, `assignedWarehouseIds`, `employeeId`, `position`, `businessUnitId` — eliminating casts in `auth.config.ts`, `auth.ts`, `middleware.ts`.
- Move docs/binaries out of git; gitignore scratch.

## Tech Stack

TypeScript module augmentation, `.gitignore`.

## Acceptance Criteria

1. `scratch/` gitignored; no scratch files tracked (after T1 moved the test).
2. `data/` binaries and `HH-Project manager/` removed from tracking (moved to external storage; recorded in README where they went).
3. `types/next-auth.d.ts` created; `as any` count in `auth.config.ts`/`auth.ts`/`middleware.ts` → 0.
4. `git grep "as any"` total reduced to only genuinely-unavoidable bridges (documented).
5. `npx tsc --noEmit` + `npm run qa:verify` pass.

---

## Files

| Action | Path |
|--------|------|
| Create | `types/next-auth.d.ts` |
| Modify | `auth.config.ts`, `auth.ts`, `middleware.ts` (drop `as any`) |
| Modify | `.gitignore` (add `scratch/`, binary patterns) |
| Remove (git rm --cached) | `data/*.pdf`, `data/*.jpg`, `HH-Project manager/`, `scratch/` contents |
| Modify | `README.md` (note where moved docs live) |

---

## Tasks

### Task 1: NextAuth type augmentation

- [ ] **1.1** Read `types/index.ts` for `SessionUser`/`UserRole` shape.
- [ ] **1.2** Create `types/next-auth.d.ts`:
```ts
import type { UserRole } from '@/types';
declare module 'next-auth' {
  interface Session { user: { id: string; email: string; name?: string | null;
    role: UserRole; permissions: string[]; assignedWarehouseIds: string[];
    employeeId: string | null; position: string | null; businessUnitId: string | null; }; }
  interface User { role: UserRole; permissions: string[]; assignedWarehouseIds: string[];
    employeeId: string | null; position: string | null; businessUnitId: string | null; }
}
declare module 'next-auth/jwt' {
  interface JWT { id: string; role: UserRole; permissions: string[]; assignedWarehouseIds: string[];
    employeeId: string | null; position: string | null; businessUnitId: string | null; }
}
```
- [ ] **1.3** Remove `(user as any)` / `(session.user as any)` / `(token as any)` casts in `auth.config.ts`, `auth.ts` (keep the documented `as unknown as SessionUser` bridge in API routes — that's the sanctioned pattern), and `middleware.ts`.
- [ ] **1.4** `npx tsc --noEmit` — clean.

### Task 2: Gitignore scratch + remove binaries

- [ ] **2.1** Confirm T1 moved the test: `git ls-files scratch/ | grep test` → empty. If not, STOP and finish T1.
- [ ] **2.2** Add to `.gitignore`: `scratch/`, `*.pdf`, `*.jpg`, `*.png` (scope binary patterns to `data/` if needed to avoid ignoring legit assets — verify `git ls-files '*.png'` first).
- [ ] **2.3** `git rm -r --cached scratch/ "HH-Project manager/" data/*.pdf data/*.jpg` (keep working copies). Record in README where requirement docs now live.

### Task 3: Verify + commit

- [ ] **3.1** `npm run qa:verify`.
- [ ] **3.2** Commit:
```bash
git add types/next-auth.d.ts auth.config.ts auth.ts middleware.ts
git commit -m "refactor(types): augment NextAuth types, remove as-any casts"
git add .gitignore README.md
git commit -m "chore(hygiene): gitignore scratch, untrack committed binaries"
```

---

## Verification

```bash
git grep -c "as any" -- auth.config.ts auth.ts middleware.ts   # → 0
git ls-files scratch/ | wc -l                                   # → 0
npm run qa:verify
```

## Notes

- `git rm --cached` keeps local files; only stops tracking. Do NOT hard-delete the requirement PDFs without confirming they live elsewhere first.
- Verify `*.png`/`*.jpg` ignore patterns do not accidentally untrack legitimate UI assets — run `git ls-files '*.png' '*.jpg'` before adding broad patterns; scope to `data/` if any are real assets.

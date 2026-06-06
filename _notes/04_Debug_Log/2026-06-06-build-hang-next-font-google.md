# Debug Log — `npm run build` hangs in sandboxed agents

**Date:** 2026-06-06 · **Author:** Claude · **Fix commit:** `aa2e66e` (merge `be859a6`)

## Symptom

Codex reported `npm run build` "ค้างนานมาก" / timing out during QA verification.
Same build succeeded for other agents.

## Root cause

`app/layout.tsx` imported fonts via `next/font/google`
(`IBM_Plex_Sans_Thai`, `IBM_Plex_Mono`). `next/font/google` downloads the font
files from Google **at build time**. Codex runs in a sandbox with **network
blocked** → the fetch retries until timeout → build stalls. Builds that "worked"
had a warm `.next` cache (712 MB) and network access, masking the dependency.

## Why it was hard to spot

- A green `npm run build` elsewhere implied "code is fine" — but the failure was
  environmental (network), not code.
- Build exit 0 does NOT prove fonts are correct, and a timeout gives no clear
  error pointing at fonts.

## Fix

Self-host with `next/font/local`:
- Vendored IBM Plex woff2 into `app/fonts/` from the official `@ibm/plex-*`
  **`complete`** builds (one file per weight, Thai+Latin together):
  Sans Thai 300/400/500/600/700, Mono 400/500/600.
- Removed the `@ibm/plex-*` / `@fontsource/*` helper packages after copying
  (files committed; no new build/runtime dependency).
- `--font-sans` / `--font-mono` CSS-variable contract unchanged
  (`app/globals.css` untouched).

## Key gotcha (recorded in pitfalls #11)

Do NOT use `@fontsource` subset-split files (`*-thai-*` + `*-latin-*` as separate
woff2). `next/font/local` exposes no per-`src` `unicode-range`, so two entries
with the same weight collide and one script silently drops to tofu. Need a
single file per weight covering all required scripts.

## Verification

- fontTools cmap: `IBMPlexSansThai-Regular` has `A` + Thai `ก`/`๙` + digits;
  `IBMPlexMono-Regular` is Latin-only (intended).
- `npm run build` → exit 0, **no network**; 8 woff2 emitted to
  `.next/static/media`.
- `npm run lint` → 0; `npx tsc --noEmit` → 0.
- Recommended follow-up: visual QA on `/login` (TH/EN) to confirm rendering.

---
module: Core
type: module-summary
---

# Core — UI Framework & Infrastructure

Design system, navigation, i18n, performance, view transitions.

## Dependencies
- **Foundational for:** All modules ([[WMS]], [[Inventory]], [[POS]], [[Sales]], [[Accounting]], [[HR]], [[BOM]], [[Vendors]], [[Security]])
- **Infrastructure:** Provides document numbering, API clients, and shared UI components.

## Stack
Next.js 15 App Router · React 19 · TypeScript strict · Tailwind CSS · NextAuth v5

## Key Conventions
- Bilingual labels: Thai primary, English secondary
- `formatCurrency()` THB only — ห้าม hardcode สกุลเงิน
- `formatDate()` Thai locale, Asia/Bangkok TZ
- All pages `'use client'` — no RSC data fetching
- Components: `components/ui/index.ts`
- API client: `lib/api-client.ts` (`get`, `post`, `patch`, `del`)

## Document Numbering
PostgreSQL `next_doc_number(prefix, seq)` — ห้าม generate ใน app code

## Sequences
`seq_pr` · `seq_po` · `seq_grn` · `seq_rma` · `seq_clm` · `seq_trf` · `seq_cc`

## Tracks

```dataview
TABLE status, updated
FROM "conductor/tracks"
WHERE file.name = "plan" AND module = "Core"
SORT updated DESC
```

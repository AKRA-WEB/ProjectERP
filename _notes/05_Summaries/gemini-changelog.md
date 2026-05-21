# GEMINI.md Changelog

| Date | Change |
|------|--------|
| 2026-05-20 | **Bugfix: GRN receive status transition** — Fixed a bug where completing a GRN did not update the Inbound Order status, leaving it as 'receiving' ('กำลังลงสินค้า') in the active queue. Now correctly updates to 'pending_verification' ('รอตรวจสอบ') and updates the UI status mappings. |
| 2026-05-20 | **grn-role-segregation track completed** — Gated QC and Stock-In buttons under isManager in Detail page, secured POST /api/grn/[id]/stock on backend, and updated redirects to Receiving Queue with success toast |
| 2026-05-20 | **grn-simplified-workflow track completed** — Refactored GRN receiving UX to single scrollable form with bonus items, lift fee payment, Thai labels, and 72-hour overdue badges |
| 2026-05-20 | **repack-order track completed** — New module for multi-UoM repack system; integrated stock synchronization with stock_ledger; added print barcode stub |
| 2026-05-20 | **Rework Cleanup** — Verified and completed `po-gr-audit`, `io-grn-500`, `wms-search-nav-fix`, and `hr-ui-redesign`; fixed global lint errors across multiple modules |
| 2026-05-19 | **hr-ui-redesign track completed** — Full redesign of HR Dashboard, Employees, Leave, and Payroll pages; extended 4 APIs; added 13 stub pages; updated Sidebar to 8 groups |
| 2026-05-19 | **view-transitions track completed** — Final rework and verification of app-wide view transitions in Sidebar and TopBar |
| 2026-05-19 | **Core Stability** — Fixed global hydration errors; added `formatNumber` to shared utilities |
| 2026-05-18 | **po-gr-audit track completed** — Refactored PO/GRN POST and QC routes to use transactions; added role check to QC route |
| 2026-05-18 | **Rule 7 added** — Execution summary must quote file:line evidence per task; narrative-only = insufficient |
| 2026-05-18 | **Rule 4b added** — Re-read before tick: no BUG/TODO/FIXME allowed in modified files before marking task complete |
| 2026-05-18 | **Critical Traps moved to pitfalls.md** — GEMINI.md now links out; traps 5-7 added (parent-child INSERT, body.action, status side effects) |
| 2026-05-18 | **Critical Traps 5-7 added** — Parent-child INSERT, body.action discriminant, status transition side effects (from po-gr-audit) |
| 2026-05-18 | **Obsidian vault restructured** — `_notes/modules/` → `_notes/00_Project_Map/modules/`, `_notes/decisions/` → `_notes/01_Decisions/`, new folders: `02_Agent_Memory/`, `03_Prompts/`, `04_Debug_Log/`, `05_Summaries/` |
| 2026-05-18 | **Rule 0 (Pitfalls First)** — Must read `_notes/02_Agent_Memory/pitfalls.md` before every `Go` command |
| 2026-05-16 | **Rule 0b added** — Read target file before ANY edit. Never edit from memory. |
| 2026-05-16 | **chen.agent.md Rule 12** — Chen must check latest migration number before writing any plan with new migration |
| 2026-05-16 | **chen.agent.md Rule 13** — Check `types/index.ts` + `components/ui/index.ts` before UI plan |
| 2026-05-16 | **qa_audit_rules.md** — Billy checklist now includes `console.log` artifact check + hardcoded VAT rate check |

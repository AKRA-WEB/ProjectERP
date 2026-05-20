
## Session: 2026-05-17 (Session 11 â€” Full QA Sweep + Rework Plans)

### à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸—à¸³à¸§à¸±à¸™à¸™à¸µà¹‰

#### 1. QA Audit à¸„à¸£à¸š 34 tracks â€” âœ… à¹€à¸ªà¸£à¹‡à¸ˆà¸ªà¸¡à¸šà¸¹à¸£à¸“à¹Œ
à¸£à¸±à¸™ Billy QA agents 7 à¸•à¸±à¸§à¸žà¸£à¹‰à¸­à¸¡à¸à¸±à¸™ à¸„à¸£à¸­à¸šà¸„à¸¥à¸¸à¸¡à¸—à¸¸à¸ track à¸—à¸µà¹ˆà¸¡à¸µà¸ªà¸–à¸²à¸™à¸° "Completed":
- Batch 1: WMS Core (5 tracks) Â· Batch 2: Inventory/Stock (5) Â· Batch 3: POS/Sales (4)
- Batch 4: Finance/HR/BOM (4) Â· Batch 5: UI/Nav (5) Â· Batch 6: UoM/Vendors/i18n (5)
- Batch 7: UI Improvements + Recent (6)

**à¸œà¸¥à¸¥à¸±à¸žà¸˜à¹Œ:** Rework Required = 21, Optimization Suggested = 10, Verified = 1

#### 2. Critical Findings
- `fix-over-receipt`: over-receipt guard à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸¥à¸¢
- `accounting-module`: float equality à¸—à¸³à¹ƒà¸«à¹‰ double-entry balance check à¸œà¸´à¸”à¸žà¸¥à¸²à¸”
- `bom-module`: recursive CTE à¹„à¸¡à¹ˆà¸¡à¸µ depth limit â†’ circular BOM à¸—à¸³à¹ƒà¸«à¹‰ DB hang
- `audit-pr-po-grn`: warehouse scope leak + PR state machine bypass
- `inventory-valuation-report`: staff role à¸­à¹ˆà¸²à¸™ cost data à¹„à¸”à¹‰ (à¸•à¹‰à¸­à¸‡à¹€à¸›à¹‡à¸™ manager+)

#### 3. Rework Plans à¹€à¸‚à¸µà¸¢à¸™à¸„à¸£à¸š â€” âœ… à¹€à¸ªà¸£à¹‡à¸ˆà¸ªà¸¡à¸šà¸¹à¸£à¸“à¹Œ
à¹€à¸‚à¸µà¸¢à¸™ rework-plan.md à¹ƒà¸«à¹‰ 18 tracks à¹ƒà¸«à¸¡à¹ˆ + 2 pre-existing = à¸„à¸£à¸­à¸šà¸„à¸¥à¸¸à¸¡à¸—à¸¸à¸ Rework Required track

#### 4. conductor/index.md à¸­à¸±à¸žà¹€à¸”à¸— â€” âœ… à¹€à¸ªà¸£à¹‡à¸ˆà¸ªà¸¡à¸šà¸¹à¸£à¸“à¹Œ
à¸ªà¸–à¸²à¸™à¸°à¸—à¸¸à¸ track à¹à¸à¹‰à¹„à¸‚à¹ƒà¸«à¹‰à¸•à¸£à¸‡à¸à¸±à¸šà¸œà¸¥ QA à¸ˆà¸£à¸´à¸‡

### à¸ªà¸–à¸²à¸™à¸°
âœ… STABLE â€” rework plans à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¸žà¸£à¹‰à¸­à¸¡à¹ƒà¸«à¹‰ Gemini CLI implement

---

## Session: 2026-05-16 (Session 10 â€” Project Health Check + UI Bug Fixes)

### à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸—à¸³à¸§à¸±à¸™à¸™à¸µà¹‰

#### 1. Project Health Check & Cleanup â€” âœ… à¹€à¸ªà¸£à¹‡à¸ˆà¸ªà¸¡à¸šà¸¹à¸£à¸“à¹Œ
- à¸•à¸£à¸§à¸ˆ worktree / conductor index / memory à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”
- Commit à¸‚à¸­à¸‡à¸„à¹‰à¸²à¸‡: `run-migrate.ts`, `package.json` (tsx migrate runner), `settings.local.json`, `puka.agent.md`
- Conductor index: "Active Now" à¸§à¹ˆà¸²à¸‡, Dashboard track â†’ Completed
- Memory `project_state.md`: à¹à¸à¹‰à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ stale â€” POS à¹€à¸›à¹‡à¸™ Verified, migration à¸­à¸¢à¸¹à¹ˆà¸—à¸µà¹ˆ 031

#### 2. Bug Fix: Hamburger Menu Mobile â€” âœ… à¹€à¸ªà¸£à¹‡à¸ˆà¸ªà¸¡à¸šà¸¹à¸£à¸“à¹Œ
**Root cause:** `layout.tsx` à¸ªà¹ˆà¸‡ `onClose` à¹€à¸›à¹‡à¸™ inline arrow function â†’ new ref à¸—à¸¸à¸ render â†’ Sidebar `useEffect([pathname, onClose])` fire à¸—à¸±à¸™à¸—à¸µà¸«à¸¥à¸±à¸‡ `setSidebarOpen(true)` à¸—à¸³à¹ƒà¸«à¹‰ sidebar à¸›à¸´à¸”à¸à¹ˆà¸­à¸™à¹€à¸›à¸´à¸”à¹„à¸”à¹‰

**Fix:** `useCallback` stabilize 3 callbacks à¹ƒà¸™ `layout.tsx`:
- `handleCloseSidebar`
- `handleMenuToggle`
- `handleToggleCollapse`

#### 3. Bug Fix: Sign Out Button â€” âœ… à¹€à¸ªà¸£à¹‡à¸ˆà¸ªà¸¡à¸šà¸¹à¸£à¸“à¹Œ
**Root cause:** `onSignOut` prop à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸ªà¹ˆà¸‡à¹ƒà¸«à¹‰ `TopBar` à¹€à¸¥à¸¢ â€” button `onClick={onSignOut}` = `undefined`

**Fix:** import `signOut` à¸ˆà¸²à¸ `next-auth/react` + wire `handleSignOut({ callbackUrl: '/login' })` à¸œà¹ˆà¸²à¸™ `useCallback`

### à¸ªà¸–à¸²à¸™à¸°
âœ… STABLE â€” TSC clean, lint pass, à¹„à¸¡à¹ˆà¸¡à¸µ active track à¸„à¹‰à¸²à¸‡

---

## Session: 2026-05-16 (Session 9 â€” Dashboard ReferenceError Fix)

### à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸—à¸³à¸§à¸±à¸™à¸™à¸µà¹‰

#### 1. Dashboard Crash Fix â€” âœ… à¹€à¸ªà¸£à¹‡à¸ˆà¸ªà¸¡à¸šà¸¹à¸£à¸“à¹Œ
à¹à¸à¹‰à¹„à¸‚à¸›à¸±à¸à¸«à¸² `ReferenceError: formatDatetime is not defined` à¹ƒà¸™à¸«à¸™à¹‰à¸² Dashboard (`app/app/dashboard/page.tsx`)

#### 2. Build Blocker & <Html> Error Fix â€” âœ… à¹€à¸ªà¸£à¹‡à¸ˆà¸ªà¸¡à¸šà¸¹à¸£à¸“à¹Œ
à¹à¸à¹‰à¹„à¸‚à¸›à¸±à¸à¸«à¸²à¸—à¸µà¹ˆà¸—à¸³à¹ƒà¸«à¹‰ `npm run build` à¹„à¸¡à¹ˆà¸œà¹ˆà¸²à¸™ (Critical for Vercel)

**à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸—à¸³:**
- **Lint Cleanup:** à¸¥à¸šà¸•à¸±à¸§à¹à¸›à¸£à¹à¸¥à¸° Interface à¸—à¸µà¹ˆà¹„à¸¡à¹ˆà¹„à¸”à¹‰à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¹ƒà¸™à¸«à¸™à¹‰à¸² GRN (`app/app/grn/new/page.tsx`, `app/app/grn/page.tsx`)
- **Structure Cleanup:** à¸¥à¸šà¹‚à¸Ÿà¸¥à¹€à¸”à¸­à¸£à¹Œ `app/(app)` à¸—à¸µà¹ˆà¸§à¹ˆà¸²à¸‡à¹€à¸›à¸¥à¹ˆà¸²à¹à¸¥à¸°à¸‹à¹‰à¸³à¸‹à¹‰à¸­à¸™à¸­à¸­à¸ à¸‹à¸¶à¹ˆà¸‡à¹€à¸›à¹‡à¸™à¸ªà¸²à¹€à¸«à¸•à¸¸à¸‚à¸­à¸‡à¸„à¸§à¸²à¸¡à¸ªà¸±à¸šà¸ªà¸™à¹ƒà¸™ Next.js App Router
- **Build Verification:** à¸—à¸”à¸ªà¸­à¸šà¸£à¸±à¸™ `npm run build` à¸”à¹‰à¸§à¸¢ `NODE_ENV=production` à¸žà¸šà¸§à¹ˆà¸²à¸œà¹ˆà¸²à¸™ 100% à¸„à¸£à¸šà¸—à¸±à¹‰à¸‡ 152 routes (à¸£à¸§à¸¡ API)
- **Resolved persistent error:** à¸›à¸±à¸à¸«à¸² `<Html> should not be imported outside of pages/_document` à¸«à¸²à¸¢à¹„à¸›à¸­à¸¢à¹ˆà¸²à¸‡à¸ªà¸¡à¸šà¸¹à¸£à¸“à¹Œ

**à¸œà¸¥à¸¥à¸±à¸žà¸˜à¹Œ:** à¹‚à¸›à¸£à¹€à¸ˆà¸à¸•à¹Œà¸­à¸¢à¸¹à¹ˆà¹ƒà¸™à¸ªà¸–à¸²à¸™à¸° **Production Ready** à¸ªà¸²à¸¡à¸²à¸£à¸– Deploy à¸‚à¸¶à¹‰à¸™ Vercel à¹„à¸”à¹‰à¸—à¸±à¸™à¸—à¸µ

---

## Session: 2026-05-15 (Session 8 â€” AP System Plan + Obsidian Setup + Workflow Upgrade)

### à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸—à¸³à¸§à¸±à¸™à¸™à¸µà¹‰

#### 1. Accounts Payable System â€” Plan à¸žà¸£à¹‰à¸­à¸¡à¹à¸¥à¹‰à¸§

à¸§à¸²à¸‡à¹à¸œà¸™ AP System à¸„à¸£à¸šà¸§à¸‡à¸ˆà¸£ 17 tasks, 5 phases â€” à¸žà¸£à¹‰à¸­à¸¡à¹ƒà¸«à¹‰ Gemini CLI implement

**Key findings à¸ˆà¸²à¸à¸à¸²à¸£à¸­à¹ˆà¸²à¸™ schema à¸ˆà¸£à¸´à¸‡:**
- `po_invoices` table à¸¡à¸µà¸­à¸¢à¸¹à¹ˆà¹à¸¥à¹‰à¸§à¹ƒà¸™ `005_pr_po.sql` â†’ extend à¸”à¹‰à¸§à¸¢ `ALTER TABLE` à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡à¸ªà¸£à¹‰à¸²à¸‡à¹ƒà¸«à¸¡à¹ˆ
- `vendors` à¸¡à¸µ `payment_terms_days INTEGER DEFAULT 30` à¸­à¸¢à¸¹à¹ˆà¹à¸¥à¹‰à¸§ â†’ migration à¹€à¸žà¸´à¹ˆà¸¡à¹à¸„à¹ˆ bank fields
- GRN stocking trigger 2 à¸ˆà¸¸à¸”: `app/api/grn/[id]/stock/route.ts` + `app/api/grn/[id]/confirm/route.ts`

**Scope:**
- Migration `031_ap_system.sql` â€” extend vendors (bank fields), extend po_invoices (vendor_id, grn_id, paid_amount), new ap_payments + ap_payment_allocations tables + trigger auto-update is_paid
- API: `/api/ap/invoices`, `/api/ap/aging`, `/api/ap/payments` + vendor PATCH
- UI: AP invoices list, invoice detail, aging report, payment recording
- GRN integration: auto-create AP invoice on stocking

**Output:** `conductor/tracks/accounts-payable/plan.md` âœ…

---

#### 4. Accounts Payable (AP) Module â€” Implementation Complete

Gemini CLI à¹„à¸”à¹‰à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£ Implement à¸£à¸°à¸šà¸š AP à¸ˆà¸™à¹€à¸ªà¸£à¹‡à¸ˆà¸ªà¸´à¹‰à¸™à¸„à¸£à¸šà¸—à¸¸à¸ Phase:

**à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸—à¸³:**
- **Migration:** à¸ªà¸£à¹‰à¸²à¸‡ `031_ap_system.sql` à¹€à¸žà¸´à¹ˆà¸¡à¸Ÿà¸´à¸¥à¸”à¹Œà¸˜à¸™à¸²à¸„à¸²à¸£à¹ƒà¸™ `vendors`, à¸‚à¸¢à¸²à¸¢ `po_invoices`, à¹à¸¥à¸°à¹€à¸žà¸´à¹ˆà¸¡à¸•à¸²à¸£à¸²à¸‡ `ap_payments`
- **Backend:** API `/api/ap/invoices`, `/api/ap/aging`, `/api/ap/payments` (à¸žà¸£à¹‰à¸­à¸¡ logic à¸•à¸±à¸”à¸ˆà¹ˆà¸²à¸¢à¸«à¸™à¸µà¹‰à¹à¸šà¸š partial)
- **Integration:** à¹€à¸Šà¸·à¹ˆà¸­à¸¡à¸•à¹ˆà¸­ GRN à¹ƒà¸«à¹‰à¸ªà¸£à¹‰à¸²à¸‡ AP Invoice à¹‚à¸”à¸¢à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´à¹€à¸¡à¸·à¹ˆà¸­ Stocked/Confirmed
- **Frontend:** à¸žà¸±à¸’à¸™à¸² UI à¸„à¸£à¸šà¸—à¸¸à¸à¸ªà¹ˆà¸§à¸™ (List, Detail, Aging Report, Multi-invoice Payment Form)
- **Navigation:** à¹€à¸žà¸´à¹ˆà¸¡à¸ªà¹ˆà¸§à¸™à¸‡à¸²à¸™ AP à¹ƒà¸™ Sidebar

**à¸œà¸¥à¸¥à¸±à¸žà¸˜à¹Œ:** `Completed` à¸žà¸£à¹‰à¸­à¸¡à¸£à¸­ Billy QA à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š

---

#### 2. Chen Agent Bug Fix â€” à¹„à¸¡à¹ˆà¸ªà¸£à¹‰à¸²à¸‡à¹„à¸Ÿà¸¥à¹Œ

**à¸›à¸±à¸à¸«à¸²:** Chen agent à¸ªà¸£à¹‰à¸²à¸‡à¹à¸œà¸™à¹€à¸›à¹‡à¸™ text output à¹à¸•à¹ˆà¹„à¸¡à¹ˆà¹„à¸”à¹‰ write à¹„à¸Ÿà¸¥à¹Œà¸ˆà¸£à¸´à¸‡à¸šà¸™ disk à¹€à¸žà¸£à¸²à¸°:
1. Tools à¸¡à¸µà¹à¸„à¹ˆ `read, search, agent` â€” à¹„à¸¡à¹ˆà¸¡à¸µ `write`/`edit`
2. Bash à¹ƒà¸™ Git Bash à¹ƒà¸Šà¹‰ path `/c/Users/...` à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œ Windows à¹„à¸¡à¹ˆà¸­à¸­à¸ â†’ schema à¸”à¸¹ empty

**à¹à¸à¹‰:**
- à¹€à¸žà¸´à¹ˆà¸¡ `write` + `edit` à¹ƒà¸™ `.claude/agents/chen.agent.md` tools list
- à¹€à¸žà¸´à¹ˆà¸¡ "File Writing Rules" section â€” à¸šà¸±à¸‡à¸„à¸±à¸š Write tool + Windows absolute path
- à¹€à¸žà¸´à¹ˆà¸¡ Verify step à¸à¹ˆà¸­à¸™à¸£à¸²à¸¢à¸‡à¸²à¸™à¸§à¹ˆà¸²à¹€à¸ªà¸£à¹‡à¸ˆ

**à¹€à¸£à¸µà¸¢à¸™à¸£à¸¹à¹‰:** subagent output â‰  file exists â€” à¸•à¹‰à¸­à¸‡ Glob verify à¸—à¸¸à¸à¸„à¸£à¸±à¹‰à¸‡à¸«à¸¥à¸±à¸‡ spawn agent

---

#### 3. Obsidian In-Project Vault Setup

à¹€à¸›à¸´à¸” Obsidian à¸•à¸£à¸‡à¸šà¸™ `projectERP/` folder à¹‚à¸”à¸¢à¹„à¸¡à¹ˆà¸¢à¹‰à¸²à¸¢à¹„à¸Ÿà¸¥à¹Œà¹ƒà¸”à¹†

**à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸—à¸³:**
- `.obsidian/app.json` â€” exclude node_modules, .next, migrations, scripts, *.log; à¸•à¸±à¹‰à¸‡ new note â†’ `_notes/`
- à¸ªà¸£à¹‰à¸²à¸‡ `_notes/HOME.md` â€” vault entry point + quick links à¹„à¸› active tracks
- à¸ªà¸£à¹‰à¸²à¸‡ `_notes/daily/`, `_notes/modules/`, `_notes/decisions/`
- à¸¢à¹‰à¸²à¸¢ `HR_MODULE_SUMMARY.md` â†’ `_notes/modules/`, `Context.md` â†’ `_notes/`, `TROUBLESHOOTING.md` â†’ `docs/`
- `.gitignore` â€” à¹€à¸žà¸´à¹ˆà¸¡ `.obsidian/workspace.json` + `_notes/daily/`

**Root .md à¸—à¸µà¹ˆà¹€à¸«à¸¥à¸·à¸­ (3 à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸­à¸¢à¸¹à¹ˆ root):** `CLAUDE.md` Â· `GEMINI.md` Â· `PROGRESS.md`

---

#### 4. Post-Task Knowledge Capture System

à¸£à¸°à¸šà¸š capture pattern/trap à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´à¸«à¸¥à¸±à¸‡à¸—à¸¸à¸ task â€” à¸—à¸±à¹‰à¸‡ Gemini à¹à¸¥à¸° Claude

**à¹€à¸žà¸´à¹ˆà¸¡à¹ƒà¸™:**
- `GEMINI.md` â€” Post-Task Knowledge Capture protocol (Q1 pattern / Q2 trap / Q3 decision)
- `CLAUDE.md` â€” section à¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™ + trigger à¸—à¸µà¹ˆà¸šà¸±à¸‡à¸„à¸±à¸š capture à¸—à¸±à¸™à¸—à¸µ
- `conductor/PROTOCOLS.md` â€” à¹€à¸žà¸´à¹ˆà¸¡ bullet + execution-summary à¸•à¹‰à¸­à¸‡ list patterns
- `docs/skills/*.md` (4 à¹„à¸Ÿà¸¥à¹Œ) â€” à¹€à¸žà¸´à¹ˆà¸¡ section "Patterns & Traps â€” Captured in Field"

**à¸§à¸´à¸˜à¸µà¸—à¸³à¸‡à¸²à¸™:** à¸«à¸¥à¸±à¸‡à¸—à¸¸à¸ task â†’ check 3 à¸„à¸³à¸–à¸²à¸¡ â†’ append à¹ƒà¸™ skill file à¸«à¸£à¸·à¸­ decisions.md â†’ à¹€à¸£à¸´à¹ˆà¸¡ task à¸–à¸±à¸”à¹„à¸›

---

### à¸ªà¸–à¸²à¸™à¸°à¹‚à¸„à¹‰à¸” (Code Stability)

| à¸£à¸°à¸šà¸š | à¸ªà¸–à¸²à¸™à¸° |
|------|-------|
| WMS Core | âœ… Verified |
| POS Module (base) | âœ… Verified |
| POS Improvements | âœ… Verified |
| HR Module | âœ… Completed |
| Sales Module | âœ… Completed |
| Accounting Module | âœ… Completed |
| Outbound Picking | âœ… Completed |
| **Accounts Payable** | **ðŸ“‹ Plan Ready â€” à¸£à¸­ Gemini implement** |

---

### à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸—à¸³à¸„à¸£à¸±à¹‰à¸‡à¸«à¸™à¹‰à¸²

1. **Gemini CLI:** `Go` â†’ implement Accounts Payable track (17 tasks)
2. **Billy QA** à¸«à¸¥à¸±à¸‡ AP implement à¹€à¸ªà¸£à¹‡à¸ˆ
3. à¸¥à¸šà¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆ copy à¹„à¸› `02-2 - AKRA\BUYMORETH` à¸–à¹‰à¸²à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡à¸à¸²à¸£

---

## Session: 2026-05-15 (Session 7 â€” POS Improvements QA)

### à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸—à¸³à¸§à¸±à¸™à¸™à¸µà¹‰

#### 1. Billy QA Audit â€” POS Improvements Track â€” âš ï¸ Rework Required

à¸£à¸±à¸™ Billy QA audit à¸„à¸£à¸šà¸§à¸‡à¸ˆà¸£à¸šà¸™ track `pos-improvements` à¸—à¸µà¹ˆ Gemini CLI implement à¹„à¸§à¹‰ à¸žà¸š 12 à¸›à¸±à¸à¸«à¸² à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¹„à¸”à¹‰à¸£à¸±à¸šà¸à¸²à¸£ validate à¹‚à¸”à¸¢ Chen agent à¹€à¸—à¸µà¸¢à¸šà¸à¸±à¸š code à¸ˆà¸£à¸´à¸‡

**à¸›à¸±à¸à¸«à¸²à¸—à¸µà¹ˆà¸žà¸š (Must Fix â€” 4 à¸£à¸²à¸¢à¸à¸²à¸£):**

| ID | à¹„à¸Ÿà¸¥à¹Œ | à¸›à¸±à¸à¸«à¸² |
|----|------|-------|
| F-001 | `app/api/pos/transactions/route.ts` | **Security:** `discount_amount` à¸ˆà¸²à¸ client body à¹„à¸¡à¹ˆà¸–à¸¹à¸ verify à¸à¸±à¸š `discount_rate` à¸ˆà¸²à¸ DB â€” cashier à¸ªà¸²à¸¡à¸²à¸£à¸–à¸ªà¹ˆà¸‡ discount à¹€à¸à¸´à¸™à¸ªà¸´à¸—à¸˜à¸´à¹Œà¹„à¸”à¹‰ |
| F-002 | `app/api/pos/transactions/route.ts` | **Data Integrity:** `UPDATE pos_members SET points_balance` à¸£à¸±à¸™ **à¸«à¸¥à¸±à¸‡** `client.release()` â€” à¸™à¸­à¸ transaction block. Crash à¸£à¸°à¸«à¸§à¹ˆà¸²à¸‡à¸à¸¥à¸²à¸‡ = sale à¸šà¸±à¸™à¸—à¸¶à¸ à¹à¸•à¹ˆà¹à¸•à¹‰à¸¡à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸šà¸§à¸ |
| F-003 | `app/api/pos/shifts/route.ts` | **Architecture:** Shift number à¹ƒà¸Šà¹‰ `Math.random()` à¹ƒà¸™ app code â€” à¸œà¸´à¸” CLAUDE.md. `seq_pos_shift` à¸¡à¸µà¹ƒà¸™ migration à¹à¸•à¹ˆà¹„à¸¡à¹ˆà¹„à¸”à¹‰ wire à¹€à¸‚à¹‰à¸² column DEFAULT |
| F-004 | `app/api/pos/sessions/route.ts` | **Feature Broken:** `p.image_url` à¸‚à¸²à¸”à¸ˆà¸²à¸ SQL SELECT â€” product images à¹ƒà¸™ terminal à¸—à¸¸à¸à¸£à¸²à¸¢à¸à¸²à¸£à¹à¸ªà¸”à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰ |

**à¸›à¸±à¸à¸«à¸²à¸—à¸µà¹ˆà¸žà¸š (Should Fix â€” 5 à¸£à¸²à¸¢à¸à¸²à¸£):**

| ID | à¸›à¸±à¸à¸«à¸² |
|----|-------|
| F-005 | `transactions/route.ts` GET hardcode `LIMIT 50` à¹„à¸¡à¹ˆà¸¡à¸µ pagination |
| F-006 | `members/route.ts` GET à¹„à¸¡à¹ˆà¸¡à¸µ LIMIT â€” full table scan |
| F-007 | `shifts/route.ts` `cash_in_drawer` à¹„à¸¡à¹ˆà¸¡à¸µ range validation à¹ƒà¸™ Zod |
| F-008 | `held-carts/route.ts` GET à¹„à¸¡à¹ˆ verify à¸§à¹ˆà¸² `session_id` à¹€à¸›à¹‡à¸™à¸‚à¸­à¸‡ user à¸—à¸µà¹ˆ login â€” IDOR risk |
| F-009 | `transactions/route.ts` + `session/[id]/page.tsx` hardcode `0.07` à¹à¸—à¸™ `VAT_RATE` à¸ˆà¸²à¸ constants |

**Suggestions (3 à¸£à¸²à¸¢à¸à¸²à¸£):**
- F-010: Barcode scanner keydown listener à¹„à¸¡à¹ˆà¸¡à¸µ guard à¹€à¸¡à¸·à¹ˆà¸­ modal à¹€à¸›à¸´à¸”à¸­à¸¢à¸¹à¹ˆ
- F-011: `shifts/page.tsx` + `members/page.tsx` à¹ƒà¸Šà¹‰ `toLocaleDateString()` à¹‚à¸”à¸¢à¸•à¸£à¸‡à¹à¸—à¸™ `formatDate()`
- F-012: à¸Šà¸·à¹ˆà¸­ migration à¹ƒà¸™ plan.md à¸œà¸´à¸” (`029_` â†’ à¸ˆà¸£à¸´à¸‡à¸„à¸·à¸­ `027_`)

**Output:**
- `conductor/tracks/pos-improvements/rework-plan.md` â€” à¸ªà¸£à¹‰à¸²à¸‡à¹ƒà¸«à¸¡à¹ˆ, à¸„à¸£à¸š 12 à¸£à¸²à¸¢à¸à¸²à¸£à¸žà¸£à¹‰à¸­à¸¡ execution order à¹à¸¥à¸° acceptance criteria
- `conductor/index.md` â€” à¸­à¸±à¸žà¹€à¸”à¸—à¸ªà¸–à¸²à¸™à¸° POS Improvements: `Completed` â†’ `Rework Required`

---

### à¸›à¸±à¸à¸«à¸²à¸¢à¸²à¸à¸—à¸µà¹ˆà¸žà¸šà¹à¸¥à¸°à¹à¸à¹‰à¹ƒà¸™à¹€à¸‹à¸ªà¸Šà¸±à¸™à¸™à¸µà¹‰

#### 1. Points UPDATE outside transaction (F-002) â€” Pattern à¸—à¸µà¹ˆà¸­à¸±à¸™à¸•à¸£à¸²à¸¢à¹à¸•à¹ˆà¸¡à¸­à¸‡à¸‚à¹‰à¸²à¸¡à¸‡à¹ˆà¸²à¸¢

**à¸›à¸±à¸à¸«à¸²:** Code à¸”à¸¹à¸–à¸¹à¸à¸•à¹‰à¸­à¸‡à¹€à¸¡à¸·à¹ˆà¸­à¸¡à¸­à¸‡ surface â€” à¸¡à¸µ `pool.connect()`, à¸¡à¸µ BEGIN/COMMIT, à¸¡à¸µ try/catch. à¹à¸•à¹ˆ `UPDATE pos_members` à¹€à¸‚à¸µà¸¢à¸™à¹„à¸§à¹‰à¸šà¸£à¸£à¸—à¸±à¸”à¸«à¸¥à¸±à¸‡ `client.release()` à¸—à¸³à¹ƒà¸«à¹‰à¸£à¸±à¸™à¸™à¸­à¸ transaction à¸ˆà¸£à¸´à¸‡

**à¹€à¸«à¸•à¸¸à¸—à¸µà¹ˆà¸­à¸±à¸™à¸•à¸£à¸²à¸¢:** à¸–à¹‰à¸² process crash à¸«à¸¥à¸±à¸‡ COMMIT à¹à¸•à¹ˆà¸à¹ˆà¸­à¸™ UPDATE â†’ sale à¸šà¸±à¸™à¸—à¸¶à¸à¸„à¸£à¸š à¹à¸•à¹ˆà¹à¸•à¹‰à¸¡à¸ªà¸¡à¸²à¸Šà¸´à¸à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸šà¸§à¸ à¹„à¸¡à¹ˆà¸¡à¸µ error, à¹„à¸¡à¹ˆà¸¡à¸µ rollback, à¹„à¸¡à¹ˆà¸¡à¸µà¸—à¸²à¸‡à¸£à¸¹à¹‰à¸ˆà¸²à¸ log à¸›à¸à¸•à¸´

**à¸§à¸´à¸˜à¸µà¸•à¸£à¸§à¸ˆà¸ˆà¸±à¸š:** à¸•à¹‰à¸­à¸‡à¸­à¹ˆà¸²à¸™à¹‚à¸„à¹‰à¸”à¹€à¸£à¸µà¸¢à¸‡à¸šà¸£à¸£à¸—à¸±à¸”à¹à¸¥à¸° track `client` lifetime à¸­à¸¢à¹ˆà¸²à¸‡à¸¥à¸°à¹€à¸­à¸µà¸¢à¸” â€” lint à¹„à¸¡à¹ˆà¸ˆà¸±à¸š, TypeScript à¹„à¸¡à¹ˆà¸ˆà¸±à¸š, unit test à¹„à¸¡à¹ˆà¸ˆà¸±à¸š (à¸–à¹‰à¸² test à¹„à¸¡à¹ˆ crash process à¸ˆà¸‡à¹ƒà¸ˆ)

#### 2. Shift number à¹ƒà¸Šà¹‰ Math.random() (F-003) â€” Collision risk à¸‹à¹ˆà¸­à¸™à¹ƒà¸™à¸£à¸¹à¸› "à¹€à¸£à¹‡à¸§à¸”à¸µ"

**à¸›à¸±à¸à¸«à¸²:** Gemini à¹ƒà¸Šà¹‰ `Math.random()` à¸ªà¸£à¹‰à¸²à¸‡ suffix à¹à¸—à¸™à¸—à¸µà¹ˆà¸ˆà¸° wire `seq_pos_shift` à¹€à¸‚à¹‰à¸² column DEFAULT à¹€à¸žà¸£à¸²à¸° `next_doc_number()` à¸•à¹‰à¸­à¸‡à¸à¸²à¸£ sequence à¸—à¸µà¹ˆ register à¸à¹ˆà¸­à¸™

**à¹€à¸«à¸•à¸¸à¸—à¸µà¹ˆà¸­à¸±à¸™à¸•à¸£à¸²à¸¢:** Random 4-digit suffix â†’ collision probability à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸¨à¸¹à¸™à¸¢à¹Œà¹ƒà¸™à¸£à¸°à¸šà¸š high-volume POS à¸—à¸µà¹ˆà¹€à¸›à¸´à¸”à¸«à¸¥à¸²à¸¢ shift/à¸§à¸±à¸™ à¸™à¸­à¸à¸ˆà¸²à¸à¸™à¸µà¹‰à¸¢à¸±à¸‡à¸œà¸´à¸” architectural rule à¸‚à¸­à¸‡ project

**à¸§à¸´à¸˜à¸µà¹à¸à¹‰à¸–à¸¹à¸à¸•à¹‰à¸­à¸‡:** New migration `030_fix_shift_number_default.sql` â†’ `ALTER TABLE pos_shifts ALTER COLUMN shift_number SET DEFAULT next_doc_number('SHF', 'seq_pos_shift')` + à¸¥à¸š app-side generation

#### 3. IDOR à¸šà¸™ Held Carts (F-008) â€” Business logic à¸—à¸³à¹ƒà¸«à¹‰à¸¡à¸­à¸‡à¸‚à¹‰à¸²à¸¡à¸‡à¹ˆà¸²à¸¢

**à¸›à¸±à¸à¸«à¸²:** `session_id` à¹€à¸›à¹‡à¸™ UUID à¸—à¸µà¹ˆ client à¸ªà¹ˆà¸‡à¸¡à¸² à¸–à¹‰à¸²à¹„à¸¡à¹ˆ join à¸à¸±à¸š `pos_sessions` à¹€à¸žà¸·à¹ˆà¸­ verify `cashier_id = u.id` â†’ cashier à¸—à¸µà¹ˆà¸£à¸¹à¹‰ session UUID à¸‚à¸­à¸‡à¸„à¸™à¸­à¸·à¹ˆà¸™à¸ªà¸²à¸¡à¸²à¸£à¸– GET held carts à¸‚à¸­à¸‡ terminal à¸­à¸·à¹ˆà¸™à¹„à¸”à¹‰

**à¹€à¸«à¸•à¸¸à¸—à¸µà¹ˆà¸¡à¸­à¸‡à¸‚à¹‰à¸²à¸¡:** à¸›à¸à¸•à¸´ cashier à¹„à¸”à¹‰ `session_id` à¸¡à¸²à¸ˆà¸²à¸ login flow à¸‚à¸­à¸‡à¸•à¸±à¸§à¹€à¸­à¸‡ â€” à¹ƒà¸™à¸—à¸²à¸‡à¸›à¸à¸´à¸šà¸±à¸•à¸´à¹„à¸¡à¹ˆà¸™à¹ˆà¸²à¸ˆà¸°à¸£à¸¹à¹‰ UUID à¸‚à¸­à¸‡à¸„à¸™à¸­à¸·à¹ˆà¸™ à¹à¸•à¹ˆà¸–à¹‰à¸²à¹‚à¸ˆà¸¡à¸•à¸µà¸”à¹‰à¸§à¸¢ enumeration à¸«à¸£à¸·à¸­ log leak â†’ exposed

---

### à¸ªà¸–à¸²à¸™à¸°à¹‚à¸„à¹‰à¸” (Code Stability)

**âš ï¸ REWORK PENDING** â€” POS Improvements à¸£à¸­ Gemini CLI fix à¸•à¸²à¸¡ `rework-plan.md`

| à¸£à¸°à¸šà¸š | à¸ªà¸–à¸²à¸™à¸° |
|------|-------|
| WMS Core | âœ… Verified |
| POS Module (base) | âœ… Verified |
| POS Improvements | âš ï¸ Rework Required (12 issues) |
| HR Module | âœ… Completed |
| Sales Module | âœ… Completed |
| Accounting Module | âœ… Completed |
| Outbound Picking | âœ… Completed |

---

### à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸—à¸³à¸„à¸£à¸±à¹‰à¸‡à¸«à¸™à¹‰à¸²

**à¸¥à¸³à¸”à¸±à¸šà¸„à¸§à¸²à¸¡à¸ªà¸³à¸„à¸±à¸à¸ªà¸¹à¸‡:**
1. **Gemini CLI:** Execute `conductor/tracks/pos-improvements/rework-plan.md` â€” à¹à¸à¹‰ 12 issues à¸•à¸²à¸¡ execution order (R-003 migration à¸à¹ˆà¸­à¸™)
2. **Re-run Billy QA** à¸«à¸¥à¸±à¸‡ rework à¹€à¸ªà¸£à¹‡à¸ˆ â†’ à¸•à¹‰à¸­à¸‡à¸œà¹ˆà¸²à¸™ acceptance criteria à¸—à¸¸à¸à¸‚à¹‰à¸­

**à¸¥à¸³à¸”à¸±à¸šà¸„à¸§à¸²à¸¡à¸ªà¸³à¸„à¸±à¸à¸à¸¥à¸²à¸‡:**
3. **Outbound Picking QA** â€” track à¸¢à¸±à¸‡à¹€à¸›à¹‡à¸™ Completed à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸œà¹ˆà¸²à¸™ Billy
4. **New track** â€” à¹€à¸¥à¸·à¸­à¸ feature à¸–à¸±à¸”à¹„à¸›à¸«à¸¥à¸±à¸‡ POS Improvements Verified

---

### à¸ˆà¸¸à¸”à¹€à¸•à¸·à¸­à¸™à¸žà¸´à¹€à¸¨à¸© âš ï¸

**1. Transaction atomicity â€” pattern à¸—à¸µà¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡**
```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO pos_transactions ...');
  await client.query('UPDATE pos_members SET points_balance = points_balance + $1 ...'); // â† à¸•à¹‰à¸­à¸‡à¸­à¸¢à¸¹à¹ˆà¸•à¸£à¸‡à¸™à¸µà¹‰
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release(); // â† release LAST
}
```
à¸«à¹‰à¸²à¸¡à¹€à¸‚à¸µà¸¢à¸™ UPDATE à¸«à¸¥à¸±à¸‡ `client.release()` à¹„à¸¡à¹ˆà¸§à¹ˆà¸²à¸à¸£à¸“à¸µà¹ƒà¸”

**2. Document numbers â€” DB only**
à¸—à¸¸à¸ sequence à¸—à¸µà¹ˆà¸ªà¸£à¹‰à¸²à¸‡à¹ƒà¸™ migration à¸•à¹‰à¸­à¸‡à¸–à¸¹à¸ wire à¹€à¸‚à¹‰à¸² `DEFAULT next_doc_number(prefix, seq_name)` à¸—à¸µà¹ˆà¸£à¸°à¸”à¸±à¸š column DDL à¸—à¸±à¸™à¸—à¸µ à¸«à¹‰à¸²à¸¡ generate à¹ƒà¸™ app code à¹„à¸¡à¹ˆà¸§à¹ˆà¸²à¸ˆà¸° `Math.random()`, `Date`, à¸«à¸£à¸·à¸­ counter

**3. List endpoints à¸•à¹‰à¸­à¸‡à¸¡à¸µ LIMIT à¹€à¸ªà¸¡à¸­**
à¸—à¸¸à¸ GET list route à¸•à¹‰à¸­à¸‡à¸¡à¸µ LIMIT â€” minimum `LIMIT 100` hard cap à¹à¸¡à¹‰à¹„à¸¡à¹ˆà¸¡à¸µ pagination params

---

## Session: 2026-05-13 (Session 5 â€” UI Design System "à¸­à¸£à¸¸à¸“" + HR Bugfix Final)

### à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸—à¸³à¸§à¸±à¸™à¸™à¸µà¹‰

#### 1. Conductor Protocol Skill â€” âœ… à¹€à¸ªà¸£à¹‡à¸ˆà¸ªà¸¡à¸šà¸¹à¸£à¸“à¹Œ
... (à¸„à¸‡à¹€à¸”à¸´à¸¡)

#### 2. UI Design System â€” à¸­à¸£à¸¸à¸“ (Aroon) â€” âœ… à¹€à¸ªà¸£à¹‡à¸ˆà¸ªà¸¡à¸šà¸¹à¸£à¸“à¹Œ
... (à¸„à¸‡à¹€à¸”à¸´à¸¡)

#### 3. HR Bugfix Final â€” âœ… à¹€à¸ªà¸£à¹‡à¸ˆà¸ªà¸¡à¸šà¸¹à¸£à¸“à¹Œ

**à¸à¸²à¸£à¹à¸à¹‰à¹„à¸‚ Bug à¹à¸¥à¸°à¹‚à¸„à¸£à¸‡à¸ªà¸£à¹‰à¸²à¸‡:**
- **User Name Fix:** à¹à¸à¹‰à¹„à¸‚à¸›à¸±à¸à¸«à¸² `u.name` à¸—à¸µà¹ˆà¹„à¸¡à¹ˆà¸¡à¸µà¸­à¸¢à¸¹à¹ˆà¹ƒà¸™à¸•à¸²à¸£à¸²à¸‡ `users` à¹ƒà¸™à¸—à¸¸à¸ API à¹à¸¥à¸° UI à¸‚à¸­à¸‡à¹‚à¸¡à¸”à¸¹à¸¥ HR à¹‚à¸”à¸¢à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¹„à¸›à¹ƒà¸Šà¹‰ `name_th` à¹à¸¥à¸° `name_en` à¹à¸—à¸™
- **Department Type Sync:** à¸­à¸±à¸žà¹€à¸”à¸— interface `Department` à¹ƒà¸™ `types/index.ts` à¹ƒà¸«à¹‰à¸£à¸­à¸‡à¸£à¸±à¸š `manager_name_th/en` à¹à¸¥à¸°à¸›à¸£à¸±à¸šà¸›à¸£à¸¸à¸‡à¸«à¸™à¹‰à¸²à¸ˆà¸­à¹à¸ªà¸”à¸‡à¸œà¸¥à¹à¸œà¸™à¸à¹ƒà¸«à¹‰à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¸Ÿà¸´à¸¥à¸”à¹Œà¹ƒà¸«à¸¡à¹ˆ
- **Formatting Cleanup:** 
    - à¹à¸à¹‰à¹„à¸‚à¸à¸²à¸£à¸™à¸³à¹€à¸‚à¹‰à¸² (import) `formatDate`, `formatNumber`, `formatCurrency` à¸ˆà¸²à¸ `@/lib/format` à¹à¸—à¸™ `@/lib/utils` à¸—à¸µà¹ˆà¸œà¸´à¸”à¸žà¸¥à¸²à¸”
    - à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸à¸²à¸£à¹ƒà¸Šà¹‰ `.toLocaleString()` à¹à¸¥à¸° `.toLocaleDateString()` à¹€à¸›à¹‡à¸™ utility functions à¸‚à¸­à¸‡à¹‚à¸›à¸£à¹€à¸ˆà¸à¸•à¹Œà¹€à¸žà¸·à¹ˆà¸­à¹ƒà¸«à¹‰à¸£à¸­à¸‡à¸£à¸±à¸š Timezone (Asia/Bangkok) à¸­à¸¢à¹ˆà¸²à¸‡à¸–à¸¹à¸à¸•à¹‰à¸­à¸‡
    - à¹€à¸žà¸´à¹ˆà¸¡ `THAI_MONTHS` constant à¸ªà¸³à¸«à¸£à¸±à¸š dropdown à¹ƒà¸™à¸«à¸™à¹‰à¸² Payroll à¹€à¸žà¸·à¹ˆà¸­à¸„à¸§à¸²à¸¡à¸–à¸¹à¸à¸•à¹‰à¸­à¸‡à¸‚à¸­à¸‡à¸ à¸²à¸©à¸²
- **Consistency:** à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¹à¸¥à¸°à¹à¸à¹‰à¹„à¸‚à¹„à¸Ÿà¸¥à¹Œà¹ƒà¸™à¹‚à¸¡à¸”à¸¹à¸¥ HR à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” (Attendance, Employees, Leave Requests, Payroll) à¹ƒà¸«à¹‰à¸¡à¸µà¸¡à¸²à¸•à¸£à¸à¸²à¸™à¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™

---

### à¸ªà¸–à¸²à¸™à¸°à¹‚à¸„à¹‰à¸” (Code Stability)

**âœ… STABLE** â€” à¸œà¹ˆà¸²à¸™ `npm run lint` à¹à¸¥à¸° `npm run build`

| à¸£à¸°à¸šà¸š | à¸ªà¸–à¸²à¸™à¸° |
|------|-------|
| UI System (Aroon) | âœ… Completed & Integrated |
| HR Module | âœ… Rework Completed & Bugfixed |
| Collaboration Protocol | âœ… Documented & Mandated |
| Dashboard | âœ… Migrated to new KPI system |

---

### à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸—à¸³à¸„à¸£à¸±à¹‰à¸‡à¸«à¸™à¹‰à¸²

**à¸¥à¸³à¸”à¸±à¸šà¸„à¸§à¸²à¸¡à¸ªà¸³à¸„à¸±à¸à¸ªà¸¹à¸‡:**
1. **BOM Module Implementation** â€” à¹€à¸£à¸´à¹ˆà¸¡à¸•à¹‰à¸™ Track à¸ªà¸¹à¸•à¸£à¸à¸²à¸£à¸œà¸¥à¸´à¸•à¹à¸¥à¸° Multi-UOM à¸•à¸²à¸¡à¹à¸œà¸™à¸‡à¸²à¸™
2. **Audit Trail UI** â€” à¹ƒà¸Šà¹‰ `Card` à¹à¸¥à¸° `Table` à¹ƒà¸«à¸¡à¹ˆà¹ƒà¸™à¸à¸²à¸£à¸ªà¸£à¹‰à¸²à¸‡à¸«à¸™à¹‰à¸²à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¸à¸²à¸£à¹à¸à¹‰à¹„à¸‚à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ (Audit triggers)

**à¸¥à¸³à¸”à¸±à¸šà¸„à¸§à¸²à¸¡à¸ªà¸³à¸„à¸±à¸à¸à¸¥à¸²à¸‡:**
3. **Mobile Polish** â€” à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š Responsive à¸‚à¸­à¸‡à¸«à¸™à¹‰à¸²à¸ˆà¸­à¸—à¸µà¹ˆà¸ªà¸£à¹‰à¸²à¸‡à¹ƒà¸«à¸¡à¹ˆà¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¹‚à¸”à¸¢à¹ƒà¸Šà¹‰ Sidebar à¹à¸šà¸šà¸žà¸±à¸š

---

### à¸ˆà¸¸à¸”à¹€à¸•à¸·à¸­à¸™à¸žà¸´à¹€à¸¨à¸© âš ï¸

**1. à¸«à¹‰à¸²à¸¡à¹à¸à¹‰à¹„à¸‚à¹„à¸Ÿà¸¥à¹Œà¸™à¸­à¸ Task Scope**
à¸•à¹‰à¸­à¸‡à¸›à¸à¸´à¸šà¸±à¸•à¸´à¸•à¸²à¸¡ **Conductor Protocol** à¸­à¸¢à¹ˆà¸²à¸‡à¹€à¸„à¸£à¹ˆà¸‡à¸„à¸£à¸±à¸” à¸«à¸²à¸à¹€à¸«à¹‡à¸™à¸ˆà¸¸à¸”à¸—à¸µà¹ˆà¸„à¸§à¸£à¹à¸à¹‰ (à¹€à¸Šà¹ˆà¸™ typo à¹ƒà¸™à¹„à¸Ÿà¸¥à¹Œà¸­à¸·à¹ˆà¸™) à¹ƒà¸«à¹‰à¹‚à¸™à¹‰à¸•à¹„à¸§à¹‰à¹ƒà¸™ Summary à¸«à¸£à¸·à¸­à¸ªà¸£à¹‰à¸²à¸‡ Task à¹ƒà¸«à¸¡à¹ˆ à¸«à¹‰à¸²à¸¡à¹à¸à¹‰à¸—à¸±à¸™à¸—à¸µ

**2. à¸à¸²à¸£à¹ƒà¸Šà¹‰ Font à¹ƒà¸™à¸•à¸±à¸§à¹€à¸¥à¸‚**
à¹ƒà¸™à¸•à¸²à¸£à¸²à¸‡à¸«à¸£à¸·à¸­à¸ªà¹ˆà¸§à¸™à¸—à¸µà¹ˆà¹à¸ªà¸”à¸‡à¸•à¸±à¸§à¹€à¸¥à¸‚à¸ˆà¸³à¸™à¸§à¸™à¹€à¸‡à¸´à¸™/à¸ªà¸•à¹‡à¸­à¸ à¹ƒà¸«à¹‰à¹ƒà¸Šà¹‰ class `font-mono tabular-nums` à¹€à¸ªà¸¡à¸­à¹€à¸žà¸·à¹ˆà¸­à¹ƒà¸«à¹‰à¸•à¸±à¸§à¹€à¸¥à¸‚à¸•à¸£à¸‡à¸à¸±à¸™à¸ªà¸§à¸¢à¸‡à¸²à¸¡

**3. Dual-mode Table**
à¸«à¹‰à¸²à¸¡à¸•à¸±à¸” logic à¸à¸²à¸£à¸£à¸±à¸š `children` à¸­à¸­à¸à¸ˆà¸²à¸ `Table.tsx` à¹€à¸žà¸£à¸²à¸°à¸«à¸™à¹‰à¸²à¸ˆà¸­à¹€à¸à¹ˆà¸²à¸«à¸¥à¸²à¸¢à¸«à¸™à¹‰à¸²à¸¢à¸±à¸‡à¹ƒà¸Šà¹‰à¸à¸²à¸£à¹€à¸‚à¸µà¸¢à¸™ `<tr>` à¹à¸¥à¸° `<td>` à¹€à¸­à¸‡à¸­à¸¢à¸¹à¹ˆ

---

## Session: 2026-05-11 (Session 4 â€” Full ERP Expansion + Bug Hunt / à¸›à¸´à¸”à¸‡à¸²à¸™)

### à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸—à¸³à¸§à¸±à¸™à¸™à¸µà¹‰

#### 1. POS Module (Point of Sale) â€” âœ… à¹€à¸ªà¸£à¹‡à¸ˆà¸ªà¸¡à¸šà¸¹à¸£à¸“à¹Œ

**Migration:** `migrations/016_pos.sql`
- à¸•à¸²à¸£à¸²à¸‡ `pos_sessions`, `pos_transactions`, `pos_transaction_lines`
- à¹€à¸žà¸´à¹ˆà¸¡à¸Ÿà¸´à¸¥à¸”à¹Œ `selling_price` à¹ƒà¸™à¸•à¸²à¸£à¸²à¸‡ `products`
- Permissions: `pos:cashier`, `pos:void`, `pos:session_open/close`, `pos:view`
- Sequence: `seq_pos` / Document number: `RCP-YYYYMMDD-0001`, `SES-YYYYMMDD-0001`

**API Files à¸ªà¸£à¹‰à¸²à¸‡à¹ƒà¸«à¸¡à¹ˆ:**
- `app/api/pos/sessions/route.ts` â€” à¹€à¸›à¸´à¸”/à¸”à¸¹à¸£à¸²à¸¢à¸à¸²à¸£à¸£à¸­à¸š
- `app/api/pos/sessions/[id]/route.ts` â€” à¸”à¸¹à¸£à¸­à¸š, à¸›à¸´à¸”à¸£à¸­à¸š
- `app/api/pos/transactions/route.ts` â€” à¸ªà¸£à¹‰à¸²à¸‡à¸šà¸´à¸¥ (Checkout)
- `app/api/pos/transactions/[id]/route.ts` â€” à¸”à¸¹à¸šà¸´à¸¥, à¸¢à¸à¹€à¸¥à¸´à¸à¸šà¸´à¸¥ (Void)
- `app/api/pos/products/route.ts` â€” à¸„à¹‰à¸™à¸ªà¸´à¸™à¸„à¹‰à¸² (barcode/SKU/name)

**Page Files à¸ªà¸£à¹‰à¸²à¸‡à¹ƒà¸«à¸¡à¹ˆ:**
- `app/app/pos/page.tsx` â€” POS Home (à¹€à¸¥à¸·à¸­à¸à¸£à¸­à¸š/à¹€à¸›à¸´à¸”à¸£à¸­à¸šà¹ƒà¸«à¸¡à¹ˆ)
- `app/app/pos/session/[id]/page.tsx` â€” POS Terminal (à¸«à¸™à¹‰à¸²à¸ˆà¸­à¸‚à¸²à¸¢à¸«à¸™à¹‰à¸²à¸£à¹‰à¸²à¸™)
- `app/app/pos/sessions/page.tsx` â€” à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¸£à¸­à¸š
- `app/app/pos/sessions/[id]/page.tsx` â€” à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸£à¸­à¸š + à¸¢à¸à¹€à¸¥à¸´à¸à¸šà¸´à¸¥

**Logic à¸«à¸¥à¸±à¸:**
- VAT **Inclusive** 7% (`vat = total Ã— 7/107`) â€” à¸¡à¸²à¸•à¸£à¸à¸²à¸™à¸‚à¸²à¸¢à¸›à¸¥à¸µà¸à¹„à¸—à¸¢
- à¸•à¸±à¸”à¸ªà¸•à¹‡à¸­à¸à¸œà¹ˆà¸²à¸™ `stock_ledger` (entry_type: `pos_sale`) à¸—à¸±à¸™à¸—à¸µà¸—à¸µà¹ˆ Checkout
- Void â†’ à¸„à¸·à¸™à¸ªà¸•à¹‡à¸­à¸ (`pos_void`)
- à¸›à¹‰à¸­à¸‡à¸à¸±à¸™ 1 user à¸¡à¸µ 2 à¸£à¸­à¸šà¹€à¸›à¸´à¸”à¸žà¸£à¹‰à¸­à¸¡à¸à¸±à¸™ (à¹€à¸Šà¹‡à¸„ unique open session à¸•à¹ˆà¸­ user+warehouse)

---

#### 2. Sales Module (B2B: SQâ†’SOâ†’DOâ†’SIâ†’SR) â€” âœ… à¹€à¸ªà¸£à¹‡à¸ˆà¸ªà¸¡à¸šà¸¹à¸£à¸“à¹Œ

**Migration:** `migrations/017_sales.sql`
- à¸•à¸²à¸£à¸²à¸‡ `customers`, `sales_quotations`, `sq_line_items`, `sales_orders`, `so_line_items`
- à¸•à¸²à¸£à¸²à¸‡ `delivery_orders`, `do_line_items`, `sales_invoices`, `sales_returns`, `sr_line_items`
- Junction tables: `so_sq_links`
- Sequences: `seq_sq`, `seq_so`, `seq_do`, `seq_si`, `seq_sr`
- Permissions: 22 permissions (customers, sq, so, do, si, sr)

**API Files à¸ªà¸£à¹‰à¸²à¸‡à¹ƒà¸«à¸¡à¹ˆ:** (14 files)
- Customers CRUD: `/api/customers/`, `/api/customers/[id]/`
- SQ: `/api/sales-quotations/`, `/api/sales-quotations/[id]/`
- SO: `/api/sales-orders/`, `/api/sales-orders/[id]/`
- DO: `/api/delivery-orders/`, `/api/delivery-orders/[id]/`
- SI: `/api/sales-invoices/`, `/api/sales-invoices/[id]/`
- SR: `/api/sales-returns/`, `/api/sales-returns/[id]/`

**Page Files à¸ªà¸£à¹‰à¸²à¸‡à¹ƒà¸«à¸¡à¹ˆ:** (18 files)
- Customers: list, new, [id]
- SQ: list, new, [id] (à¸£à¸­à¸‡à¸£à¸±à¸š convert to SO)
- SO: list, new, [id] (à¹à¸ªà¸”à¸‡ credit limit warning)
- DO: list, new, [id] (Ship â†’ à¸•à¸±à¸”à¸ªà¸•à¹‡à¸­à¸à¸ˆà¸£à¸´à¸‡)
- SI: list, new, [id]
- SR: list, new, [id] (Restock â†’ à¸„à¸·à¸™à¸ªà¸•à¹‡à¸­à¸)

**Logic à¸«à¸¥à¸±à¸:**
- VAT **Exclusive** 7% (`vat = subtotal Ã— 0.07`) â€” à¸¡à¸²à¸•à¸£à¸à¸²à¸™à¸šà¸±à¸à¸Šà¸µ B2B à¹„à¸—à¸¢
- Stock deduction à¹€à¸‰à¸žà¸²à¸°à¸•à¸­à¸™ DO `ship` â†’ `stock_ledger` (entry_type: `so_delivery`)
- SR Restock â†’ `stock_ledger` (entry_type: `so_return`)
- Credit limit check à¸—à¸µà¹ˆ SO confirm (warn-only, à¹„à¸¡à¹ˆà¸šà¸¥à¹‡à¸­à¸)
- qty_delivered tracking à¸•à¹ˆà¸­à¸šà¸£à¸£à¸—à¸±à¸” SO â†’ auto update SO status

---

#### 3. Accounting Module (CoAâ†’Periodsâ†’JEâ†’Reports) â€” âœ… à¹€à¸ªà¸£à¹‡à¸ˆà¸ªà¸¡à¸šà¸¹à¸£à¸“à¹Œ

**Migration:** `migrations/018_accounting.sql`
- à¸•à¸²à¸£à¸²à¸‡ `accounts` (à¸œà¸±à¸‡à¸šà¸±à¸à¸Šà¸µ), `fiscal_periods` (à¸£à¸­à¸šà¸šà¸±à¸à¸Šà¸µ)
- à¸•à¸²à¸£à¸²à¸‡ `journal_entries`, `journal_entry_lines`
- Seed: 28 à¸šà¸±à¸à¸Šà¸µà¸¡à¸²à¸•à¸£à¸à¸²à¸™ Thai GAAP (à¸à¸¥à¸¸à¹ˆà¸¡ 1000â€“7000)
- Sequence: `seq_je` / Document number: `JE-YYYYMMDD-0001`
- Permissions: 9 permissions (accounts, fiscal_periods, accounting, reports)

**API Files à¸ªà¸£à¹‰à¸²à¸‡à¹ƒà¸«à¸¡à¹ˆ:** (14 files)
- CoA: `/api/accounting/accounts/`, `/api/accounting/accounts/[id]/`
- Periods: `/api/accounting/fiscal-periods/`, `/api/accounting/fiscal-periods/[id]/`
- JE: `/api/accounting/journal-entries/`, `/api/accounting/journal-entries/[id]/`
- Reports: trial-balance, general-ledger, profit-loss, balance-sheet, ar-aging, ap-aging

**Page Files à¸ªà¸£à¹‰à¸²à¸‡à¹ƒà¸«à¸¡à¹ˆ:** (14 files)
- Chart of Accounts: list, new, [id]
- Fiscal Periods: list, new
- Journal Entries: list, new, [id]
- Reports: trial-balance, general-ledger, profit-loss, balance-sheet, ar-aging, ap-aging

**Logic à¸«à¸¥à¸±à¸:**
- Double-entry: à¸—à¸¸à¸ JE à¸•à¹‰à¸­à¸‡ `SUM(debit) = SUM(credit)` â€” à¸•à¸£à¸§à¸ˆà¸—à¸±à¹‰à¸‡ API + DB CHECK constraint
- Void à¹„à¸¡à¹ˆà¸¥à¸š entries â€” mark void à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™ (audit trail à¸ªà¸¡à¸šà¸¹à¸£à¸“à¹Œ)
- Fiscal Period `locked` = à¸–à¸²à¸§à¸£ à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸– reopen à¸«à¸£à¸·à¸­à¹‚à¸žà¸ªà¸•à¹Œà¸£à¸²à¸¢à¸à¸²à¸£à¹ƒà¸«à¸¡à¹ˆ
- AR Aging à¸­à¹ˆà¸²à¸™à¸•à¸£à¸‡à¸ˆà¸²à¸ `sales_invoices` (graceful degrade à¸–à¹‰à¸² Sales module à¸¢à¸±à¸‡à¹„à¸¡à¹ˆ migrate)
- AP Aging à¸­à¹ˆà¸²à¸™à¸•à¸£à¸‡à¸ˆà¸²à¸ `po_invoices`

---

#### 4. Bug Hunt & WMS Polish â€” âœ… à¹à¸à¹‰à¸„à¸£à¸š 12 à¸ˆà¸¸à¸”

| BUG | à¸„à¸§à¸²à¸¡à¸£à¸¸à¸™à¹à¸£à¸‡ | à¹„à¸Ÿà¸¥à¹Œà¸—à¸µà¹ˆà¹à¸à¹‰ | à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¹à¸à¹‰ |
|-----|-----------|-----------|------------|
| BUG-001 | P1 | `app/api/grn/route.ts` | à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™ INNER JOIN â†’ LEFT JOIN à¹€à¸žà¸·à¹ˆà¸­à¹ƒà¸«à¹‰ IO-based GRN à¸›à¸£à¸²à¸à¸à¹ƒà¸™à¸£à¸²à¸¢à¸à¸²à¸£ |
| BUG-002 | P1 | `app/app/grn/page.tsx` | à¹à¸à¹‰à¸¥à¸´à¸‡à¸à¹Œ PO à¸—à¸µà¹ˆà¹ƒà¸Šà¹‰ `g.id` (à¸œà¸´à¸”) à¹€à¸›à¹‡à¸™ `g.po_id`; à¹€à¸žà¸´à¹ˆà¸¡à¸¥à¸´à¸‡à¸à¹Œ IO à¸ªà¸³à¸«à¸£à¸±à¸š IO-based GRN |
| BUG-003 | P1 | `app/api/transfers/route.ts` | à¹à¸à¹‰ Warehouse scope à¹ƒà¸«à¹‰à¸„à¸£à¸­à¸šà¸„à¸¥à¸¸à¸¡à¸—à¸±à¹‰à¸‡ source à¹à¸¥à¸° destination warehouse |
| BUG-004 | P2 | `app/api/transfers/route.ts` | à¹€à¸žà¸´à¹ˆà¸¡ `FOR UPDATE` à¹ƒà¸™ stock check à¹€à¸žà¸·à¹ˆà¸­à¸›à¹‰à¸­à¸‡à¸à¸±à¸™ Race Condition |
| BUG-005 | P2 | `app/api/grn/[id]/qc/route.ts` | à¹€à¸žà¸´à¹ˆà¸¡ validation: `qty_accepted + qty_rejected â‰¤ qty_received` |
| BUG-006 | P2 | à¸ªà¸£à¹‰à¸²à¸‡à¹ƒà¸«à¸¡à¹ˆ | à¸ªà¸£à¹‰à¸²à¸‡ `app/app/delivery-orders/[id]/page.tsx` à¸—à¸µà¹ˆà¸‚à¸²à¸”à¸«à¸²à¸¢à¹„à¸› |
| BUG-007 | P2 | à¸ªà¸£à¹‰à¸²à¸‡à¹ƒà¸«à¸¡à¹ˆ | à¸ªà¸£à¹‰à¸²à¸‡ `app/app/sales-returns/[id]/page.tsx` à¸—à¸µà¹ˆà¸‚à¸²à¸”à¸«à¸²à¸¢à¹„à¸› |
| BUG-008 | P2 | à¸ªà¸£à¹‰à¸²à¸‡à¹ƒà¸«à¸¡à¹ˆ | à¸ªà¸£à¹‰à¸²à¸‡ `app/app/accounting/reports/general-ledger/page.tsx` à¸—à¸µà¹ˆà¸‚à¸²à¸”à¸«à¸²à¸¢à¹„à¸› |
| BUG-009 | P3 | `app/app/grn/[id]/page.tsx` | à¹à¸à¹‰ Typo: `setVerifyVerifyNotes` â†’ `setVerifyNotes` |
| BUG-010 | P3 | `app/app/grn/page.tsx` | Modal à¸‚à¸­à¸‡ IO GRN à¹à¸ªà¸”à¸‡à¹€à¸›à¹‡à¸™ "à¹€à¸¥à¸‚ IO" à¹à¸—à¸™ "à¹€à¸¥à¸‚ PO" |
| BUG-011 | P3 | `app/app/grn/page.tsx` | à¹€à¸žà¸´à¹ˆà¸¡ Tab "à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¹à¸¥à¹‰à¸§" (verified) à¸—à¸µà¹ˆà¸«à¸²à¸¢à¹„à¸› |
| BUG-012 | P3 | `components/layout/Sidebar.tsx` | à¹€à¸žà¸´à¹ˆà¸¡à¸¥à¸´à¸‡à¸à¹Œ GRN Receiving Queue à¹ƒà¸™ Sidebar |

---

#### 5. Select Component Crash Fix â€” âœ… à¹à¸à¹‰à¹„à¸‚à¹à¸¥à¹‰à¸§

**à¹„à¸Ÿà¸¥à¹Œ:** `components/ui/Select.tsx`

**à¸ªà¸²à¹€à¸«à¸•à¸¸:** Gemini à¹€à¸‚à¸µà¸¢à¸™à¸«à¸™à¹‰à¸²à¸ˆà¸­à¹ƒà¸«à¸¡à¹ˆà¸—à¸¸à¸à¸«à¸™à¹‰à¸²à¹‚à¸”à¸¢à¹ƒà¸Šà¹‰ `<Select>` à¹à¸šà¸šà¸ªà¹ˆà¸‡ JSX children (à¸£à¸¹à¸›à¹à¸šà¸š HTML à¸›à¸à¸•à¸´) à¹à¸•à¹ˆ component à¹€à¸”à¸´à¸¡à¸•à¹‰à¸­à¸‡à¸à¸²à¸£ `options: SelectOption[]` prop à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™ (Required, à¹„à¸¡à¹ˆà¸¡à¸µ default) â†’ crash à¸—à¸±à¸™à¸—à¸µà¹€à¸¡à¸·à¹ˆà¸­ render

**à¸§à¸´à¸˜à¸µà¹à¸à¹‰:** à¸—à¸³à¹ƒà¸«à¹‰ `options` à¹€à¸›à¹‡à¸™ Optional (`options?: SelectOption[]`) à¹à¸¥à¸°à¹€à¸žà¸´à¹ˆà¸¡ logic:
- à¸–à¹‰à¸²à¸¡à¸µ `options` prop â†’ render à¸ˆà¸²à¸ options array (behavior à¹€à¸”à¸´à¸¡, backward-compatible)
- à¸–à¹‰à¸²à¹„à¸¡à¹ˆà¸¡à¸µ â†’ render `children` (à¸£à¸­à¸‡à¸£à¸±à¸šà¸«à¸™à¹‰à¸²à¸ˆà¸­à¹ƒà¸«à¸¡à¹ˆà¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”)

**à¸œà¸¥à¸à¸£à¸°à¸—à¸š:** à¹à¸à¹‰ crash à¸—à¸¸à¸à¸«à¸™à¹‰à¸²à¸ˆà¸­à¹ƒà¸™ Sales, Accounting, POS à¸”à¹‰à¸§à¸¢à¹„à¸Ÿà¸¥à¹Œà¹€à¸”à¸µà¸¢à¸§

---

#### 6. à¹„à¸Ÿà¸¥à¹Œà¸­à¸·à¹ˆà¸™à¸—à¸µà¹ˆà¹à¸à¹‰à¹„à¸‚

| à¹„à¸Ÿà¸¥à¹Œ | à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¹à¸à¹‰ |
|------|-----------|
| `types/index.ts` | à¹€à¸žà¸´à¹ˆà¸¡ interfaces à¸ªà¸³à¸«à¸£à¸±à¸š POS, Sales, Accounting à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” |
| `components/layout/Sidebar.tsx` | à¹€à¸žà¸´à¹ˆà¸¡ nav groups: à¸‚à¸²à¸¢/Sales, à¸‚à¸²à¸¢à¸«à¸™à¹‰à¸²à¸£à¹‰à¸²à¸™/POS, à¸à¸²à¸£à¸šà¸±à¸à¸Šà¸µ/Accounting; à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™ header "WMS" â†’ "ERP" |
| `conductor/index.md` | à¸­à¸±à¸žà¹€à¸”à¸—à¸ªà¸–à¸²à¸™à¸° tracks à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” |
| `conductor/PROTOCOLS.md` | à¸­à¸±à¸žà¹€à¸”à¸— protocol |

---

### à¸ªà¸–à¸²à¸™à¸°à¹‚à¸„à¹‰à¸” (Code Stability)

**âœ… STABLE** â€” à¸œà¹ˆà¸²à¸™ `npm run lint` à¸ªà¸°à¸­à¸²à¸” (zero errors)

| à¸£à¸°à¸šà¸š | à¸ªà¸–à¸²à¸™à¸° |
|------|-------|
| WMS Core (PRâ†’POâ†’GRNâ†’Stockâ†’Transferâ†’CCâ†’RMA) | âœ… Stable + bugs fixed |
| POS Module | âœ… Implemented, lint pass |
| Sales Module (SQâ†’SOâ†’DOâ†’SIâ†’SR) | âœ… Implemented, lint pass |
| Accounting Module | âœ… Implemented, lint pass |
| Select Component | âœ… Fixed (both patterns work) |
| Migrations (016, 017, 018) | âœ… Files created â€” **à¸•à¹‰à¸­à¸‡ run `npm run migrate` à¸à¹ˆà¸­à¸™à¹ƒà¸Šà¹‰à¸‡à¸²à¸™** |

---

### à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸—à¸³à¸„à¸£à¸±à¹‰à¸‡à¸«à¸™à¹‰à¸²

**à¸¥à¸³à¸”à¸±à¸šà¸„à¸§à¸²à¸¡à¸ªà¸³à¸„à¸±à¸à¸ªà¸¹à¸‡ â€” à¸—à¸³à¸à¹ˆà¸­à¸™:**
1. **Run migrations** â†’ `npm run migrate` à¹€à¸žà¸·à¹ˆà¸­ apply 016, 017, 018 à¹ƒà¸™ database à¸ˆà¸£à¸´à¸‡
2. **Integrated Testing** â€” à¸—à¸”à¸ªà¸­à¸š Golden Path à¸—à¸±à¹‰à¸‡ 3 à¹‚à¸¡à¸”à¸¹à¸¥à¹ƒà¸«à¸¡à¹ˆ:
   - POS: à¹€à¸›à¸´à¸”à¸£à¸­à¸š â†’ à¸„à¹‰à¸™à¸ªà¸´à¸™à¸„à¹‰à¸² â†’ Checkout â†’ à¸”à¸¹à¹ƒà¸šà¹€à¸ªà¸£à¹‡à¸ˆ â†’ à¸›à¸´à¸”à¸£à¸­à¸š â†’ à¸•à¸£à¸§à¸ˆ stock_ledger
   - Sales: à¸ªà¸£à¹‰à¸²à¸‡ Customer â†’ SQ â†’ SO â†’ DO (Ship) â†’ SI â†’ SR (Restock) â†’ à¸•à¸£à¸§à¸ˆà¸ªà¸•à¹‡à¸­à¸
   - Accounting: à¸ªà¸£à¹‰à¸²à¸‡ Fiscal Period â†’ Journal Entry (Balanced) â†’ Post â†’ Trial Balance
3. **Data Import** â€” à¸™à¸³à¹€à¸‚à¹‰à¸²à¸‚à¹‰à¸­à¸¡à¸¹à¸¥:
   - à¹ƒà¸ªà¹ˆ `selling_price` à¹ƒà¸«à¹‰à¸ªà¸´à¸™à¸„à¹‰à¸²à¸—à¸µà¹ˆà¸¡à¸µà¸­à¸¢à¸¹à¹ˆà¹à¸¥à¹‰à¸§ (à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™ default = 0)
   - Import à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸¥à¸¹à¸à¸„à¹‰à¸² (`customers` table)

**à¸¥à¸³à¸”à¸±à¸šà¸„à¸§à¸²à¸¡à¸ªà¸³à¸„à¸±à¸à¸à¸¥à¸²à¸‡:**
4. **Accounting Auto-posting** â€” à¹€à¸‚à¸µà¸¢à¸™à¹à¸œà¸™ track à¹ƒà¸«à¸¡à¹ˆ: à¹ƒà¸«à¹‰ GRN stock/DO ship/POS checkout à¸ªà¸£à¹‰à¸²à¸‡ Journal Entry à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´ (à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™à¸•à¹‰à¸­à¸‡à¸šà¸±à¸™à¸—à¸¶à¸à¸¡à¸·à¸­)
5. **Report Export** â€” à¹€à¸žà¸´à¹ˆà¸¡à¸›à¸¸à¹ˆà¸¡ Export CSV/PDF à¹ƒà¸™ Reports pages à¸—à¸¸à¸à¸«à¸™à¹‰à¸²
6. **Dashboard Update** â€” à¸­à¸±à¸žà¹€à¸”à¸— KPI cards à¹ƒà¸«à¹‰à¹à¸ªà¸”à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸²à¸ Sales à¹à¸¥à¸° POS à¸”à¹‰à¸§à¸¢

**à¸­à¸™à¸²à¸„à¸•:**
7. **BOM / Production Module** â€” à¸«à¸²à¸à¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸£à¸°à¸šà¸šà¸à¸²à¸£à¸œà¸¥à¸´à¸•
8. **HR Module** â€” à¸£à¸°à¸šà¸šà¸žà¸™à¸±à¸à¸‡à¸²à¸™/à¹€à¸‡à¸´à¸™à¹€à¸”à¸·à¸­à¸™

---

### à¸ˆà¸¸à¸”à¹€à¸•à¸·à¸­à¸™à¸žà¸´à¹€à¸¨à¸© âš ï¸

**1. Select Component â€” à¸«à¹‰à¸²à¸¡à¹à¸à¹‰à¸à¸¥à¸±à¸šà¹€à¸›à¹‡à¸™à¹à¸šà¸šà¹€à¸”à¸´à¸¡**
`components/ui/Select.tsx` à¸£à¸­à¸‡à¸£à¸±à¸š 2 à¸£à¸¹à¸›à¹à¸šà¸šà¹à¸¥à¹‰à¸§:
```tsx
// à¹à¸šà¸š A (à¹€à¸”à¸´à¸¡ â€” WMS pages): options prop
<Select options={items} placeholder="à¹€à¸¥à¸·à¸­à¸..." />

// à¹à¸šà¸š B (à¹ƒà¸«à¸¡à¹ˆ â€” Sales/POS/Accounting pages): children
<Select label="à¸¥à¸¹à¸à¸„à¹‰à¸²">
  <option value="">-- à¹€à¸¥à¸·à¸­à¸ --</option>
  {customers.map(c => <option key={c.id} value={c.id}>{c.name_th}</option>)}
</Select>
```
à¸«à¸²à¸à¹à¸à¹‰à¸à¸¥à¸±à¸šà¹€à¸›à¹‡à¸™ `options: SelectOption[]` (required) à¸ˆà¸°à¸—à¸³à¹ƒà¸«à¹‰à¸—à¸¸à¸à¸«à¸™à¹‰à¸²à¹ƒà¸«à¸¡à¹ˆ crash

**2. Migrations à¸•à¹‰à¸­à¸‡ run à¸•à¸²à¸¡à¸¥à¸³à¸”à¸±à¸š**
Migration runner à¹ƒà¸Šà¹‰ filename order à¹à¸¥à¸° track à¹ƒà¸™ `schema_migrations` â€” à¸«à¹‰à¸²à¸¡ apply à¸‚à¹‰à¸²à¸¡à¸¥à¸³à¸”à¸±à¸š à¸«à¸£à¸·à¸­ apply à¸‹à¹‰à¸³

**3. VAT à¸•à¹ˆà¸²à¸‡à¸£à¸°à¸šà¸š â€” à¸«à¹‰à¸²à¸¡à¸ªà¸±à¸šà¸ªà¸™**
| à¹‚à¸¡à¸”à¸¹à¸¥ | à¸§à¸´à¸˜à¸µà¸„à¸³à¸™à¸§à¸“ VAT | à¸ªà¸¹à¸•à¸£ |
|-------|--------------|------|
| POS | Inclusive (à¸£à¸§à¸¡à¸­à¸¢à¸¹à¹ˆà¹ƒà¸™à¸£à¸²à¸„à¸²à¹à¸¥à¹‰à¸§) | `vat = total Ã— 7/107` |
| Sales (SQ/SO/DO/SI) | Exclusive (à¸šà¸§à¸à¹€à¸žà¸´à¹ˆà¸¡à¸ˆà¸²à¸ subtotal) | `vat = subtotal Ã— 0.07` |
| Purchasing (PR/PO) | Exclusive | `vat = subtotal Ã— 0.07` |

**4. Stock Ledger â€” insert-only, à¸«à¹‰à¸²à¸¡ UPDATE/DELETE**
à¸—à¸¸à¸à¸à¸²à¸£à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¹à¸›à¸¥à¸‡à¸ªà¸•à¹‡à¸­à¸à¸•à¹‰à¸­à¸‡à¸œà¹ˆà¸²à¸™ INSERT à¹ƒà¸™ `stock_ledger` à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™
Trigger `sync_stock_balances()` à¸ˆà¸°à¸­à¸±à¸žà¹€à¸”à¸— `stock_balances` à¹ƒà¸«à¹‰à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´

**5. Transfer Race Condition â€” à¹à¸à¹‰à¹à¸¥à¹‰à¸§ à¹à¸•à¹ˆà¸£à¸°à¸§à¸±à¸‡**
à¹ƒà¸Šà¹‰ `SELECT ... FOR UPDATE` à¸¥à¹‡à¸­à¸à¹à¸–à¸§ `stock_balances` à¹à¸¥à¹‰à¸§à¸£à¸°à¸«à¸§à¹ˆà¸²à¸‡ transaction
à¸«à¸²à¸à¹€à¸žà¸´à¹ˆà¸¡ endpoint à¸—à¸µà¹ˆà¹à¸à¹‰ stock à¹ƒà¸«à¸¡à¹ˆ à¸•à¹‰à¸­à¸‡à¹ƒà¸Šà¹‰ pattern à¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™

**6. Accounting â€” Locked Period à¸–à¸²à¸§à¸£**
Period à¸—à¸µà¹ˆ status = `locked` à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸– reopen à¹„à¸”à¹‰ (hard constraint)
Admin à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™à¸—à¸µà¹ˆ lock à¹„à¸”à¹‰ à¹à¸¥à¸°à¸•à¹‰à¸­à¸‡à¸£à¸°à¸§à¸±à¸‡à¸à¹ˆà¸­à¸™ lock

---

## Session: 2026-05-10 (Session 3 â€” Night / à¸›à¸´à¸”à¸‡à¸²à¸™)

### à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸—à¸³
- Dashboard redesign (KPI cards + charts)
- Route migration: à¸¢à¹‰à¸²à¸¢à¸«à¸™à¹‰à¸²à¸ˆà¸­à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¹„à¸›à¸­à¸¢à¸¹à¹ˆà¹ƒà¸™ `app/(app)/` group
- à¹à¸à¹‰ Thai encoding double-encoding bug (TIS-620 re-encode)
- TypeScript strict mode cleanup

### à¸ªà¸–à¸²à¸™à¸°
âœ… STABLE â€” Lint pass, structure clean

---

## Session: 2026-05-10 (Session 2 â€” Afternoon)

### à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸—à¸³
- UI redesign: Vendor detail page
- Employee Management + RBAC system (permissions, roles, role assignments)
- Migrations: à¹€à¸žà¸´à¹ˆà¸¡à¸£à¸°à¸šà¸š permissions table + role grants

### à¸ªà¸–à¸²à¸™à¸°
âœ… STABLE

---

## Session: 2026-05-10 (Session 1 â€” Morning)

### à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸—à¸³
- Audit WMS flow (PRâ†’POâ†’GRNâ†’Stock)
- Fix over-receipt guard (BUG-001)
- Import 4,761 products à¸ˆà¸²à¸ Excel
- Claude-Gemini collaboration protocol setup

### à¸ªà¸–à¸²à¸™à¸°
âœ… STABLE

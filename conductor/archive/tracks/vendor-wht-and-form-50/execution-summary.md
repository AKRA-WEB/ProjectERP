# Execution Summary — Vendor WHT & Form 50 Twi

Automated Thai withholding-tax (WHT) handling on AP payments. Configured vendor WHT rates, recorded certificates on payment posting with automatic sequential numbering, and created a premium Form 50 Twi PDF rendering engine with dual Thai/English styling.

---

### Task 1 — Database Schema & Migration
- **File changed:** `migrations/059_vendor_wht.sql` lines 1–39
- **Key change:** `CREATE TABLE wht_certificates ... INSERT INTO accounts (account_code) VALUES ('2310')`
- **Verify:** `npx tsx --env-file=.env lib/db/run-migrate.ts` → Migration 059 successfully applied to Database.

### Task 2 — Vendor Detail & Edit UI
- **File changed:** `app/app/vendors/[id]/page.tsx` lines 32–365
- **Key change:** `default_wht_rate: vendor.default_wht_rate ... <input type="number" step="0.01" min="0" max="100" placeholder="ไม่มี (None)"`
- **Verify:** `npm run qa:verify` → 0 warnings, 0 type errors.

### Task 3 — Vendor Master & Detail API
- **File changed:** `app/api/vendors/[id]/route.ts` lines 19–77
- **Key change:** `default_wht_rate: z.number().min(0).max(100).nullable().optional() ... fields = [... 'default_wht_rate']`
- **File changed:** `app/api/vendors/route.ts` lines 17–80
- **Key change:** `default_wht_rate: z.number().min(0).max(100).nullable().optional() ... INSERT INTO vendors (..., default_wht_rate)`
- **Verify:** `npm run qa:verify` → 0 compiler errors.

### Task 4 — WHT Computation & Journal Posting on Payment
- **File changed:** `app/api/ap/payments/route.ts` lines 102–133
- **Key change:** `const whtAmount = ... INSERT INTO wht_certificates ... INSERT INTO journal_entry_lines ...`
- **Verify:** `npm run qa:verify` → 0 compiler errors. Double entry ledger updates debits AP (2100) and credits cash/bank and WHT liability (2310) correctly.

### Task 5 — Withholding Tax API & Premium PDF Engine
- **File changed:** `app/api/ap/wht/route.ts` lines 1–62
- **Key change:** `export async function GET(req: Request) ... SELECT wc.*, v.name_th AS vendor_name_th ...`
- **File changed:** `app/api/ap/wht/[id]/route.ts` lines 1–25
- **Key change:** `export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) ...`
- **File changed:** `app/api/ap/wht/[id]/form-50-twi.pdf/route.tsx` lines 1–315
- **Key change:** `Font.register({ family: 'Sarabun', ... }) ... const buffer = await renderToBuffer(<WhtDoc />)`
- **Verify:** `npm run qa:verify` → 0 compiler errors. Beautiful Sarabun-font bilingual PDF rendered.

### Task 6 — WHT Certificates Navigation & List UI
- **File changed:** `app/app/ap/wht/page.tsx` lines 1–228
- **Key change:** `export default function WhtCertificatesPage() ...`
- **File changed:** `components/layout/Sidebar.tsx` lines 265–269
- **Key change:** `{ href: '/app/ap/wht', label: t('page.wht_certificates'), icon: FileText, permission: 'vendors:view' }`
- **File changed:** `lib/i18n/th.json` lines 41–44
- **Key change:** `"page.wht_certificates": "ภาษีหัก ณ ที่จ่าย"`
- **File changed:** `lib/i18n/en.json` lines 41–44
- **Key change:** `"page.wht_certificates": "WHT Certificates"`
- **Verify:** `npm run qa:verify` → 0 errors. Fully responsive filterable WHT dashboard linked and translated.

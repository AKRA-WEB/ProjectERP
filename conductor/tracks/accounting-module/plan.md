---
track: accounting-module
status: Completed
aliases: ["Accounting Module"]
owner: paku, puka
module: Accounting
updated: 2026-05-11
---

# Track: Accounting Module

**Created:** 2026-05-11
**Status:** Active
**Architect:** Claude

---

## Overview

Double-entry bookkeeping engine for the ERP. Provides:

- **Chart of Accounts (CoA)** — hierarchical account structure (Thai GAAP / TFRS aligned)
- **Fiscal Periods** — monthly accounting periods with open/close/lock lifecycle
- **Journal Entries** — manual double-entry posting; draft → posted → void
- **Reports** — Trial Balance, General Ledger, P&L, Balance Sheet, AR Aging, AP Aging

Integration with existing modules is **read-only at this stage**: accounting reads from `po_invoices`, `sales_invoices`, `pos_transactions`, `stock_ledger` to surface AP/AR aging. Automated journal entry creation (auto-posting on GRN/DO/POS events) is scoped as a future track.

---

## Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Entry model | Double-entry (debit/credit lines) | Standard accounting; ensures balance |
| Auto-posting | Not in this track | Requires cross-module coupling; plan separately |
| Report engine | Raw SQL queries on `journal_entry_lines` WHERE `status='posted'` | No ORM; consistent with project pattern |
| AR/AP aging | Queries on `sales_invoices` + `po_invoices` | No need to duplicate data; source of truth already exists |
| Account hierarchy | Self-referential `parent_id` (max 2 levels: group → account) | Simple enough for SME; extensible |
| Fiscal periods | Monthly periods, manually created by admin | Matches Thai tax filing cadence |
| Balance check | PostgreSQL CHECK constraint + API layer | Belt-and-suspenders: can't post unbalanced entries |
| Normal balance | Stored on `accounts` table | Determines sign for trial balance display |

---

## Account Type → Normal Balance Reference

| Type | Normal Balance | Examples |
|---|---|---|
| `asset` | debit | Cash, AR, Inventory, Equipment |
| `liability` | credit | AP, VAT Payable, Loans |
| `equity` | credit | Share Capital, Retained Earnings |
| `revenue` | credit | Sales Revenue, Other Income |
| `expense` | debit | COGS, Salaries, Rent |

---

## Tasks

### Task 1: Migration — `migrations/018_accounting.sql`

- [x] **Enums:**
  ```sql
  CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
  CREATE TYPE normal_balance_type AS ENUM ('debit', 'credit');
  CREATE TYPE fiscal_period_status AS ENUM ('open', 'closed', 'locked');
  CREATE TYPE journal_entry_status AS ENUM ('draft', 'posted', 'void');
  CREATE TYPE journal_entry_type AS ENUM (
    'manual', 'ap_payment', 'ar_receipt', 'pos_sale',
    'so_delivery', 'grn_receipt', 'inventory_adjustment', 'opening_balance'
  );
  ```

- [x] **Sequence:**
  ```sql
  CREATE SEQUENCE IF NOT EXISTS seq_je START 1;
  ```

- [x] **Table `accounts`** (Chart of Accounts):
  ```sql
  CREATE TABLE IF NOT EXISTS accounts (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_code          VARCHAR(20)  NOT NULL UNIQUE,
    name_th               VARCHAR(255) NOT NULL,
    name_en               VARCHAR(255) NOT NULL,
    account_type          account_type NOT NULL,
    normal_balance        normal_balance_type NOT NULL,
    parent_id             UUID REFERENCES accounts(id),
    allows_direct_posting BOOLEAN NOT NULL DEFAULT TRUE,
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    description           TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```

- [x] **Table `fiscal_periods`:**
  ```sql
  CREATE TABLE IF NOT EXISTS fiscal_periods (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(50) NOT NULL,
    year        INTEGER NOT NULL,
    month       INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    status      fiscal_period_status NOT NULL DEFAULT 'open',
    closed_at   TIMESTAMPTZ,
    closed_by   UUID REFERENCES users(id),
    locked_at   TIMESTAMPTZ,
    locked_by   UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(year, month)
  );
  ```

- [x] **Table `journal_entries`:**
  ```sql
  CREATE TABLE IF NOT EXISTS journal_entries (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_number     VARCHAR(50) NOT NULL UNIQUE DEFAULT next_doc_number('JE','seq_je'),
    fiscal_period_id UUID NOT NULL REFERENCES fiscal_periods(id),
    entry_date       DATE NOT NULL,
    entry_type       journal_entry_type NOT NULL DEFAULT 'manual',
    reference_type   VARCHAR(50),
    reference_id     UUID,
    description      TEXT NOT NULL,
    status           journal_entry_status NOT NULL DEFAULT 'draft',
    posted_by        UUID REFERENCES users(id),
    posted_at        TIMESTAMPTZ,
    voided_by        UUID REFERENCES users(id),
    voided_at        TIMESTAMPTZ,
    void_reason      TEXT,
    created_by       UUID NOT NULL REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```

- [x] **Table `journal_entry_lines`:**
  ```sql
  CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id       UUID NOT NULL REFERENCES accounts(id),
    description      TEXT,
    debit_amount     NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (debit_amount >= 0),
    credit_amount    NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
    line_number      INTEGER NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(journal_entry_id, line_number),
    CONSTRAINT chk_one_side CHECK (
      (debit_amount > 0 AND credit_amount = 0) OR
      (credit_amount > 0 AND debit_amount = 0) OR
      (debit_amount = 0 AND credit_amount = 0)
    )
  );
  ```

- [x] **Indexes:**
  - `idx_accounts_code` on `accounts(account_code)`
  - `idx_accounts_type` on `accounts(account_type)`
  - `idx_accounts_parent` on `accounts(parent_id)` WHERE `parent_id IS NOT NULL`
  - `idx_fiscal_periods_year_month` on `fiscal_periods(year, month)`
  - `idx_fiscal_periods_status` on `fiscal_periods(status)`
  - `idx_je_period` on `journal_entries(fiscal_period_id)`
  - `idx_je_status` on `journal_entries(status)`
  - `idx_je_date` on `journal_entries(entry_date)`
  - `idx_je_reference` on `journal_entries(reference_type, reference_id)`
  - `idx_jel_entry` on `journal_entry_lines(journal_entry_id)`
  - `idx_jel_account` on `journal_entry_lines(account_id)`

- [x] **Triggers:** `set_updated_at()` on `accounts`, `fiscal_periods`, `journal_entries`

- [x] **Seed: Chart of Accounts (Thai GAAP)**
  ```sql
  -- Group accounts (allows_direct_posting=FALSE)
  INSERT INTO accounts (account_code, name_th, name_en, account_type, normal_balance, allows_direct_posting) VALUES
  ('1000', 'สินทรัพย์', 'Assets', 'asset', 'debit', FALSE),
  ('2000', 'หนี้สิน', 'Liabilities', 'liability', 'credit', FALSE),
  ('3000', 'ส่วนของผู้ถือหุ้น', 'Equity', 'equity', 'credit', FALSE),
  ('4000', 'รายได้', 'Revenue', 'revenue', 'credit', FALSE),
  ('5000', 'ต้นทุนขาย', 'Cost of Goods Sold', 'expense', 'debit', FALSE),
  ('6000', 'ค่าใช้จ่าย', 'Expenses', 'expense', 'debit', FALSE),
  ('7000', 'ภาษี', 'Taxes', 'expense', 'debit', FALSE)
  ON CONFLICT (account_code) DO NOTHING;

  -- Leaf accounts — set parent_id after insert
  INSERT INTO accounts (account_code, name_th, name_en, account_type, normal_balance) VALUES
  -- Assets
  ('1100', 'เงินสด', 'Cash', 'asset', 'debit'),
  ('1110', 'เงินฝากธนาคาร', 'Bank Account', 'asset', 'debit'),
  ('1200', 'ลูกหนี้การค้า', 'Accounts Receivable', 'asset', 'debit'),
  ('1210', 'ค่าเผื่อหนี้สงสัยจะสูญ', 'Allowance for Doubtful Accounts', 'asset', 'credit'),
  ('1300', 'สินค้าคงเหลือ', 'Inventory', 'asset', 'debit'),
  ('1400', 'ค่าใช้จ่ายล่วงหน้า', 'Prepaid Expenses', 'asset', 'debit'),
  ('1500', 'ที่ดิน อาคาร อุปกรณ์', 'Property, Plant & Equipment', 'asset', 'debit'),
  ('1510', 'ค่าเสื่อมราคาสะสม', 'Accumulated Depreciation', 'asset', 'credit'),
  -- Liabilities
  ('2100', 'เจ้าหนี้การค้า', 'Accounts Payable', 'liability', 'credit'),
  ('2200', 'ค่าใช้จ่ายค้างจ่าย', 'Accrued Expenses', 'liability', 'credit'),
  ('2300', 'ภาษีมูลค่าเพิ่มค้างจ่าย', 'VAT Payable', 'liability', 'credit'),
  ('2400', 'ภาษีเงินได้ค้างจ่าย', 'Income Tax Payable', 'liability', 'credit'),
  ('2500', 'เงินกู้ยืม', 'Loans Payable', 'liability', 'credit'),
  -- Equity
  ('3100', 'ทุนจดทะเบียน', 'Share Capital', 'equity', 'credit'),
  ('3200', 'กำไรสะสม', 'Retained Earnings', 'equity', 'credit'),
  ('3300', 'กำไร(ขาดทุน)ปัจจุบัน', 'Current Period P&L', 'equity', 'credit'),
  -- Revenue
  ('4100', 'รายได้จากการขาย', 'Sales Revenue', 'revenue', 'credit'),
  ('4200', 'รายได้อื่น', 'Other Income', 'revenue', 'credit'),
  -- COGS
  ('5100', 'ต้นทุนสินค้าที่ขาย', 'Cost of Goods Sold', 'expense', 'debit'),
  -- Expenses
  ('6100', 'เงินเดือนและค่าแรง', 'Salaries & Wages', 'expense', 'debit'),
  ('6200', 'ค่าเช่า', 'Rent', 'expense', 'debit'),
  ('6300', 'ค่าสาธารณูปโภค', 'Utilities', 'expense', 'debit'),
  ('6400', 'ค่าใช้จ่ายในการขาย', 'Selling & Admin Expenses', 'expense', 'debit'),
  ('6500', 'ค่าเสื่อมราคา', 'Depreciation Expense', 'expense', 'debit'),
  ('6600', 'ค่าใช้จ่ายอื่น', 'Other Expenses', 'expense', 'debit'),
  -- Tax
  ('7100', 'ภาษีเงินได้นิติบุคคล', 'Corporate Income Tax', 'expense', 'debit')
  ON CONFLICT (account_code) DO NOTHING;

  -- Link leaf accounts to parent groups
  UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE account_code='1000')
    WHERE account_code IN ('1100','1110','1200','1210','1300','1400','1500','1510');
  UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE account_code='2000')
    WHERE account_code IN ('2100','2200','2300','2400','2500');
  UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE account_code='3000')
    WHERE account_code IN ('3100','3200','3300');
  UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE account_code='4000')
    WHERE account_code IN ('4100','4200');
  UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE account_code='5000')
    WHERE account_code IN ('5100');
  UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE account_code='6000')
    WHERE account_code IN ('6100','6200','6300','6400','6500','6600');
  UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE account_code='7000')
    WHERE account_code IN ('7100');
  ```

- [x] **Seed permissions** (sort_order 230–270):
  ```sql
  ('accounts:view',           'ดูผังบัญชี',            'View Chart of Accounts',  'accounting', 230),
  ('accounts:manage',         'จัดการผังบัญชี',         'Manage Chart of Accounts','accounting', 231),
  ('fiscal_periods:view',     'ดูรอบบัญชี',             'View Fiscal Periods',      'accounting', 240),
  ('fiscal_periods:manage',   'จัดการรอบบัญชี',         'Manage Fiscal Periods',    'accounting', 241),
  ('accounting:view',         'ดูรายการบัญชี',          'View Journal Entries',     'accounting', 250),
  ('accounting:create',       'สร้างรายการบัญชี',       'Create Journal Entries',   'accounting', 251),
  ('accounting:post',         'บันทึกรายการบัญชี',      'Post Journal Entries',     'accounting', 252),
  ('accounting:void',         'ยกเลิกรายการบัญชี',      'Void Journal Entries',     'accounting', 253),
  ('reports:accounting',      'รายงานบัญชี',             'Accounting Reports',       'accounting', 260)
  ```

- [x] **Grant to system roles:**
  - `system_admin`: all accounting permissions
  - `system_manager`: `accounts:view`, `fiscal_periods:view`, `accounting:view`, `accounting:create`, `accounting:post`, `reports:accounting`
  - `system_staff`: `accounts:view`, `accounting:view`, `reports:accounting`

**Verification:** `npm run migrate` passes. All tables and seed data exist. `SELECT COUNT(*) FROM accounts` = 28.

---

### Task 2: Types — `types/index.ts`

- [x] 
 Status types:
  ```typescript
  export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  export type NormalBalanceType = 'debit' | 'credit';
  export type FiscalPeriodStatus = 'open' | 'closed' | 'locked';
  export type JournalEntryStatus = 'draft' | 'posted' | 'void';
  export type JournalEntryType = 'manual' | 'ap_payment' | 'ar_receipt' | 'pos_sale' | 'so_delivery' | 'grn_receipt' | 'inventory_adjustment' | 'opening_balance';
  ```

- [x] 
 Interface `Account`:
  ```typescript
  export interface Account {
    id: string;
    account_code: string;
    name_th: string;
    name_en: string;
    account_type: AccountType;
    normal_balance: NormalBalanceType;
    parent_id: string | null;
    parent_code: string | null;
    parent_name_th: string | null;
    allows_direct_posting: boolean;
    is_active: boolean;
    description: string | null;
    created_at: string;
  }
  ```

- [x] 
 Interface `FiscalPeriod`:
  ```typescript
  export interface FiscalPeriod {
    id: string;
    name: string;
    year: number;
    month: number;
    start_date: string;
    end_date: string;
    status: FiscalPeriodStatus;
    closed_at: string | null;
    locked_at: string | null;
    entry_count?: number;
    created_at: string;
  }
  ```

- [x] 
 Interface `JournalEntryLine`:
  ```typescript
  export interface JournalEntryLine {
    id: string;
    account_id: string;
    account_code: string;
    account_name_th: string;
    account_name_en: string;
    description: string | null;
    debit_amount: number;
    credit_amount: number;
    line_number: number;
  }
  ```

- [x] 
 Interface `JournalEntry`:
  ```typescript
  export interface JournalEntry {
    id: string;
    entry_number: string;
    fiscal_period_id: string;
    period_name: string;
    entry_date: string;
    entry_type: JournalEntryType;
    reference_type: string | null;
    reference_id: string | null;
    description: string;
    status: JournalEntryStatus;
    total_debit: number;
    total_credit: number;
    posted_by: string | null;
    posted_at: string | null;
    voided_by: string | null;
    void_reason: string | null;
    created_by: string;
    created_by_name: string;
    lines?: JournalEntryLine[];
    created_at: string;
  }
  ```

- [x] 
 Report interfaces:
  ```typescript
  export interface TrialBalanceRow {
    account_code: string;
    account_name_th: string;
    account_name_en: string;
    account_type: AccountType;
    total_debit: number;
    total_credit: number;
    balance: number;
    normal_balance: NormalBalanceType;
  }
  export interface GeneralLedgerRow {
    entry_number: string;
    entry_date: string;
    description: string;
    debit_amount: number;
    credit_amount: number;
    running_balance: number;
  }
  export interface ArAgingRow {
    customer_name_th: string;
    si_number: string;
    invoice_date: string;
    due_date: string;
    total_amount: number;
    days_overdue: number;
    bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+';
  }
  export interface ApAgingRow {
    vendor_name_th: string;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    amount: number;
    days_overdue: number;
    bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+';
  }
  ```

---

### Task 3: API Routes

#### 3a. `app/api/accounting/accounts/route.ts`

- [x] 
 `GET` — list accounts; optional filter by `account_type`, `is_active`, `search` (code/name); join parent info; order by `account_code`; assert `accounts:view`; no pagination (CoA is small, return all)
- [x] 
 `POST` — create account; assert `accounts:manage`; validate:
  ```typescript
  { account_code, name_th, name_en, account_type, normal_balance, parent_id?, allows_direct_posting?, description? }
  ```
  - Check `account_code` uniqueness
  - If `parent_id` set, verify parent exists and `allows_direct_posting=FALSE`
  - INSERT and return

#### 3b. `app/api/accounting/accounts/[id]/route.ts`

- [x] 
 `GET` — account detail; assert `accounts:view`
- [x] 
 `PATCH` — edit name_th, name_en, description, is_active; assert `accounts:manage`; cannot change account_code, account_type, normal_balance once created (immutable — changing these would corrupt historical entries)

#### 3c. `app/api/accounting/fiscal-periods/route.ts`

- [x] 
 `GET` — list periods ordered by year DESC, month DESC; include `entry_count` (COUNT of posted entries in period); assert `fiscal_periods:view`
- [x] 
 `POST` — create fiscal period; assert `fiscal_periods:manage`; validate:
  ```typescript
  { year, month, name?, start_date, end_date }
  ```
  - Check UNIQUE(year, month)
  - Auto-name if not provided: e.g., `"มกราคม 2026"` from month/year
  - Default status: `open`

#### 3d. `app/api/accounting/fiscal-periods/[id]/route.ts`

- [x] 
 `GET` — period detail; assert `fiscal_periods:view`
- [x] 
 `PATCH` — actions via `body.action`:
  - **`close`**: assert `fiscal_periods:manage`; status=`open`→`closed`; closed_at=NOW(), closed_by=user.id
  - **`reopen`**: assert admin only; status=`closed`→`open` (cannot reopen `locked`)
  - **`lock`**: assert admin only; status=`closed`→`locked`; locked_at=NOW() — permanent, no reopen

#### 3e. `app/api/accounting/journal-entries/route.ts`

- [x] 
 `GET` — list entries; filter by `fiscal_period_id`, `status`, `entry_type`, `from_date`, `to_date`; paginated; include `total_debit` and `total_credit` (SUM of lines); assert `accounting:view`
- [x] 
 `POST` — create journal entry; assert `accounting:create`; validate:
  ```typescript
  {
    fiscal_period_id: uuid,
    entry_date: date,
    entry_type?: JournalEntryType,
    description: string,
    reference_type?: string,
    reference_id?: uuid,
    lines: [{
      account_id: uuid,
      description?: string,
      debit_amount: number,  // exactly one of these must be > 0
      credit_amount: number
    }]
  }
  ```
  - Validate fiscal period is `open`
  - Validate `lines.length >= 2`
  - Validate each line: only one of debit/credit > 0 (enforced by DB CHECK, but validate in API too)
  - Validate all `account_id` have `allows_direct_posting=TRUE`
  - Check balance: `SUM(debit_amount) === SUM(credit_amount)` — return 400 if not balanced (include computed totals in error message)
  - Use transaction: INSERT header + all lines
  - Return `apiSuccess(entry, 201)` with lines included

#### 3f. `app/api/accounting/journal-entries/[id]/route.ts`

- [x] 
 `GET` — entry detail with all lines (join account code/name); assert `accounting:view`
- [x] 
 `PATCH` — actions via `body.action`:
  - **`post`**: assert `accounting:post`; status=`draft`→`posted`; posted_at=NOW(); re-validate balance (SUM debit = SUM credit); verify fiscal period still `open`
  - **`void`**: assert `accounting:void`; status=`posted`→`void`; validate body: `{ void_reason: string }`; voided_at=NOW(); **Note:** void does NOT reverse entries — it marks them void and they are excluded from reports. A reversing entry must be created manually if needed
  - **`unpost`** (draft recovery): assert admin only; status=`posted`→`draft` only if fiscal period still `open` and entry was posted by same user within same day — strict guard

#### 3g. `app/api/accounting/reports/trial-balance/route.ts`

- [x] 
 `GET` — params: `period_id` (required)
  - Assert `reports:accounting`
  - Query: for each active account with `allows_direct_posting=TRUE`, SUM debit/credit from posted entries in the period
  - Include only accounts with non-zero activity OR all accounts (param `include_zero=true`)
  - Compute `balance`: if `normal_balance='debit'` then `total_debit - total_credit`; if `credit` then `total_credit - total_debit`
  - Return rows sorted by `account_code`
  - Include footer: grand total debit, grand total credit (must be equal for a balanced set of books)

#### 3h. `app/api/accounting/reports/general-ledger/route.ts`

- [x] 
 `GET` — params: `account_id` (required), `from_date`, `to_date`
  - Assert `reports:accounting`
  - Query posted journal_entry_lines for the account, ordered by entry_date ASC, entry_number ASC
  - Compute `running_balance` using window function: `SUM(debit - credit) OVER (ORDER BY entry_date, entry_number)`
  - Return rows + opening_balance (balance before from_date)

#### 3i. `app/api/accounting/reports/profit-loss/route.ts`

- [x] 
 `GET` — params: `from_date`, `to_date` (required)
  - Assert `reports:accounting`
  - Revenue: SUM of credit_amount - debit_amount for accounts with `account_type='revenue'`
  - COGS: SUM of debit_amount - credit_amount for accounts with `account_code LIKE '5%'`
  - Gross Profit = Revenue - COGS
  - Operating Expenses: SUM of debit_amount - credit_amount for `account_code LIKE '6%'`
  - Operating Income = Gross Profit - Operating Expenses
  - Tax: `account_code LIKE '7%'`
  - Net Income = Operating Income - Tax
  - Return structured JSON with sections and line items

#### 3j. `app/api/accounting/reports/balance-sheet/route.ts`

- [x] 
 `GET` — params: `as_of` date (required)
  - Assert `reports:accounting`
  - Sum ALL posted journal_entry_lines WHERE `entry_date <= as_of`
  - Assets (account_type='asset'): debit balance
  - Liabilities (account_type='liability'): credit balance
  - Equity (account_type='equity'): credit balance
  - Include retained earnings = sum of all revenue and expense accounts up to prior fiscal year + current year net income
  - Return structured JSON: Assets section, Liabilities section, Equity section
  - Include validation: Total Assets = Total Liabilities + Total Equity

#### 3k. `app/api/accounting/reports/ar-aging/route.ts`

- [x] 
 `GET` — current date as of today; assert `reports:accounting`
  - Query `sales_invoices` WHERE `status IN ('issued')` (unpaid) — from Sales module (migration 017)
  - JOIN `customers` for name
  - Compute `days_overdue = CURRENT_DATE - due_date`
  - Assign bucket: ≤0 = `current`; 1-30 = `1-30`; 31-60 = `31-60`; 61-90 = `61-90`; >90 = `90+`
  - Return rows grouped by bucket, with totals per bucket and grand total
  - **Graceful degradation:** If `sales_invoices` table doesn't exist yet (Sales module not migrated), return empty `{ rows: [], total: 0 }` — use `EXISTS` check on information_schema

#### 3l. `app/api/accounting/reports/ap-aging/route.ts`

- [x] 
 `GET` — assert `reports:accounting`
  - Query `po_invoices` WHERE `is_paid = FALSE`
  - JOIN `purchase_orders` → `vendors` for vendor name
  - Compute `days_overdue = CURRENT_DATE - due_date`
  - Assign bucket same as AR aging
  - Return rows with bucket totals

**Verification:** All 12 route files exist, lint passes. Trial balance totals debit = credit. Balance sheet Assets = Liabilities + Equity (after posting sample balanced entries).

---

### Task 4: Pages

#### 4a. Chart of Accounts

**`app/app/accounting/chart-of-accounts/page.tsx`**
- [x] 
 Table: account_code (sortable), name_th, account_type badge, normal_balance, parent, allows_direct_posting, is_active
- [x] 
 Filter by account_type, is_active
- [x] 
 "เพิ่มบัญชี / Add Account" button (visible if `accounts:manage`)
- [x] 
 Inline toggle `is_active` per row (if `accounts:manage`)
- [x] 
 Click row → expand inline to show description + edit form

**`app/app/accounting/chart-of-accounts/new/page.tsx`**
- [x] 
 Form: account_code, name_th, name_en, account_type (Select), normal_balance (auto-suggest based on type: asset/expense→debit, liability/equity/revenue→credit; user can override), parent account (Select filtered to group accounts), allows_direct_posting (checkbox), description
- [x] 
 POST `/api/accounting/accounts` → redirect to list

#### 4b. Fiscal Periods

**`app/app/accounting/fiscal-periods/page.tsx`**
- [x] 
 Table: year, month, name, start_date, end_date, status badge, entry_count
- [x] 
 Actions per row:
  - `open`: "ปิดรอบ / Close" (if `fiscal_periods:manage`)
  - `closed`: "เปิดใหม่ / Reopen" (admin only), "ล็อก / Lock" (admin only)
- [x] 
 "สร้างรอบบัญชี / New Period" button

**`app/app/accounting/fiscal-periods/new/page.tsx`**
- [x] 
 Fields: year (number), month (Select: 1-12 with Thai month names), start_date, end_date, name (auto-filled but editable)
- [x] 
 POST → redirect to list

#### 4c. Journal Entries

**`app/app/accounting/journal-entries/page.tsx`**
- [x] 
 Table: entry_number, entry_date, period, description, entry_type badge, status badge, total_debit, total_credit
- [x] 
 Filter by status, entry_type, period, date range
- [x] 
 "สร้างรายการ / New Entry" button (if `accounting:create`)
- [x] 
 Paginated

**`app/app/accounting/journal-entries/new/page.tsx`**
- [x] 
 Select fiscal_period (must be `open`), entry_date, description, entry_type (default: manual)
- [x] 
 **Line editor** (debit/credit table):
  - Each line: account selector (search by code or name), description, either debit OR credit amount
  - "เพิ่มบรรทัด / Add Line" button
  - At least 2 lines required
  - Live balance indicator: running total debit vs credit; turns green when balanced
- [x] 
 Submit: POST — API validates balance; if unbalanced, show error with difference amount
- [x] 
 "บันทึกร่าง / Save Draft" and "บันทึกและโพสต์ / Save & Post" buttons

**`app/app/accounting/journal-entries/[id]/page.tsx`**
- [x] 
 Header: entry_number, date, period, type, status badge, description
- [x] 
 Lines table: account_code, account_name_th, description, debit_amount, credit_amount
- [x] 
 Footer totals: total debit, total credit, balance check indicator (✓ balanced)
- [x] 
 Action buttons based on status:
  - `draft`: "โพสต์ / Post" (if `accounting:post`), "แก้ไข / Edit" (re-render as edit form)
  - `posted`: "ยกเลิก / Void" → reason modal (if `accounting:void`)

#### 4d. Reports

All report pages share a common layout: filter bar at top, results table/chart below, "ส่งออก / Export CSV" button (use browser's `window.print()` or data URL approach).

**`app/app/accounting/reports/trial-balance/page.tsx`**
- [x] 
 Filter: period selector (from fiscal_periods list)
- [x] 
 Table: account_code, name_th, name_en, total_debit, total_credit, balance (positive = normal, red if abnormal balance)
- [x] 
 Footer: grand total debit, grand total credit; show ✓ if equal, ✗ if not
- [x] 
 Group by account_type section headers

**`app/app/accounting/reports/general-ledger/page.tsx`**
- [x] 
 Filters: account selector (CoA), from_date, to_date
- [x] 
 Table: date, entry_number, description, debit, credit, running_balance
- [x] 
 Opening balance row at top

**`app/app/accounting/reports/profit-loss/page.tsx`**
- [x] 
 Filters: from_date, to_date
- [x] 
 Structured P&L layout:
  - Revenue section with line items
  - Less: COGS → Gross Profit
  - Less: Operating Expenses → Operating Income
  - Less: Tax → Net Income
- [x] 
 Amounts in THB with `formatCurrency()`

**`app/app/accounting/reports/balance-sheet/page.tsx`**
- [x] 
 Filter: as_of date (default: today)
- [x] 
 Three-column layout: Assets | Liabilities + Equity
- [x] 
 Balance check indicator at bottom: Assets = Liabilities + Equity

**`app/app/accounting/reports/ar-aging/page.tsx`**
- [x] 
 Buckets as column headers: Current | 1-30 days | 31-60 | 61-90 | 90+
- [x] 
 One row per outstanding invoice
- [x] 
 Totals row at bottom per bucket
- [x] 
 If Sales module not yet installed, show info banner

**`app/app/accounting/reports/ap-aging/page.tsx`**
- [x] 
 Same layout as AR aging but for vendor invoices

**Verification:** Golden path: create fiscal period → create balanced JE (Dr. Cash 1000 / Cr. Revenue 1000) → post → trial balance shows 1000 on both sides → P&L shows 1000 revenue → balance sheet shows 1000 cash asset, 1000 equity (retained earnings via P&L).

---

### Task 5: Sidebar — `components/layout/Sidebar.tsx`

- [x] 
 Add nav group `'บัญชี / Accounting'` **before** `'ขาย / Sales'`:
  ```typescript
  {
    label: 'บัญชี / Accounting',
    items: [
      { href: '/app/accounting/chart-of-accounts', label: 'ผังบัญชี / Chart of Accounts', icon: '📒', permission: 'accounts:view' },
      { href: '/app/accounting/fiscal-periods',    label: 'รอบบัญชี / Fiscal Periods',     icon: '📅', permission: 'fiscal_periods:view' },
      { href: '/app/accounting/journal-entries',   label: 'รายการบัญชี / Journal Entries', icon: '📔', permission: 'accounting:view' },
      { href: '/app/accounting/reports/trial-balance', label: 'งบทดลอง / Trial Balance',  icon: '⚖️', permission: 'reports:accounting' },
      { href: '/app/accounting/reports/profit-loss',   label: 'P&L',                       icon: '📈', permission: 'reports:accounting' },
      { href: '/app/accounting/reports/balance-sheet', label: 'งบดุล / Balance Sheet',     icon: '🏦', permission: 'reports:accounting' },
      { href: '/app/accounting/reports/ar-aging',      label: 'AR Aging',                  icon: '📤', permission: 'reports:accounting' },
      { href: '/app/accounting/reports/ap-aging',      label: 'AP Aging',                  icon: '📥', permission: 'reports:accounting' },
    ],
  },
  ```

---

## Files to Create / Modify

| Action | Path |
|--------|------|
| CREATE | `migrations/018_accounting.sql` |
| MODIFY | `types/index.ts` |
| CREATE | `app/api/accounting/accounts/route.ts` |
| CREATE | `app/api/accounting/accounts/[id]/route.ts` |
| CREATE | `app/api/accounting/fiscal-periods/route.ts` |
| CREATE | `app/api/accounting/fiscal-periods/[id]/route.ts` |
| CREATE | `app/api/accounting/journal-entries/route.ts` |
| CREATE | `app/api/accounting/journal-entries/[id]/route.ts` |
| CREATE | `app/api/accounting/reports/trial-balance/route.ts` |
| CREATE | `app/api/accounting/reports/general-ledger/route.ts` |
| CREATE | `app/api/accounting/reports/profit-loss/route.ts` |
| CREATE | `app/api/accounting/reports/balance-sheet/route.ts` |
| CREATE | `app/api/accounting/reports/ar-aging/route.ts` |
| CREATE | `app/api/accounting/reports/ap-aging/route.ts` |
| CREATE | `app/app/accounting/chart-of-accounts/page.tsx` |
| CREATE | `app/app/accounting/chart-of-accounts/new/page.tsx` |
| CREATE | `app/app/accounting/fiscal-periods/page.tsx` |
| CREATE | `app/app/accounting/fiscal-periods/new/page.tsx` |
| CREATE | `app/app/accounting/journal-entries/page.tsx` |
| CREATE | `app/app/accounting/journal-entries/new/page.tsx` |
| CREATE | `app/app/accounting/journal-entries/[id]/page.tsx` |
| CREATE | `app/app/accounting/reports/trial-balance/page.tsx` |
| CREATE | `app/app/accounting/reports/general-ledger/page.tsx` |
| CREATE | `app/app/accounting/reports/profit-loss/page.tsx` |
| CREATE | `app/app/accounting/reports/balance-sheet/page.tsx` |
| CREATE | `app/app/accounting/reports/ar-aging/page.tsx` |
| CREATE | `app/app/accounting/reports/ap-aging/page.tsx` |
| MODIFY | `components/layout/Sidebar.tsx` |

Total: 2 modified, 26 created.

---

## Acceptance Criteria

1. `npm run migrate` runs `018_accounting.sql` without errors; 28 seed accounts exist
2. `npm run lint` passes zero errors
3. CoA CRUD works; account_code uniqueness enforced; immutable fields (type, normal_balance) cannot be changed via PATCH
4. Fiscal period lifecycle: create → open → close → lock; locked periods reject new entries
5. Journal entry creation validates balance; unbalanced entry returns 400 with difference amount
6. Post action rejects if period is closed/locked
7. Trial balance: sum of all debit balances = sum of all credit balances for any set of balanced entries
8. P&L returns Revenue, COGS, Gross Profit, Operating Expenses, Operating Income, Net Income sections
9. Balance Sheet: Total Assets = Total Liabilities + Total Equity
10. AR Aging shows outstanding `sales_invoices` (or empty if Sales module not installed)
11. AP Aging shows outstanding `po_invoices`
12. Sidebar Accounting group visible with permission gating

---

## Future Track: Auto-Posting

When ready, create `conductor/tracks/accounting-auto-posting/plan.md` to cover:
- Hook GRN stocking → post Dr. Inventory / Cr. AP journal entry
- Hook DO shipping → post Dr. COGS / Cr. Inventory + Dr. AR / Cr. Revenue + VAT entries
- Hook POS checkout → post Dr. Cash / Cr. Revenue + VAT
- Hook PO invoice paid → post Dr. AP / Cr. Cash
- Hook Sales invoice paid → post Dr. Cash / Cr. AR

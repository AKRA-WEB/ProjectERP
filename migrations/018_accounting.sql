-- 1. Enums
DO $$ BEGIN
  CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE normal_balance_type AS ENUM ('debit', 'credit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fiscal_period_status AS ENUM ('open', 'closed', 'locked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE journal_entry_status AS ENUM ('draft', 'posted', 'void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE journal_entry_type AS ENUM (
    'manual', 'ap_payment', 'ar_receipt', 'pos_sale',
    'so_delivery', 'grn_receipt', 'inventory_adjustment', 'opening_balance'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Sequence
CREATE SEQUENCE IF NOT EXISTS seq_je START 1;

-- 3. Tables

-- accounts (Chart of Accounts)
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

-- fiscal_periods
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

-- journal_entries
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

-- journal_entry_lines
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
    (debit_amount = 0 AND credit_amount = 0) -- Allow zero lines for drafts if needed, though app should prevent
  )
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(account_code);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_year_month ON fiscal_periods(year, month);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_status ON fiscal_periods(status);
CREATE INDEX IF NOT EXISTS idx_je_period ON journal_entries(fiscal_period_id);
CREATE INDEX IF NOT EXISTS idx_je_status ON journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_je_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_je_reference ON journal_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_jel_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jel_account ON journal_entry_lines(account_id);

-- 5. Triggers
CREATE OR REPLACE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE TRIGGER trg_fiscal_periods_updated_at BEFORE UPDATE ON fiscal_periods FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE TRIGGER trg_journal_entries_updated_at BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. Seed: Chart of Accounts (Thai GAAP)
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

-- Leaf accounts
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

-- 7. Permissions
INSERT INTO permissions (id, name_th, name_en, module, sort_order) VALUES
  ('accounts:view',           'ดูผังบัญชี',            'View Chart of Accounts',  'accounting', 230),
  ('accounts:manage',         'จัดการผังบัญชี',         'Manage Chart of Accounts','accounting', 231),
  ('fiscal_periods:view',     'ดูรอบบัญชี',             'View Fiscal Periods',      'accounting', 240),
  ('fiscal_periods:manage',   'จัดการรอบบัญชี',         'Manage Fiscal Periods',    'accounting', 241),
  ('accounting:view',         'ดูรายการบัญชี',          'View Journal Entries',     'accounting', 250),
  ('accounting:create',       'สร้างรายการบัญชี',       'Create Journal Entries',   'accounting', 251),
  ('accounting:post',         'บันทึกรายการบัญชี',      'Post Journal Entries',     'accounting', 252),
  ('accounting:void',         'ยกเลิกรายการบัญชี',      'Void Journal Entries',     'accounting', 253),
  ('reports:accounting',      'รายงานบัญชี',             'Accounting Reports',       'accounting', 260)
ON CONFLICT (id) DO NOTHING;

-- 8. Grant to system roles
-- system_admin: all accounting permissions
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000001', id FROM permissions WHERE module = 'accounting'
ON CONFLICT DO NOTHING;

-- system_manager
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000002', id FROM permissions 
  WHERE id IN ('accounts:view', 'fiscal_periods:view', 'accounting:view', 'accounting:create', 'accounting:post', 'reports:accounting')
ON CONFLICT DO NOTHING;

-- system_staff
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000003', id FROM permissions 
  WHERE id IN ('accounts:view', 'accounting:view', 'reports:accounting')
ON CONFLICT DO NOTHING;

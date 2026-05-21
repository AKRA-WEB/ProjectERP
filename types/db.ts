export type UserRole = 'admin' | 'manager' | 'staff';
export type Locale = 'th' | 'en';

export interface User {
  id: string;
  email: string;
  name_th: string | null;
  name_en: string;
  role: UserRole;
  is_active: boolean;
  employee_id: string | null;
  position: string | null;
  department: string | null;
  phone: string | null;
  hired_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vendor {
  id: string;
  code: string;
  name_th: string;
  name_en: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  code: string;
  name_th: string;
  name_en: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address_th: string | null;
  tax_id: string | null;
  payment_terms_days: number;
  credit_limit: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Warehouse {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  address_th: string | null;
  address_en: string | null;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name_th: string;
  name_en: string | null;
  category_id: string | null;
  category_name?: string | null;
  unit_cost: number | string;
  uom_id: string | null;
  uom_code: string | null;
  reorder_point: number | string | null;
  is_active: boolean;
  is_lot_tracked: boolean;
  is_serial_tracked: boolean;
  created_at: string;
}

export interface ProductCategory {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
}

export interface UnitOfMeasure {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  is_base_unit: boolean;
  is_integer_unit: boolean;
  barcode_label: string | null;
  sort_order: number;
  factor?: number | null;
  base_uom_id?: string | null;
  base_uom_code?: string | null;
}

export type FiscalPeriodStatus = 'open' | 'closed' | 'locked';
export interface FiscalPeriod {
  id: string;
  name_th: string;
  name_en: string | null;
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

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type NormalBalanceType = 'debit' | 'credit';
export interface Account {
  id: string;
  account_code: string;
  name_th: string;
  name_en: string;
  account_type: AccountType;
  normal_balance: NormalBalanceType;
  parent_id: string | null;
  parent_code?: string | null;
  parent_name_th?: string | null;
  allows_direct_posting: boolean;
  is_active: boolean;
  description: string | null;
  created_at: string;
}

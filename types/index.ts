export * from './db';
export * from './api';
export * from './hr';
export * from './inventory';

import type { PriceChannel } from './db';

// Remaining types not yet classified or for cross-module features (Sales, POS, Accounting)
// ... keeping them here for now until further splitting ...

export interface PosSession {
  id: string;
  session_number: string;
  warehouse_id: string;
  warehouse_name_th: string;
  warehouse_name_en: string;
  opened_by: string;
  opened_by_name: string;
  closed_by: string | null;
  status: any; // PosSessionStatus;
  opening_float: number;
  closing_float: number | null;
  shift_id?: string | null;
  shift_name_th?: string | null;
  shift_name_en?: string | null;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
  transaction_count?: number;
  total_sales?: number;
  created_at: string;
}

export interface PosShift {
  id: string;
  name_th: string;
  name_en: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface PosMember {
  id: string;
  member_number: string;
  name_th: string;
  phone: string;
  email: string | null;
  tier: string;
  price_tier?: 'T0' | 'T1' | 'T2' | 'T3';
  discount_rate: number;
  point_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PosHeldCart {
  id: string;
  hold_number: string;
  session_id: string;
  warehouse_id: string;
  note: string | null;
  created_by: string;
  created_at: string;
  line_count?: number;
  is_hybrid: boolean;
  wholesale_picking_slip_id: string | null;
  picking_slip_status?: PosPickingSlipStatus;
}

export type PosPickingSlipStatus = 'printed' | 'picked' | 'cancelled';

export interface PosPickingSlip {
  id: string;
  doc_no: string;
  draft_cart_id: string;
  status: PosPickingSlipStatus;
  source_warehouse_id: string;
  printed_at: string;
  printed_by: string;
  picked_at: string | null;
  picked_by: string | null;
  lines: any;
  created_at: string;
  updated_at: string;
}

export interface PosHeldCartLine {
  id: string;
  held_cart_id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  discount_amount: number;
  name_th?: string;
  sku?: string;
  image_url?: string;
}

export interface PosProduct {
  id: string;
  sku: string;
  barcode: string | null;
  name_th: string;
  name_en: string | null;
  selling_price: number;
  qty_available: number;
  image_url?: string | null;
  reorder_point?: number;
  category_id?: string | null;
}

export interface PosTransactionLine {
  id: string;
  product_id: string;
  sku: string;
  barcode: string | null;
  name_th: string;
  name_en: string;
  qty: number;
  unit_price: number;
  discount_amount: number;
  line_total: number;
}

export interface PosTransaction {
  id: string;
  receipt_number: string;
  session_id: string;
  warehouse_id: string;
  subtotal: number;
  discount_amount: number;
  vat_amount: number;
  total: number;
  payment_method: any; // PosPaymentMethod;
  cash_tendered: number | null;
  card_amount: number | null;
  change_given: number;
  status: any; // PosTransactionStatus;
  voided_by: string | null;
  voided_by_name?: string | null;
  voided_at: string | null;
  void_reason: string | null;
  member_id?: string | null;
  member_name?: string | null;
  member_discount?: number;
  points_earned?: number;
  created_by: string;
  cashier_name: string;
  lines?: PosTransactionLine[];
  created_at: string;
}

export interface SalesQuotation {
  id: string;
  sq_number: string;
  customer_id: string;
  customer_name_th: string;
  warehouse_id: string;
  warehouse_name_th: string;
  status: any; // SqStatus;
  channel: PriceChannel;
  valid_until: string | null;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  notes: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  created_by: string;
  created_by_name: string;
  lines?: SqLineItem[];
  created_at: string;
  updated_at: string;
}

export interface SqLineItem {
  id: string;
  product_id: string;
  sku: string;
  name_th: string;
  name_en: string;
  qty: number;
  unit_price: number;
  discount_amount: number;
  line_total: number;
  line_number: number;
}

export interface SalesOrder {
  id: string;
  so_number: string;
  customer_id: string;
  customer_name_th: string;
  warehouse_id: string;
  warehouse_name_th: string;
  status: any; // SoStatus;
  channel: PriceChannel;
  expected_delivery: string | null;
  payment_terms_days: number;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  notes: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  credit_limit_warning?: boolean;
  lines?: SoLineItem[];
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface SoLineItem {
  id: string;
  product_id: string;
  sku: string;
  name_th: string;
  name_en: string;
  qty_ordered: number;
  qty_delivered: number;
  unit_price: number;
  discount_amount: number;
  line_total: number;
  line_number: number;
}

export interface DeliveryOrder {
  id: string;
  do_number: string;
  so_id: string;
  so_number: string;
  customer_name_th: string;
  warehouse_id: string;
  warehouse_name_th: string;
  status: any; // DoStatus;
  shipping_address: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  notes: string | null;
  lines?: DoLineItem[];
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface DoLineItem {
  id: string;
  so_line_item_id: string;
  product_id: string;
  sku: string;
  name_th: string;
  name_en: string;
  qty_to_deliver: number;
  unit_price: number;
  line_total: number;
  line_number: number;
}

export interface SalesInvoice {
  id: string;
  si_number: string;
  so_id: string;
  so_number: string;
  delivery_order_id: string | null;
  do_number: string | null;
  customer_id: string;
  customer_name_th: string;
  status: any; // SiStatus;
  channel: PriceChannel;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  paid_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  notes: string | null;
  current_version: number;
  current_barcode: string | null;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export interface InvoiceVersion {
  id: string;
  invoice_id: string;
  version_no: number;
  barcode: string;
  change_summary: any;
  created_at: string;
  created_by: string;
  created_by_name?: string;
}

export interface SalesReturn {
  id: string;
  sr_number: string;
  so_id: string | null;
  so_number: string | null;
  customer_id: string;
  customer_name_th: string;
  warehouse_id: string;
  warehouse_name_th: string;
  status: any; // SrStatus;
  reason: string | null;
  received_at: string | null;
  restocked_at: string | null;
  notes: string | null;
  lines?: SrLineItem[];
  created_by: string;
  created_at: string;
}

export interface SrLineItem {
  id: string;
  product_id: string;
  sku: string;
  name_th: string;
  qty_returned: number;
  unit_price: number;
  line_number: number;
}

export interface Permission {
  id: string;
  name_th: string;
  name_en: string;
  module: string;
  sort_order: number;
}

export interface EmployeeRole {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  description: string | null;
  is_system: boolean;
  permission_count?: number;
  user_count?: number;
  permission_ids?: string[];
  created_at: string;
}

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

export interface JournalEntry {
  id: string;
  entry_number: string;
  fiscal_period_id: string;
  period_name?: string;
  entry_date: string;
  entry_type: any; // JournalEntryType;
  reference_type: string | null;
  reference_id: string | null;
  description: string;
  status: any; // JournalEntryStatus;
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

export interface TrialBalanceRow {
  account_code: string;
  account_name_th: string;
  account_name_en: string;
  account_type: any; // AccountType;
  total_debit: number;
  total_credit: number;
  balance: number;
  normal_balance: any; // NormalBalanceType;
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
  customer_name_en?: string;
  si_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  days_overdue: number;
  bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+';
}

export interface ApInvoiceAgingRow {
  vendor_name_th: string;
  vendor_name_en?: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  days_overdue: number;
  bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+';
}

export interface ApAgingRow {
  vendor_id: string;
  vendor_code: string;
  vendor_name_th: string;
  vendor_name_en: string;
  total_outstanding: number;
  current_amount: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  days_over_90: number;
  invoice_count: number;
  oldest_due_date: string;
  invoice_number?: string;
  due_date?: string;
  amount?: number;
  days_overdue?: number;
  bucket?: 'current' | '1-30' | '31-60' | '61-90' | '90+';
}

export interface ApInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  paid_amount: number;
  outstanding_amount: number;
  is_paid: boolean;
  overdue_days: number;
  vendor_id: string;
  vendor_name_th: string;
  vendor_name_en: string;
  vendor_code: string;
  po_id: string | null;
  po_number: string | null;
  grn_id: string | null;
  grn_number: string | null;
  created_at: string;
}

export interface ApPayment {
  id: string;
  payment_number: string;
  vendor_id: string;
  vendor_name_th: string;
  payment_date: string;
  total_amount: number;
  bank_ref: string | null;
  notes: string | null;
  paid_by: string;
  paid_by_name: string;
  created_at: string;
}

export type { PriceResolution } from '@/lib/pricing/resolve';
export { resolvePrice } from '@/lib/pricing/resolve';


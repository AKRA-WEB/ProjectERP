export type UserRole = 'admin' | 'manager' | 'staff';
export type Locale = 'th' | 'en';

export interface SessionUser {
  id: string;
  role: UserRole;
  assignedWarehouseIds: string[];
  permissions: string[];
}
export type RmaCondition = 'resaleable' | 'repack_resell' | 'damaged_return_vendor';
export type RmaStatus = 'open' | 'in_review' | 'resolved' | 'closed';
export type ClaimStatus = 'open' | 'in_review' | 'resolved' | 'closed';
export type ClaimResolutionType = 'credit_note' | 'replacement_shipment' | 'both';
export type TransferStatus = 'pending' | 'completed' | 'cancelled';
export type InboundOrderStatus = 'open' | 'receiving' | 'pending_verification' | 'verified' | 'closed' | 'rejected' | 'converted_to_po';
export type GrnStatus = 'draft' | 'received' | 'verified' | 'qc_pending' | 'qc_passed' | 'qc_failed' | 'stocked' | 'rejected';
export type PrStatus = 'draft' | 'submitted' | 'manager_approved' | 'admin_approved' | 'rejected' | 'converted_to_po' | 'received';
export type PoStatus = 'draft' | 'sent' | 'partially_received' | 'fully_received' | 'invoiced' | 'paid' | 'closed' | 'cancelled';
export type CycleCountStatus = 'open' | 'counting' | 'pending_approval' | 'approved' | 'closed';
export type LedgerEntryType = 'grn_receipt' | 'grn_qc_reject' | 'rma_return' | 'rma_vendor_return' | 'transfer_out' | 'transfer_in' | 'cycle_count_adjustment' | 'po_reversal' | 'manual_adjustment' | 'pos_sale' | 'pos_void' | 'pick_dispatch' | 'repack_out' | 'repack_in';

export type GrnSourceType = 'po' | 'inbound_order' | 'standalone' | 'pr_direct';

export interface GRNLine {
  id: string;
  grn_id: string;
  product_id: string;
  sku: string;
  name_th: string;
  qty_received: number;
  unit_cost: number;
  line_total: number;
  po_line_item_id: string | null;
  pr_line_item_id: string | null;
  source_type: GrnSourceType;
}

export interface GRNDetail {
  id: string;
  grn_number: string;
  source_type: GrnSourceType;
  status: GrnStatus;
  vendor_id: string | null;
  vendor_name: string | null;
  warehouse_id: string;
  warehouse_name: string;
  po_id: string | null;
  po_number: string | null;
  pr_id: string | null;
  pr_number: string | null;
  received_date: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  lines: GRNLine[];
}

export type PosSessionStatus = 'open' | 'closed';
export type PosTransactionStatus = 'completed' | 'voided';
export type PosPaymentMethod = 'cash' | 'card' | 'mixed';

export interface PosSession {
  id: string;
  session_number: string;
  warehouse_id: string;
  warehouse_name_th: string;
  warehouse_name_en: string;
  opened_by: string;
  opened_by_name: string;
  closed_by: string | null;
  status: PosSessionStatus;
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
  payment_method: PosPaymentMethod;
  cash_tendered: number | null;
  card_amount: number | null;
  change_given: number;
  status: PosTransactionStatus;
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

export type SqStatus = 'draft' | 'sent' | 'accepted' | 'converted_to_so' | 'rejected' | 'expired';
export type SoStatus = 'draft' | 'confirmed' | 'partially_delivered' | 'fully_delivered' | 'invoiced' | 'paid' | 'closed' | 'cancelled';
export type DoStatus = 'draft' | 'ready' | 'shipped' | 'delivered' | 'cancelled';
export type SiStatus = 'draft' | 'issued' | 'paid' | 'void';
export type SrStatus = 'open' | 'received' | 'restocked' | 'disposed';

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

export interface SalesQuotation {
  id: string;
  sq_number: string;
  customer_id: string;
  customer_name_th: string;
  warehouse_id: string;
  warehouse_name_th: string;
  status: SqStatus;
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

export interface SalesOrder {
  id: string;
  so_number: string;
  customer_id: string;
  customer_name_th: string;
  warehouse_id: string;
  warehouse_name_th: string;
  status: SoStatus;
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

export interface DeliveryOrder {
  id: string;
  do_number: string;
  so_id: string;
  so_number: string;
  customer_name_th: string;
  warehouse_id: string;
  warehouse_name_th: string;
  status: DoStatus;
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

export interface SalesInvoice {
  id: string;
  si_number: string;
  so_id: string;
  so_number: string;
  delivery_order_id: string | null;
  do_number: string | null;
  customer_id: string;
  customer_name_th: string;
  status: SiStatus;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  paid_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  notes: string | null;
  created_by: string;
  created_by_name: string;
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

export interface SalesReturn {
  id: string;
  sr_number: string;
  so_id: string | null;
  so_number: string | null;
  customer_id: string;
  customer_name_th: string;
  warehouse_id: string;
  warehouse_name_th: string;
  status: SrStatus;
  reason: string | null;
  received_at: string | null;
  restocked_at: string | null;
  notes: string | null;
  lines?: SrLineItem[];
  created_by: string;
  created_at: string;
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

export interface StockBalance {
  warehouse_id: string;
  product_id: string;
  qty_on_hand: string;
  qty_reserved: string;
  qty_available: string;
  last_updated: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface InboundOrder {
  id: string;
  io_number: string;
  vendor_id: string;
  vendor_name: string;
  vendor_code: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  status: InboundOrderStatus;
  order_date: string;
  notes: string | null;
  vendor_ref: string | null;
  verified_by: string | null;
  verified_by_name: string | null;
  verified_at: string | null;
  verification_notes: string | null;
  line_count: number;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type NormalBalanceType = 'debit' | 'credit';
export type FiscalPeriodStatus = 'open' | 'closed' | 'locked';
export type JournalEntryStatus = 'draft' | 'posted' | 'void';
export type JournalEntryType = 'manual' | 'ap_payment' | 'ar_receipt' | 'pos_sale' | 'so_delivery' | 'grn_receipt' | 'inventory_adjustment' | 'opening_balance';

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

export interface ApInvoiceAgingRow {
  vendor_name_th: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  days_overdue: number;
  bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+';
}

export type EmploymentType = 'full_time' | 'part_time' | 'contract';
export type EmployeeStatus = 'active' | 'inactive' | 'resigned';

export interface Department {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  parent_id: string | null;
  manager_id: string | null;
  manager_name_th?: string;
  manager_name_en?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  department_id: string | null;
  department_name_th?: string;
  salary_grade_id: string | null;
  salary_grade_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalaryGrade {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  base_salary_min: number;
  base_salary_max: number;
  created_at: string;
  updated_at: string;
}

export interface HrEmployee {
  id: string;
  employee_id: string | null;
  name_th: string;
  name_en: string;
  email: string;
  role: string;
  department_id: string | null;
  department_name_th: string | null;
  department_name_en: string | null;
  position_id: string | null;
  position_name_th: string | null;
  position_name_en: string | null;
  salary_grade_id: string | null;
  salary_grade_name: string | null;
  base_salary: number | null;
  employment_type: EmploymentType;
  employee_status: EmployeeStatus;
  hired_date: string | null;
  resignation_date: string | null;
  phone: string | null;
  created_at: string;
}

export type LeaveRequestStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveType {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  days_per_year: number;
  is_paid: boolean;
  carry_over: boolean;
  is_active: boolean;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  leave_type_name_th: string;
  leave_type_name_en: string;
  year: number;
  days_entitled: number;
  days_used: number;
  days_remaining: number;
}

export interface LeaveRequest {
  id: string;
  request_number: string;
  employee_id: string;
  employee_name_th: string;
  employee_name_en: string;
  leave_type_id: string;
  leave_type_name_th: string;
  leave_type_name_en: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  status: LeaveRequestStatus;
  approved_by: string | null;
  approved_by_name_th: string | null;
  approved_by_name_en: string | null;
  approved_at: string | null;
  notes: string | null;
  reject_reason: string | null;
  created_at: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'holiday';

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name_th?: string;
  employee_name_en?: string;
  employee_code?: string;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: AttendanceStatus;
  ot_hours: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkSchedule {
  id: string;
  name_th: string;
  name_en: string;
  shift_start: string;
  shift_end: string;
  days_of_week: number[];
  is_default: boolean;
  is_active: boolean;
}

export type PayrollRunStatus = 'draft' | 'processing' | 'approved' | 'paid' | 'void';

export interface PayrollAllowance {
  name_th: string;
  name_en: string;
  amount: number;
}

export interface PayrollLine {
  id: string;
  run_id: string;
  employee_id: string;
  employee_name_th: string;
  employee_name_en: string;
  employee_id_code: string | null;
  base_salary: number;
  allowances: PayrollAllowance[];
  ot_pay: number;
  absence_deduction: number;
  gross_pay: number;
  sso_employee: number;
  sso_employer: number;
  taxable_income: number;
  income_tax: number;
  total_deductions: number;
  net_pay: number;
  slip_url: string | null;
}

export interface PayrollRun {
  id: string;
  run_number: string;
  period_month: number;
  period_year: number;
  status: PayrollRunStatus;
  total_gross: number;
  total_net: number;
  total_sso_emp: number;
  total_sso_co: number;
  total_tax: number;
  approved_by: string | null;
  approved_by_name_th: string | null;
  approved_by_name_en: string | null;
  approved_at: string | null;
  journal_entry_id: string | null;
  created_by: string;
  created_by_name_th: string | null;
  created_by_name_en: string | null;
  created_at: string;
  lines?: PayrollLine[];
}

export type BomType = 'manufacturing' | 'kit';
export type ProductUomType = 'purchase' | 'sales' | 'other';

export interface ProductUom {
  id: string;
  product_id: string;
  uom_id: string;
  uom_code: string;
  uom_name_th: string;
  uom_name_en: string;
  uom_type: 'purchase' | 'sales' | 'other';
  barcode_label: string | null;
  is_active: boolean;
  is_base_unit?: boolean;
  // joined from uom_conversions
  factor: number | null;
  conversion_factor?: number | null;
  base_uom_code: string | null;
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
  // joined from uom_conversions (present in admin API responses)
  factor?: number | null;
  base_uom_id?: string | null;
  base_uom_code?: string | null;
}

export interface UomConversion {
  id: string;
  uom_id: string;
  uom_code: string;
  base_uom_id: string;
  base_uom_code: string;
  factor: number;
  notes: string | null;
  created_at: string;
}

export interface BomLine {
  id: string;
  bom_id: string;
  line_number: number;
  component_id: string;
  component_sku: string;
  component_name_th: string;
  component_name_en: string;
  uom_id: string;
  uom_code: string;
  uom_name_th: string;
  qty_required: number;
  scrap_pct: number;
  qty_effective: number; // computed: qty_required / (1 - scrap_pct/100)
  notes: string | null;
}

export interface BomHeader {
  id: string;
  bom_number: string;
  product_id: string;
  product_sku: string;
  product_name_th: string;
  product_name_en: string;
  uom_id: string;
  uom_code: string;
  output_qty: number;
  bom_type: BomType;
  version: number;
  is_active: boolean;
  notes: string | null;
  line_count?: number;
  lines?: BomLine[];
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export type PickListStatus = 'draft' | 'open' | 'picking' | 'completed' | 'cancelled';
export type PickLineStatus = 'pending' | 'picked' | 'short_picked';
export type ShipmentStatus = 'pending' | 'shipped' | 'delivered';

export interface PickList {
  id: string;
  pick_number: string;
  sales_order_id: string | null;
  so_number?: string | null;
  warehouse_id: string;
  warehouse_name?: string;
  status: PickListStatus;
  assigned_to: string | null;
  assigned_to_name?: string | null;
  created_by: string;
  created_by_name?: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lines?: PickListLine[];
}

export interface PickListLine {
  id: string;
  pick_list_id: string;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  qty_requested: number;
  qty_picked: number;
  storage_location: string | null;
  status: PickLineStatus;
  qty_available?: number;
  qty_on_hand?: number;
  created_at: string;
  updated_at: string;
}

export interface Shipment {
  id: string;
  shipment_number: string;
  pick_list_id: string;
  pick_number?: string;
  warehouse_id: string;
  warehouse_name?: string;
  shipped_by: string | null;
  shipped_by_name?: string | null;
  ship_date: string | null;
  carrier: string | null;
  tracking_number: string | null;
  notes: string | null;
  status: ShipmentStatus;
  created_at: string;
  updated_at: string;
  lines?: PickListLine[];
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
  // invoice-level detail properties
  invoice_number?: string;
  due_date?: string;
  amount?: number;
  days_overdue?: number;
  bucket?: 'current' | '1-30' | '31-60' | '61-90' | '90+';
}

export interface POLineItem {
  id: string;
  po_id: string;
  product_id: string;
  sku: string;
  name_th: string;
  name_en: string;
  qty_ordered: number;
  qty_received: number;
  unit_price: number;
  line_discount: number;
  line_total: number;
  line_number: number;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_id: string;
  vendor_code: string;
  vendor_name: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  status: PoStatus;
  subtotal: number;
  bill_discount: number;
  non_vat_amount: number;
  pre_vat_amount: number;
  vat_amount: number;
  total_amount: number;
  include_vat: boolean;
  doc_date: string | null;
  expiry_date: string | null;
  delivery_date: string | null;
  from_address: string | null;
  to_address: string | null;
  reference: string | null;
  notes: string | null;
  expected_date: string | null;
  payment_terms_days: number;
  approved_by: string | null;
  approved_at: string | null;
  approved_by_name?: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  lines?: POLineItem[];
  grns?: any[];
  invoices?: any[];
}

export type RepackStatus = 'draft' | 'completed' | 'void';

export interface RepackTemplateItem {
  id: string;
  template_id: string;
  product_id: string;
  product_sku?: string;
  product_name_th?: string;
  qty_ratio: number;
  notes: string | null;
}

export interface RepackTemplate {
  id: string;
  name: string;
  source_product_id: string;
  source_product_sku?: string;
  source_product_name_th?: string;
  source_qty: number;
  notes: string | null;
  is_active: boolean;
  items?: RepackTemplateItem[];
  created_at: string;
  updated_at: string;
}

export interface RepackOrderItem {
  id: string;
  repack_order_id: string;
  product_id: string;
  product_sku?: string;
  product_name_th?: string;
  qty: number;
  unit_cost: number;
  notes: string | null;
}

export interface RepackOrder {
  id: string;
  order_number: string;
  source_product_id: string;
  source_product_sku?: string;
  source_product_name_th?: string;
  source_qty: number;
  source_unit_cost: number | null;
  warehouse_id: string;
  warehouse_name_th?: string;
  status: RepackStatus;
  notes: string | null;
  created_by: string;
  created_by_name?: string;
  completed_at: string | null;
  items?: RepackOrderItem[];
  created_at: string;
  updated_at: string;
}


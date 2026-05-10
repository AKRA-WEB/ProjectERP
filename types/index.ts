export type UserRole = 'admin' | 'manager' | 'staff';
export type RmaCondition = 'resaleable' | 'repack_resell' | 'damaged_return_vendor';
export type RmaStatus = 'open' | 'in_review' | 'resolved' | 'closed';
export type ClaimStatus = 'open' | 'in_review' | 'resolved' | 'closed';
export type ClaimResolutionType = 'credit_note' | 'replacement_shipment' | 'both';
export type TransferStatus = 'pending' | 'completed' | 'cancelled';
export type InboundOrderStatus = 'open' | 'receiving' | 'pending_verification' | 'verified' | 'closed';
export type GrnStatus = 'draft' | 'received' | 'verified' | 'qc_pending' | 'qc_passed' | 'qc_failed' | 'stocked';
export type PrStatus = 'draft' | 'submitted' | 'manager_approved' | 'admin_approved' | 'rejected' | 'converted_to_po';
export type PoStatus = 'draft' | 'sent' | 'partially_received' | 'fully_received' | 'invoiced' | 'paid' | 'closed' | 'cancelled';
export type CycleCountStatus = 'open' | 'counting' | 'pending_approval' | 'approved' | 'closed';
export type LedgerEntryType = 'grn_receipt' | 'grn_qc_reject' | 'rma_return' | 'rma_vendor_return' | 'transfer_out' | 'transfer_in' | 'cycle_count_adjustment' | 'po_reversal' | 'manual_adjustment';

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
  unit_cost: number | string;
  uom_id: string | null;
  uom_code: string | null;
  reorder_point: number | string | null;
  is_active: boolean;
  is_lot_tracked: boolean;
  is_serial_tracked: boolean;
  created_at: string;
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

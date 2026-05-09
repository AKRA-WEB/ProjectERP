export type UserRole = 'admin' | 'manager' | 'staff';
export type RmaCondition = 'resaleable' | 'repack_resell' | 'damaged_return_vendor';
export type RmaStatus = 'open' | 'in_review' | 'resolved' | 'closed';
export type ClaimStatus = 'open' | 'in_review' | 'resolved' | 'closed';
export type ClaimResolutionType = 'credit_note' | 'replacement_shipment' | 'both';
export type TransferStatus = 'pending' | 'completed' | 'cancelled';
export type GrnStatus = 'draft' | 'received' | 'qc_pending' | 'qc_passed' | 'qc_failed' | 'stocked';
export type PrStatus = 'draft' | 'submitted' | 'manager_approved' | 'admin_approved' | 'rejected' | 'converted_to_po';
export type PoStatus = 'draft' | 'sent' | 'partially_received' | 'fully_received' | 'invoiced' | 'paid' | 'closed' | 'cancelled';
export type CycleCountStatus = 'open' | 'counting' | 'pending_approval' | 'approved' | 'closed';
export type LedgerEntryType = 'grn_receipt' | 'grn_qc_reject' | 'rma_return' | 'rma_vendor_return' | 'transfer_out' | 'transfer_in' | 'cycle_count_adjustment' | 'po_reversal' | 'manual_adjustment';

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
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name_th: string;
  name_en: string;
  description_th: string | null;
  description_en: string | null;
  category_id: string | null;
  uom_id: string;
  unit_cost: string;
  reorder_point: number;
  is_lot_tracked: boolean;
  is_serial_tracked: boolean;
  is_active: boolean;
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

import { UserRole } from './db';

export interface SessionUser {
  id: string;
  role: UserRole;
  assignedWarehouseIds: string[];
  permissions: string[];
  businessUnitId?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
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
export type LedgerEntryType = 'grn_receipt' | 'grn_qc_reject' | 'rma_return' | 'rma_vendor_return' | 'transfer_out' | 'transfer_in' | 'cycle_count_adjustment' | 'po_reversal' | 'manual_adjustment' | 'pos_sale' | 'pos_void' | 'pick_dispatch' | 'repack_out' | 'repack_in' | 'quarantine_in' | 'quarantine_out' | 'scrap' | 'clearance_move' | 'repack_stage_in' | 'repack_stage_out';

export type PosSessionStatus = 'open' | 'closed';
export type PosTransactionStatus = 'completed' | 'voided';
export type PosPaymentMethod = 'cash' | 'card' | 'mixed';

export type SqStatus = 'draft' | 'sent' | 'accepted' | 'converted_to_so' | 'rejected' | 'expired';
export type SoStatus = 'draft' | 'confirmed' | 'partially_delivered' | 'fully_delivered' | 'invoiced' | 'paid' | 'closed' | 'cancelled';
export type DoStatus = 'draft' | 'ready' | 'shipped' | 'delivered' | 'cancelled';
export type SiStatus = 'draft' | 'issued' | 'paid' | 'void';
export type SrStatus = 'open' | 'received' | 'restocked' | 'disposed';

export type EmploymentType = 'full_time' | 'part_time' | 'contract';
export type EmployeeStatus = 'active' | 'inactive' | 'resigned';
export type LeaveRequestStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'cancelled';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'holiday';
export type PayrollRunStatus = 'draft' | 'processing' | 'approved' | 'paid' | 'void';

export type BomType = 'manufacturing' | 'kit';
export type ProductUomType = 'purchase' | 'sales' | 'other';

export type PickListStatus = 'draft' | 'open' | 'picking' | 'completed' | 'cancelled';
export type PickLineStatus = 'pending' | 'picked' | 'short_picked';
export type ShipmentStatus = 'pending' | 'shipped' | 'delivered';

export type RepackStatus = 'draft' | 'completed' | 'void';

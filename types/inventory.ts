import { GrnStatus, PoStatus, PrStatus, InboundOrderStatus, PickListStatus, PickLineStatus, ShipmentStatus, RepackStatus, BomType } from './api';

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

export interface StockBalance {
  warehouse_id: string;
  product_id: string;
  qty_on_hand: string;
  qty_reserved: string;
  qty_available: string;
  last_updated: string;
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
  grns?: GRNDetail[];
  invoices?: ApInvoiceSummary[];
}

export interface ApInvoiceSummary {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  paid_amount?: number | string;
  is_paid: boolean;
  status?: string;
}

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
  lot_id?: string | null;
  suggested_lot_number?: string | null;
  suggested_expiry?: string | null;
  fefo_override_jti?: string | null;
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
  name_th: string;
  name_en: string | null;
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
  yield_loss_qty: number;
  yield_loss_reason: string | null;
  closed_je_id: string | null;
  created_by: string;
  created_by_name?: string;
  completed_at: string | null;
  items?: RepackOrderItem[];
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
  qty_effective: number;
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
  factor: number | null;
  conversion_factor?: number | null;
  base_uom_code: string | null;
}

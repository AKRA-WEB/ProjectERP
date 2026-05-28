'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, StatusBadge, Badge, Input, Modal, ModalHeader, ModalBody, ModalFooter, Select, useToast } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import { formatDate, formatQty, formatCurrency } from '@/lib/format';
import { useSession } from 'next-auth/react';
import type { GrnStatus, Vendor, PaginatedResponse } from '@/types';
import Link from 'next/link';
import { Search, ScanLine, Plus, Trash2, ShoppingCart, ChevronDown, Printer } from 'lucide-react';

const LABEL_CLS = "block text-[13px] font-medium text-stone-500 mb-1";
const FIELD_CLS = "w-full bg-white border border-stone-200 rounded-[7px] px-3 py-2 text-[14px] outline-none focus:border-emerald-500 transition-colors";

interface ExtraLine {
  product_id: string;
  sku: string;
  name_th: string;
  qty_received: number;
  storage_location: string;
}

interface ProductSearchResult {
  id: string;
  sku: string;
  name_th: string;
}

interface Warehouse {
  id: string;
  code: string;
  name_th: string;
}

interface GRNLine {
  id: string;
  line_number: number;
  sku: string;
  name_th: string;
  qty_expected: number | null;
  qty_received: number;
  qty_accepted: number | null;
  qty_rejected: number | null;
  uom_code: string;
  lot_number: string | null;
  storage_location: string | null;
  qc_status: string | null;
  qc_notes: string | null;
  unit_cost: number;
  line_total: number;
}

interface GRNDetail {
  id: string;
  grn_number: string;
  status: GrnStatus;
  source_type: string;
  po_id: string | null;
  po_number: string | null;
  io_number: string | null;
  inbound_order_id: string | null;
  vendor_id: string | null;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  received_by_name: string;
  received_date: string;
  lines: GRNLine[];
}

interface QCLineUpdate {
  id: string;
  qty_accepted: number;
  qty_rejected: number;
  qc_status: string;
  qc_notes: string;
}

export default function GRNDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const toast = useToast();
  const [grn, setGrn] = useState<GRNDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const [qcLines, setQcLines] = useState<QCLineUpdate[]>([]);
  const [showQC, setShowQC] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [qcNotes, setQcNotes] = useState('');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [headerExpanded, setHeaderExpanded] = useState(false);

  // Retrospective PO States
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [poData, setPoData] = useState({
    vendor_id: '',
    payment_terms_days: 0,
    notes: '',
  });

  // Work Card States
  const [extraLines, setExtraLines] = useState<ExtraLine[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [workCard, setWorkCard] = useState({
    delivery_date: new Date().toISOString().split('T')[0],
    receiver_name: '',
    warehouse_id: '',
    lines: [] as { id: string; qty_received: number; storage_location: string }[],
  });

  // Reversal States
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [blockingTransactions, setBlockingTransactions] = useState<Array<{ type: string; id: string }>>([]);
  const [showConsumptionModal, setShowConsumptionModal] = useState(false);

  const fetchGRN = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get<GRNDetail>(`/api/grn/${id}`);
      setGrn(data);
      setQcLines(data.lines?.map((l) => ({
        id: l.id,
        qty_accepted: l.qty_accepted ?? l.qty_received,
        qty_rejected: l.qty_rejected ?? 0,
        qc_status: l.qc_status ?? 'pass',
        qc_notes: l.qc_notes ?? '',
      })) ?? []);

      // Initialize Work Card
      setWorkCard((wc) => ({
        ...wc,
        warehouse_id: data.warehouse_id,
        receiver_name: data.received_by_name ?? '',
        lines: data.lines.map((l) => ({
          id: l.id,
          qty_received: data.status === 'draft' ? 0 : l.qty_received,
          storage_location: l.storage_location ?? '',
        })),
      }));

      // Set initial PO data if vendor exists
      if (data.vendor_id) {
        setPoData(prev => ({ ...prev, vendor_id: data.vendor_id || '' }));
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchGRN(); }, [fetchGRN]);

  useEffect(() => {
    get<Warehouse[]>('/api/admin/warehouses').then(setWarehouses).catch(() => {});
    get<PaginatedResponse<Vendor>>('/api/vendors?limit=100').then((r) => setVendors(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!productSearch.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await get<{ data: ProductSearchResult[] }>(
          `/api/products?search=${encodeURIComponent(productSearch)}&limit=10`
        );
        setSearchResults(res.data ?? []);
      } catch (e) {
        console.error('Search error', e);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [productSearch]);

  function addExtraLine(p: ProductSearchResult) {
    setExtraLines((prev) => [...prev, {
      product_id: p.id, sku: p.sku, name_th: p.name_th,
      qty_received: 1, storage_location: '',
    }]);
    setProductSearch('');
    setSearchResults([]);
  }

  async function action(path: string, body: object = {}) {
    setError('');
    setActing(true);
    try {
      await post(`/api/grn/${id}/${path}`, body);
      await fetchGRN();
      setShowQC(false);
      setShowVerify(false);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message ?? 'เกิดข้อผิดพลาด');
    } finally {
      setActing(false);
    }
  }

  async function handleReceive() {
    setError('');
    setActing(true);
    try {
      await post(`/api/grn/${id}/receive`, {
        delivery_date: workCard.delivery_date,
        receiver_name: workCard.receiver_name || undefined,
        warehouse_id: workCard.warehouse_id !== grn?.warehouse_id ? workCard.warehouse_id : undefined,
        lines: workCard.lines,
        extra_lines: extraLines.length > 0
          ? extraLines.map((l) => ({
              product_id: l.product_id,
              qty_received: l.qty_received,
              storage_location: l.storage_location || undefined,
            }))
          : undefined,
      });
      await fetchGRN();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message ?? 'เกิดข้อผิดพลาด');
    } finally {
      setActing(false);
    }
  }

  async function handleCreatePO() {
    if (!poData.vendor_id) { setError('กรุณาเลือกผู้จำหน่าย'); return; }
    setError('');
    setActing(true);
    try {
      const result = await post<{ po_id: string; po_number: string }>(`/api/grn/${id}/create-po`, poData);
      toast('success', `สร้าง PO เลขที่ ${result.po_number} แล้ว`);
      setShowCreatePO(false);
      await fetchGRN();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message ?? 'เกิดข้อผิดพลาด');
    } finally {
      setActing(false);
    }
  }

  async function handleCancel() {
    setError('');
    setActing(true);
    try {
      await post(`/api/grn/${id}/cancel`, { reason: cancelReason || undefined });
      toast('success', 'ยกเลิก GRN และปรับลดยอดสต็อกเรียบร้อยแล้ว');
      setShowCancelModal(false);
      setCancelReason('');
      await fetchGRN();
    } catch (e: unknown) {
      const err = e as { message?: string; status?: number; details?: unknown };
      const details = err.details as { code?: string; blocking_transactions?: Array<{ type: string; id: string }> } | undefined;
      
      if (details?.code === 'CONSUMPTION_EXISTS') {
        setShowCancelModal(false);
        setBlockingTransactions(details.blocking_transactions ?? []);
        setShowConsumptionModal(true);
      } else if (details?.code === 'INVOICE_PAID') {
        setShowCancelModal(false);
        toast('error', err.message ?? 'ใบแจ้งหนี้ชำระแล้ว — กรุณาลงบัญชีแก้ไขผ่านสมุดรายวัน');
      } else {
        toast('error', err.message ?? 'เกิดข้อผิดพลาดในการยกเลิก GRN');
      }
    } finally {
      setActing(false);
    }
  }

  function updateQcLine(i: number, key: keyof QCLineUpdate, val: number | string) {
    setQcLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  }

  if (loading) return <div className="py-16 text-center text-gray-400">กำลังโหลด...</div>;
  if (!grn) return <div className="py-16 text-center text-gray-400">ไม่พบข้อมูล</div>;

  const isManager = session?.user && ['manager', 'admin'].includes((session.user as { role?: string }).role ?? '');
  const canCreatePO = (grn.source_type === 'standalone' || grn.source_type === 'pr_direct') && grn.status === 'stocked' && !grn.po_id;

  return (
    <div className="max-w-5xl pb-24 md:pb-0">
      {/* Mobile Header (md:hidden) */}
      <div className="md:hidden mb-4">
        <button className="text-sm text-gray-500 hover:underline mb-2 flex items-center min-h-[44px]" onClick={() => router.back()}>← ย้อนกลับ</button>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono text-lg font-bold text-gray-900">{grn.grn_number}</span>
              <span className="ml-2 inline-block"><StatusBadge status={grn.status} /></span>
            </div>
            <button
              onClick={() => setHeaderExpanded(v => !v)}
              className="p-2 text-gray-500 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-50"
              aria-label="ขยายรายละเอียด"
            >
              <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${headerExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
          <div className="text-sm text-gray-600 mt-1">คลัง: {grn.warehouse_code} · {formatDate(grn.received_date)}</div>

          {headerExpanded && (
            <div className="mt-3 space-y-2 text-sm text-gray-600 border-t border-gray-100 pt-3">
              <div>
                <span className="text-gray-400">แหล่งที่มา: </span>
                <span className="font-medium text-gray-800 uppercase">{grn.source_type}</span>
              </div>
              <div>
                <span className="text-gray-400">{grn.inbound_order_id ? 'ใบส่งสินค้า (IO): ' : 'ใบสั่งซื้อ (PO): '}</span>
                {grn.inbound_order_id ? (
                  <Link href={`/app/inbound-orders/${grn.inbound_order_id}`} className="font-mono font-medium text-blue-600 hover:underline">{grn.io_number ?? '—'}</Link>
                ) : grn.po_id ? (
                  <Link href={`/app/purchase-orders/${grn.po_id}`} className="font-mono font-medium text-blue-600 hover:underline">{grn.po_number ?? '—'}</Link>
                ) : (
                  <span className="font-medium text-gray-800">—</span>
                )}
              </div>
              <div>
                <span className="text-gray-400">ผู้รับ: </span>
                <span className="font-medium text-gray-800">{grn.received_by_name ?? '—'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Header (hidden md:block) */}
      <div className="hidden md:block">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button className="text-sm text-gray-500 hover:underline mb-1" onClick={() => router.back()}>← ย้อนกลับ</button>
            <h1 className="text-2xl font-bold text-gray-900 font-mono">{grn.grn_number}</h1>
          </div>
          <StatusBadge status={grn.status} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: grn.inbound_order_id ? 'เลข IO' : 'เลข PO', value: grn.io_number ?? grn.po_number, href: grn.inbound_order_id ? `/app/inbound-orders/${grn.inbound_order_id}` : (grn.po_id ? `/app/purchase-orders/${grn.po_id}` : undefined) },
            { label: 'คลังสินค้า', value: `${grn.warehouse_code} — ${grn.warehouse_name}` },
            { label: 'ผู้รับ', value: grn.received_by_name },
            { label: 'วันที่รับ', value: formatDate(grn.received_date) },
          ].map((f) => (
            <div key={f.label} className="rounded-lg bg-white border border-gray-100 p-4">
              <p className="text-xs text-gray-400 mb-1">{f.label}</p>
              {f.href ? (
                <Link href={f.href} className="text-sm font-medium text-blue-600 hover:underline font-mono">{f.value}</Link>
              ) : (
                <p className="text-sm font-medium">{f.value || '—'}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Forms and Tables */}
      {grn.status === 'draft' ? (
        <div className="rounded-xl bg-white shadow-sm border border-emerald-100 p-4 md:p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h2 className="text-lg font-semibold text-emerald-800 flex items-center gap-2">
              <ScanLine className="w-5 h-5" /> บันทึกรับสินค้า (Work Card)
            </h2>
            <div className="w-full md:w-1/3">
              <label className={LABEL_CLS}>คลังรับสินค้า / Receiving Warehouse</label>
              <select
                value={workCard.warehouse_id}
                onChange={(e) => setWorkCard((wc) => ({ ...wc, warehouse_id: e.target.value }))}
                className={`${FIELD_CLS} text-base md:text-[14px]`}
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.code} — {w.name_th}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Desktop Work Card Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm mb-4 border-t border-stone-200">
              <thead className="bg-stone-50">
                <tr>
                  <th className="text-left p-3 font-medium text-stone-600">SKU</th>
                  <th className="text-left p-3 font-medium text-stone-600">สินค้า</th>
                  <th className="text-right p-3 font-medium text-stone-600 w-32">ที่สั่ง / คาดว่าจะรับ</th>
                  <th className="text-right p-3 font-medium text-stone-600 w-32">จำนวนที่รับ</th>
                  <th className="text-left p-3 font-medium text-stone-600 w-40">โลเคชั่น</th>
                </tr>
              </thead>
              <tbody>
                {grn.lines?.map((line) => {
                  const wl = workCard.lines.find(l => l.id === line.id) || { qty_received: 0, storage_location: '' };
                  return (
                    <tr key={line.id} className="border-b border-stone-100">
                      <td className="p-3 font-mono text-xs text-stone-500">{line.sku}</td>
                      <td className="p-3 font-medium text-stone-800">{line.name_th}</td>
                      <td className="p-3 text-right font-mono text-stone-500">
                        {line.qty_expected != null ? formatQty(line.qty_expected) : '—'} <span className="text-[11px] text-stone-400">{line.uom_code}</span>
                      </td>
                      <td className="p-3 text-right">
                        <input
                          type="number" min="0" step="any"
                          value={wl.qty_received || ''}
                          onChange={(e) => setWorkCard(wc => ({
                            ...wc,
                            lines: wc.lines.map(l => l.id === line.id ? { ...l, qty_received: parseFloat(e.target.value) || 0 } : l)
                          }))}
                          className="w-full text-right rounded-[6px] border border-stone-200 px-2 py-1.5 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                        />
                        {wl.qty_received > 0 && line.qty_expected != null && wl.qty_received > line.qty_expected && (
                          <p className="text-[11px] text-amber-600 text-right mt-0.5 tabular-nums">
                            เกินที่สั่ง +{(wl.qty_received - Number(line.qty_expected)).toFixed(0)} {line.uom_code}
                          </p>
                        )}
                      </td>
                      <td className="p-3">
                        <input
                          type="text" placeholder="A-01"
                          value={wl.storage_location}
                          onChange={(e) => setWorkCard(wc => ({
                            ...wc,
                            lines: wc.lines.map(l => l.id === line.id ? { ...l, storage_location: e.target.value } : l)
                          }))}
                          className="w-full rounded-[6px] border border-stone-200 px-2 py-1.5 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Work Card Cards */}
          <div className="md:hidden space-y-3 mb-4">
            {grn.lines?.map((line) => {
              const wl = workCard.lines.find(l => l.id === line.id) || { qty_received: 0, storage_location: '' };
              return (
                <div key={line.id} className="border border-stone-200 rounded-xl p-4 bg-stone-50/50">
                  <div className="font-semibold text-stone-900 text-sm mb-1">{line.name_th}</div>
                  <div className="text-xs text-stone-500 font-mono mb-3">SKU: {line.sku} · สั่ง {line.qty_expected != null ? formatQty(line.qty_expected) : '—'} {line.uom_code}</div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">จำนวนที่รับ *</label>
                      <input
                        type="number" min="0" step="any"
                        value={wl.qty_received || ''}
                        onChange={(e) => setWorkCard(wc => ({
                          ...wc,
                          lines: wc.lines.map(l => l.id === line.id ? { ...l, qty_received: parseFloat(e.target.value) || 0 } : l)
                        }))}
                        className="w-full text-right rounded-lg border border-stone-300 px-3 py-2 text-base bg-white"
                      />
                      {wl.qty_received > 0 && line.qty_expected != null && wl.qty_received > line.qty_expected && (
                        <p className="text-[11px] text-amber-600 text-right mt-0.5 tabular-nums">
                          เกินที่สั่ง +{(wl.qty_received - Number(line.qty_expected)).toFixed(0)}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">ตำแหน่งเก็บ / โลเคชั่น</label>
                      <input
                        type="text" placeholder="เช่น A-01"
                        value={wl.storage_location}
                        onChange={(e) => setWorkCard(wc => ({
                          ...wc,
                          lines: wc.lines.map(l => l.id === line.id ? { ...l, storage_location: e.target.value } : l)
                        }))}
                        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base bg-white"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Extra / bonus items search */}
          <div className="mt-6 mb-2">
            <p className={LABEL_CLS}>เพิ่มสินค้าแถม / สินค้าที่ไม่ได้สั่ง</p>
            <div className="relative">
              <input
                type="text"
                placeholder="ค้นหาสินค้าด้วยชื่อหรือ SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className={`${FIELD_CLS} text-base md:text-[14px]`}
              />
              <Search className="absolute right-3 top-2.5 w-4 h-4 text-stone-400" />
              {searchResults.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded-[7px] shadow-lg text-[13px] max-h-60 overflow-y-auto">
                  {searchResults.map((p) => (
                    <li
                      key={p.id}
                      onClick={() => addExtraLine(p)}
                      className="px-3 py-2.5 cursor-pointer hover:bg-emerald-50 flex items-center gap-3 border-b border-stone-50 last:border-0"
                    >
                      <Plus className="w-4 h-4 text-emerald-500" />
                      <span className="font-mono text-stone-500 text-[11px]">{p.sku}</span>
                      <span className="font-medium">{p.name_th}</span>
                    </li>
                  ))}
                </ul>
              )}
              {searching && (
                <span className="absolute right-10 top-2.5 text-[11px] text-stone-400">กำลังค้นหา…</span>
              )}
            </div>
          </div>

          {extraLines.length > 0 && (
            <>
              {/* Desktop view */}
              <div className="hidden md:block">
                <table className="w-full text-[13px] mb-4 border-t border-dashed border-amber-200 mt-4">
                  <thead className="bg-amber-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-amber-800">สินค้าเพิ่มเติม (ไม่ได้สั่ง)</th>
                      <th className="px-3 py-2 text-right font-medium text-stone-600 w-32">จำนวนที่รับ</th>
                      <th className="px-3 py-2 text-left font-medium text-stone-600 w-40">โลเคชั่น</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {extraLines.map((el, i) => (
                      <tr key={i} className="border-b border-stone-100">
                        <td className="px-3 py-2">
                          <span className="font-mono text-[11px] text-stone-500 block">{el.sku}</span>
                          <span className="font-medium text-stone-800">{el.name_th}</span>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" min="0.01" step="any"
                            value={el.qty_received || ''}
                            onChange={(e) => setExtraLines((prev) =>
                              prev.map((l, idx) => idx === i ? { ...l, qty_received: parseFloat(e.target.value) || 0 } : l)
                            )}
                            className="w-full bg-white border border-stone-200 rounded-[6px] px-2 py-1.5 text-[13px] text-right outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text" placeholder="A-01-02"
                            value={el.storage_location}
                            onChange={(e) => setExtraLines((prev) =>
                              prev.map((l, idx) => idx === i ? { ...l, storage_location: e.target.value } : l)
                            )}
                            className="w-full bg-white border border-stone-200 rounded-[6px] px-2 py-1.5 text-[13px] outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => setExtraLines((prev) => prev.filter((_, idx) => idx !== i))}
                            className="text-red-400 hover:text-red-600 p-1"
                          ><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile view */}
              <div className="md:hidden space-y-3 mb-4">
                <p className="text-sm font-semibold text-amber-800 border-b border-amber-100 pb-2">สินค้าเพิ่มเติม (ไม่ได้สั่ง)</p>
                {extraLines.map((el, i) => (
                  <div key={i} className="border border-amber-200 rounded-xl p-4 bg-amber-50/20 relative">
                    <button
                      onClick={() => setExtraLines((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-2 right-2 text-red-500 hover:text-red-700 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-stone-100/50"
                      aria-label="ลบสินค้า"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                    <div className="font-semibold text-stone-900 text-sm mb-1">{el.name_th}</div>
                    <div className="text-xs text-stone-500 font-mono mb-3">SKU: {el.sku}</div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">จำนวนที่รับ *</label>
                        <input
                          type="number" min="0.01" step="any"
                          value={el.qty_received || ''}
                          onChange={(e) => setExtraLines((prev) =>
                            prev.map((l, idx) => idx === i ? { ...l, qty_received: parseFloat(e.target.value) || 0 } : l)
                          )}
                          className="w-full text-right rounded-lg border border-stone-300 px-3 py-2 text-base bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">ตำแหน่งเก็บ / โลเคชั่น</label>
                        <input
                          type="text" placeholder="เช่น A-01-02"
                          value={el.storage_location}
                          onChange={(e) => setExtraLines((prev) =>
                            prev.map((l, idx) => idx === i ? { ...l, storage_location: e.target.value } : l)
                          )}
                          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex justify-end mt-6">
            <Button onClick={handleReceive} loading={acting} className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white min-h-[44px]">
              รับลงสินค้า
            </Button>
          </div>
        </div>
      ) : showQC ? (
        <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-4 md:p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">QC Review</h2>
          
          {/* Desktop QC Table */}
          <div className="hidden md:block overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2 font-medium">SKU / สินค้า</th>
                  <th className="text-right p-2 font-medium w-24">รับมา</th>
                  <th className="text-right p-2 font-medium w-24">ยอมรับ</th>
                  <th className="text-right p-2 font-medium w-24">ปฏิเสธ</th>
                  <th className="p-2 font-medium w-28">ผล QC</th>
                </tr>
              </thead>
              <tbody>
                {grn.lines?.map((l, i) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-2">
                      <div className="font-mono text-xs">{l.sku}</div>
                      <div>{l.name_th}</div>
                    </td>
                    <td className="p-2 text-right">{l.qty_received}</td>
                    <td className="p-2">
                      <input type="number" min="0" step="any" value={qcLines[i]?.qty_accepted ?? 0}
                        onChange={(e) => updateQcLine(i, 'qty_accepted', parseFloat(e.target.value) || 0)}
                        className="w-full text-right rounded border px-2 py-1" />
                    </td>
                    <td className="p-2">
                      <input type="number" min="0" step="any" value={qcLines[i]?.qty_rejected ?? 0}
                        onChange={(e) => updateQcLine(i, 'qty_rejected', parseFloat(e.target.value) || 0)}
                        className="w-full text-right rounded border px-2 py-1" />
                    </td>
                    <td className="p-2">
                      <select value={qcLines[i]?.qc_status ?? 'pass'}
                        onChange={(e) => updateQcLine(i, 'qc_status', e.target.value)}
                        className="w-full rounded border px-2 py-1 text-sm">
                        <option value="pass">ผ่าน</option>
                        <option value="partial">บางส่วน</option>
                        <option value="fail">ไม่ผ่าน</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile QC Cards */}
          <div className="md:hidden space-y-4 mb-4">
            {grn.lines?.map((l, i) => (
              <div key={l.id} className="border border-stone-200 rounded-xl p-4 bg-stone-50/50">
                <div className="font-semibold text-stone-900 text-sm mb-1">{l.name_th}</div>
                <div className="text-xs text-stone-500 font-mono mb-3">SKU: {l.sku} · รับมา {l.qty_received} {l.uom_code}</div>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">ยอมรับ (Accept) *</label>
                    <input type="number" min="0" step="any" value={qcLines[i]?.qty_accepted ?? 0}
                      onChange={(e) => updateQcLine(i, 'qty_accepted', parseFloat(e.target.value) || 0)}
                      className="w-full text-right rounded-lg border border-stone-300 px-3 py-2 text-base bg-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">ปฏิเสธ (Reject)</label>
                    <input type="number" min="0" step="any" value={qcLines[i]?.qty_rejected ?? 0}
                      onChange={(e) => updateQcLine(i, 'qty_rejected', parseFloat(e.target.value) || 0)}
                      className="w-full text-right rounded-lg border border-stone-300 px-3 py-2 text-base bg-white" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">ผลการตรวจสอบ (QC Status)</label>
                  <select value={qcLines[i]?.qc_status ?? 'pass'}
                    onChange={(e) => updateQcLine(i, 'qc_status', e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base bg-white">
                    <option value="pass">ผ่าน (Pass)</option>
                    <option value="partial">บางส่วน (Partial)</option>
                    <option value="fail">ไม่ผ่าน (Fail)</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <Input label="หมายเหตุ QC" value={qcNotes} onChange={(e) => setQcNotes(e.target.value)} className="text-base" />
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="ghost" onClick={() => setShowQC(false)} className="flex-1 md:flex-initial min-h-[44px]">ยกเลิก</Button>
            <Button onClick={() => action('qc', { qc_notes: qcNotes, lines: qcLines })} loading={acting} className="flex-1 md:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white min-h-[44px]">บันทึก QC</Button>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-xl bg-white shadow-sm border border-gray-100 mb-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium">#</th>
                  <th className="text-left p-3 font-medium">SKU</th>
                  <th className="text-left p-3 font-medium min-w-[200px]">สินค้า</th>
                  <th className="text-right p-3 font-medium">คาดหวัง</th>
                  <th className="text-right p-3 font-medium">รับมา</th>
                  <th className="text-right p-3 font-medium">ยอมรับ</th>
                  <th className="text-right p-3 font-medium">ปฏิเสธ</th>
                  <th className="text-right p-3 font-medium">ต้นทุน</th>
                  <th className="text-right p-3 font-medium">รวม</th>
                  <th className="p-3 font-medium">Lot</th>
                  <th className="p-3 font-medium text-center">QC</th>
                </tr>
              </thead>
              <tbody>
                {grn.lines?.map((l) => (
                  <tr key={l.id} className="border-t hover:bg-gray-50/50">
                    <td className="p-3 text-gray-400">{l.line_number}</td>
                    <td className="p-3 font-mono text-xs">{l.sku}</td>
                    <td className="p-3">{l.name_th}</td>
                    <td className="p-3 text-right text-stone-500">{l.qty_expected != null ? formatQty(l.qty_expected) : '—'}</td>
                    <td className="p-3 text-right">{formatQty(l.qty_received)} {l.uom_code}</td>
                    <td className="p-3 text-right text-green-600">{l.qty_accepted != null ? formatQty(l.qty_accepted) : '—'}</td>
                    <td className="p-3 text-right text-red-500">{l.qty_rejected != null ? formatQty(l.qty_rejected) : '—'}</td>
                    <td className="p-3 text-right font-mono text-stone-600">{formatCurrency(l.unit_cost)}</td>
                    <td className="p-3 text-right font-mono font-medium text-stone-900">{formatCurrency(l.line_total)}</td>
                    <td className="p-3 text-xs text-gray-500 font-mono">{l.lot_number ?? '—'}</td>
                    <td className="p-3 text-center">
                      {l.qc_status ? (
                        <Badge variant={l.qc_status === 'pass' ? 'green' : l.qc_status === 'partial' ? 'yellow' : 'red'}>
                          {l.qc_status}
                        </Badge>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile line cards */}
          <div className="md:hidden space-y-3 mb-6">
            {grn.lines?.map((l) => (
              <div key={l.id} className="border border-stone-200 rounded-xl p-4 bg-white shadow-sm">
                <div className="font-semibold text-stone-900 text-sm mb-1">{l.name_th}</div>
                <div className="text-xs text-stone-500 font-mono mb-3">SKU: {l.sku}</div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[13px] border-t border-stone-100 pt-3">
                  <div>
                    <span className="text-stone-400">สั่ง/รับจริง: </span>
                    <span className="font-medium text-stone-800">{l.qty_expected != null ? formatQty(l.qty_expected) : '—'} / {formatQty(l.qty_received)} {l.uom_code}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-stone-400">ต้นทุน: </span>
                    <span className="font-mono text-stone-800">{formatCurrency(l.unit_cost)}</span>
                  </div>
                  <div>
                    <span className="text-stone-400">QC ผ่าน/เสีย: </span>
                    <span className="font-medium text-emerald-600">{l.qty_accepted != null ? formatQty(l.qty_accepted) : '—'}</span> / <span className="font-medium text-red-500">{l.qty_rejected != null ? formatQty(l.qty_rejected) : '—'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-stone-400">รวมเงิน: </span>
                    <span className="font-mono font-semibold text-stone-900">{formatCurrency(l.line_total)}</span>
                  </div>
                </div>
                {(l.lot_number || l.qc_status) && (
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-stone-50">
                    {l.lot_number && (
                      <span className="text-[11px] font-mono text-stone-600 bg-stone-50 border border-stone-100 rounded px-1.5 py-0.5">
                        Lot: {l.lot_number}
                      </span>
                    )}
                    {l.qc_status && (
                      <Badge variant={l.qc_status === 'pass' ? 'green' : l.qc_status === 'partial' ? 'yellow' : 'red'}>
                        QC: {l.qc_status}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* Action buttons with sticky bottom on mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 p-3 px-4 flex gap-3 justify-end flex-wrap z-10 md:static md:bg-transparent md:border-none md:p-0 md:mt-4">
        <Button
          variant="outline"
          onClick={() => window.print()}
          className="flex items-center gap-2 flex-1 md:flex-initial min-h-[44px]"
        >
          <Printer className="w-4 h-4" /> พิมพ์ / Print
        </Button>

        {canCreatePO && (
          <Button
            onClick={() => setShowCreatePO(true)}
            className="bg-stone-900 hover:bg-stone-800 text-white flex items-center gap-2 flex-1 md:flex-initial min-h-[44px]"
          >
            <ShoppingCart className="w-4 h-4" /> สร้าง PO จาก GR นี้
          </Button>
        )}

        {grn.status === 'received' && isManager && (
          <>
            {grn.inbound_order_id ? (
              <Button onClick={() => setShowVerify(true)} className="flex-1 md:flex-initial min-h-[44px]">
                ✓ ตรวจสอบความถูกต้อง / Verify
              </Button>
            ) : (
              <Button onClick={() => setShowQC(true)} className="flex-1 md:flex-initial min-h-[44px]">
                เริ่ม QC / Quality Control
              </Button>
            )}
          </>
        )}

        {['qc_passed', 'verified'].includes(grn.status) && isManager && (
          <Button onClick={() => action('stock')} loading={acting} className="flex-1 md:flex-initial min-h-[44px]">
            นำเข้าคลัง / Stock In
          </Button>
        )}

        {grn.status === 'stocked' && isManager && (
          <Button
            onClick={() => setShowCancelModal(true)}
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 flex items-center gap-2 flex-1 md:flex-initial min-h-[44px]"
          >
            <Trash2 className="w-4 h-4" /> ยกเลิก GRN / Cancel
          </Button>
        )}
      </div>

      {showVerify && (
        <Modal open={showVerify} onClose={() => setShowVerify(false)} size="md">
          <ModalHeader onClose={() => setShowVerify(false)}>ตรวจสอบการรับสินค้า (IO Flow)</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">กรุณายืนยันว่ารายการสินค้าและจำนวนที่รับเข้ามา ถูกต้องตามใบส่งของ (Delivery Bill) ของผู้จำหน่าย</p>
              <Input label="หมายเหตุการตรวจสอบ (ไม่บังคับ)" value={verifyNotes} onChange={(e) => setVerifyNotes(e.target.value)} placeholder="เช่น ตรวจสอบแล้วตรงตามบิล..." className="text-base" />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowVerify(false)} className="min-h-[44px]">ยกเลิก</Button>
            <Button onClick={() => action('verify', { verification_notes: verifyNotes })} loading={acting} className="min-h-[44px]">ยืนยันความถูกต้อง</Button>
          </ModalFooter>
        </Modal>
      )}

      {showCreatePO && (
        <Modal open={showCreatePO} onClose={() => setShowCreatePO(false)} size="md">
          <ModalHeader onClose={() => setShowCreatePO(false)}>สร้างใบสั่งซื้อย้อนหลัง (Retrospective PO)</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <p className="text-sm text-stone-600">สร้างใบสั่งซื้อเพื่อจับคู่กับยอดรับสินค้านี้ สต็อกจะไม่ถูกเพิ่มซ้ำ</p>
              <Select
                label="ผู้จำหน่าย / Vendor *"
                value={poData.vendor_id}
                onChange={(e) => setPoData(prev => ({ ...prev, vendor_id: e.target.value }))}
                options={vendors.map(v => ({ value: v.id, label: `${v.code} — ${v.name_th}` }))}
                disabled={!!grn.vendor_id}
                className="text-base"
              />
              <Input
                label="เครดิต (จำนวนวัน)"
                type="number"
                value={poData.payment_terms_days}
                onChange={(e) => setPoData(prev => ({ ...prev, payment_terms_days: parseInt(e.target.value) || 0 }))}
                className="text-base"
              />
              <Input
                label="หมายเหตุ PO"
                value={poData.notes}
                onChange={(e) => setPoData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="ระบุเหตุผลหรือเลอ่ะอ้างอิงบิล..."
                className="text-base"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowCreatePO(false)} className="min-h-[44px]">ยกเลิก</Button>
            <Button onClick={handleCreatePO} loading={acting} className="bg-stone-900 text-white min-h-[44px]">ยืนยันสร้าง PO</Button>
          </ModalFooter>
        </Modal>
      )}

      {showCancelModal && (
        <Modal open={showCancelModal} onClose={() => setShowCancelModal(false)} size="md">
          <ModalHeader onClose={() => setShowCancelModal(false)}>ยืนยันการยกเลิกสินค้าเข้าคลัง / Cancel GRN</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-[7px] text-xs leading-relaxed">
                <span className="font-bold block mb-1">คำเตือน: การกระทำนี้ไม่สามารถย้อนกลับได้</span>
                ระบบจะสร้างรายการหักลบในสต็อก และยกเลิกใบแจ้งหนี้คู่ค้า (AP Invoice) ที่เชื่อมโยงอยู่โดยอัตโนมัติ 
                ไม่สามารถยกเลิกได้หากมีการดึงยอดสินค้าไปขายหรือโอนย้ายแล้ว
              </div>
              <Input
                label="ระบุเหตุผลการยกเลิก (Cancel Reason) *"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="ระบุเหตุผลในการยกเลิกรายการนี้..."
                className="text-base"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowCancelModal(false)} className="min-h-[44px]">ยกเลิก</Button>
            <Button 
              onClick={handleCancel} 
              loading={acting} 
              disabled={!cancelReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white min-h-[44px]"
            >
              ยืนยันการยกเลิก GRN
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {showConsumptionModal && (
        <Modal open={showConsumptionModal} onClose={() => setShowConsumptionModal(false)} size="md">
          <ModalHeader onClose={() => setShowConsumptionModal(false)}>ไม่สามารถยกเลิก GRN ได้ / Cannot Cancel GRN</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-[7px] text-sm font-medium">
                ไม่สามารถยกเลิกได้ — มีรายการเบิกจ่ายสินค้าหลังรับสินค้าเข้าคลัง (Outbound stock consumption exists after stocking)
              </div>
              <p className="text-sm text-stone-600 font-medium">รายการที่เบิกจ่ายเพื่อการอ้างอิง:</p>
              <div className="border border-stone-200 rounded-[7px] overflow-hidden max-h-[250px] overflow-y-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-medium">
                      <th className="p-2 pl-3">ประเภทรายการ (Type)</th>
                      <th className="p-2 pr-3">รหัสรายการอ้างอิง (Reference ID / Number)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockingTransactions.map((tx, idx) => (
                      <tr key={idx} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                        <td className="p-2 pl-3 font-semibold text-stone-700">
                          {tx.type === 'pos_sale' ? 'POS Sale' : tx.type === 'so_delivery' ? 'SO Delivery' : tx.type === 'transfer_out' ? 'Transfer Out' : tx.type}
                        </td>
                        <td className="p-2 pr-3 font-mono text-stone-600">{tx.id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-stone-500">
                หมายเหตุ: กรุณาให้เจ้าหน้าที่บัญชีปรับปรุงบัญชีด้วยตนเองผ่านสมุดรายวันทั่วไป (General Journal)
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setShowConsumptionModal(false)} className="min-h-[44px] w-full md:w-auto">ตกลง / Close</Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}

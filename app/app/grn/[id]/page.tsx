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
import { useT } from '@/lib/i18n';

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
  const t = useT();
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
      setError(err.message ?? t('error.generic'));
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
      setError(err.message ?? t('error.generic'));
    } finally {
      setActing(false);
    }
  }

  async function handleCreatePO() {
    if (!poData.vendor_id) { setError(t('error.select_vendor')); return; }
    setError('');
    setActing(true);
    try {
      const result = await post<{ po_id: string; po_number: string }>(`/api/grn/${id}/create-po`, poData);
      toast('success', t('msg.create_po_success_prefix') + result.po_number + t('msg.create_po_success_suffix'));
      setShowCreatePO(false);
      await fetchGRN();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message ?? t('error.generic'));
    } finally {
      setActing(false);
    }
  }

  async function handleCancel() {
    setError('');
    setActing(true);
    try {
      await post(`/api/grn/${id}/cancel`, { reason: cancelReason || undefined });
      toast('success', t('msg.cancel_grn_success'));
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
        toast('error', err.message ?? t('msg.invoice_paid_error'));
      } else {
        toast('error', err.message ?? t('error.cancel_grn'));
      }
    } finally {
      setActing(false);
    }
  }

  function updateQcLine(i: number, key: keyof QCLineUpdate, val: number | string) {
    setQcLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  }

  if (loading) return <div className="py-16 text-center text-gray-400">{t('label.loading')}</div>;
  if (!grn) return <div className="py-16 text-center text-gray-400">{t('label.no_data')}</div>;

  const isManager = session?.user && ['manager', 'admin'].includes((session.user as { role?: string }).role ?? '');
  const canCreatePO = (grn.source_type === 'standalone' || grn.source_type === 'pr_direct') && grn.status === 'stocked' && !grn.po_id;

  return (
    <div className="max-w-5xl pb-24 md:pb-0">
      {/* Mobile Header (md:hidden) */}
      <div className="md:hidden mb-4">
        <button className="text-sm text-gray-500 hover:underline mb-2 flex items-center min-h-[44px]" onClick={() => router.back()}>← {t('action.back')}</button>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono text-lg font-bold text-gray-900">{grn.grn_number}</span>
              <span className="ml-2 inline-block"><StatusBadge status={grn.status} /></span>
            </div>
            <button
              onClick={() => setHeaderExpanded(v => !v)}
              className="p-2 text-gray-500 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-50"
              aria-label={t('action.expand_details')}
            >
              <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${headerExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
          <div className="text-sm text-gray-600 mt-1">{t('label.warehouse_colon')}{grn.warehouse_code} · {formatDate(grn.received_date)}</div>

          {headerExpanded && (
            <div className="mt-3 space-y-2 text-sm text-gray-600 border-t border-gray-100 pt-3">
              <div>
                <span className="text-gray-400">{t('label.source_colon')}</span>
                <span className="font-medium text-gray-800 uppercase">{grn.source_type}</span>
              </div>
              <div>
                <span className="text-gray-400">{grn.inbound_order_id ? t('label.delivery_bill_io_colon') : t('label.purchase_order_po_colon')}</span>
                {grn.inbound_order_id ? (
                  <Link href={`/app/inbound-orders/${grn.inbound_order_id}`} className="font-mono font-medium text-blue-600 hover:underline">{grn.io_number ?? '—'}</Link>
                ) : grn.po_id ? (
                  <Link href={`/app/purchase-orders/${grn.po_id}`} className="font-mono font-medium text-blue-600 hover:underline">{grn.po_number ?? '—'}</Link>
                ) : (
                  <span className="font-medium text-gray-800">—</span>
                )}
              </div>
              <div>
                <span className="text-gray-400">{t('label.receiver_colon')}</span>
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
            <button className="text-sm text-gray-500 hover:underline mb-1" onClick={() => router.back()}>← {t('action.back')}</button>
            <h1 className="text-2xl font-bold text-gray-900 font-mono">{grn.grn_number}</h1>
          </div>
          <StatusBadge status={grn.status} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: grn.inbound_order_id ? t('label.io_number') : t('label.po_number_short'), value: grn.io_number ?? grn.po_number, href: grn.inbound_order_id ? `/app/inbound-orders/${grn.inbound_order_id}` : (grn.po_id ? `/app/purchase-orders/${grn.po_id}` : undefined) },
            { label: t('label.warehouse'), value: `${grn.warehouse_code} — ${grn.warehouse_name}` },
            { label: t('label.receiver'), value: grn.received_by_name },
            { label: t('label.received_date'), value: formatDate(grn.received_date) },
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
              <ScanLine className="w-5 h-5" /> {t('title.record_receiving_work_card')}
            </h2>
            <div className="w-full md:w-1/3">
              <label className={LABEL_CLS}>{t('label.receiving_warehouse')}</label>
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
                  <th className="text-left p-3 font-medium text-stone-600">{t('label.product')}</th>
                  <th className="text-right p-3 font-medium text-stone-600 w-32">{t('label.qty_ordered_expected')}</th>
                  <th className="text-right p-3 font-medium text-stone-600 w-32">{t('label.received_qty')}</th>
                  <th className="text-left p-3 font-medium text-stone-600 w-40">{t('label.location')}</th>
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
                            {t('label.exceeded_by')}+{((wl.qty_received - Number(line.qty_expected))).toFixed(0)} {line.uom_code}
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
                  <div className="text-xs text-stone-500 font-mono mb-3">SKU: {line.sku} · {t('label.ordered_prefix')}{line.qty_expected != null ? formatQty(line.qty_expected) : '—'} {line.uom_code}</div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">{t('label.received_qty_required')}</label>
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
                          {t('label.exceeded_by')}+{((wl.qty_received - Number(line.qty_expected))).toFixed(0)}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">{t('label.storage_location_or_location')}</label>
                      <input
                        type="text" placeholder={t('placeholder.location_example')}
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
            <p className={LABEL_CLS}>{t('label.add_bonus_or_unordered_items')}</p>
            <div className="relative">
              <input
                type="text"
                placeholder={t('placeholder.search_product_sku')}
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
                <span className="absolute right-10 top-2.5 text-[11px] text-stone-400">{t('msg.searching')}</span>
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
                      <th className="px-3 py-2 text-left font-medium text-amber-800">{t('label.extra_unordered_items')}</th>
                      <th className="px-3 py-2 text-right font-medium text-stone-600 w-32">{t('label.received_qty')}</th>
                      <th className="px-3 py-2 text-left font-medium text-stone-600 w-40">{t('label.location')}</th>
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
                            aria-label={t('action.delete_product')}
                          ><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile view */}
              <div className="md:hidden space-y-3 mb-4">
                <p className="text-sm font-semibold text-amber-800 border-b border-amber-100 pb-2">{t('label.extra_unordered_items')}</p>
                {extraLines.map((el, i) => (
                  <div key={i} className="border border-amber-200 rounded-xl p-4 bg-amber-50/20 relative">
                    <button
                      onClick={() => setExtraLines((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-2 right-2 text-red-500 hover:text-red-700 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-stone-100/50"
                      aria-label={t('action.delete_product')}
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                    <div className="font-semibold text-stone-900 text-sm mb-1">{el.name_th}</div>
                    <div className="text-xs text-stone-500 font-mono mb-3">SKU: {el.sku}</div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">{t('label.received_qty_required')}</label>
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
                        <label className="text-xs text-gray-500 block mb-1">{t('label.storage_location_or_location')}</label>
                        <input
                          type="text" placeholder={t('placeholder.location_example_2')}
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
              {t('action.receive_goods')}
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
                  <th className="text-left p-2 font-medium">{t('label.sku_product')}</th>
                  <th className="text-right p-2 font-medium w-24">{t('label.received')}</th>
                  <th className="text-right p-2 font-medium w-24">{t('label.accepted')}</th>
                  <th className="text-right p-2 font-medium w-24">{t('label.rejected')}</th>
                  <th className="p-2 font-medium w-28">{t('label.qc_result')}</th>
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
                        <option value="pass">{t('label.qc_status_pass')}</option>
                        <option value="partial">{t('label.qc_status_partial')}</option>
                        <option value="fail">{t('label.qc_status_fail')}</option>
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
                <div className="text-xs text-stone-500 font-mono mb-3">SKU: {l.sku} · {t('label.received_prefix')}{l.qty_received} {l.uom_code}</div>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">{t('label.qc_accept_required')}</label>
                    <input type="number" min="0" step="any" value={qcLines[i]?.qty_accepted ?? 0}
                      onChange={(e) => updateQcLine(i, 'qty_accepted', parseFloat(e.target.value) || 0)}
                      className="w-full text-right rounded-lg border border-stone-300 px-3 py-2 text-base bg-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">{t('label.qc_reject')}</label>
                    <input type="number" min="0" step="any" value={qcLines[i]?.qty_rejected ?? 0}
                      onChange={(e) => updateQcLine(i, 'qty_rejected', parseFloat(e.target.value) || 0)}
                      className="w-full text-right rounded-lg border border-stone-300 px-3 py-2 text-base bg-white" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">{t('label.qc_status_label')}</label>
                  <select value={qcLines[i]?.qc_status ?? 'pass'}
                    onChange={(e) => updateQcLine(i, 'qc_status', e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base bg-white">
                    <option value="pass">{t('label.qc_pass_option')}</option>
                    <option value="partial">{t('label.qc_partial_option')}</option>
                    <option value="fail">{t('label.qc_fail_option')}</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <Input label={t('label.qc_notes_label')} value={qcNotes} onChange={(e) => setQcNotes(e.target.value)} className="text-base" />
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="ghost" onClick={() => setShowQC(false)} className="flex-1 md:flex-initial min-h-[44px]">{t('action.cancel')}</Button>
            <Button onClick={() => action('qc', { qc_notes: qcNotes, lines: qcLines })} loading={acting} className="flex-1 md:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white min-h-[44px]">{t('action.save_qc')}</Button>
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
                  <th className="text-left p-3 font-medium min-w-[200px]">{t('label.product')}</th>
                  <th className="text-right p-3 font-medium">{t('label.expected')}</th>
                  <th className="text-right p-3 font-medium">{t('label.received')}</th>
                  <th className="text-right p-3 font-medium">{t('label.accepted')}</th>
                  <th className="text-right p-3 font-medium">{t('label.rejected')}</th>
                  <th className="text-right p-3 font-medium">{t('label.cost')}</th>
                  <th className="text-right p-3 font-medium">{t('label.total')}</th>
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
                    <span className="text-stone-400">{t('label.ordered_vs_received')}</span>
                    <span className="font-medium text-stone-800">{l.qty_expected != null ? formatQty(l.qty_expected) : '—'} / {formatQty(l.qty_received)} {l.uom_code}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-stone-400">{t('label.cost_colon')}</span>
                    <span className="font-mono text-stone-800">{formatCurrency(l.unit_cost)}</span>
                  </div>
                  <div>
                    <span className="text-stone-400">{t('label.qc_pass_fail_colon')}</span>
                    <span className="font-medium text-emerald-600">{l.qty_accepted != null ? formatQty(l.qty_accepted) : '—'}</span> / <span className="font-medium text-red-500">{l.qty_rejected != null ? formatQty(l.qty_rejected) : '—'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-stone-400">{t('label.total_amount_colon')}</span>
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
          <Printer className="w-4 h-4" /> {t('action.print_label')}
        </Button>

        {canCreatePO && (
          <Button
            onClick={() => setShowCreatePO(true)}
            className="bg-stone-900 hover:bg-stone-800 text-white flex items-center gap-2 flex-1 md:flex-initial min-h-[44px]"
          >
            <ShoppingCart className="w-4 h-4" /> {t('action.create_po_from_gr')}
          </Button>
        )}

        {grn.status === 'received' && isManager && (
          <>
            {grn.inbound_order_id ? (
              <Button onClick={() => setShowVerify(true)} className="flex-1 md:flex-initial min-h-[44px]">
                {t('action.verify_correctness')}
              </Button>
            ) : (
              <Button onClick={() => setShowQC(true)} className="flex-1 md:flex-initial min-h-[44px]">
                {t('action.start_qc')}
              </Button>
            )}
          </>
        )}

        {['qc_passed', 'verified'].includes(grn.status) && isManager && (
          <Button onClick={() => action('stock')} loading={acting} className="flex-1 md:flex-initial min-h-[44px]">
            {t('action.stock_in')}
          </Button>
        )}

        {grn.status === 'stocked' && isManager && (
          <Button
            onClick={() => setShowCancelModal(true)}
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 flex items-center gap-2 flex-1 md:flex-initial min-h-[44px]"
          >
            <Trash2 className="w-4 h-4" /> {t('action.cancel_grn_label')}
          </Button>
        )}
      </div>

      {showVerify && (
        <Modal open={showVerify} onClose={() => setShowVerify(false)} size="md">
          <ModalHeader onClose={() => setShowVerify(false)}>{t('title.verify_receiving_io_flow')}</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">{t('msg.confirm_items_qty_correct')}</p>
              <Input label={t('label.verification_notes_optional')} value={verifyNotes} onChange={(e) => setVerifyNotes(e.target.value)} placeholder={t('placeholder.verification_notes_example')} className="text-base" />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowVerify(false)} className="min-h-[44px]">{t('action.cancel')}</Button>
            <Button onClick={() => action('verify', { verification_notes: verifyNotes })} loading={acting} className="min-h-[44px]">{t('action.confirm_correctness')}</Button>
          </ModalFooter>
        </Modal>
      )}

      {showCreatePO && (
        <Modal open={showCreatePO} onClose={() => setShowCreatePO(false)} size="md">
          <ModalHeader onClose={() => setShowCreatePO(false)}>{t('title.create_retrospective_po')}</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <p className="text-sm text-stone-600">{t('msg.create_po_match_receipt')}</p>
              <Select
                label={t('label.vendor_required')}
                value={poData.vendor_id}
                onChange={(e) => setPoData(prev => ({ ...prev, vendor_id: e.target.value }))}
                options={vendors.map(v => ({ value: v.id, label: `${v.code} — ${v.name_th}` }))}
                disabled={!!grn.vendor_id}
                className="text-base"
              />
              <Input
                label={t('label.credit_days')}
                type="number"
                value={poData.payment_terms_days}
                onChange={(e) => setPoData(prev => ({ ...prev, payment_terms_days: parseInt(e.target.value) || 0 }))}
                className="text-base"
              />
              <Input
                label={t('label.po_notes')}
                value={poData.notes}
                onChange={(e) => setPoData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder={t('placeholder.po_notes_example')}
                className="text-base"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowCreatePO(false)} className="min-h-[44px]">{t('action.cancel')}</Button>
            <Button onClick={handleCreatePO} loading={acting} className="bg-stone-900 text-white min-h-[44px]">{t('action.confirm_create_po')}</Button>
          </ModalFooter>
        </Modal>
      )}

      {showCancelModal && (
        <Modal open={showCancelModal} onClose={() => setShowCancelModal(false)} size="md">
          <ModalHeader onClose={() => setShowCancelModal(false)}>{t('title.confirm_cancel_stocked_grn')}</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-[7px] text-xs leading-relaxed">
                <span className="font-bold block mb-1">{t('label.warning_irreversible')}</span>
                {t('msg.cancel_grn_warning_details')}
              </div>
              <Input
                label={t('label.cancel_reason_required')}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={t('placeholder.cancel_reason')}
                className="text-base"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowCancelModal(false)} className="min-h-[44px]">{t('action.cancel')}</Button>
            <Button 
              onClick={handleCancel} 
              loading={acting} 
              disabled={!cancelReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white min-h-[44px]"
            >
              {t('action.confirm_cancel_grn')}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {showConsumptionModal && (
        <Modal open={showConsumptionModal} onClose={() => setShowConsumptionModal(false)} size="md">
          <ModalHeader onClose={() => setShowConsumptionModal(false)}>{t('title.cannot_cancel_grn')}</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-[7px] text-sm font-medium">
                {t('msg.cannot_cancel_consumption_exists')}
              </div>
              <p className="text-sm text-stone-600 font-medium">{t('label.referenced_consumption_items')}</p>
              <div className="border border-stone-200 rounded-[7px] overflow-hidden max-h-[250px] overflow-y-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-medium">
                      <th className="p-2 pl-3">{t('label.transaction_type')}</th>
                      <th className="p-2 pr-3">{t('label.reference_id_number')}</th>
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
                {t('msg.manual_journal_adjustment_note')}
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setShowConsumptionModal(false)} className="min-h-[44px] w-full md:w-auto">{t('action.ok_close')}</Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}

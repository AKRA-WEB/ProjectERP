'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { get, patch, post } from '@/lib/api-client';
import { formatDate, formatQty } from '@/lib/format';

import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import { useToast } from '@/components/ui';
import { useSession } from 'next-auth/react';
import { Loader2, Search, Warehouse as WarehouseIcon, Clock, User, Download, Plus, CornerDownRight } from 'lucide-react';
import type { GRNPageResult, GRNRow } from '@/lib/queries/grn';
import type { WarehouseRow } from '@/lib/queries/admin';
import { useT } from '@/lib/i18n';

interface GRN {
  id: string;
  grn_number: string;
  status: string;
  po_number: string | null;
  io_number?: string | null;
  po_id?: string | null;
  inbound_order_id?: string | null;
  warehouse_code: string;
  warehouse_name: string;
  received_by_name: string;
  received_date: string;
  line_count: number;
  created_at: string;
}

interface GRNDetail extends GRN {
  qc_reviewed_by_name: string | null;
  stocked_by_name: string | null;
  qc_notes: string | null;
  notes: string | null;
  lines: Array<{
    id: string;
    sku: string;
    name_th: string;
    uom_code: string;
    qty_received: string | number;
    qty_accepted: string | number | null;
    qty_rejected: string | number | null;
    lot_number: string | null;
    qc_status: string | null;
  }>;
}

const GRN_STATUSES: Record<string, { cls: string }> = {
  draft:       { cls: 'muted' },
  received:    { cls: 'info' },
  qc_pending:  { cls: 'warn' },
  qc_passed:   { cls: 'ok' },
  qc_failed:   { cls: 'danger' },
  verified:    { cls: 'info' },
  stocked:     { cls: 'ok' },
};

const TABS = [
  { id: '' },
  { id: 'draft' },
  { id: 'received' },
  { id: 'qc_pending' },
  { id: 'qc_passed' },
  { id: 'qc_failed' },
  { id: 'verified' },
  { id: 'stocked' },
];

const PILL_COLORS: Record<string, string> = {
  ok:     'text-emerald-700 border-emerald-200 bg-emerald-50',
  warn:   'text-amber-700 border-amber-300 bg-amber-50',
  danger: 'text-red-700 border-red-200 bg-red-50',
  info:   'text-blue-700 border-blue-200 bg-blue-50',
  muted:  'text-stone-500 border-stone-200 bg-stone-50',
};

function Pill({ status }: { status: string }) {
  const t = useT();
  const s = GRN_STATUSES[status] ?? { cls: 'muted' };
  const labels: Record<string, string> = {
    draft: t('status.draft'),
    received: t('status.received'),
    qc_pending: t('status.qc_pending'),
    qc_passed: t('status.qc_passed'),
    qc_failed: t('status.qc_failed'),
    verified: t('status.verified'),
    stocked: t('status.stocked'),
  };
  return (
    <span className={`inline-flex items-center gap-[5px] px-2 py-[2px] text-[11.5px] font-medium rounded-full border leading-[1.5] whitespace-nowrap before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-current ${PILL_COLORS[s.cls]}`}>
      {labels[status] ?? status}
    </span>
  );
}

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

function GRNDetailModal({
  grn,
  onClose,
  onActionComplete,
  sessionUser
}: {
  grn: GRNDetail;
  onClose: () => void;
  onActionComplete: () => void;
  sessionUser: { role: string } | undefined;
}) {
  const t = useT();
  const [qcNotes, setQcNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleAction = async (action: 'send_qc' | 'qc_approve' | 'qc_reject' | 'stock') => {
    setActionLoading(true);
    try {
      if (action === 'stock') {
        await post(`/api/grn/${grn.id}/stock`, {});
        toast('success', t('msg.grn_stocked_success'));
      } else {
        await patch(`/api/grn/${grn.id}`, { action, qc_notes: qcNotes });
        toast('success', t('msg.update_status_success'));
      }
      onActionComplete();
      onClose();
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : t('msg.transaction_error'));
    } finally {
      setActionLoading(false);
    }
  };

  const isManagerOrAdmin = sessionUser?.role === 'admin' || sessionUser?.role === 'manager';

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(15,23,42,.42)] backdrop-blur-[4px] animate-[fadeIn_.14s_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[14px] shadow-[0_12px_32px_-8px_rgba(15,23,42,.18),0_2px_6px_rgba(15,23,42,.06)] w-[720px] max-w-[calc(100vw-40px)] max-h-[calc(100vh-60px)] flex flex-col overflow-hidden animate-[popIn_.18s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-[22px] py-[18px] pb-[14px] border-b border-stone-100">
          <div>
            <h3 className="flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.01em] text-stone-950">
              <span className="font-mono">{grn.grn_number}</span>
              <Pill status={grn.status} />
            </h3>
            <div className="text-[12px] text-stone-600 mt-0.5">
              {grn.io_number ?? grn.po_number ?? '—'} · {grn.warehouse_name} · {formatDate(grn.received_date)}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-[7px] grid place-items-center text-stone-600 hover:bg-stone-100 hover:text-stone-700"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-[22px] py-[18px] overflow-auto flex flex-col gap-5">
          {/* Info grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { l: grn.inbound_order_id ? t('grn.queue.th_io_num') : t('grn.queue.th_po_num'), v: grn.io_number ?? grn.po_number ?? '—' },
              { l: t('grn.client.th_warehouse'), v: grn.warehouse_name },
              { l: t('grn.modal.receiver'), v: grn.received_by_name },
            ].map((s) => (
              <div key={s.l} className="bg-stone-50 border border-stone-200 rounded-[8px] px-3 py-[10px]">
                <div className="text-[11.5px] text-stone-600 mb-1">{s.l}</div>
                <div className="text-[13px] font-medium text-stone-900 truncate">{s.v || '—'}</div>
              </div>
            ))}
          </div>

          {/* Line items */}
          <div>
            <div className="text-[12px] font-semibold tracking-[.04em] uppercase text-stone-600 mb-2">{t('grn.modal.items_title')}</div>
            <div className={CARD}>
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    {[t('label.sku'), t('label.product'), t('grn.modal.th_received'), t('grn.modal.th_passed'), t('grn.modal.th_rejected'), t('grn.modal.th_unit')].map((h, i) => (
                      <th key={h} className={`text-left py-2.5 px-3.5 text-[11.5px] font-medium tracking-[.04em] uppercase text-stone-600 bg-stone-50 border-b border-stone-200 first:pl-5 last:pr-5 ${i >= 2 ? 'text-right' : ''}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grn.lines.map((l, idx) => (
                    <tr key={idx} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                      <td className="py-0 h-10 px-3.5 pl-5 font-mono text-[12.5px] text-stone-700">{l.sku}</td>
                      <td className="py-0 h-10 px-3.5">
                        <div className="truncate max-w-[180px]">{l.name_th}</div>
                        {l.lot_number && <div className="text-[11px] text-stone-600 font-mono">Lot: {l.lot_number}</div>}
                      </td>
                      <td className="py-0 h-10 px-3.5 text-right font-mono tabular-nums">{formatQty(l.qty_received)}</td>
                      <td className="py-0 h-10 px-3.5 text-right font-mono tabular-nums text-emerald-700">{l.qty_accepted != null ? formatQty(l.qty_accepted) : '—'}</td>
                      <td className="py-0 h-10 px-3.5 text-right font-mono tabular-nums text-red-600">{l.qty_rejected != null ? formatQty(l.qty_rejected) : '—'}</td>
                      <td className="py-0 h-10 px-3.5 pr-5 text-right text-stone-600">{l.uom_code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {grn.qc_notes && (
            <div>
              <div className="text-[12px] font-semibold tracking-[.04em] uppercase text-stone-600 mb-1">{t('grn.modal.qc_notes_title')}</div>
              <p className="text-[13px] text-stone-600 bg-stone-50 rounded-[8px] px-3 py-2.5 border border-stone-200">{grn.qc_notes}</p>
            </div>
          )}

          {/* QC action panel inside modal */}
          {grn.status === 'qc_pending' && isManagerOrAdmin && (
            <div className="flex flex-col gap-2 w-full mt-2 border-t border-stone-100 pt-4">
              <div className="text-[12px] font-semibold text-stone-600">{t('grn.modal.specify_qc_notes')}</div>
              <textarea
                value={qcNotes}
                onChange={(e) => setQcNotes(e.target.value)}
                placeholder={t('grn.modal.qc_notes_placeholder')}
                className="w-full text-xs p-2.5 border border-stone-200 rounded-[6px] focus:outline-none focus:border-stone-400 bg-stone-50 transition-colors"
                rows={2}
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => handleAction('qc_reject')}
                  disabled={actionLoading}
                  className="h-8 px-4 rounded-[7px] text-[13px] font-medium text-white bg-red-600 hover:bg-red-700 shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {t('grn.modal.btn_qc_reject')}
                </button>
                <button
                  onClick={() => handleAction('qc_approve')}
                  disabled={actionLoading}
                  className="h-8 px-4 rounded-[7px] text-[13px] font-medium text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {t('grn.modal.btn_qc_approve')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-[22px] py-[14px] border-t border-stone-100 bg-stone-50/60">
          <div className="flex gap-2">
            {grn.status === 'received' && (
              <button
                onClick={() => handleAction('send_qc')}
                disabled={actionLoading}
                className="h-8 px-3 rounded-[7px] text-[13px] font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {t('grn.modal.btn_send_qc')}
              </button>
            )}
            {grn.status === 'qc_passed' && isManagerOrAdmin && (
              <button
                onClick={() => handleAction('stock')}
                disabled={actionLoading}
                className="h-8 px-3 rounded-[7px] text-[13px] font-medium text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {t('grn.modal.btn_stock')}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="h-8 px-3 rounded-[7px] text-[13px] font-medium text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 shadow-[0_1px_0_rgba(15,23,42,.03)]">
              {t('grn.modal.btn_close')}
            </button>
            <Link href={`/app/grn/${grn.id}`} transitionTypes={['nav-forward']}
              className="h-8 px-3 rounded-[7px] text-[13px] font-medium text-white bg-stone-950 hover:bg-stone-800 shadow-sm inline-flex items-center gap-1.5">
              {t('grn.modal.btn_full_details')}
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes popIn  { from { opacity:0; transform:translateY(8px) scale(.98) } to { opacity:1; transform:none } }
      `}</style>
    </div>
  );
}

interface Props {
  initialGRNs: GRNPageResult;
  initialStatusCounts: Record<string, number>;
  initialWarehouses: WarehouseRow[];
  initialQueueCounts: { io: number; po: number };
}

export function GRNClient({ initialGRNs, initialStatusCounts, initialWarehouses, initialQueueCounts }: Props) {
  const { data: session } = useSession();
  const t = useT();

  const [data, setData] = useState<GRNPageResult | null>(initialGRNs);
  const [tabCounts, setTabCounts] = useState<Record<string, number>>(initialStatusCounts);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<GRNDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const queueCounts = initialQueueCounts;
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);

  // Filter States
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [timeFilter, setTimeFilter] = useState('');
  const [receiverFilter, setReceiverFilter] = useState('');
  const warehousesList = initialWarehouses;

  const fetchStatusCounts = useCallback(async () => {
    try {
      const counts = await get<Record<string, number>>('/api/grn/status-counts');
      setTabCounts(counts);
    } catch (error) {
      console.error('Failed to refresh GRN status counts:', error);
    }
  }, []);

  const fetchGRNs = useCallback(async () => {
    if (page === 1 && !tab && !warehouseFilter) {
      setData(initialGRNs);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (tab) params.set('status', tab);
      if (warehouseFilter) params.set('warehouse_id', warehouseFilter);
      setData(await get<GRNPageResult>(`/api/grn?${params}`));
      setSelectedRowIndex(-1);
    } finally { setLoading(false); }
  }, [page, tab, warehouseFilter, initialGRNs]);

  useEffect(() => { fetchGRNs(); }, [fetchGRNs]);
  useEffect(() => { fetchStatusCounts(); }, [fetchStatusCounts, tab]);

  async function openModal(g: GRNRow) {
    setModalLoading(true);
    try {
      const detail = await get<GRNDetail>(`/api/grn/${g.id}`);
      setModal(detail);
    } finally { setModalLoading(false); }
  }

  const displayedGRNs = useMemo(() => {
    return data?.data.filter((g) => {
      if (search) {
        const term = search.toLowerCase();
        const matchGrn = g.grn_number.toLowerCase().includes(term);
        const matchPo = g.po_number?.toLowerCase().includes(term) ?? false;
        const matchIo = g.io_number?.toLowerCase().includes(term) ?? false;
        if (!matchGrn && !matchPo && !matchIo) return false;
      }
      if (receiverFilter && g.received_by_name !== receiverFilter) {
        return false;
      }
      if (timeFilter) {
        const date = new Date(g.received_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (timeFilter === 'today') {
          const checkDate = new Date(g.received_date);
          if (checkDate.toDateString() !== new Date().toDateString()) return false;
        } else if (timeFilter === '7days') {
          const diffTime = Math.abs(today.getTime() - date.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 7) return false;
        } else if (timeFilter === '30days') {
          const diffTime = Math.abs(today.getTime() - date.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 30) return false;
        }
      }
      return true;
    }) ?? [];
  }, [data, search, receiverFilter, timeFilter]);

  const getTabCount = (status: string) => tabCounts[status] ?? 0;
  const uniqueReceivers = Array.from(new Set((data?.data ?? []).map((g) => g.received_by_name))).filter(Boolean);

  useEffect(() => {
    if (!displayedGRNs || displayedGRNs.length === 0 || modal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedRowIndex((prev) => (prev < displayedGRNs.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedRowIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter') {
        if (selectedRowIndex >= 0 && selectedRowIndex < displayedGRNs.length) {
          e.preventDefault();
          openModal(displayedGRNs[selectedRowIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [displayedGRNs, selectedRowIndex, modal]);

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12 space-y-5 font-sans">

        {/* Header */}
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-stone-950 leading-tight mb-1">
              {t('grn.client.title')}
            </h1>
            <p className="text-[13.5px] text-stone-500">
              {t('grn.client.subtitle_prefix')}{loading ? '—' : (data?.total ?? 0).toLocaleString()}{t('grn.client.subtitle_suffix')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="h-8 px-3 rounded-[7px] text-[13px] font-medium text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 shadow-[0_1px_0_rgba(15,23,42,.03)] inline-flex items-center gap-1.5 transition-colors">
              <Download className="w-3.5 h-3.5" />
              {t('grn.client.btn_export')}
            </button>
            <Link
              href="/app/grn/receiving-queue"
              transitionTypes={['nav-forward']}
              className="h-8 px-3 rounded-[7px] text-[13px] font-medium text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 shadow-[0_1px_0_rgba(15,23,42,.03)] inline-flex items-center gap-1.5 transition-colors"
            >
              {t('grn.client.btn_waiting_receive')}
              {(queueCounts.io + queueCounts.po) > 0 && (
                <span className="ml-1 text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5 animate-pulse">
                  {queueCounts.io > 0 ? `${queueCounts.io} IO` : ''}
                  {queueCounts.io > 0 && queueCounts.po > 0 ? ' · ' : ''}
                  {queueCounts.po > 0 ? `${queueCounts.po} PO` : ''}
                </span>
              )}
            </Link>
            <Link
              href="/app/grn/new"
              transitionTypes={['nav-forward']}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] bg-stone-950 text-white text-[13px] font-medium shadow-sm hover:bg-stone-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('grn.client.btn_create_grn')}
            </Link>
          </div>
        </div>

        {/* 8 Status Tabs */}
        <div className="flex gap-0 border-b border-stone-200 overflow-x-auto scrollbar-none whitespace-nowrap">
          {TABS.map((tItem) => {
            const count = tItem.id === '' 
              ? Object.values(tabCounts).reduce((a, b) => a + b, 0)
              : getTabCount(tItem.id);
            const isQCPending = tItem.id === 'qc_pending';
            return (
              <button
                key={tItem.id}
                onClick={() => { setTab(tItem.id); setPage(1); }}
                className={`px-4 py-3 text-[13.5px] font-medium border-b-2 -mb-px transition-all inline-flex items-center gap-1.5 ${
                  tab === tItem.id
                    ? 'text-stone-950 border-stone-950 font-semibold'
                    : 'text-stone-600 border-transparent hover:text-stone-700'
                }`}
              >
                <span>{tItem.id === '' ? t('label.all') : ({
                  draft: t('status.draft'),
                  received: t('status.received'),
                  qc_pending: t('status.qc_pending'),
                  qc_passed: t('status.qc_passed'),
                  qc_failed: t('status.qc_failed'),
                  verified: t('status.verified'),
                  stocked: t('status.stocked'),
                } as Record<string, string>)[tItem.id] ?? tItem.id}</span>
                <span className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full ${
                  tab === tItem.id
                    ? isQCPending ? 'bg-amber-100 text-amber-800' : 'bg-stone-200 text-stone-800'
                    : isQCPending ? 'bg-amber-50 text-amber-700/80' : 'bg-stone-100 text-stone-600/80'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 4-column filter bar in single row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-stone-50 p-4 border border-stone-200 rounded-[10px]">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder={t('grn.client.filter_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-[13px] pl-9 pr-3 py-2 bg-white border border-stone-200 rounded-[7px] focus:outline-none focus:border-stone-400 transition-colors"
            />
          </div>

          {/* Warehouse Selector */}
          <div className="relative">
            <WarehouseIcon className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
            <select
              value={warehouseFilter}
              onChange={(e) => { setWarehouseFilter(e.target.value); setPage(1); }}
              className="w-full text-[13px] pl-9 pr-3 py-2 bg-white border border-stone-200 rounded-[7px] focus:outline-none focus:border-stone-400 appearance-none transition-colors"
            >
              <option value="">{t('grn.client.filter_all_warehouses')}</option>
              {warehousesList.map((wh) => (
                <option key={wh.id} value={wh.id}>{wh.code} - {wh.name_th}</option>
              ))}
            </select>
          </div>

          {/* Period Selector */}
          <div className="relative">
            <Clock className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="w-full text-[13px] pl-9 pr-3 py-2 bg-white border border-stone-200 rounded-[7px] focus:outline-none focus:border-stone-400 appearance-none transition-colors"
            >
              <option value="">{t('grn.client.filter_all_periods')}</option>
              <option value="today">{t('grn.client.filter_today')}</option>
              <option value="7days">{t('grn.client.filter_7days')}</option>
              <option value="30days">{t('grn.client.filter_30days')}</option>
            </select>
          </div>

          {/* Receiver Selector */}
          <div className="relative">
            <User className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
            <select
              value={receiverFilter}
              onChange={(e) => setReceiverFilter(e.target.value)}
              className="w-full text-[13px] pl-9 pr-3 py-2 bg-white border border-stone-200 rounded-[7px] focus:outline-none focus:border-stone-400 appearance-none transition-colors"
            >
              <option value="">{t('grn.client.filter_all_receivers')}</option>
              {uniqueReceivers.map((rec) => (
                <option key={rec} value={rec}>{rec}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table card */}
        <div className={`hidden md:block ${CARD}`}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {[
                  t('grn.client.th_grn_num'),
                  t('grn.client.th_ref'),
                  t('grn.client.th_warehouse'),
                  t('grn.client.th_receiver'),
                  t('grn.client.th_received_date'),
                  t('grn.client.th_items_count'),
                  t('grn.client.th_status'),
                  ''
                ].map((h, i) => (
                  <th key={i} className={`text-left py-3 px-3.5 text-[11.5px] font-medium tracking-[.04em] uppercase text-stone-600 bg-stone-50 border-b border-stone-200 first:pl-5 last:pr-5 ${i === 5 ? 'text-center' : ''} ${[2,3,4,5].includes(i) ? 'hidden lg:table-cell' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center text-[13px] text-stone-600">{t('grn.client.loading')}</td></tr>
              ) : displayedGRNs.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-[13px] text-stone-600">{t('grn.client.no_records')}</td></tr>
              ) : displayedGRNs.map((g, index) => {
                const isSelected = selectedRowIndex === index;
                return (
                  <tr
                    key={g.id}
                    onClick={() => openModal(g)}
                    className={`border-b border-stone-50 last:border-0 hover:bg-stone-50/60 cursor-default transition-all duration-150 ${
                      isSelected ? 'bg-stone-100 ring-1 ring-inset ring-stone-200/50 scale-[0.995]' : ''
                    }`}
                  >
                    <td className="py-0 h-11 px-3.5 pl-5 font-mono text-[12.5px] text-stone-700 font-medium">
                      <div className="flex items-center gap-2">
                        {isSelected && <CornerDownRight className="w-3.5 h-3.5 text-stone-400 animate-pulse" />}
                        <span>{g.grn_number}</span>
                      </div>
                    </td>
                    <td className="py-0 h-11 px-3.5 font-mono text-[12.5px] hidden lg:table-cell">
                      <span onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5">
                        {g.po_id ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11.5px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            <Link href={`/app/purchase-orders/${g.po_id}`} className="hover:underline">{g.po_number}</Link>
                          </span>
                        ) : g.io_number ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <Link href={`/app/inbound-orders/${g.inbound_order_id}`} className="hover:underline">{g.io_number}</Link>
                          </span>
                        ) : <span className="text-stone-300">—</span>}
                      </span>
                    </td>
                    <td className="py-0 h-11 px-3.5 text-stone-500 hidden lg:table-cell">{g.warehouse_code}</td>
                    <td className="py-0 h-11 px-3.5 text-stone-500 hidden lg:table-cell">{g.received_by_name}</td>
                    <td className="py-0 h-11 px-3.5 text-stone-500 font-mono text-[12.5px] hidden lg:table-cell">{formatDate(g.received_date)}</td>
                    <td className="py-0 h-11 px-3.5 text-center tabular-nums text-stone-500 hidden lg:table-cell">{g.line_count}</td>
                    <td className="py-0 h-11 px-3.5"><Pill status={g.status} /></td>
                    <td className="py-0 h-11 px-3.5 pr-5 text-stone-300">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Card stack for mobile */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="text-center py-8 text-[13px] text-stone-600 bg-white border border-stone-200 rounded-xl">{t('grn.client.loading')}</div>
          ) : displayedGRNs.length === 0 ? (
            <div className="text-center py-8 text-[13px] text-stone-600 bg-white border border-stone-200 rounded-xl">{t('grn.client.no_records')}</div>
          ) : (
            displayedGRNs.map((g) => (
              <div
                key={g.id}
                onClick={() => openModal(g)}
                className="bg-white border border-stone-200 rounded-xl p-4 active:bg-stone-50 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-stone-900 font-mono text-[14px]">{g.grn_number}</span>
                  <Pill status={g.status} />
                </div>
                <div className="text-[13px] text-stone-600 mb-1">
                  {t('label.warehouse_colon')}{g.warehouse_name} ({g.warehouse_code})
                </div>
                <div className="text-[13px] text-stone-600 mb-2">
                  {t('label.source_colon')}{g.po_number ? `PO: ${g.po_number}` : g.io_number ? `IO: ${g.io_number}` : '—'}
                </div>
                <div className="flex justify-between items-center text-[11px] text-stone-500 border-t border-stone-100 pt-2">
                  <span>{t('label.receiver_colon')}{g.received_by_name}</span>
                  <span className="font-mono">{formatDate(g.received_date)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between text-[13px] text-stone-500">
            <span>{t('label.page')} {page} {t('label.of')} {data.total_pages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="h-8 px-3 rounded-[7px] border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none text-[13px]">
                ← {t('label.prev')}
              </button>
              <button onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))} disabled={page === data.total_pages}
                className="h-8 px-3 rounded-[7px] border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none text-[13px]">
                {t('label.next')} →
              </button>
            </div>
          </div>
        )}

        {/* Loading overlay for modal fetch */}
        {modalLoading && (
          <div className="fixed inset-0 z-40 grid place-items-center bg-[rgba(15,23,42,.2)]">
            <div className="bg-white rounded-lg p-4 shadow-md flex items-center gap-2 border border-stone-100">
              <Loader2 className="w-5 h-5 text-stone-800 animate-spin" />
              <span className="text-stone-700 text-[13px]">{t('grn.modal.loading_details')}</span>
            </div>
          </div>
        )}

        {/* GRN Detail Modal */}
        {modal && (
          <GRNDetailModal
            grn={modal}
            onClose={() => setModal(null)}
            onActionComplete={fetchGRNs}
            sessionUser={session?.user as unknown as { role: string } | undefined}
          />
        )}
      </div>
    </DirectionalTransition>
  );
}

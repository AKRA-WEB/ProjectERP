'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Table, Thead, Tbody, Th, Td, StatusBadge } from '@/components/ui';
import { get } from '@/lib/api-client';
import { formatDate, formatQty } from '@/lib/format';
import type { Warehouse } from '@/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import { ArrowLeft, Filter, Home, Package, Boxes, ClipboardList, ScanLine } from 'lucide-react';
import { useT, type DictKey } from '@/lib/i18n';

interface PendingPO {
  id: string;
  po_number: string;
  status: string;
  expected_date: string | null;
  vendor_name: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  total_lines: number;
  total_qty_remaining: string | number;
  created_at: string;
}

interface PendingIO {
  id: string;
  io_number: string;
  status: string;
  created_at: string;
  vendor_name: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  total_lines: number;
  total_qty_remaining: string | number;
}

interface QueueResponse {
  pending_pos: PendingPO[];
  inbound_orders: PendingIO[];
}

function timeSince(dateStr: string, t: (key: DictKey) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return t('time.days_ago').replace('{count}', String(days));
  if (hrs > 0) return t('time.hours_ago').replace('{count}', String(hrs));
  return t('time.mins_ago').replace('{count}', String(mins));
}

function isUrgent(dateStr: string): boolean {
  return Date.now() - new Date(dateStr).getTime() > 4 * 60 * 60 * 1000;
}

function isOverdue(dateStr: string, status: string): boolean {
  if (status !== 'open' && status !== 'receiving') return false;
  return Date.now() - new Date(dateStr).getTime() > 72 * 60 * 60 * 1000;
}

function MobileBottomTabBar() {
  const router = useRouter();
  const t = useT();
  const tabs = [
    { key: 'home', label: t('grn.queue.mobile_tab_home'), icon: Home, href: '/app' },
    { key: 'receive', label: t('grn.queue.mobile_tab_receive'), icon: Package, href: '/app/grn/receiving-queue', active: true },
    { key: 'stock', label: t('grn.queue.mobile_tab_stock'), icon: Boxes, href: '/app/inventory' },
    { key: 'profile', label: t('grn.queue.mobile_tab_profile'), icon: ClipboardList, href: '/app/profile' },
  ];
  return (
    <div className="fixed bottom-0 inset-x-0 h-16 bg-white border-t border-stone-200 flex md:hidden z-40">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            onClick={() => router.push(tab.href)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
              tab.active ? 'text-emerald-600' : 'text-stone-600 hover:text-stone-600'
            }`}
          >
            <Icon className={`w-5 h-5 ${tab.active ? 'text-emerald-600' : 'text-stone-600'}`} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default function ReceivingQueuePage() {
  const router = useRouter();
  const t = useT();

  const IO_STATUS_LABEL: Record<string, string> = {
    open:                 t('status.open'),
    receiving:            t('status.receiving'),
    received:             t('status.pending_verification'),
    pending_verification: t('status.pending_verification'),
    stocked:              t('status.stocked'),
    verified:             t('status.verified'),
  };

  const [data, setData] = useState<QueueResponse>({ pending_pos: [], inbound_orders: [] });
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState<'io' | 'po'>('io');

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (warehouseId) params.set('warehouse_id', warehouseId);
      const res = await get<QueueResponse>(`/api/grn/receiving-queue?${params}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    get<Warehouse[]>('/api/admin/warehouses').then(setWarehouses);
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const urgentCount = data.inbound_orders.filter((io) => isUrgent(io.created_at)).length
    + data.pending_pos.filter((po) => isUrgent(po.created_at ?? '')).length;

  const ioQtyTotal = data.inbound_orders.reduce((s, io) => s + Number(io.total_qty_remaining), 0);
  const poQtyTotal = data.pending_pos.reduce((s, po) => s + Number(po.total_qty_remaining), 0);

  const selectedWarehouseCode = warehouses.find((w) => w.id === warehouseId)?.code ?? t('grn.queue.all_warehouses_short');

  return (
    <DirectionalTransition>
      <>
        {/* ═══ MOBILE (< md) ═════════════════════════════════════════ */}
        <div className="flex flex-col min-h-screen bg-stone-50 pb-24 md:hidden">

          {/* Header */}
          <div className="flex items-center px-4 pt-5 pb-4 bg-white border-b border-stone-100/80 sticky top-0 z-30 shadow-sm">
            <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-full bg-stone-50 border border-stone-100 hover:bg-stone-100 -ml-1 active:scale-95 transition-all">
              <ArrowLeft className="w-5 h-5 text-stone-700" />
            </button>
            <div className="flex-1 text-center">
              <p className="text-[16px] font-extrabold text-stone-900 tracking-tight">{t('grn.queue.mobile_title')}</p>
              <p className="text-[11px] font-bold text-emerald-600 uppercase mt-0.5 tracking-wider">{selectedWarehouseCode}</p>
            </div>
            <button className="w-10 h-10 flex items-center justify-center rounded-full bg-stone-50 border border-stone-100 hover:bg-stone-100 active:scale-95 transition-all">
              <Filter className="w-4 h-4 text-stone-600" />
            </button>
          </div>

          <div className="px-4 py-4 space-y-4">

            {/* Summary strip */}
            <div className="grid grid-cols-3 gap-2">
              {/* Urgent Block */}
              <div className={`bg-gradient-to-br from-white to-stone-50/30 rounded-2xl p-3 border transition-all shadow-sm ${
                urgentCount > 0 
                  ? 'border-amber-300 ring-2 ring-amber-100/50 shadow-md shadow-amber-50/40' 
                  : 'border-stone-200'
              }`}>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">{t('grn.queue.mobile_urgent_title')}</p>
                  {urgentCount > 0 && <span className="animate-pulse w-2 h-2 rounded-full bg-amber-500" />}
                </div>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <p className={`text-2xl font-mono font-extrabold tabular-nums leading-none ${urgentCount > 0 ? 'text-amber-600' : 'text-stone-300'}`}>
                    {urgentCount}
                  </p>
                  <p className="text-[10px] font-bold text-stone-400">{t('grn.queue.mobile_bills_unit')}</p>
                </div>
                <p className="text-[9px] font-semibold text-stone-500 mt-1">{t('grn.queue.mobile_over_4h')}</p>
              </div>

              {/* Inbound Orders Block */}
              <div className="bg-gradient-to-br from-white to-stone-50/30 rounded-2xl p-3 border border-stone-200 shadow-sm">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{t('grn.queue.io_line')}</p>
                <div className="flex items-baseline gap-1 mt-1.5">
                  <p className="text-2xl font-mono font-extrabold tabular-nums text-stone-900 leading-none">
                    {data.inbound_orders.length}
                  </p>
                  <p className="text-[10px] font-bold text-stone-400">{t('grn.queue.mobile_bills_unit')}</p>
                </div>
                <p className="text-[9px] font-semibold text-stone-500 mt-1">{t('grn.queue.mobile_items_unit').replace('{count}', ioQtyTotal.toLocaleString())}</p>
              </div>

              {/* Purchase Orders Block */}
              <div className="bg-gradient-to-br from-white to-stone-50/30 rounded-2xl p-3 border border-stone-200 shadow-sm">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">{t('grn.queue.po_normal')}</p>
                <div className="flex items-baseline gap-1 mt-1.5">
                  <p className="text-2xl font-mono font-extrabold tabular-nums text-stone-900 leading-none">
                    {data.pending_pos.length}
                  </p>
                  <p className="text-[10px] font-bold text-stone-400">{t('grn.queue.mobile_bills_unit')}</p>
                </div>
                <p className="text-[9px] font-semibold text-stone-500 mt-1">{t('grn.queue.mobile_items_unit').replace('{count}', poQtyTotal.toLocaleString())}</p>
              </div>
            </div>

            {/* Segmented control with slide transition */}
            <div className="bg-stone-100 rounded-2xl p-1 flex relative select-none">
              <div
                className="absolute top-1 bottom-1 left-1 bg-white rounded-xl shadow-sm border border-stone-200/40 transition-all duration-300 ease-out"
                style={{
                  width: 'calc(50% - 4px)',
                  transform: segment === 'io' ? 'translateX(0)' : 'translateX(100%)',
                }}
              />
              <button
                onClick={() => setSegment('io')}
                className={`flex-1 h-9 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all relative z-10 ${
                  segment === 'io' ? 'text-emerald-700' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                Inbound Orders
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full font-mono transition-all ${
                  segment === 'io' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-600'
                }`}>
                  {data.inbound_orders.length}
                </span>
              </button>
              <button
                onClick={() => setSegment('po')}
                className={`flex-1 h-9 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all relative z-10 ${
                  segment === 'po' ? 'text-blue-700' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                Purchase Orders
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full font-mono transition-all ${
                  segment === 'po' ? 'bg-blue-100 text-blue-700' : 'bg-stone-200 text-stone-600'
                }`}>
                  {data.pending_pos.length}
                </span>
              </button>
            </div>

            {/* Queue cards */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-stone-400 space-y-2">
                <span className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full" />
                <p className="text-xs font-semibold">{t('grn.queue.loading_queue')}</p>
              </div>
            ) : segment === 'io' ? (
              data.inbound_orders.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-stone-200/60 p-6 shadow-sm">
                  <div className="w-12 h-12 bg-stone-50 border border-stone-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Package className="w-5 h-5 text-stone-300" />
                  </div>
                  <p className="text-sm font-bold text-stone-800">{t('grn.queue.no_io_queue_title')}</p>
                  <p className="text-xs text-stone-500 mt-1">{t('grn.queue.no_io_queue_desc')}</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {data.inbound_orders.map((io) => {
                    const urgent = isUrgent(io.created_at);
                    const overdue = isOverdue(io.created_at, io.status);
                    return (
                      <div key={io.id} className={`bg-white rounded-2xl border p-5 space-y-4 transition-all duration-200 hover:shadow-md ${
                        overdue 
                          ? 'border-red-300 ring-2 ring-red-100/50 shadow-md shadow-rose-50/40' 
                          : urgent 
                          ? 'border-amber-200 ring-2 ring-amber-300/40 shadow-md shadow-amber-50/30' 
                          : 'border-stone-200/80 shadow-sm'
                      }`}>
                        <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-4">
                          <div className="flex flex-col gap-2 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-[14px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1 leading-none">
                                {io.io_number}
                              </span>
                              {urgent && (
                                <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 border border-amber-300 rounded-full px-2 py-0.5 tracking-wider uppercase leading-none animate-pulse">{t('grn.queue.urgent_tag')}</span>
                              )}
                              {overdue && (
                                <span className="text-[9px] font-extrabold text-red-700 bg-red-50 border border-red-300 rounded-full px-2 py-0.5 tracking-wider uppercase leading-none">{t('grn.queue.overdue_tag')}</span>
                              )}
                            </div>
                            <div>
                              <StatusBadge status={io.status} labelOverride={IO_STATUS_LABEL[io.status]} />
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-2xl font-mono font-extrabold tabular-nums text-stone-900 leading-none">{formatQty(io.total_qty_remaining)}</p>
                            <p className="text-[10px] font-bold text-stone-400 mt-1.5">{t('grn.queue.sku_remaining').replace('{count}', String(io.total_lines))}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[14px] font-bold text-stone-800 leading-snug">{io.vendor_name}</p>
                          <div className="flex items-center justify-between text-[11px] font-semibold text-stone-500">
                            <span>{t('grn.queue.destination_wh')}: <span className="text-stone-700 font-bold">{io.warehouse_code}</span></span>
                            <span>{timeSince(io.created_at, t)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => router.push(`/app/grn/new?io_id=${io.id}`)}
                          className="w-full h-12 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl text-[13.5px] font-extrabold hover:from-emerald-700 hover:to-emerald-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/10"
                        >
                          <ScanLine className="w-4.5 h-4.5" />
                          {t('grn.queue.scan_receive')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              data.pending_pos.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-stone-200/60 p-6 shadow-sm">
                  <div className="w-12 h-12 bg-stone-50 border border-stone-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Package className="w-5 h-5 text-stone-300" />
                  </div>
                  <p className="text-sm font-bold text-stone-800">{t('grn.queue.no_po_queue_title')}</p>
                  <p className="text-xs text-stone-500 mt-1">{t('grn.queue.no_po_queue_desc')}</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {data.pending_pos.map((po) => {
                    const urgent = isUrgent(po.created_at ?? '');
                    return (
                      <div key={po.id} className={`bg-white rounded-2xl border p-5 space-y-4 transition-all duration-200 hover:shadow-md ${
                        urgent 
                          ? 'border-amber-200 ring-2 ring-amber-300/40 shadow-md shadow-amber-50/30' 
                          : 'border-stone-200/80 shadow-sm'
                      }`}>
                        <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-4">
                          <div className="flex flex-col gap-2 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-[14px] font-extrabold text-blue-800 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1 leading-none">
                                {po.po_number}
                              </span>
                              {urgent && (
                                <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 border border-amber-300 rounded-full px-2 py-0.5 tracking-wider uppercase leading-none animate-pulse">{t('grn.queue.urgent_tag')}</span>
                              )}
                            </div>
                            <div>
                              <StatusBadge status={po.status} />
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-2xl font-mono font-extrabold tabular-nums text-stone-900 leading-none">{formatQty(po.total_qty_remaining)}</p>
                            <p className="text-[10px] font-bold text-stone-400 mt-1.5">{t('grn.queue.sku_remaining').replace('{count}', String(po.total_lines))}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[14px] font-bold text-stone-800 leading-snug">{po.vendor_name}</p>
                          <div className="flex items-center justify-between text-[11px] font-semibold text-stone-500">
                            <span>{t('grn.queue.destination_wh')}: <span className="text-stone-700 font-bold">{po.warehouse_code}</span></span>
                            <span>{po.expected_date ? `${t('grn.queue.mobile_expected_prefix')}${formatDate(po.expected_date)}` : timeSince(po.created_at ?? '', t)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => router.push(`/app/grn/new?po_id=${po.id}`)}
                          className="w-full h-12 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl text-[13.5px] font-extrabold hover:from-emerald-700 hover:to-emerald-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/10"
                        >
                          <ScanLine className="w-4.5 h-4.5" />
                          {t('grn.queue.scan_receive')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>

          <MobileBottomTabBar />
        </div>

        {/* ═══ DESKTOP (≥ md) ════════════════════════════════════════ */}
        <div className="hidden md:block max-w-[1440px] mx-auto pb-12">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">{t('grn.queue.title')}</h1>
              <p className="text-sm text-stone-500">{t('grn.queue.subtitle')}</p>
            </div>
            <div className="flex gap-2 items-center">
              <Link href="/app/inbound-orders/new" transitionTypes={['nav-forward']}>
                <Button variant="secondary" size="sm">{t('grn.queue.btn_create_io')}</Button>
              </Link>
              <Link href="/app/grn" transitionTypes={['nav-back']} className="text-sm text-blue-600 hover:underline flex items-center">
                {t('grn.queue.btn_history')}
              </Link>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <select
              className="w-full sm:w-auto rounded-lg border border-stone-200 px-3 py-2 text-sm"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="">{t('grn.queue.all_warehouses')}</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name_th}</option>)}
            </select>
          </div>

          <div className="space-y-10">
            {/* Inbound Orders */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-bold text-stone-800">{t('grn.queue.io_line_title')}</h2>
                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full ml-2">{data.inbound_orders.length}</span>
              </div>
              <div className="rounded-xl bg-white shadow-sm border border-stone-200 overflow-hidden">
                <Table>
                  <Thead>
                    <tr>
                      <Th>{t('grn.queue.th_io_num')}</Th>
                      <Th>{t('grn.queue.th_vendor')}</Th>
                      <Th className="hidden sm:table-cell">{t('grn.queue.th_warehouse')}</Th>
                      <Th className="hidden sm:table-cell text-right">{t('grn.queue.th_remaining')}</Th>
                      <Th className="hidden sm:table-cell">{t('grn.queue.th_created_date')}</Th>
                      <Th>{t('grn.queue.th_status')}</Th>
                      <Th></Th>
                    </tr>
                  </Thead>
                  <Tbody>
                    {loading ? (
                      <tr><Td colSpan={7}><div className="py-8 text-center text-stone-600">{t('grn.queue.loading')}</div></Td></tr>
                    ) : data.inbound_orders.length === 0 ? (
                      <tr><Td colSpan={7}><div className="py-8 text-center text-stone-600 italic">{t('grn.queue.no_io_pending')}</div></Td></tr>
                    ) : data.inbound_orders.map((io) => (
                      <tr key={io.id} className="hover:bg-stone-50">
                        <Td className="font-mono font-medium text-sm text-emerald-700">
                          <Link href={`/app/inbound-orders/${io.id}`} transitionTypes={['nav-forward']}>{io.io_number}</Link>
                        </Td>
                        <Td className="text-sm">{io.vendor_name}</Td>
                        <Td className="text-sm hidden sm:table-cell">{io.warehouse_code}</Td>
                        <Td className="text-right font-mono text-sm hidden sm:table-cell tabular-nums">{formatQty(io.total_qty_remaining)}</Td>
                        <Td className="text-sm text-stone-500 hidden sm:table-cell">{formatDate(io.created_at)}</Td>
                        <Td><StatusBadge status={io.status} labelOverride={IO_STATUS_LABEL[io.status]} /></Td>
                        <Td className="text-right">
                          <Link href={`/app/grn/new?io_id=${io.id}`} transitionTypes={['nav-forward']}>
                            <Button size="sm">{t('grn.queue.btn_receive')}</Button>
                          </Link>
                        </Td>
                      </tr>
                    ))}
                  </Tbody>
                </Table>
              </div>
            </section>

            {/* Purchase Orders */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-bold text-stone-800">{t('grn.queue.po_system_title')}</h2>
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full ml-2">{data.pending_pos.length}</span>
              </div>
              <div className="rounded-xl bg-white shadow-sm border border-stone-200 overflow-hidden">
                <Table>
                  <Thead>
                    <tr>
                      <Th>{t('grn.queue.th_po_num')}</Th>
                      <Th>{t('grn.queue.th_vendor')}</Th>
                      <Th className="hidden sm:table-cell">{t('grn.queue.th_warehouse')}</Th>
                      <Th className="hidden sm:table-cell text-right">{t('grn.queue.th_remaining')}</Th>
                      <Th className="hidden sm:table-cell">{t('grn.queue.th_expected_date')}</Th>
                      <Th>{t('grn.queue.th_status')}</Th>
                      <Th></Th>
                    </tr>
                  </Thead>
                  <Tbody>
                    {loading ? (
                      <tr><Td colSpan={7}><div className="py-8 text-center text-stone-600">{t('grn.queue.loading')}</div></Td></tr>
                    ) : data.pending_pos.length === 0 ? (
                      <tr><Td colSpan={7}><div className="py-8 text-center text-stone-600 italic">{t('grn.queue.no_po_pending')}</div></Td></tr>
                    ) : data.pending_pos.map((po) => (
                      <tr key={po.id} className="hover:bg-stone-50">
                        <Td className="font-mono font-medium text-sm text-blue-700">
                          <Link href={`/app/purchase-orders/${po.id}`} transitionTypes={['nav-forward']}>{po.po_number}</Link>
                        </Td>
                        <Td className="text-sm">{po.vendor_name}</Td>
                        <Td className="text-sm hidden sm:table-cell">{po.warehouse_code}</Td>
                        <Td className="text-right font-mono text-sm hidden sm:table-cell tabular-nums">{formatQty(po.total_qty_remaining)}</Td>
                        <Td className="text-sm text-stone-500 hidden sm:table-cell">{po.expected_date ? formatDate(po.expected_date) : '—'}</Td>
                        <Td><StatusBadge status={po.status} /></Td>
                        <Td className="text-right">
                          <Link href={`/app/grn/new?po_id=${po.id}`} transitionTypes={['nav-forward']}>
                            <Button size="sm">{t('grn.queue.btn_receive')}</Button>
                          </Link>
                        </Td>
                      </tr>
                    ))}
                  </Tbody>
                </Table>
              </div>
            </section>
          </div>
        </div>
      </>
    </DirectionalTransition>
  );
}

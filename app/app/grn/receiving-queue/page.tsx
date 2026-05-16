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

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `เมื่อ ${days} วัน ที่แล้ว`;
  if (hrs > 0) return `เมื่อ ${hrs} ชม. ที่แล้ว`;
  return `เมื่อ ${mins} น. ที่แล้ว`;
}

function isUrgent(dateStr: string): boolean {
  return Date.now() - new Date(dateStr).getTime() > 4 * 60 * 60 * 1000;
}

function MobileBottomTabBar() {
  const router = useRouter();
  const tabs = [
    { key: 'home', label: 'หน้าหลัก', icon: Home, href: '/app' },
    { key: 'receive', label: 'รับสินค้า', icon: Package, href: '/app/grn/receiving-queue', active: true },
    { key: 'stock', label: 'สต็อก', icon: Boxes, href: '/app/inventory' },
    { key: 'profile', label: 'โปรไฟล์', icon: ClipboardList, href: '/app/profile' },
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
              tab.active ? 'text-emerald-600' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            <Icon className={`w-5 h-5 ${tab.active ? 'text-emerald-600' : 'text-stone-400'}`} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default function ReceivingQueuePage() {
  const router = useRouter();
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

  const selectedWarehouseCode = warehouses.find((w) => w.id === warehouseId)?.code ?? 'ทุกคลัง';

  return (
    <DirectionalTransition>
      <>
        {/* ═══ MOBILE (< md) ═════════════════════════════════════════ */}
        <div className="flex flex-col min-h-screen bg-stone-50 pb-20 md:hidden">

          {/* Header */}
          <div className="flex items-center px-4 pt-4 pb-3 bg-white border-b border-stone-100">
            <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100 -ml-1">
              <ArrowLeft className="w-5 h-5 text-stone-700" />
            </button>
            <div className="flex-1 text-center">
              <p className="text-[15px] font-semibold text-stone-900">รายการรอรับ</p>
              <p className="text-[12px] text-stone-400 mt-0.5">Receiving Queue · {selectedWarehouseCode}</p>
            </div>
            <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100">
              <Filter className="w-4 h-4 text-stone-600" />
            </button>
          </div>

          <div className="px-4 py-3 space-y-3">

            {/* Summary strip */}
            <div className="grid grid-cols-3 gap-2">
              <div className={`bg-white rounded-xl p-3 border ${urgentCount > 0 ? 'border-amber-300' : 'border-stone-200'}`}>
                <p className="text-[10px] text-stone-400">ด่วน</p>
                <p className={`text-xl font-mono font-bold tabular-nums ${urgentCount > 0 ? 'text-amber-700' : 'text-stone-300'}`}>{urgentCount}</p>
                <p className="text-[9px] text-stone-400">เกิน 4 ชม.</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-stone-200">
                <p className="text-[10px] text-stone-400">IO (LINE)</p>
                <p className="text-xl font-mono font-bold tabular-nums text-stone-900">{data.inbound_orders.length}</p>
                <p className="text-[9px] text-stone-400">{ioQtyTotal.toLocaleString()} ชิ้น</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-stone-200">
                <p className="text-[10px] text-stone-400">PO</p>
                <p className="text-xl font-mono font-bold tabular-nums text-stone-900">{data.pending_pos.length}</p>
                <p className="text-[9px] text-stone-400">{poQtyTotal.toLocaleString()} ชิ้น</p>
              </div>
            </div>

            {/* Segmented control */}
            <div className="bg-stone-100 rounded-full p-1 flex">
              <button
                onClick={() => setSegment('io')}
                className={`flex-1 h-9 rounded-full text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  segment === 'io' ? 'bg-white shadow text-stone-900' : 'text-stone-500'
                }`}
              >
                Inbound Orders
                <span className="bg-stone-200 text-stone-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono">
                  {data.inbound_orders.length}
                </span>
              </button>
              <button
                onClick={() => setSegment('po')}
                className={`flex-1 h-9 rounded-full text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  segment === 'po' ? 'bg-white shadow text-stone-900' : 'text-stone-500'
                }`}
              >
                Purchase Orders
                <span className="bg-stone-200 text-stone-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono">
                  {data.pending_pos.length}
                </span>
              </button>
            </div>

            {/* Queue cards */}
            {loading ? (
              <div className="text-center py-12 text-stone-400 text-sm">กำลังโหลด...</div>
            ) : segment === 'io' ? (
              data.inbound_orders.length === 0 ? (
                <div className="text-center py-12 text-stone-400 text-sm">ไม่มี IO ค้างรับ</div>
              ) : (
                <div className="space-y-3">
                  {data.inbound_orders.map((io) => {
                    const urgent = isUrgent(io.created_at);
                    return (
                      <div key={io.id} className={`bg-white rounded-2xl border p-4 space-y-2.5 ${
                        urgent ? 'border-amber-300 ring-1 ring-amber-200/50' : 'border-stone-200'
                      }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[13px] font-bold text-emerald-700">{io.io_number}</span>
                            {urgent && (
                              <span className="text-[10px] font-bold text-amber-700 border border-amber-300 bg-amber-50 rounded-full px-1.5 py-0.5">ด่วน</span>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-mono font-bold tabular-nums text-stone-900">{formatQty(io.total_qty_remaining)}</p>
                            <p className="text-[10px] text-stone-400">{io.total_lines} รายการ</p>
                          </div>
                        </div>
                        <p className="text-[13.5px] font-medium text-stone-800">{io.vendor_name}</p>
                        <p className="text-[12px] text-stone-400">{timeSince(io.created_at)}</p>
                        <button
                          onClick={() => router.push(`/app/grn/new?io_id=${io.id}`)}
                          className="w-full h-10 bg-emerald-600 text-white rounded-xl text-[13px] font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                          <ScanLine className="w-4 h-4" />
                          เริ่มรับสินค้า
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              data.pending_pos.length === 0 ? (
                <div className="text-center py-12 text-stone-400 text-sm">ไม่มี PO ค้างรับ</div>
              ) : (
                <div className="space-y-3">
                  {data.pending_pos.map((po) => {
                    const urgent = isUrgent(po.created_at ?? '');
                    return (
                      <div key={po.id} className={`bg-white rounded-2xl border p-4 space-y-2.5 ${
                        urgent ? 'border-amber-300 ring-1 ring-amber-200/50' : 'border-stone-200'
                      }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[13px] font-bold text-blue-700">{po.po_number}</span>
                            {urgent && (
                              <span className="text-[10px] font-bold text-amber-700 border border-amber-300 bg-amber-50 rounded-full px-1.5 py-0.5">ด่วน</span>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-mono font-bold tabular-nums text-stone-900">{formatQty(po.total_qty_remaining)}</p>
                            <p className="text-[10px] text-stone-400">{po.total_lines} รายการ</p>
                          </div>
                        </div>
                        <p className="text-[13.5px] font-medium text-stone-800">{po.vendor_name}</p>
                        <p className="text-[12px] text-stone-400">
                          {po.expected_date ? `คาดรับ ${formatDate(po.expected_date)}` : timeSince(po.created_at ?? '')}
                        </p>
                        <button
                          onClick={() => router.push(`/app/grn/new?po_id=${po.id}`)}
                          className="w-full h-10 bg-emerald-600 text-white rounded-xl text-[13px] font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                          <ScanLine className="w-4 h-4" />
                          เริ่มรับสินค้า
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
              <h1 className="text-2xl font-bold text-stone-900">รายการรอรับสินค้า / Receiving Queue</h1>
              <p className="text-sm text-stone-500">รายการทั้งหมดที่พร้อมรับเข้าคลัง</p>
            </div>
            <div className="flex gap-2 items-center">
              <Link href="/app/inbound-orders/new" transitionTypes={['nav-forward']}>
                <Button variant="secondary" size="sm">+ สร้าง IO ใหม่ (LINE)</Button>
              </Link>
              <Link href="/app/grn" transitionTypes={['nav-back']} className="text-sm text-blue-600 hover:underline flex items-center">
                ← ไปหน้าประวัติ GRN
              </Link>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <select
              className="w-full sm:w-auto rounded-lg border border-stone-200 px-3 py-2 text-sm"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="">ทุกคลังสินค้า</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name_th}</option>)}
            </select>
          </div>

          <div className="space-y-10">
            {/* Inbound Orders */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-bold text-stone-800">Inbound Orders (สั่งผ่าน LINE)</h2>
                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full ml-2">{data.inbound_orders.length}</span>
              </div>
              <div className="rounded-xl bg-white shadow-sm border border-stone-200 overflow-hidden">
                <Table>
                  <Thead>
                    <tr>
                      <Th>เลข IO</Th>
                      <Th>ผู้จำหน่าย</Th>
                      <Th className="hidden sm:table-cell">คลังสินค้า</Th>
                      <Th className="hidden sm:table-cell text-right">ค้างรับ</Th>
                      <Th className="hidden sm:table-cell">วันที่สร้าง</Th>
                      <Th>สถานะ</Th>
                      <Th></Th>
                    </tr>
                  </Thead>
                  <Tbody>
                    {loading ? (
                      <tr><Td colSpan={7}><div className="py-8 text-center text-stone-400">กำลังโหลด...</div></Td></tr>
                    ) : data.inbound_orders.length === 0 ? (
                      <tr><Td colSpan={7}><div className="py-8 text-center text-stone-400 italic">ไม่มีรายการ IO ค้างรับ</div></Td></tr>
                    ) : data.inbound_orders.map((io) => (
                      <tr key={io.id} className="hover:bg-stone-50">
                        <Td className="font-mono font-medium text-sm text-emerald-700">
                          <Link href={`/app/inbound-orders/${io.id}`} transitionTypes={['nav-forward']}>{io.io_number}</Link>
                        </Td>
                        <Td className="text-sm">{io.vendor_name}</Td>
                        <Td className="text-sm hidden sm:table-cell">{io.warehouse_code}</Td>
                        <Td className="text-right font-mono text-sm hidden sm:table-cell tabular-nums">{formatQty(io.total_qty_remaining)}</Td>
                        <Td className="text-sm text-stone-500 hidden sm:table-cell">{formatDate(io.created_at)}</Td>
                        <Td><StatusBadge status={io.status} /></Td>
                        <Td className="text-right">
                          <Link href={`/app/grn/new?io_id=${io.id}`} transitionTypes={['nav-forward']}>
                            <Button size="sm">รับสินค้า</Button>
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
                <h2 className="text-lg font-bold text-stone-800">Purchase Orders (ระบบปกติ)</h2>
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full ml-2">{data.pending_pos.length}</span>
              </div>
              <div className="rounded-xl bg-white shadow-sm border border-stone-200 overflow-hidden">
                <Table>
                  <Thead>
                    <tr>
                      <Th>เลข PO</Th>
                      <Th>ผู้จำหน่าย</Th>
                      <Th className="hidden sm:table-cell">คลังสินค้า</Th>
                      <Th className="hidden sm:table-cell text-right">ค้างรับ</Th>
                      <Th className="hidden sm:table-cell">วันที่คาดรับ</Th>
                      <Th>สถานะ</Th>
                      <Th></Th>
                    </tr>
                  </Thead>
                  <Tbody>
                    {loading ? (
                      <tr><Td colSpan={7}><div className="py-8 text-center text-stone-400">กำลังโหลด...</div></Td></tr>
                    ) : data.pending_pos.length === 0 ? (
                      <tr><Td colSpan={7}><div className="py-8 text-center text-stone-400 italic">ไม่มีรายการ PO ค้างรับ</div></Td></tr>
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
                            <Button size="sm">รับสินค้า</Button>
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

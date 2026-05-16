'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input, Select } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import { formatQty } from '@/lib/format';
import { useSession } from 'next-auth/react';
import type { Warehouse, PaginatedResponse } from '@/types';
import { ArrowLeft, MoreHorizontal, ScanLine, Calendar, CheckCircle2, Circle } from 'lucide-react';

interface GRNLine {
  po_line_item_id?: string;
  inbound_order_line_id?: string;
  product_id: string;
  product_label: string;
  sku: string;
  qty_ordered: number;
  qty_received: number;
  qty_on_hand: number;
  qty_available: number;
  lot_number: string;
  expiry_date: string;
  storage_location: string;
}

interface POItem {
  id: string;
  po_number: string;
  vendor_name: string;
}

interface PODetail {
  warehouse_id: string | null;
  lines: Array<{
    id: string;
    product_id: string;
    sku: string;
    name_th: string;
    qty_ordered: number;
    qty_received: number | null;
    qty_on_hand: number;
    qty_available: number;
  }>;
}

interface IODetail {
  id: string;
  io_number: string;
  vendor_name: string;
  warehouse_id: string;
  lines: Array<{
    id: string;
    product_id: string;
    sku: string;
    name_th: string;
    qty_ordered: number;
    qty_received: number;
    qty_available: number;
  }>;
}

type LineStatus = 'pending' | 'partial' | 'done';

function getLineStatus(line: GRNLine): LineStatus {
  if (line.qty_received >= line.qty_ordered && line.qty_ordered > 0) return 'done';
  if (line.qty_received > 0) return 'partial';
  return 'pending';
}

function expiryDaysLeft(dateStr: string): number | null {
  if (!dateStr) return null;
  const exp = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function ExpiryChip({ days }: { days: number | null }) {
  if (days === null) return null;
  const cls = days >= 90
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : days >= 30
    ? 'bg-amber-50 text-amber-700 border-amber-300'
    : 'bg-red-50 text-red-700 border-red-200';
  return (
    <span className={`text-[11px] font-bold border rounded-full px-2 py-0.5 ${cls}`}>
      {days > 0 ? `เหลือ ${days} วัน` : days === 0 ? 'หมดวันนี้' : `หมดแล้ว ${Math.abs(days)} วัน`}
    </span>
  );
}

function NewGRNPageInner() {
  const router = useRouter();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const poIdParam = searchParams.get('po_id');
  const ioIdParam = searchParams.get('io_id');
  const mode = ioIdParam ? 'io' : 'po';

  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([]);
  const [poOptions, setPoOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedPoId, setSelectedPoId] = useState(poIdParam ?? '');
  const [ioDetail, setIoDetail] = useState<IODetail | null>(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<GRNLine[]>([]);
  const [activeLine, setActiveLine] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    get<Warehouse[]>('/api/admin/warehouses').then((data) =>
      setWarehouses(data.map((w) => ({ value: w.id, label: `${w.code} — ${w.name_th}` })))
    );
    if (mode === 'po') {
      get<PaginatedResponse<POItem>>('/api/purchase-orders?status=sent&limit=100').then((r) =>
        setPoOptions(r.data.map((po) => ({ value: po.id, label: `${po.po_number} — ${po.vendor_name}` })))
      );
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'po' || !selectedPoId) { if (mode === 'po') setLines([]); return; }
    get<PODetail>(`/api/purchase-orders/${selectedPoId}`).then((po) => {
      setWarehouseId(po.warehouse_id ?? '');
      setLines(
        (po.lines ?? []).map((l) => ({
          po_line_item_id: l.id,
          product_id: l.product_id,
          product_label: `${l.sku} — ${l.name_th}`,
          sku: l.sku,
          qty_ordered: Number(l.qty_ordered),
          qty_received: Number(l.qty_ordered) - Number(l.qty_received ?? 0),
          qty_on_hand: Number(l.qty_on_hand ?? 0),
          qty_available: Number(l.qty_available ?? 0),
          lot_number: '',
          expiry_date: '',
          storage_location: '',
        }))
      );
      setActiveLine(0);
    });
  }, [selectedPoId, mode]);

  useEffect(() => {
    if (mode !== 'io' || !ioIdParam) return;
    get<IODetail>(`/api/inbound-orders/${ioIdParam}`).then((io) => {
      setIoDetail(io);
      setWarehouseId(io.warehouse_id);
      setLines(
        (io.lines ?? []).map((l) => ({
          inbound_order_line_id: l.id,
          product_id: l.product_id,
          product_label: `${l.sku} — ${l.name_th}`,
          sku: l.sku,
          qty_ordered: Number(l.qty_ordered),
          qty_received: Math.max(0, Number(l.qty_ordered) - Number(l.qty_received)),
          qty_on_hand: 0,
          qty_available: Number(l.qty_available ?? 0),
          lot_number: '',
          expiry_date: '',
          storage_location: '',
        }))
      );
      setActiveLine(0);
    });
  }, [ioIdParam, mode]);

  function updateLine(i: number, key: keyof GRNLine, val: string | number) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  }

  function saveLine() {
    const next = lines.findIndex((l, i) => i > activeLine && getLineStatus(l) === 'pending');
    if (next !== -1) setActiveLine(next);
    else {
      const anyPending = lines.findIndex((l) => getLineStatus(l) === 'pending');
      if (anyPending !== -1) setActiveLine(anyPending);
    }
  }

  function skipLine() {
    const next = lines.findIndex((l, i) => i > activeLine && getLineStatus(l) !== 'done');
    if (next !== -1) setActiveLine(next);
  }

  async function handleSubmit() {
    if (mode === 'po' && !selectedPoId) { setError('กรุณาเลือกใบสั่งซื้อ'); return; }
    if (mode === 'io' && !ioIdParam) { setError('ไม่พบรหัส IO'); return; }
    if (!warehouseId) { setError('กรุณาเลือกคลังสินค้า'); return; }
    if (lines.length === 0) { setError('ไม่มีรายการสินค้า'); return; }
    const activeLines = lines.filter((l) => l.qty_received > 0);
    if (activeLines.length === 0) { setError('กรุณาระบุจำนวนที่รับ'); return; }

    setError('');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        warehouse_id: warehouseId,
        received_date: receivedDate,
        notes: notes || undefined,
        lines: activeLines.map((l) => ({
          po_line_item_id: l.po_line_item_id,
          inbound_order_line_id: l.inbound_order_line_id,
          product_id: l.product_id,
          qty_received: l.qty_received,
          lot_number: l.lot_number || undefined,
          expiry_date: l.expiry_date || undefined,
          storage_location: l.storage_location || undefined,
        })),
      };
      if (mode === 'po') payload.po_id = selectedPoId;
      else payload.inbound_order_id = ioIdParam;
      const result = await post<{ id: string }>('/api/grn', payload);
      router.push(`/app/grn/${result.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  const doneCount = lines.filter((l) => getLineStatus(l) !== 'pending').length;
  const totalCount = lines.length;
  const allDone = doneCount === totalCount && totalCount > 0;
  const docNumber = mode === 'io' ? ioDetail?.io_number : undefined;
  const vendorName = mode === 'io' ? ioDetail?.vendor_name : undefined;
  const activeL = lines[activeLine];

  // ── Mobile layout ──────────────────────────────────────────────
  const MobileView = (
    <div className="flex flex-col min-h-screen bg-stone-50">
      {/* Header */}
      <div className="flex items-center px-4 pt-4 pb-3 bg-white border-b border-stone-100 flex-shrink-0">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100 -ml-1">
          <ArrowLeft className="w-5 h-5 text-stone-700" />
        </button>
        <div className="flex-1 text-center">
          <p className="text-[15px] font-semibold text-stone-900 leading-tight">
            รับสินค้า · {docNumber ?? (mode === 'po' ? selectedPoId.slice(0, 8) : '—')}
          </p>
          {vendorName && <p className="text-[12px] text-stone-400 leading-tight mt-0.5">{vendorName}</p>}
        </div>
        <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100">
          <MoreHorizontal className="w-5 h-5 text-stone-700" />
        </button>
      </div>

      {/* Progress bar */}
      {lines.length > 0 && (
        <div className="px-4 pt-3 pb-1 bg-white flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: totalCount > 0 ? `${(doneCount / totalCount) * 100}%` : '0%' }}
            />
          </div>
          <span className="text-[11px] font-mono text-stone-400 flex-shrink-0">{doneCount}/{totalCount}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-28">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-stone-300">
            <p className="text-sm">ไม่มีรายการสินค้า</p>
            {mode === 'po' && !selectedPoId && (
              <p className="text-xs mt-1 text-stone-400">เลือก PO ก่อน</p>
            )}
          </div>
        ) : (
          <>
            {/* Scan banner */}
            <div className="bg-stone-900 text-white rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ScanLine className="w-5 h-5 text-stone-400" />
                <div>
                  <p className="text-[13px] font-semibold">สแกนบาร์โค้ดสินค้า</p>
                  <p className="text-[11px] text-stone-400">สแกนเพื่อข้ามไปยังรายการที่ตรงกัน</p>
                </div>
              </div>
              <button className="border border-stone-600 text-stone-300 text-[12px] px-3 py-1.5 rounded-lg hover:bg-stone-800">
                เปิดกล้อง
              </button>
            </div>

            {/* Active line card */}
            {activeL && (
              <div className="rounded-2xl bg-white border-2 border-emerald-300 ring-2 ring-emerald-100 p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-mono text-emerald-700">{activeL.sku}</p>
                    <p className="text-[14.5px] font-semibold text-stone-900 leading-snug mt-0.5">{activeL.product_label.split(' — ')[1] ?? activeL.product_label}</p>
                  </div>
                  {getLineStatus(activeL) === 'partial' && (
                    <span className="text-[10px] font-bold text-amber-700 border border-amber-300 bg-amber-50 rounded-full px-2 py-0.5 flex-shrink-0">รับบางส่วน</span>
                  )}
                </div>

                {/* Qty stepper */}
                <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 space-y-2">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-stone-500">จำนวนที่รับ</span>
                    <span className="text-stone-400 font-mono">สั่ง {formatQty(activeL.qty_ordered)}</span>
                  </div>
                  <div className="flex justify-center items-center gap-2.5">
                    <button
                      onClick={() => updateLine(activeLine, 'qty_received', Math.max(0, activeL.qty_received - 1))}
                      className="w-11 h-11 rounded-xl border border-stone-200 bg-white flex items-center justify-center text-stone-700 text-xl font-bold hover:bg-stone-100 active:scale-95"
                    >−</button>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={activeL.qty_received || ''}
                      onChange={(e) => updateLine(activeLine, 'qty_received', parseFloat(e.target.value) || 0)}
                      className="w-32 h-11 text-center text-2xl font-mono border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                    />
                    <button
                      onClick={() => updateLine(activeLine, 'qty_received', activeL.qty_received + 1)}
                      className="w-11 h-11 rounded-xl border border-stone-200 bg-white flex items-center justify-center text-stone-700 text-xl font-bold hover:bg-stone-100 active:scale-95"
                    >+</button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button onClick={() => updateLine(activeLine, 'qty_received', activeL.qty_received + 10)}
                      className="py-1.5 border border-stone-200 bg-white rounded-lg text-[12px] font-mono font-bold text-stone-700 hover:bg-stone-50">
                      +10
                    </button>
                    <button onClick={() => updateLine(activeLine, 'qty_received', activeL.qty_ordered)}
                      className="py-1.5 border border-emerald-200 bg-emerald-50 rounded-lg text-[12px] font-bold text-emerald-700 hover:bg-emerald-100">
                      รับครบ
                    </button>
                    <button onClick={() => updateLine(activeLine, 'qty_received', Math.max(0, activeL.qty_received - 1))}
                      className="py-1.5 border border-stone-200 bg-white rounded-lg text-[12px] font-mono font-bold text-stone-700 hover:bg-stone-50">
                      −1
                    </button>
                  </div>
                </div>

                {/* Lot + Location */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-stone-400 mb-1 block">LOT NO.</label>
                    <input
                      value={activeL.lot_number}
                      onChange={(e) => updateLine(activeLine, 'lot_number', e.target.value)}
                      placeholder="L12345"
                      className="w-full h-11 px-3 border border-stone-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-stone-300"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-stone-400 mb-1 block">ตำแหน่งเก็บ</label>
                    <input
                      value={activeL.storage_location}
                      onChange={(e) => updateLine(activeLine, 'storage_location', e.target.value)}
                      placeholder="A-01"
                      className="w-full h-11 px-3 border border-stone-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-stone-300"
                    />
                  </div>
                </div>

                {/* Expiry date */}
                <div>
                  <label className="text-[11px] text-stone-400 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> วันหมดอายุ
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-stone-700">
                      {activeL.expiry_date || '—'}
                    </span>
                    <ExpiryChip days={expiryDaysLeft(activeL.expiry_date)} />
                    <div className="ml-auto">
                      <input
                        type="date"
                        value={activeL.expiry_date}
                        onChange={(e) => updateLine(activeLine, 'expiry_date', e.target.value)}
                        className="h-8 px-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button onClick={skipLine}
                    className="h-10 border border-stone-200 rounded-xl text-[13px] font-semibold text-stone-600 hover:bg-stone-50">
                    ข้ามไปก่อน
                  </button>
                  <button onClick={saveLine}
                    className="h-10 bg-emerald-600 text-white rounded-xl text-[13px] font-semibold hover:bg-emerald-700 active:scale-[0.98]">
                    บันทึก →
                  </button>
                </div>
              </div>
            )}

            {/* Line checklist */}
            <div>
              <p className="text-[12px] font-semibold text-stone-500 mb-2">รายการทั้งหมด · {totalCount} SKU</p>
              <div className="space-y-1.5">
                {lines.map((l, i) => {
                  const status = getLineStatus(l);
                  const isActive = i === activeLine;
                  return (
                    <button
                      key={i}
                      onClick={() => setActiveLine(i)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl bg-white border text-left transition-all ${
                        isActive ? 'border-emerald-300 ring-1 ring-emerald-100' :
                        status === 'done' ? 'border-stone-100 opacity-70' : 'border-stone-200'
                      }`}
                    >
                      {status === 'done' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      ) : status === 'partial' ? (
                        <div className="w-5 h-5 rounded-full border-2 border-amber-400 bg-amber-100 flex-shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-stone-300 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-stone-800 truncate">{l.product_label.split(' — ')[1] ?? l.product_label}</p>
                        <p className="text-[11px] font-mono text-stone-400">{l.sku}</p>
                      </div>
                      <span className={`text-[12px] font-mono font-bold flex-shrink-0 ${
                        status === 'done' ? 'text-emerald-600' : status === 'partial' ? 'text-amber-600' : 'text-stone-400'
                      }`}>
                        {formatQty(l.qty_received)}/{formatQty(l.qty_ordered)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      </div>

      {/* Sticky bottom submit */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-white border-t border-stone-200 z-40">
        <button
          onClick={handleSubmit}
          disabled={!allDone || saving}
          className={`w-full h-12 rounded-xl text-[14px] font-semibold transition-all ${
            allDone
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-stone-200 text-stone-400 cursor-not-allowed'
          }`}
        >
          {saving ? 'กำลังบันทึก...' : allDone
            ? 'ส่งใบรับสินค้า ✓'
            : `ส่งใบรับสินค้า · ยังเหลืออีก ${totalCount - doneCount} รายการ`}
        </button>
      </div>
    </div>
  );

  // ── Desktop layout ──────────────────────────────────────────────
  const DesktopView = (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {mode === 'io' ? 'รับสินค้า (Inbound Order)' : 'รับสินค้า (Purchase Order)'}
        </h1>
        <button className="text-sm text-gray-500 hover:underline" onClick={() => router.back()}>← ย้อนกลับ</button>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-stone-200 p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            {mode === 'po' ? (
              <Select
                label="ใบสั่งซื้อ *"
                value={selectedPoId}
                onChange={(e) => setSelectedPoId(e.target.value)}
                options={poOptions}
                placeholder="เลือกใบสั่งซื้อ (สถานะ sent)"
              />
            ) : (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <p className="text-xs text-blue-600 font-medium uppercase mb-1">Inbound Order</p>
                <p className="font-mono text-sm font-bold text-blue-900">{ioDetail?.io_number}</p>
                <p className="text-xs text-blue-700 mt-1">{ioDetail?.vendor_name}</p>
              </div>
            )}
            <Select
              label="คลังสินค้า *"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              options={warehouses}
              placeholder="เลือกคลังสินค้า"
              disabled={mode === 'io'}
            />
          </div>
          <div className="space-y-4">
            <Input label="วันที่รับสินค้า *" type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
            <Input label="หมายเหตุ" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="bg-stone-50 rounded-lg p-4 flex flex-col justify-center">
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">ผู้รับสินค้า</label>
            <p className="text-sm font-semibold text-stone-900">{session?.user?.name ?? '—'}</p>
            <p className="text-xs text-stone-400 mt-1">บันทึกอัตโนมัติจากผู้ใช้ที่ล็อกอิน</p>
          </div>
        </div>

        {lines.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-stone-700 mb-3">รายการสินค้า</h2>
            <div className="border border-stone-200 rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="text-left p-3 font-medium text-stone-600 min-w-[200px]">สินค้า</th>
                    <th className="text-right p-3 font-medium text-stone-600 w-24">สต็อกเดิม</th>
                    <th className="text-right p-3 font-medium text-stone-600 w-24">{mode === 'io' ? 'สั่ง IO' : 'สั่งคงเหลือ'}</th>
                    <th className="text-right p-3 font-medium text-stone-600 w-24">รับครั้งนี้</th>
                    <th className="p-3 font-medium text-stone-600 w-32">Lot Number</th>
                    <th className="p-3 font-medium text-stone-600 w-32">ตำแหน่งเก็บ</th>
                    <th className="p-3 font-medium text-stone-600 w-36">วันหมดอายุ</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-t border-stone-100">
                      <td className="p-3">{l.product_label}</td>
                      <td className={`p-3 text-right font-mono tabular-nums ${l.qty_available <= 0 ? 'text-red-500 font-bold' : l.qty_available < 10 ? 'text-amber-600' : 'text-stone-500'}`}>
                        {formatQty(l.qty_available)}
                      </td>
                      <td className="p-3 text-right text-stone-500 font-mono tabular-nums">{formatQty(l.qty_ordered)}</td>
                      <td className="p-2">
                        <input type="number" min="0" step="any" value={l.qty_received}
                          onChange={(e) => updateLine(i, 'qty_received', parseFloat(e.target.value) || 0)}
                          className="w-full text-right rounded-lg border border-stone-200 px-2 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-stone-300" />
                      </td>
                      <td className="p-2">
                        <input value={l.lot_number} onChange={(e) => updateLine(i, 'lot_number', e.target.value)}
                          className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-stone-300" placeholder="LOT..." />
                      </td>
                      <td className="p-2">
                        <input value={l.storage_location} onChange={(e) => updateLine(i, 'storage_location', e.target.value)}
                          className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300" placeholder="A-1" />
                      </td>
                      <td className="p-2">
                        <div className="space-y-1">
                          <input type="date" value={l.expiry_date} onChange={(e) => updateLine(i, 'expiry_date', e.target.value)}
                            className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300" />
                          <ExpiryChip days={expiryDaysLeft(l.expiry_date)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {mode === 'po' && !selectedPoId && (
          <p className="text-sm text-stone-400 text-center py-8 border-2 border-dashed border-stone-200 rounded-lg">
            เลือกใบสั่งซื้อก่อนเพื่อโหลดรายการสินค้า
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <Button onClick={handleSubmit} loading={saving} disabled={(mode === 'po' && !selectedPoId) || lines.length === 0}>
            {mode === 'io' ? 'บันทึกการรับสินค้า' : 'สร้าง GRN'}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="md:hidden">{MobileView}</div>
      <div className="hidden md:block">{DesktopView}</div>
    </>
  );
}

export default function NewGRNPage() {
  return (
    <Suspense>
      <NewGRNPageInner />
    </Suspense>
  );
}

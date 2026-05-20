'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input, Select } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import { formatQty } from '@/lib/format';
import type { Warehouse, PaginatedResponse } from '@/types';
import {
  ArrowLeft,
  Plus,
  Trash2,
  User,
  Search,
  Landmark,
  FileText,
  BadgeAlert,
  Inbox
} from 'lucide-react';
import { parseBuddhistDate, todayBE } from '@/lib/date-utils';

interface GRNLine {
  po_line_item_id?: string;
  inbound_order_line_id?: string;
  product_id: string;
  sku: string;
  product_name: string;
  qty_ordered: number;
  qty_received: number;
  unit: string;
  expiry_date_be: string;    // Thai BE display string "วว/ดด/ปปปป"
  mfg_date_be: string;
  date_type: 'expiry' | 'mfg';
  storage_location: string;
  stock_on_hand: number;     // from API GET
}

interface BonusItem {
  product_id?: string;
  product_name: string;
  sku?: string;
  qty: number;
  unit: string;
  expiry_date_be: string;
  notes: string;
}

interface POItem {
  id: string;
  po_number: string;
  vendor_name: string;
}

interface PODetail {
  po_number: string;
  warehouse_id: string | null;
  vendor_name: string;
  lines: Array<{
    id: string;
    product_id: string;
    sku: string;
    name_th: string;
    qty_ordered: number;
    qty_received: number | null;
    qty_on_hand: number;
    qty_available: number;
    uom_code: string;
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
    uom_code: string;
  }>;
}

interface ProductSearchResult {
  id: string;
  sku: string;
  name_th: string;
  uom_code: string | null;
}

function expiryDaysLeft(beStr: string): number | null {
  if (!beStr || !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(beStr)) return null;
  const isoStr = parseBuddhistDate(beStr);
  if (!isoStr) return null;
  const exp = new Date(isoStr);
  const now = new Date();
  // Clear times to compare dates
  exp.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function ExpiryChip({ days }: { days: number | null }) {
  if (days === null) return null;
  const cls = days >= 90
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : days >= 30
    ? 'bg-amber-50 text-amber-700 border-amber-300'
    : 'bg-rose-50 text-rose-700 border-rose-200';
  return (
    <span className={`text-[11px] font-semibold border rounded-full px-2.5 py-0.5 inline-flex items-center ${cls}`}>
      {days > 0 ? `เหลือ ${days} วัน` : days === 0 ? 'หมดวันนี้' : `หมดอายุแล้ว ${Math.abs(days)} วัน`}
    </span>
  );
}

function NewGRNPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const poIdParam = searchParams.get('po_id');
  const ioIdParam = searchParams.get('io_id');
  const mode = ioIdParam ? 'io' : 'po';

  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([]);
  const [poOptions, setPoOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedPoId, setSelectedPoId] = useState(poIdParam ?? '');
  const [ioDetail, setIoDetail] = useState<IODetail | null>(null);
  const [poDetail, setPoDetail] = useState<PODetail | null>(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [receivedDate, setReceivedDate] = useState(todayBE());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<GRNLine[]>([]);
  const [bonusItems, setBonusItems] = useState<BonusItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // W2 Lift Fee state
  const [receivedByNames, setReceivedByNames] = useState('');
  const [liftFeeRounds, setLiftFeeRounds] = useState(0);
  const [liftFeePayment, setLiftFeePayment] = useState<'cash'|'credit'>('cash');
  const [isW2Warehouse, setIsW2Warehouse] = useState(false);
  const [warehouseList, setWarehouseList] = useState<{ id: string; code: string; name_th: string }[]>([]);

  // Autocomplete search queries/results states for bonus items
  const [searchQueries, setSearchQueries] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<ProductSearchResult[][]>([]);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);

  useEffect(() => {
    get<Warehouse[]>('/api/admin/warehouses').then((data) => {
      setWarehouseList(data);
      setWarehouses(data.map((w) => ({ value: w.id, label: `${w.code} — ${w.name_th}` })));
    });
    if (mode === 'po') {
      get<PaginatedResponse<POItem>>('/api/purchase-orders?status=sent&limit=100').then((r) =>
        setPoOptions(r.data.map((po) => ({ value: po.id, label: `${po.po_number} — ${po.vendor_name}` })))
      );
    }
  }, [mode]);

  useEffect(() => {
    const w = warehouseList.find((wh) => wh.id === warehouseId);
    const w2Active = w?.code === 'W2';
    setIsW2Warehouse(w2Active);
    if (!w2Active) {
      setLiftFeeRounds(0);
    }
  }, [warehouseId, warehouseList]);

  useEffect(() => {
    if (mode !== 'po' || !selectedPoId) {
      if (mode === 'po') {
        setLines([]);
        setPoDetail(null);
      }
      return;
    }
    get<PODetail>(`/api/purchase-orders/${selectedPoId}`).then((po) => {
      setPoDetail(po);
      setWarehouseId(po.warehouse_id ?? '');
      setLines(
        (po.lines ?? []).map((l) => ({
          po_line_item_id: l.id,
          product_id: l.product_id,
          sku: l.sku,
          product_name: l.name_th,
          qty_ordered: Number(l.qty_ordered),
          qty_received: Math.max(0, Number(l.qty_ordered) - Number(l.qty_received ?? 0)),
          unit: l.uom_code || 'ชิ้น',
          expiry_date_be: todayBE(),
          mfg_date_be: '',
          date_type: 'expiry',
          storage_location: '',
          stock_on_hand: Number(l.qty_on_hand ?? l.qty_available ?? 0),
        }))
      );
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
          sku: l.sku,
          product_name: l.name_th,
          qty_ordered: Number(l.qty_ordered),
          qty_received: Math.max(0, Number(l.qty_ordered) - Number(l.qty_received)),
          unit: l.uom_code || 'ชิ้น',
          expiry_date_be: todayBE(),
          mfg_date_be: '',
          date_type: 'expiry',
          storage_location: '',
          stock_on_hand: Number(l.qty_available ?? 0),
        }))
      );
    });
  }, [ioIdParam, mode]);

  function updateLine(i: number, key: keyof GRNLine, val: string | number) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  }

  const handleAddBonusItem = () => {
    setBonusItems([
      ...bonusItems,
      {
        product_id: undefined,
        product_name: '',
        qty: 1,
        unit: 'ชิ้น',
        expiry_date_be: todayBE(),
        notes: '',
      },
    ]);
    setSearchQueries([...searchQueries, '']);
    setSearchResults([...searchResults, []]);
  };

  const handleRemoveBonusItem = (index: number) => {
    setBonusItems(bonusItems.filter((_, i) => i !== index));
    setSearchQueries(searchQueries.filter((_, i) => i !== index));
    setSearchResults(searchResults.filter((_, i) => i !== index));
    if (dropdownOpen === index) {
      setDropdownOpen(null);
    }
  };

  const handleSearchChange = async (index: number, val: string) => {
    const newQueries = [...searchQueries];
    newQueries[index] = val;
    setSearchQueries(newQueries);

    const newItems = [...bonusItems];
    newItems[index].product_name = val;
    newItems[index].product_id = undefined;
    newItems[index].sku = undefined;
    setBonusItems(newItems);

    if (!val.trim()) {
      const newResults = [...searchResults];
      newResults[index] = [];
      setSearchResults(newResults);
      return;
    }

    try {
      const res = await get<{ data: ProductSearchResult[] }>(
        `/api/products?search=${encodeURIComponent(val)}&limit=10`
      );
      const newResults = [...searchResults];
      newResults[index] = res.data ?? [];
      setSearchResults(newResults);
    } catch (e) {
      console.error('Bonus product search error', e);
    }
  };

  const handleSelectProduct = (index: number, product: ProductSearchResult) => {
    const newItems = [...bonusItems];
    newItems[index].product_id = product.id;
    newItems[index].product_name = product.name_th;
    newItems[index].sku = product.sku;
    newItems[index].unit = product.uom_code ?? 'ชิ้น';
    setBonusItems(newItems);

    const newQueries = [...searchQueries];
    newQueries[index] = product.name_th;
    setSearchQueries(newQueries);

    const newResults = [...searchResults];
    newResults[index] = [];
    setSearchResults(newResults);
    setDropdownOpen(null);
  };

  async function handleSubmit(submitMode: 'draft' | 'submit') {
    if (mode === 'po' && !selectedPoId) {
      setError('กรุณาเลือกใบสั่งซื้อ / Please select a Purchase Order');
      return;
    }
    if (mode === 'io' && !ioIdParam) {
      setError('ไม่พบรหัส IO / Inbound Order ID not found');
      return;
    }
    if (!warehouseId) {
      setError('กรุณาเลือกคลังสินค้า / Please select a warehouse');
      return;
    }
    if (lines.length === 0) {
      setError('ไม่มีรายการสินค้า / No items found');
      return;
    }

    // Date validation
    if (!receivedDate || !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(receivedDate)) {
      setError('รูปแบบวันที่ไม่ถูกต้อง กรุณาระบุในรูปแบบ วว/ดด/ปปปป');
      return;
    }
    const gregorianATA = parseBuddhistDate(receivedDate);
    if (!gregorianATA) {
      setError('วันที่มาส่งไม่ถูกต้อง / Invalid ATA Date');
      return;
    }

    const activeLines = lines.filter((l) => l.qty_received > 0);
    if (activeLines.length === 0 && bonusItems.length === 0) {
      setError('กรุณาระบุจำนวนที่รับอย่างน้อย 1 รายการ');
      return;
    }

    // Line date validations
    for (const l of activeLines) {
      const targetDate = l.date_type === 'expiry' ? l.expiry_date_be : l.mfg_date_be;
      if (targetDate) {
        if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(targetDate)) {
          setError(`รูปแบบวันที่ในรายการสินค้า ${l.sku} ไม่ถูกต้อง (ระบุ วว/ดด/ปปปป)`);
          return;
        }
      }
    }

    // Bonus date validation
    for (const b of bonusItems) {
      if (b.expiry_date_be) {
        if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(b.expiry_date_be)) {
          setError(`รูปแบบวันที่ควบคุมในของแถม ${b.product_name} ไม่ถูกต้อง (ระบุ วว/ดด/ปปปป)`);
          return;
        }
      }
    }

    if (submitMode === 'submit' && !receivedByNames.trim()) {
      setError('กรุณาระบุชื่อผู้รับลงสินค้า / Please enter staff names');
      return;
    }

    setError('');
    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        warehouse_id: warehouseId,
        received_date: gregorianATA,
        notes: notes || undefined,
        received_by_names: receivedByNames || undefined,
        lift_fee_rounds: isW2Warehouse ? liftFeeRounds : 0,
        lift_fee_payment_method: isW2Warehouse ? liftFeePayment : null,
        lines: activeLines.map((l) => ({
          po_line_item_id: l.po_line_item_id,
          inbound_order_line_id: l.inbound_order_line_id,
          product_id: l.product_id,
          qty_received: l.qty_received,
          storage_location: l.storage_location || undefined,
          date_type: l.date_type,
          expiry_date: l.date_type === 'expiry' ? (l.expiry_date_be ? parseBuddhistDate(l.expiry_date_be) : undefined) : undefined,
          mfg_date: l.date_type === 'mfg' ? (l.mfg_date_be ? parseBuddhistDate(l.mfg_date_be) : undefined) : undefined,
        })),
        bonus_items: bonusItems.map((b) => ({
          product_id: b.product_id || null,
          product_name: b.product_name,
          qty: b.qty,
          unit: b.unit || null,
          expiry_date: b.expiry_date_be ? parseBuddhistDate(b.expiry_date_be) : null,
          notes: b.notes || null,
        })),
      };

      if (mode === 'po') {
        payload.po_id = selectedPoId;
      } else {
        payload.inbound_order_id = ioIdParam;
      }

      const result = await post<{ id: string }>('/api/grn', payload);

      if (submitMode === 'submit') {
        const grnDetail = await get<{ lines: { id: string; qty_received: number; storage_location: string }[] }>(`/api/grn/${result.id}`);
        await post(`/api/grn/${result.id}/receive`, {
          delivery_date: gregorianATA,
          receiver_name: receivedByNames || undefined,
          lines: (grnDetail.lines ?? []).map((l) => ({
            id: l.id,
            qty_received: Number(l.qty_received),
            storage_location: l.storage_location || undefined,
          })),
        });
      }

      router.push(`/app/grn/${result.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการบันทึก / Save failed');
    } finally {
      setSaving(false);
    }
  }

  const docNumber = mode === 'io' ? ioDetail?.io_number : (poDetail?.po_number ?? '—');
  const vendorName = mode === 'io' ? ioDetail?.vendor_name : (poDetail?.vendor_name ?? '—');

  return (
    <div className="flex flex-col min-h-screen bg-stone-50/50 pb-32">
      {/* Header bar */}
      <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-stone-200/80 px-4 py-3 flex items-center justify-between z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-stone-100 transition-all text-stone-700 active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-0.5 uppercase tracking-wider">
                {mode.toUpperCase()} RECEIVING
              </span>
              {isW2Warehouse && (
                <span className="text-[12px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5 uppercase">
                  W2 Warehouse
                </span>
              )}
            </div>
            <h1 className="text-[16px] font-bold text-stone-900 leading-tight mt-1 flex items-center gap-1.5 font-mono">
              <FileText className="w-4 h-4 text-stone-400" /> {docNumber}
            </h1>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-[12px] text-stone-500 font-medium">ผู้จำหน่าย / Vendor</p>
          <p className="text-[14px] font-bold text-stone-800">{vendorName}</p>
        </div>
      </div>

      <div className="max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Info card */}
        <div className="rounded-2xl bg-white border border-stone-200/80 shadow-sm p-5 space-y-4">
          <div className="border-b border-stone-100 pb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-stone-800 flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-500" /> ข้อมูลการรับลงสินค้า / ATA Header Info
            </h2>
            <span className="text-xs text-rose-500 font-medium font-mono">* จำเป็น / Required</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mode === 'po' && (
              <div className="md:col-span-1">
                <Select
                  label="ใบสั่งซื้อ / Purchase Order *"
                  value={selectedPoId}
                  onChange={(e) => setSelectedPoId(e.target.value)}
                  options={poOptions}
                  placeholder="เลือกใบสั่งซื้อ (sent)"
                  className="w-full"
                />
              </div>
            )}

            <div className={mode === 'po' ? 'md:col-span-1' : 'md:col-span-1'}>
              <Select
                label="คลังรับสินค้า / Warehouse *"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                options={warehouses}
                placeholder="เลือกคลังสินค้า"
                disabled={mode === 'io'}
                className="w-full"
              />
            </div>

            <div>
              <Input
                label="วันที่มาส่ง (ATA) *"
                placeholder="วว/ดด/ปปปป"
                maxLength={10}
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="font-mono text-[14px]"
                helperText="ระบุเป็นปี พ.ศ. เช่น 20/05/2569"
              />
            </div>

            <div className={mode === 'po' ? 'md:col-span-3' : 'md:col-span-2'}>
              <Input
                label="ผู้รับลงสินค้า / Staff Names *"
                placeholder="ชื่อทีมผู้รับลงสินค้า คั่นด้วยจุลภาค เช่น สมชาย, วิภา"
                value={receivedByNames}
                onChange={(e) => setReceivedByNames(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Product Lines List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[15px] font-bold text-stone-700 flex items-center gap-2">
              <Landmark className="w-4.5 h-4.5 text-stone-400" /> รายการสินค้าในบิล / Document Line Items
            </h2>
            <span className="text-[12px] font-mono text-stone-500 font-bold bg-stone-100 rounded-md px-2.5 py-0.5">
              {lines.length} SKU
            </span>
          </div>

          {lines.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-white p-12 text-center text-stone-400">
              <Inbox className="w-10 h-10 mx-auto text-stone-300 mb-2" />
              <p className="text-sm font-semibold">ไม่มีรายการสินค้าในบิล</p>
              {mode === 'po' && !selectedPoId && (
                <p className="text-xs text-stone-500 mt-1">กรุณาเลือกใบสั่งซื้อเพื่อแสดงรายการสินค้า</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Responsive Layout: Cards on mobile, elegant table-like structures on desktop */}
              {lines.map((l, i) => {
                const daysLeft = l.date_type === 'expiry' ? expiryDaysLeft(l.expiry_date_be) : null;
                return (
                  <div
                    key={i}
                    className="rounded-2xl bg-white border border-stone-200/80 shadow-sm p-4 hover:border-emerald-200 transition-all duration-200 group"
                  >
                    {/* Title block */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-stone-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-stone-400 bg-stone-100 px-2 py-0.5 rounded">
                            SKU: {l.sku}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-500">
                            สั่งมา: {formatQty(l.qty_ordered)} {l.unit}
                          </span>
                          <span className="text-xs font-semibold text-stone-500 bg-stone-50 px-2 py-0.5 border border-stone-100 rounded-md">
                            สต็อกเดิม: {formatQty(l.stock_on_hand)} {l.unit}
                          </span>
                        </div>
                        <h3 className="text-[14.5px] font-bold text-stone-800 leading-snug mt-1.5">
                          {l.product_name}
                        </h3>
                      </div>
                    </div>

                    {/* Inputs Block */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 pt-3">
                      <div>
                        <label className="text-[12px] font-semibold text-stone-600 block mb-1">จำนวนที่รับ ({l.unit})</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={l.qty_received || ''}
                          onChange={(e) => updateLine(i, 'qty_received', parseFloat(e.target.value) || 0)}
                          className="w-full h-9 px-3 text-[14px] font-mono rounded-[8px] border border-stone-200 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(16,185,129,0.14)]"
                        />
                      </div>

                      <div>
                        <label className="text-[12px] font-semibold text-stone-600 block mb-1">ตำแหน่งเก็บ / Storage</label>
                        <input
                          type="text"
                          placeholder="เช่น A-01-01"
                          value={l.storage_location}
                          onChange={(e) => updateLine(i, 'storage_location', e.target.value)}
                          className="w-full h-9 px-3 text-[13.5px] rounded-[8px] border border-stone-200 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(16,185,129,0.14)]"
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[12px] font-semibold text-stone-600 block">
                            {l.date_type === 'expiry' ? '📅 วันหมดอายุ (EXP)' : '🏭 วันที่ผลิต (MFG)'}
                          </label>
                          <button
                            type="button"
                            onClick={() => updateLine(i, 'date_type', l.date_type === 'expiry' ? 'mfg' : 'expiry')}
                            className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold underline underline-offset-2"
                          >
                            สลับเป็น {l.date_type === 'expiry' ? 'MFG' : 'EXP'}
                          </button>
                        </div>

                        <div className="flex gap-2 items-center">
                          <div className="flex-1">
                            <input
                              type="text"
                              placeholder="วว/ดด/ปปปป"
                              maxLength={10}
                              value={l.date_type === 'expiry' ? l.expiry_date_be : l.mfg_date_be}
                              onChange={(e) => updateLine(i, l.date_type === 'expiry' ? 'expiry_date_be' : 'mfg_date_be', e.target.value)}
                              className="w-full h-9 px-3 text-[14px] font-mono rounded-[8px] border border-stone-200 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(16,185,129,0.14)]"
                            />
                          </div>
                          {l.date_type === 'expiry' && daysLeft !== null && (
                            <div className="flex-shrink-0">
                              <ExpiryChip days={daysLeft} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ของแถม / สินค้านอกบิล (Bonus Items) */}
        <div className="rounded-2xl bg-white border border-stone-200/80 shadow-sm p-5 space-y-4">
          <div className="border-b border-stone-100 pb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-stone-800 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-emerald-500" /> ของแถม / สินค้านอกบิล (Bonus / Extra Items)
            </h2>
            <button
              type="button"
              onClick={handleAddBonusItem}
              className="text-[12.5px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl px-3 py-1.5 flex items-center gap-1.5 transition-all duration-150 active:scale-95"
            >
              <Plus className="w-4 h-4" /> เพิ่มของแถม
            </button>
          </div>

          {bonusItems.length === 0 ? (
            <p className="text-center text-stone-400 text-xs py-4">ไม่มีของแถม หรือ สินค้านอกบิลเพิ่มเติม</p>
          ) : (
            <div className="space-y-4">
              {bonusItems.map((b, i) => {
                const daysLeft = expiryDaysLeft(b.expiry_date_be);
                return (
                  <div
                    key={i}
                    className="p-4 rounded-xl border border-stone-200/80 bg-stone-50/50 flex flex-col gap-4 relative"
                  >
                    <button
                      type="button"
                      onClick={() => handleRemoveBonusItem(i)}
                      className="absolute top-3 right-3 text-stone-400 hover:text-rose-500 transition-colors p-1"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 pt-2">
                      {/* Product search box (autocomplete) */}
                      <div className="md:col-span-5 relative">
                        <label className="text-[12px] font-semibold text-stone-600 block mb-1">
                          ค้นหาสินค้าหรือคีย์ชื่อเอง / Product Name *
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="พิมพ์ค้น SKU/ชื่อ หรือ ระบุชื่อสินค้าใหม่..."
                            value={searchQueries[i] ?? b.product_name}
                            onChange={(e) => handleSearchChange(i, e.target.value)}
                            onFocus={() => setDropdownOpen(i)}
                            className="w-full h-9 pl-8 pr-3 text-[13.5px] rounded-[8px] border border-stone-200 bg-white focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(16,185,129,0.14)]"
                          />
                          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-stone-400" />
                        </div>

                        {b.sku && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">
                              Catalog Product (SKU: {b.sku})
                            </span>
                          </div>
                        )}

                        {/* Search Result Dropdown */}
                        {dropdownOpen === i && searchResults[i] && searchResults[i].length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-stone-200/90 rounded-[8px] shadow-lg max-h-48 overflow-y-auto z-40 text-[13px]">
                            {searchResults[i].map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleSelectProduct(i, p)}
                                className="w-full text-left px-3 py-2 hover:bg-emerald-50 flex items-center gap-2 border-b border-stone-50 last:border-0"
                              >
                                <span className="font-mono text-[10.5px] text-stone-400 bg-stone-100 rounded px-1">{p.sku}</span>
                                <span className="font-semibold text-stone-700 truncate">{p.name_th}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {/* Overlay to close the dropdown */}
                        {dropdownOpen === i && (
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setDropdownOpen(null)}
                          />
                        )}
                      </div>

                      {/* Qty */}
                      <div className="md:col-span-2">
                        <label className="text-[12px] font-semibold text-stone-600 block mb-1">จำนวนรับ / Qty</label>
                        <input
                          type="number"
                          min="0.001"
                          step="any"
                          value={b.qty || ''}
                          onChange={(e) => {
                            const newItems = [...bonusItems];
                            newItems[i].qty = parseFloat(e.target.value) || 0;
                            setBonusItems(newItems);
                          }}
                          className="w-full h-9 px-3 text-[14px] font-mono rounded-[8px] border border-stone-200 bg-white focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(16,185,129,0.14)]"
                        />
                      </div>

                      {/* Unit */}
                      <div className="md:col-span-1.5">
                        <label className="text-[12px] font-semibold text-stone-600 block mb-1">หน่วย / Unit</label>
                        <input
                          type="text"
                          placeholder="ชิ้น"
                          value={b.unit}
                          onChange={(e) => {
                            const newItems = [...bonusItems];
                            newItems[i].unit = e.target.value;
                            setBonusItems(newItems);
                          }}
                          className="w-full h-9 px-3 text-[13.5px] rounded-[8px] border border-stone-200 bg-white focus:outline-none focus:border-accent"
                        />
                      </div>

                      {/* Expiry BE */}
                      <div className="md:col-span-3.5 space-y-1">
                        <label className="text-[12px] font-semibold text-stone-600 block">วันหมดอายุ / EXP (วว/ดด/ปปปป)</label>
                        <div className="flex gap-2 items-center">
                          <div className="flex-1">
                            <input
                              type="text"
                              placeholder="วว/ดด/ปปปป"
                              maxLength={10}
                              value={b.expiry_date_be}
                              onChange={(e) => {
                                const newItems = [...bonusItems];
                                newItems[i].expiry_date_be = e.target.value;
                                setBonusItems(newItems);
                              }}
                              className="w-full h-9 px-3 text-[14px] font-mono rounded-[8px] border border-stone-200 bg-white focus:outline-none focus:border-accent"
                            />
                          </div>
                          {daysLeft !== null && (
                            <div className="flex-shrink-0">
                              <ExpiryChip days={daysLeft} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[12px] font-semibold text-stone-600 block mb-1">หมายเหตุของแถม / Line Notes</label>
                      <input
                        type="text"
                        placeholder="ระบุหมายเหตุ (ถ้ามี)..."
                        value={b.notes}
                        onChange={(e) => {
                          const newItems = [...bonusItems];
                          newItems[i].notes = e.target.value;
                          setBonusItems(newItems);
                        }}
                        className="w-full h-9 px-3 text-[13px] rounded-[8px] border border-stone-200 bg-white focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ค่าลิฟท์ (W2 only) */}
        {isW2Warehouse && (
          <div className="rounded-2xl bg-amber-50/50 border border-amber-200 shadow-sm p-5 space-y-4">
            <h2 className="text-[15px] font-bold text-amber-900 flex items-center gap-2">
              <Landmark className="w-[18px] h-[18px] text-amber-600" /> ค่าบริการยกสินค้าขึ้นอาคารชั้นบน (Lift Fee rounds)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div>
                <label className="text-[12px] font-semibold text-amber-800 block mb-1">จำนวนรอบขึ้นลิฟท์ / Rounds</label>
                <input
                  type="number"
                  min="0"
                  value={liftFeeRounds || ''}
                  onChange={(e) => setLiftFeeRounds(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full h-9 px-3 text-[14px] font-mono rounded-[8px] border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400"
                />
              </div>

              <div>
                <p className="text-[12px] font-semibold text-amber-800 mb-1">คำนวณเงินค่าลิฟท์ / Total Amount</p>
                <p className="text-[18px] font-extrabold text-amber-700 font-mono">
                  ฿{(liftFeeRounds * 50).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div>
                <span className="text-[12px] font-semibold text-amber-800 block mb-1">วิธีการจ่ายเงิน / Payment Method</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[13.5px] font-medium text-stone-700">
                    <input
                      type="radio"
                      name="lift_fee_payment"
                      value="cash"
                      checked={liftFeePayment === 'cash'}
                      onChange={() => setLiftFeePayment('cash')}
                      className="w-4 h-4 text-emerald-600"
                    />
                    <span>จ่ายสด (Cash)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[13.5px] font-medium text-stone-700">
                    <input
                      type="radio"
                      name="lift_fee_payment"
                      value="credit"
                      checked={liftFeePayment === 'credit'}
                      onChange={() => setLiftFeePayment('credit')}
                      className="w-4 h-4 text-emerald-600"
                    />
                    <span>เงินเชื่อ (Credit)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* หมายเหตุ */}
        <div className="rounded-2xl bg-white border border-stone-200/80 shadow-sm p-5 space-y-3">
          <label className="text-[14px] font-bold text-stone-700 block">หมายเหตุทั่วไป / Notes</label>
          <textarea
            rows={3}
            placeholder="เขียนข้อความหมายเหตุทั่วไปประกอบการรับลงสินค้า เช่น สภาพภายนอกกล่องชำรุด ฯลฯ"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-3 text-[13.5px] rounded-[8px] border border-stone-200 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(16,185,129,0.14)]"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-2.5">
            <BadgeAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-rose-800">เกิดข้อผิดพลาดในการตรวจสอบข้อมูล</p>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Sticky bottom submit buttons */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-white/95 backdrop-blur-md border-t border-stone-200/80 z-20 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
        <div className="max-w-4xl mx-auto flex gap-3">
          <button
            type="button"
            onClick={() => handleSubmit('draft')}
            disabled={saving || lines.length === 0}
            className="flex-1 h-11 rounded-xl border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-[13.5px] font-bold text-stone-700 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            ⏸ พักบิล (Save Draft)
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('submit')}
            disabled={saving || lines.length === 0}
            className="flex-[3] h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[13.5px] font-extrabold shadow-sm shadow-emerald-600/10 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-1.5"
          >
            {saving ? 'กำลังบันทึกข้อมูล...' : '✅ รับสินค้าเสร็จแล้ว (Complete Receive)'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NewGRNPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-gray-400">กำลังโหลด...</div>}>
      <NewGRNPageInner />
    </Suspense>
  );
}

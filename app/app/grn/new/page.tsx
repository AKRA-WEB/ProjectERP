'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input, Select, useToast } from '@/components/ui';
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
  Inbox,
  Barcode,
  Camera,
  Check,
  Loader2,
  Sparkles,
  XCircle,
  PackageX
} from 'lucide-react';
import { parseBuddhistDate, todayBE } from '@/lib/date-utils';
import { useT } from '@/lib/i18n';

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
  lot_no: string;            // added for mobile/UI lot tracking
  stock_on_hand: number;     // from API GET
  skipped: boolean;          // true = สินค้ายังไม่เข้า (not arrived)
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
  const t = useT();
  if (days === null) return null;
  const cls = days >= 90
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : days >= 30
    ? 'bg-amber-50 text-amber-700 border-amber-300'
    : 'bg-rose-50 text-rose-700 border-rose-200';
  return (
    <span className={`text-[11px] font-semibold border rounded-full px-2.5 py-0.5 inline-flex items-center ${cls}`}>
      {days > 0
        ? t('expiry.days_left_prefix') + days + t('expiry.days_left_suffix')
        : days === 0
        ? t('expiry.expires_today')
        : t('expiry.expired_prefix') + Math.abs(days) + t('expiry.expired_suffix')}
    </span>
  );
}

function NewGRNPageInner() {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const poIdParam = searchParams.get('po_id');
  const ioIdParam = searchParams.get('io_id');
  const mode = ioIdParam ? 'io' : 'po';

  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([]);
  const [poOptions, setPoOptions] = useState<{ value: string; label: string }[]>([]);
  const [loadingPo, setLoadingPo] = useState(false);
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

  // Auto-fill receiver name from session user (but keep editable)
  useEffect(() => {
    if (session?.user?.name && !receivedByNames) {
      setReceivedByNames(session.user.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.name]);

  // Mobile scan specific states
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [simulatedBarcode, setSimulatedBarcode] = useState('');
  const [showSimulatedScanner, setShowSimulatedScanner] = useState(false);

  const handleSimulatedScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulatedBarcode.trim()) return;
    const targetSku = simulatedBarcode.trim().toLowerCase();
    const idx = lines.findIndex((l) => l.sku.toLowerCase() === targetSku);
    if (idx >= 0) {
      setActiveIndex(idx);
      setSimulatedBarcode('');
      setShowSimulatedScanner(false);
      toast('success', t('grn.new.sku_found_prefix') + lines[idx].sku + t('grn.new.sku_found_suffix'));
    } else {
      toast('error', t('grn.new.sku_not_found_prefix') + simulatedBarcode + t('grn.new.sku_not_found_suffix'));
    }
  };

  // Auto-select first incomplete line when lines load
  useEffect(() => {
    if (lines.length > 0) {
      const idx = lines.findIndex((l) => Number(l.qty_received) === 0);
      setActiveIndex(idx >= 0 ? idx : 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length]);

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
      setLoadingPo(true);
      get<PaginatedResponse<POItem>>('/api/purchase-orders?status=sent&limit=100')
        .then((r) =>
          setPoOptions(r.data.map((po) => ({ value: po.id, label: `${po.po_number} — ${po.vendor_name}` })))
        )
        .catch(() => {})
        .finally(() => setLoadingPo(false));
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
          qty_received: 0,
          unit: l.uom_code || t('label.default_unit'),
          expiry_date_be: todayBE(),
          mfg_date_be: '',
          date_type: 'expiry',
          storage_location: '',
          lot_no: '',
          stock_on_hand: Number(l.qty_on_hand ?? l.qty_available ?? 0),
          skipped: false,
        }))
      );
    });
  }, [selectedPoId, mode, t]);

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
          qty_received: 0,
          unit: l.uom_code || t('label.default_unit'),
          expiry_date_be: todayBE(),
          mfg_date_be: '',
          date_type: 'expiry',
          storage_location: '',
          lot_no: '',
          stock_on_hand: Number(l.qty_available ?? 0),
          skipped: false,
        }))
      );
    });
  }, [ioIdParam, mode, t]);

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
        unit: t('label.default_unit'),
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
    newItems[index].unit = product.uom_code ?? t('label.default_unit');
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
      setError(t('grn.new.error_select_po'));
      return;
    }
    if (mode === 'io' && !ioIdParam) {
      setError(t('grn.new.error_io_id_not_found'));
      return;
    }
    if (!warehouseId) {
      setError(t('grn.new.error_select_warehouse'));
      return;
    }
    if (lines.length === 0) {
      setError(t('grn.new.error_no_items'));
      return;
    }

    // F-004: Validate that no received quantities or bonus quantities are negative
    for (const l of lines) {
      if (l.qty_received < 0) {
        setError(t('grn.new.error_received_qty_negative_prefix') + l.sku + t('grn.new.error_received_qty_negative_suffix'));
        return;
      }
    }
    for (const b of bonusItems) {
      if (b.qty < 0) {
        setError(t('grn.new.error_bonus_qty_negative_prefix') + b.product_name + t('grn.new.error_bonus_qty_negative_suffix'));
        return;
      }
    }

    // Date validation
    if (!receivedDate || !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(receivedDate)) {
      setError(t('grn.new.error_invalid_date_format'));
      return;
    }
    const gregorianATA = parseBuddhistDate(receivedDate);
    if (!gregorianATA) {
      setError(t('grn.new.error_invalid_ata_date'));
      return;
    }

    const activeLines = lines.filter((l) => l.qty_received > 0);
    if (activeLines.length === 0 && bonusItems.length === 0) {
      setError(t('grn.new.error_min_one_item'));
      return;
    }

    // Line date validations
    for (const l of activeLines) {
      const targetDate = l.date_type === 'expiry' ? l.expiry_date_be : l.mfg_date_be;
      if (targetDate) {
        if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(targetDate)) {
          setError(t('grn.new.error_line_date_invalid_prefix') + l.sku + t('grn.new.error_line_date_invalid_suffix'));
          return;
        }
      }
    }

    // Bonus date validation
    for (const b of bonusItems) {
      if (b.expiry_date_be) {
        if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(b.expiry_date_be)) {
          setError(t('grn.new.error_bonus_date_invalid_prefix') + b.product_name + t('grn.new.error_bonus_date_invalid_suffix'));
          return;
        }
      }
    }

    if (submitMode === 'submit' && !receivedByNames.trim()) {
      setError(t('grn.new.error_staff_names_required'));
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

        const skippedLines = lines.filter((l) => l.qty_received === 0);
        if (skippedLines.length > 0 && mode === 'io' && ioIdParam) {
          // Partial receive: redirect to new GRN for remaining items
          toast('success', t('grn.new.toast_partial_receive_1') + activeLines.length + t('grn.new.toast_partial_receive_2') + skippedLines.length + t('grn.new.toast_partial_receive_3'));
          router.push(`/app/grn/new?io_id=${ioIdParam}`);
        } else {
          toast('success', t('grn.new.toast_receive_success'));
          router.push('/app/grn/receiving-queue');
        }
      } else {
        toast('success', t('grn.new.toast_draft_success'));
        router.push('/app/grn/receiving-queue');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('grn.new.error_save_failed'));
    } finally {
      setSaving(false);
    }
  }

  const docNumber = mode === 'io' ? ioDetail?.io_number : (poDetail?.po_number ?? '—');
  const vendorName = mode === 'io' ? ioDetail?.vendor_name : (poDetail?.vendor_name ?? '—');

  const itemsSuccessCount = lines.filter((l) => Number(l.qty_received) > 0).length;
  const itemsSkippedCount = lines.filter((l) => l.skipped).length;
  const progressPercent = lines.length > 0 ? ((itemsSuccessCount + itemsSkippedCount) / lines.length) * 100 : 0;
  const remainingCount = lines.filter((l) => Number(l.qty_received) === 0 && !l.skipped).length;

  const activeLine = lines[activeIndex] || null;
  const activeDaysLeft = activeLine && activeLine.date_type === 'expiry' ? expiryDaysLeft(activeLine.expiry_date_be) : null;

  return (
    <>
      {/* ═══ DESKTOP VIEW (≥ md) ═══ */}
      <div className="hidden md:flex flex-col min-h-screen bg-stone-50/50 pb-32">
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
                  {t('grn.new.io_receiving')}
                </span>
                {isW2Warehouse && (
                  <span className="text-[12px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5 uppercase">
                    {t('grn.new.w2_warehouse')}
                  </span>
                )}
              </div>
              <h1 className="text-[16px] font-bold text-stone-900 leading-tight mt-1 flex items-center gap-1.5 font-mono">
                <FileText className="w-4 h-4 text-stone-400" /> {docNumber}
              </h1>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-[12px] text-stone-500 font-medium">{t('grn.new.vendor_label')}</p>
            <p className="text-[14px] font-bold text-stone-800">{vendorName}</p>
          </div>
        </div>

        <div className="max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
          {/* Info card */}
          <div className="rounded-2xl bg-white border border-stone-200/80 shadow-sm p-5 space-y-4">
            <div className="border-b border-stone-100 pb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-stone-800 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-500" /> {t('grn.new.ata_header_info')}
              </h2>
              <span className="text-xs text-rose-500 font-medium font-mono">{t('grn.new.required_label')}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {mode === 'po' && (
                <div className="md:col-span-1">
                  <Select
                    label={t('page.purchase_orders') + " *"}
                    value={selectedPoId}
                    onChange={(e) => setSelectedPoId(e.target.value)}
                    options={poOptions}
                    placeholder={loadingPo ? t('grn.new.loading_po') : t('grn.new.select_po_placeholder')}
                    className="w-full"
                    disabled={loadingPo}
                  />
                </div>
              )}

              <div className={mode === 'po' ? 'md:col-span-1' : 'md:col-span-1'}>
                <Select
                  label={t('label.warehouse') + " *"}
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  options={warehouses}
                  placeholder={t('grn.new.select_warehouse_placeholder')}
                  disabled={mode === 'io'}
                  className="w-full"
                />
              </div>

              <div>
                <Input
                  label={t('grn.new.mobile_ata_date_label') + " *"}
                  placeholder={t('grn.new.date_placeholder')}
                  maxLength={10}
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="font-mono text-[14px]"
                  helperText={t('grn.new.received_date_helper')}
                />
              </div>

              <div className={mode === 'po' ? 'md:col-span-3' : 'md:col-span-2'}>
                <Input
                  label={t('grn.new.mobile_staff_names_label')}
                  placeholder={t('grn.new.staff_names_placeholder')}
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
                <Landmark className="w-4.5 h-4.5 text-stone-400" /> {t('grn.new.document_line_items')}
              </h2>
              <span className="text-[12px] font-mono text-stone-500 font-bold bg-stone-100 rounded-md px-2.5 py-0.5">
                {lines.length} SKU
              </span>
            </div>

            {lines.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-white p-12 text-center text-stone-400">
                <Inbox className="w-10 h-10 mx-auto text-stone-300 mb-2" />
                <p className="text-sm font-semibold">{t('grn.new.no_items_in_bill')}</p>
                {mode === 'po' && !selectedPoId && (
                  <p className="text-xs text-stone-500 mt-1">{t('grn.new.select_po_to_display')}</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
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
                              {t('grn.new.ordered_qty_label')}{formatQty(l.qty_ordered)} {l.unit}
                            </span>
                            <span className="text-xs font-semibold text-stone-500 bg-stone-50 px-2 py-0.5 border border-stone-100 rounded-md">
                              {t('grn.new.existing_stock_label')}{formatQty(l.stock_on_hand)} {l.unit}
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
                          <label className="text-[12px] font-semibold text-stone-600 block mb-1">{t('grn.new.received_qty_unit_label')} ({l.unit})</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={l.qty_received || ''}
                            onChange={(e) => updateLine(i, 'qty_received', parseFloat(e.target.value) || 0)}
                            className="w-full h-9 px-3 text-[14px] font-mono rounded-[8px] border border-stone-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>

                        <div>
                          <label className="text-[12px] font-semibold text-stone-600 block mb-1">{t('grn.new.storage_location_label')}</label>
                          <input
                            type="text"
                            placeholder={t('grn.new.storage_location_placeholder')}
                            value={l.storage_location}
                            onChange={(e) => updateLine(i, 'storage_location', e.target.value)}
                            className="w-full h-9 px-3 text-[13.5px] rounded-[8px] border border-stone-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>

                        <div className="sm:col-span-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[12px] font-semibold text-stone-600 block">
                              {l.date_type === 'expiry' ? t('grn.new.expiry_date_label') : t('grn.new.mfg_date_label')}
                            </label>
                            <button
                              type="button"
                              onClick={() => updateLine(i, 'date_type', l.date_type === 'expiry' ? 'mfg' : 'expiry')}
                              className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold underline underline-offset-2"
                            >
                              {t('grn.new.switch_to')}{l.date_type === 'expiry' ? 'MFG' : 'EXP'}
                            </button>
                          </div>

                          <div className="flex gap-2 items-center">
                            <div className="flex-1">
                              <input
                                type="text"
                                placeholder={t('grn.new.date_placeholder')}
                                maxLength={10}
                                value={l.date_type === 'expiry' ? l.expiry_date_be : l.mfg_date_be}
                                onChange={(e) => updateLine(i, l.date_type === 'expiry' ? 'expiry_date_be' : 'mfg_date_be', e.target.value)}
                                className="w-full h-9 px-3 text-[14px] font-mono rounded-[8px] border border-stone-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
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
                <Landmark className="w-4 h-4 text-emerald-500" /> {t('grn.new.bonus_items_title')}
              </h2>
              <button
                type="button"
                onClick={handleAddBonusItem}
                className="text-[12.5px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl px-3 py-1.5 flex items-center gap-1.5 transition-all duration-150 active:scale-95"
              >
                <Plus className="w-4 h-4" /> {t('grn.new.add_bonus_item')}
              </button>
            </div>

            {bonusItems.length === 0 ? (
              <p className="text-center text-stone-400 text-xs py-4">{t('grn.new.no_bonus_items')}</p>
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
                            {t('grn.new.bonus_product_name_label')}
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder={t('grn.new.bonus_search_placeholder')}
                              value={searchQueries[i] ?? b.product_name}
                              onChange={(e) => handleSearchChange(i, e.target.value)}
                              onFocus={() => setDropdownOpen(i)}
                              className="w-full h-9 pl-8 pr-3 text-[13.5px] rounded-[8px] border border-stone-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                            />
                            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-stone-400" />
                          </div>

                          {b.sku && (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">
                                {t('grn.new.catalog_product')} (SKU: {b.sku})
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
                          {dropdownOpen === i && (
                            <div
                              className="fixed inset-0 z-30"
                              onClick={() => setDropdownOpen(null)}
                            />
                          )}
                        </div>

                        {/* Qty */}
                        <div className="md:col-span-2">
                          <label className="text-[12px] font-semibold text-stone-600 block mb-1">{t('grn.new.received_qty_label')}</label>
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
                            className="w-full h-9 px-3 text-[14px] font-mono rounded-[8px] border border-stone-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>

                        {/* Unit */}
                        <div className="md:col-span-1.5">
                          <label className="text-[12px] font-semibold text-stone-600 block mb-1">{t('grn.new.unit_label')}</label>
                          <input
                            type="text"
                            placeholder={t('grn.new.unit_placeholder')}
                            value={b.unit}
                            onChange={(e) => {
                              const newItems = [...bonusItems];
                              newItems[i].unit = e.target.value;
                              setBonusItems(newItems);
                            }}
                            className="w-full h-9 px-3 text-[13.5px] rounded-[8px] border border-stone-200 bg-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        {/* Expiry BE */}
                        <div className="md:col-span-3.5 space-y-1">
                          <label className="text-[12px] font-semibold text-stone-600 block">{t('grn.new.bonus_expiry_label')}</label>
                          <div className="flex gap-2 items-center">
                            <div className="flex-1">
                              <input
                                  type="text"
                                  placeholder={t('grn.new.date_placeholder')}
                                  maxLength={10}
                                  value={b.expiry_date_be}
                                  onChange={(e) => {
                                    const newItems = [...bonusItems];
                                    newItems[i].expiry_date_be = e.target.value;
                                    setBonusItems(newItems);
                                  }}
                                  className="w-full h-9 px-3 text-[14px] font-mono rounded-[8px] border border-stone-200 bg-white focus:outline-none focus:border-emerald-500"
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
                        <label className="text-[12px] font-semibold text-stone-600 block mb-1">{t('grn.new.bonus_notes_label')}</label>
                        <input
                          type="text"
                          placeholder={t('grn.new.bonus_notes_placeholder')}
                          value={b.notes}
                          onChange={(e) => {
                            const newItems = [...bonusItems];
                            newItems[i].notes = e.target.value;
                            setBonusItems(newItems);
                          }}
                          className="w-full h-9 px-3 text-[13px] rounded-[8px] border border-stone-200 bg-white focus:outline-none focus:border-emerald-500"
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
                <Landmark className="w-[18px] h-[18px] text-amber-600" /> {t('grn.new.lift_fee_title')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div>
                  <label className="text-[12px] font-semibold text-amber-800 block mb-1">{t('grn.new.lift_fee_rounds_label')}</label>
                  <input
                    type="number"
                    min="0"
                    value={liftFeeRounds || ''}
                    onChange={(e) => setLiftFeeRounds(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full h-9 px-3 text-[14px] font-mono rounded-[8px] border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400"
                  />
                </div>

                <div>
                  <p className="text-[12px] font-semibold text-amber-800 mb-1">{t('grn.new.lift_fee_total_label')}</p>
                  <p className="text-[18px] font-extrabold text-amber-700 font-mono">
                    {t('currency.baht')}{(liftFeeRounds * 50).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div>
                  <span className="text-[12px] font-semibold text-amber-800 block mb-1">{t('grn.new.lift_fee_payment_label')}</span>
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
                      <span>{t('grn.new.payment_cash')} (Cash)</span>
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
                      <span>{t('grn.new.payment_credit')} (Credit)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* หมายเหตุ */}
          <div className="rounded-2xl bg-white border border-stone-200/80 shadow-sm p-5 space-y-3">
            <label className="text-[14px] font-bold text-stone-700 block">{t('grn.new.general_notes_label')}</label>
            <textarea
              rows={3}
              placeholder={t('grn.new.general_notes_placeholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 text-[13.5px] rounded-[8px] border border-stone-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-2.5">
              <BadgeAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-rose-800">{t('grn.new.validation_error_title')}</p>
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
              {t('grn.new.btn_save_draft')}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit('submit')}
              disabled={saving || lines.length === 0}
              className="flex-[3] h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[13.5px] font-extrabold shadow-sm shadow-emerald-600/10 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-1.5"
            >
              {saving ? t('grn.new.btn_saving') : t('grn.new.btn_complete_receive')}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ MOBILE VIEW (< md) ═══ */}
      <div className="flex flex-col md:hidden min-h-screen bg-stone-50 text-stone-900 pb-28">
        {/* Sticky Mobile Header + Warehouse Container */}
        <div className="sticky top-0 z-30 bg-white border-b border-stone-200 shadow-sm">
          {/* Mobile Header */}
          <div className="px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="w-11 h-11 flex items-center justify-center rounded-full bg-stone-100 border border-stone-200 text-stone-700 active:scale-90 transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.5 uppercase tracking-wider font-mono">
                    {t('grn.new.io_receiving')}
                  </span>
                  {isW2Warehouse && (
                    <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5 uppercase">{t('grn.new.w2_warehouse')}</span>
                  )}
                </div>
                <h1 className="text-[15px] font-extrabold text-stone-900 mt-1 leading-tight font-mono flex items-center gap-1">
                  <Barcode className="w-4 h-4 text-emerald-400" /> {docNumber}
                </h1>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-stone-500 block uppercase">{t('grn.new.vendor_label')}</span>
              <span className="text-[12px] font-bold text-stone-800 block truncate max-w-[160px]">{vendorName}</span>
            </div>
          </div>

          {/* Sticky Mobile Warehouse Selector */}
          <div className="px-4 pb-3.5 pt-1 border-t border-stone-100 flex items-center justify-between gap-3 bg-white">
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider whitespace-nowrap">
              {t('grn.new.mobile_warehouse_label')}
            </label>
            <select
              disabled={mode === 'io'}
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="flex-1 h-11 px-3 text-base rounded-xl bg-white border border-stone-300 text-stone-800 focus:outline-none focus:border-emerald-600 disabled:opacity-50"
            >
              <option value="">{t('grn.new.mobile_select_warehouse')}</option>
              {warehouseList.map((wh) => (
                <option key={wh.id} value={wh.id}>{wh.code} — {wh.name_th}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Info & Header Inputs inside expanding Drawer/Card */}
        <div className="px-4 pt-4 space-y-4">
          {/* Progress bar */}
          <div className="bg-white border border-stone-200 rounded-2xl p-3.5 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-stone-500">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                {t('grn.new.mobile_progress_title')}
              </span>
              <span className="font-mono text-emerald-600">
                {itemsSuccessCount}/{lines.length}{t('grn.new.mobile_sku_completed_suffix')}
                {itemsSkippedCount > 0 && <span className="text-amber-600 ml-1">({itemsSkippedCount}{t('grn.new.mobile_sku_skipped_suffix')})</span>}
              </span>
            </div>
            <div className="w-full h-3 bg-stone-200 rounded-full overflow-hidden p-0.5 border border-stone-200">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)] transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Scan Zone */}
          <div className="bg-stone-100 border border-stone-200 rounded-2xl p-4.5 text-center relative overflow-hidden flex flex-col items-center justify-center select-none shadow-inner group">
            {/* Visual scan laser animation */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-emerald-500/80 shadow-[0_0_6px_#10b981] animate-pulse z-10" />
            <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,_rgba(0,0,0,0.05)_50%)] bg-[size:100%_4px]" />

            <div className="w-12 h-12 bg-white rounded-2xl border border-stone-300 flex items-center justify-center mb-2 z-10 group-hover:scale-105 transition-transform">
              <Barcode className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-xs font-bold text-stone-700 z-10">{t('grn.new.mobile_sim_scan_title')}</p>
            <p className="text-[10px] text-stone-500 mt-0.5 z-10">{t('grn.new.mobile_sim_scan_desc')}</p>

            {showSimulatedScanner ? (
              <form onSubmit={handleSimulatedScanSubmit} className="w-full mt-3 flex gap-2 z-10 relative">
                <input
                  type="text"
                  placeholder={t('grn.new.mobile_sim_scan_placeholder')}
                  value={simulatedBarcode}
                  onChange={(e) => setSimulatedBarcode(e.target.value)}
                  className="flex-1 h-11 px-3 rounded-xl bg-white border border-stone-300 focus:outline-none focus:border-emerald-500 text-base font-mono text-stone-900 text-center"
                  autoFocus
                />
                <button
                  type="submit"
                  className="h-11 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl active:scale-95 transition-all"
                >
                  {t('grn.new.mobile_sim_scan_btn')}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowSimulatedScanner(true)}
                className="mt-3 px-4 h-11 bg-white border border-stone-300 rounded-xl text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-all flex items-center gap-1.5 active:scale-95 z-10"
              >
                <Camera className="w-3.5 h-3.5" />
                {t('grn.new.mobile_sim_scan_btn_trigger')}
              </button>
            )}
          </div>

          {/* ATA Header Fields Card for Mobile */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-3.5 shadow-sm">
            <p className="text-[11.5px] font-extrabold text-stone-500 uppercase tracking-wider border-b border-stone-200 pb-2">
              {t('grn.new.mobile_ata_header_title')}
            </p>
            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] font-bold text-stone-700 block mb-1">{t('grn.new.mobile_ata_date_label')}</label>
                <input
                  type="text"
                  maxLength={10}
                  placeholder={t('grn.new.date_placeholder')}
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="w-full h-11 px-3 text-base font-mono rounded-lg bg-white border border-stone-300 text-stone-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-700 block mb-1">{t('grn.new.mobile_staff_names_label')}</label>
                  <input
                  type="text"
                  placeholder={t('grn.new.mobile_staff_names_placeholder')}
                  value={receivedByNames}
                  onChange={(e) => setReceivedByNames(e.target.value)}
                  className="w-full h-11 px-3 text-base rounded-lg bg-white border border-stone-300 text-stone-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30"
                />
              </div>
            </div>
          </div>

          {/* Active Line Card */}
          {activeLine ? (
            <div className="bg-white border-2 border-emerald-500 rounded-3xl p-5 space-y-4 shadow-sm ring-4 ring-emerald-500/10">
              <div className="flex items-start justify-between border-b border-stone-200 pb-3 gap-2">
                <div>
                  <span className="text-[9.5px] font-mono font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded uppercase leading-none">
                    ACTIVE SKU: {activeLine.sku}
                  </span>
                  <h3 className="text-[15px] font-extrabold text-stone-900 leading-tight mt-2">{activeLine.product_name}</h3>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-[10px] font-bold text-stone-700 block uppercase">{t('grn.new.mobile_ordered_label')}</span>
                  <span className="text-[14.5px] font-mono font-extrabold text-stone-900">
                    {formatQty(activeLine.qty_ordered)} {activeLine.unit}
                  </span>
                  <span className="text-[9.5px] text-stone-700 block font-semibold">{t('grn.new.mobile_prev_label')}: {formatQty(activeLine.stock_on_hand)}</span>
                </div>
              </div>

              {/* Qty Stepper — wrapped in green highlight box */}
              <div className="border-2 border-emerald-400 bg-emerald-50/40 rounded-2xl p-4 space-y-3 ring-4 ring-emerald-400/10">
                <label className="text-[11.5px] font-bold text-stone-800 block text-center">
                  {t('grn.new.mobile_qty_input_title')} ({activeLine.unit})
                </label>
                <div className="max-w-xs mx-auto space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => updateLine(activeIndex, 'qty_received', Math.max(0, Number(activeLine.qty_received) - 1))}
                      className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-stone-300 text-2xl font-bold text-stone-700 hover:text-stone-900 active:scale-90 transition-all flex-shrink-0"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={activeLine.qty_received || ''}
                      onChange={(e) => updateLine(activeIndex, 'qty_received', parseFloat(e.target.value) || 0)}
                      className="flex-1 min-w-0 h-12 py-0 bg-white border border-stone-300 rounded-2xl text-center font-mono text-2xl font-extrabold text-black focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 leading-[48px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => updateLine(activeIndex, 'qty_received', Number(activeLine.qty_received) + 1)}
                      className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-stone-300 text-2xl font-bold text-stone-700 hover:text-stone-900 active:scale-90 transition-all flex-shrink-0"
                    >
                      +
                    </button>
                  </div>

                  {/* Quick-add Chips */}
                  <div className="grid grid-cols-4 gap-2 py-1">
                    <button
                      type="button"
                      onClick={() => updateLine(activeIndex, 'qty_received', Number(activeLine.qty_received) + 1)}
                      className="h-11 bg-white hover:bg-stone-100 text-stone-700 rounded-xl text-xs font-extrabold border border-stone-300 active:scale-95 transition-all flex items-center justify-center"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => updateLine(activeIndex, 'qty_received', Number(activeLine.qty_received) + 5)}
                      className="h-11 bg-white hover:bg-stone-100 text-stone-700 rounded-xl text-xs font-extrabold border border-stone-300 active:scale-95 transition-all flex items-center justify-center"
                    >
                      +5
                    </button>
                    <button
                      type="button"
                      onClick={() => updateLine(activeIndex, 'qty_received', Number(activeLine.qty_received) + 10)}
                      className="h-11 bg-white hover:bg-stone-100 text-stone-700 rounded-xl text-xs font-extrabold border border-stone-300 active:scale-95 transition-all flex items-center justify-center"
                    >
                      +10
                    </button>
                    <button
                      type="button"
                      onClick={() => updateLine(activeIndex, 'qty_received', Number(activeLine.qty_ordered))}
                      className="h-11 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-xl text-xs font-extrabold border border-emerald-300 active:scale-95 transition-all flex items-center justify-center"
                    >
                      {t('grn.new.mobile_btn_all_ordered')}
                    </button>
                    {Number(activeLine.qty_received) > 0 && (
                      <button
                        type="button"
                        onClick={() => updateLine(activeIndex, 'qty_received', 0)}
                        className="col-span-4 h-9 bg-white hover:bg-rose-50 text-stone-400 hover:text-rose-500 rounded-xl text-xs font-bold border border-stone-200 active:scale-95 transition-all flex items-center justify-center gap-1"
                      >
                        {t('grn.new.mobile_btn_clear')}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Exp/Mfg Date & Lot/Location Inputs for Active item */}
              <div className="grid grid-cols-2 gap-3 border-t border-stone-200 pt-3.5">
                <div>
                  <label className="text-[10px] font-bold text-stone-800 block mb-1">{t('grn.new.mobile_location_label')}</label>
                  <input
                    type="text"
                    placeholder={t('grn.new.storage_location_placeholder')}
                    value={activeLine.storage_location}
                    onChange={(e) => updateLine(activeIndex, 'storage_location', e.target.value)}
                    className="w-full h-11 px-2.5 text-base rounded-lg bg-stone-100 border border-stone-300 text-stone-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-stone-800 block mb-1">{t('grn.new.mobile_lot_no_label')}</label>
                  <input
                    type="text"
                    placeholder={t('grn.new.mobile_lot_no_placeholder')}
                    value={activeLine.lot_no}
                    onChange={(e) => updateLine(activeIndex, 'lot_no', e.target.value)}
                    className="w-full h-11 px-2.5 text-base rounded-lg bg-stone-100 border border-stone-300 text-stone-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-stone-700">
                    <span>{activeLine.date_type === 'expiry' ? t('grn.new.mobile_expiry_date_label') : t('grn.new.mobile_mfg_date_label')}</span>
                    <button
                      type="button"
                      onClick={() => updateLine(activeIndex, 'date_type', activeLine.date_type === 'expiry' ? 'mfg' : 'expiry')}
                      className="text-emerald-600 hover:text-emerald-700 underline min-h-[44px] flex items-center"
                    >
                      {t('grn.new.switch_to')}{activeLine.date_type === 'expiry' ? 'MFG' : 'EXP'}
                    </button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      maxLength={10}
                      placeholder={t('grn.new.date_placeholder')}
                      value={activeLine.date_type === 'expiry' ? activeLine.expiry_date_be : activeLine.mfg_date_be}
                      onChange={(e) => updateLine(activeIndex, activeLine.date_type === 'expiry' ? 'expiry_date_be' : 'mfg_date_be', e.target.value)}
                      className="flex-1 h-11 px-2.5 text-base font-mono rounded-lg bg-stone-100 border border-stone-300 text-stone-900 focus:outline-none focus:border-emerald-500"
                    />
                    {activeLine.date_type === 'expiry' && activeDaysLeft !== null && (
                      <div className="flex-shrink-0">
                        <ExpiryChip days={activeDaysLeft} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons inside Active Card */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    // Mark current line as skipped (สินค้ายังไม่เข้า)
                    setLines((prev) => prev.map((l, idx) => idx === activeIndex ? { ...l, skipped: true, qty_received: 0 } : l));
                    // Move to next non-completed, non-skipped line
                    const nextPending = lines.findIndex((l, idx) => idx > activeIndex && Number(l.qty_received) === 0 && !l.skipped);
                    const fallbackPending = lines.findIndex((l, idx) => idx !== activeIndex && Number(l.qty_received) === 0 && !l.skipped);
                    if (nextPending >= 0) {
                      setActiveIndex(nextPending);
                    } else if (fallbackPending >= 0) {
                      setActiveIndex(fallbackPending);
                    }
                    toast('info', activeLine.product_name + t('grn.new.toast_skipped_suffix'));
                  }}
                  className="flex-1 h-11 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs font-bold text-amber-700 transition-all active:scale-95 flex items-center justify-center gap-1"
                >
                  <PackageX className="w-4 h-4" />
                  {t('grn.new.mobile_btn_skip')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextIncomplete = lines.findIndex((l, idx) => idx > activeIndex && Number(l.qty_received) === 0 && !l.skipped);
                    const fallbackIncomplete = lines.findIndex((l) => Number(l.qty_received) === 0 && !l.skipped);
                    if (nextIncomplete >= 0) {
                      setActiveIndex(nextIncomplete);
                    } else if (fallbackIncomplete >= 0) {
                      setActiveIndex(fallbackIncomplete);
                    }
                    toast('success', t('grn.new.toast_saved_prefix') + activeLine.product_name + t('grn.new.toast_saved_suffix'));
                  }}
                  className="flex-[2] h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4" />
                  {t('grn.new.mobile_btn_save_line')}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-stone-400 text-xs italic">
              {t('grn.new.mobile_no_items_in_bill')}
            </div>
          )}

          {/* Line Checklist below */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4.5 space-y-3 shadow-sm">
            <p className="text-[11.5px] font-extrabold text-stone-500 uppercase tracking-wider border-b border-stone-200 pb-2">
              {t('grn.new.mobile_checklist_title')}
            </p>
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {lines.map((l, i) => {
                const received = Number(l.qty_received);
                const isCurrent = i === activeIndex;
                const isSkipped = l.skipped;

                let dotColor = 'bg-stone-800 border-stone-700';
                let iconEl = null;

                if (isSkipped) {
                  dotColor = 'bg-amber-400 border-amber-300';
                  iconEl = <XCircle className="w-3 h-3 text-amber-900" />;
                } else if (received >= Number(l.qty_ordered)) {
                  dotColor = 'bg-emerald-500 border-emerald-400';
                  iconEl = <Check className="w-3 h-3 text-stone-950 font-bold" />;
                } else if (received > 0) {
                  dotColor = 'bg-amber-50 border-amber-400';
                }

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      // If clicking a skipped item, un-skip it so user can re-enter
                      if (isSkipped) {
                        setLines((prev) => prev.map((line, idx) => idx === i ? { ...line, skipped: false } : line));
                      }
                      setActiveIndex(i);
                    }}
                    className={`w-full text-left p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                      isCurrent 
                        ? 'bg-stone-50 border-emerald-500 ring-2 ring-emerald-500/10' 
                        : isSkipped
                        ? 'bg-amber-50/50 border-amber-200 hover:bg-amber-50'
                        : 'bg-white border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Check dot */}
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${dotColor}`}>
                        {iconEl}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-mono font-bold text-stone-500">SKU: {l.sku}</p>
                        <p className={`text-[13px] font-bold truncate max-w-[190px] mt-0.5 leading-snug ${isSkipped ? 'text-stone-400 line-through' : 'text-stone-900'}`}>{l.product_name}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 font-mono">
                      <p className="text-xs font-bold text-stone-500">{t('grn.new.mobile_ordered_short')}: {formatQty(l.qty_ordered)}</p>
                      {isSkipped ? (
                        <p className="text-[11px] font-bold mt-0.5 text-amber-600">{t('grn.new.mobile_btn_skip')}</p>
                      ) : (
                        <p className={`text-[13px] font-extrabold mt-0.5 ${received > 0 ? 'text-emerald-600' : 'text-stone-400'}`}>
                          {t('grn.new.mobile_received_short')}: {formatQty(l.qty_received)}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes field for Mobile */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-2 shadow-sm">
            <label className="text-[11.5px] font-bold text-stone-500 block">{t('grn.new.general_notes_label')}</label>
            <textarea
              rows={2}
              placeholder={t('grn.new.mobile_notes_placeholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 text-base rounded-lg bg-stone-50 border border-stone-300 text-stone-900 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 flex items-start gap-2.5">
              <BadgeAlert className="w-4.5 h-4.5 text-rose-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-rose-700">{t('grn.new.mobile_error_title')}</p>
                <p className="text-[11px] text-rose-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Sticky bottom submit area */}
        <div className="fixed bottom-0 inset-x-0 p-4 bg-white border-t border-stone-200 z-30 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => handleSubmit('draft')}
              disabled={saving || lines.length === 0}
              className="flex-1 h-11 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 text-xs font-bold text-stone-700 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              {t('grn.new.mobile_btn_draft')}
            </button>

            {remainingCount > 0 ? (
              <button
                type="button"
                disabled
                className="flex-[2] h-11 rounded-xl bg-stone-800 border border-stone-700/60 text-stone-500 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {t('grn.new.mobile_btn_remaining_prefix')}{remainingCount}{t('grn.new.mobile_btn_remaining_suffix')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit('submit')}
                disabled={saving}
                className="flex-[2] h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                {saving ? t('grn.new.mobile_btn_saving') : itemsSkippedCount > 0 ? t('grn.new.mobile_btn_complete_skipped_prefix') + itemsSkippedCount + t('grn.new.mobile_btn_complete_skipped_suffix') : t('grn.new.mobile_btn_complete_prefix')}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function NewGRNPage() {
  const t = useT();
  return (
    <Suspense fallback={<div className="py-16 text-center text-gray-400">{t('label.loading')}</div>}>
      <NewGRNPageInner />
    </Suspense>
  );
}

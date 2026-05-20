'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatQty } from '@/lib/format';
import { get } from '@/lib/api-client';
import { SearchInput, Pagination } from '@/components/ui';
import { Filter, Download, ScanLine, Home, ArrowLeftRight, ClipboardList, Boxes, Upload } from 'lucide-react';
import ProductImportModal from '@/components/inventory/ProductImportModal';
import { useT, useLanguage, localeName } from '@/lib/i18n';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StockItem {
  id: string;
  product_id: string;
  sku: string;
  name_th: string;
  name_en: string;
  category: string;
  warehouse_id: string;
  warehouse_code: string;
  qty_on_hand: number;
  qty_reserved: number;
  qty_available: number;
  unit_cost: number;
  reorder_point: number;
}

interface InventoryData {
  data: StockItem[];
  total: number;
  page: number;
  per_page: number;
  warehouses?: { id: string; code: string; name: string }[];
}

// ─── Status pill ─────────────────────────────────────────────────────────────

function StockStatusPill({ item }: { item: StockItem }) {
  const t = useT();
  if (item.qty_available <= 0)
    return (
      <span className="text-[11px] font-bold text-red-700 border border-red-200 bg-red-50 rounded-full px-2 py-0.5">
        หมดสต็อก
      </span>
    );
  if (item.qty_available <= item.reorder_point)
    return (
      <span className="text-[11px] font-bold text-amber-700 border border-amber-300 bg-amber-50 rounded-full px-2 py-0.5">
        ต่ำกว่า Reorder
      </span>
    );
  return (
    <span className="text-[11px] font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-full px-2 py-0.5">
      {t('status.active')}
    </span>
  );
}

// ─── Bottom tab bar (mobile) ──────────────────────────────────────────────────

function BottomTabBar() {
  const router = useRouter();
  const t = useT();
  const tabs = [
    { key: 'home', label: t('nav.overview'), icon: Home, href: '/app' },
    { key: 'stock', label: t('nav.inventory'), icon: Boxes, href: '/app/inventory', active: true },
    { key: 'transfer', label: t('page.transfers'), icon: ArrowLeftRight, href: '/app/transfer' },
    { key: 'count', label: t('page.cycle_counts'), icon: ClipboardList, href: '/app/cycle-count' },
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const router = useRouter();
  const t = useT();
  const { lang } = useLanguage();

  const [inventoryData, setInventoryData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [view, setView] = useState<'table' | 'card' | 'heatmap'>('heatmap');
  const [segment, setSegment] = useState<'all' | 'low' | 'out' | 'top'>('all');
  const [allStock, setAllStock] = useState<StockItem[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (warehouseFilter) params.set('warehouse_id', warehouseFilter);
      if (segment === 'low' || segment === 'out') params.set('low_stock', 'true');
      params.set('page', String(page));
      params.set('limit', '30');
      const data = await get<InventoryData>(`/api/inventory?${params.toString()}`);
      setInventoryData(data);
    } catch {
      setInventoryData(null);
    } finally {
      setLoading(false);
    }
  }, [search, page, warehouseFilter, segment]);

  const fetchAllStock = useCallback(async () => {
    setAllLoading(true);
    try {
      const params = new URLSearchParams({ limit: '500' });
      if (search) params.set('search', search);
      const data = await get<InventoryData>(`/api/inventory?${params.toString()}`);
      setAllStock(data.data);
    } catch {
      setAllStock([]);
    } finally {
      setAllLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
    if (view === 'heatmap') fetchAllStock();
  }, [view, fetchAllStock]);

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
  }

  // ── KPI computed from loaded data ──
  const allItems = inventoryData?.data ?? [];
  const total = inventoryData?.total ?? 0;
  const perPage = inventoryData?.per_page ?? 30;
  const warehouses = inventoryData?.warehouses ?? [];

  const skuCount = total;
  const totalValue = allItems.reduce((s, i) => s + i.qty_on_hand * i.unit_cost, 0);
  const belowReorderCount = allItems.filter((i) => i.qty_available <= i.reorder_point && i.qty_available > 0).length;
  const outOfStockCount = allItems.filter((i) => i.qty_available <= 0).length;

  // ── Heatmap Pivot ──
  const pivotData = useMemo(() => {
    const baseData = allStock;
    const map = new Map<string, { sku: string; name_th: string; name_en: string; warehouses: Record<string, number>; total: number; reorder_point: number }>();
    
    baseData.forEach((i) => {
      if (!map.has(i.sku)) {
        map.set(i.sku, { sku: i.sku, name_th: i.name_th, name_en: i.name_en, warehouses: {}, total: 0, reorder_point: i.reorder_point });
      }
      const entry = map.get(i.sku)!;
      entry.warehouses[i.warehouse_id] = i.qty_available;
      entry.total += i.qty_available;
    });

    let results = Array.from(map.values());

    if (segment === 'low') {
      results = results.filter(r => Object.values(r.warehouses).some(q => q <= r.reorder_point && q > 0));
    } else if (segment === 'out') {
      results = results.filter(r => Object.values(r.warehouses).some(q => q === 0));
    } else if (segment === 'top') {
      results = [...results].sort((a, b) => b.total - a.total).slice(0, 10);
    } else {
      results.sort((a, b) => a.sku.localeCompare(b.sku));
    }

    return results;
  }, [allStock, segment]);

  const maxQty = Math.max(...allStock.map(i => i.qty_available), 1);

  function getCellColor(qty: number, reorderPoint: number, max: number): { bg: string; color: string } {
    if (qty === 0) return { bg: '#fef2f2', color: '#991b1b' };
    if (qty <= reorderPoint) return { bg: '#fffbeb', color: '#92400e' };
    const intensity = Math.min(1, qty / max);
    const a = 0.08 + intensity * 0.52;
    return { bg: `rgba(99,102,241,${a.toFixed(2)})`, color: intensity > 0.6 ? 'white' : '#312e81' };
  }

  // ── Export CSV ──
  function exportCSV() {
    const headers = ['SKU', t('label.product'), t('label.warehouse'), t('status.received'), t('label.qty'), 'Reorder'];
    const rows = allItems.map((i) => [i.sku, localeName(i.name_th, i.name_en, lang), i.warehouse_code, formatQty(i.qty_on_hand), formatQty(i.qty_available), formatQty(i.reorder_point)]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Mobile Stock Card ─────────────────────────────────────────────────────

  function MobileStockCard({ item }: { item: StockItem }) {
    const isLow = item.qty_available > 0 && item.qty_available <= item.reorder_point;
    const isOut = item.qty_available <= 0;
    return (
      <div
        onClick={() => router.push(`/app/inventory/${item.product_id}?warehouse=${item.warehouse_id}`)}
        className={`bg-white border rounded-[10px] p-3 mb-2 cursor-pointer active:scale-[0.99] transition-all ${
          isOut ? 'border-red-200 bg-red-50/30' : isLow ? 'border-amber-200 bg-amber-50/20' : 'border-stone-200'
        }`}
      >
        {/* Row 1 */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-mono text-stone-400 tabular-nums">{item.sku} · {item.warehouse_code}</p>
            <p className="text-[14px] font-semibold text-stone-900 leading-snug mt-0.5 truncate">{localeName(item.name_th, item.name_en, lang)}</p>
          </div>
          <StockStatusPill item={item} />
        </div>
        {/* Row 2 — qty grid */}
        <div className="grid grid-cols-3 border border-stone-100 rounded-lg overflow-hidden mt-2">
          <div className="px-2 py-2 text-center">
            <p className="text-[10px] text-stone-400">คงเหลือ</p>
            <p className="text-[14px] font-mono font-bold tabular-nums text-stone-900">{formatQty(item.qty_on_hand)}</p>
          </div>
          <div className="px-2 py-2 text-center border-x border-stone-100">
            <p className="text-[10px] text-stone-400">พร้อมใช้</p>
            <p className="text-[14px] font-mono font-bold tabular-nums text-stone-900">{formatQty(item.qty_available)}</p>
          </div>
          <div className="px-2 py-2 text-center">
            <p className="text-[10px] text-stone-400">Reorder</p>
            <p className="text-[14px] font-mono font-bold tabular-nums text-stone-900">{formatQty(item.reorder_point)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ═══ MOBILE (< md) ═══════════════════════════════════════════ */}
      <div className="flex flex-col min-h-screen bg-stone-50 pb-20 md:hidden">

        {/* Header */}
        <div className="px-4 pt-4 pb-3 bg-white border-b border-stone-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[17px] font-bold text-stone-900">{t('page.inventory')}</h1>
              <p className="text-[12px] text-stone-400 mt-0.5 font-mono">{skuCount} {t('label.total')}</p>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setShowImport(true)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100" 
                aria-label={t('action.import')}
              >
                <Upload className="w-4 h-4 text-stone-600" />
              </button>
              <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100" aria-label={t('action.filter')}>
                <Filter className="w-4 h-4 text-stone-600" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 space-y-3">

          {/* Search row */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={t('label.search_placeholder')}
                className="w-full h-11 pl-4 pr-4 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
            </div>
            <button className="w-11 h-11 bg-stone-950 text-white rounded-lg flex items-center justify-center flex-shrink-0">
              <ScanLine className="w-4 h-4" />
            </button>
          </div>

          {/* Filter chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => { setWarehouseFilter(''); setPage(1); }}
              className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap flex-shrink-0 ${
                !warehouseFilter ? 'bg-emerald-600 text-white shadow-sm' : 'bg-stone-100 text-stone-600'
              }`}
            >
              {t('label.all')}
            </button>
            {warehouses.map((wh) => (
              <button
                key={wh.id}
                onClick={() => { setWarehouseFilter(wh.id); setPage(1); }}
                className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap flex-shrink-0 ${
                  warehouseFilter === wh.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-stone-100 text-stone-600'
                }`}
              >
                {wh.code}
              </button>
            ))}
          </div>

          {/* KPI mini cards — horizontal scroll */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <div className="w-36 flex-shrink-0 p-3 bg-white border border-stone-200 rounded-xl">
              <p className="text-[10px] text-stone-400">SKU ทั้งหมด</p>
              <p className="text-lg font-mono font-bold tabular-nums text-stone-900 mt-1">{skuCount.toLocaleString()}</p>
            </div>
            <div className="w-36 flex-shrink-0 p-3 bg-white border border-stone-200 rounded-xl">
              <p className="text-[10px] text-stone-400">{t('label.total')} (฿)</p>
              <p className="text-lg font-mono font-bold tabular-nums text-stone-900 mt-1 truncate">{formatCurrency(totalValue, lang)}</p>
            </div>
            <div className="w-36 flex-shrink-0 p-3 bg-white border border-amber-200 rounded-xl">
              <p className="text-[10px] text-stone-400">ต่ำกว่า Reorder</p>
              <p className="text-lg font-mono font-bold tabular-nums text-amber-700 mt-1">{belowReorderCount}</p>
            </div>
            <div className="w-36 flex-shrink-0 p-3 bg-white border border-red-200 rounded-xl">
              <p className="text-[10px] text-stone-400">สินค้าหมด</p>
              <p className="text-lg font-mono font-bold tabular-nums text-red-700 mt-1">{outOfStockCount}</p>
            </div>
          </div>

          {/* Stock card list */}
          {loading ? (
            <div className="text-center py-12 text-stone-400 text-sm">{t('label.loading')}</div>
          ) : allItems.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm">{t('label.no_data')}</div>
          ) : (
            <div>
              {allItems.map((item) => (
                <MobileStockCard key={`${item.product_id}-${item.warehouse_id}`} item={item} />
              ))}
            </div>
          )}
        </div>

        <BottomTabBar />
      </div>

      {/* ═══ DESKTOP (≥ md) ═══════════════════════════════════════════ */}
      <div className="hidden md:block p-6 space-y-4 max-w-screen-xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-stone-900">{t('page.inventory')}</h1>
            <p className="text-sm text-stone-400 mt-0.5">Inventory · {skuCount.toLocaleString()} {t('label.total')}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex border border-stone-200 rounded-lg overflow-hidden">
              {(['heatmap', 'table', 'card'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    view === v ? 'bg-stone-950 text-white' : 'text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {v === 'heatmap' ? 'Heatmap' : v === 'table' ? t('action.view') : 'การ์ด'}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-emerald-100 shadow-sm"
            >
              <Upload className="w-3.5 h-3.5" />
              {t('action.import')} (Excel)
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 border border-stone-200 bg-white rounded-md px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              {t('action.export')} CSV
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="bg-white border border-stone-200 rounded-[10px] shadow-sm flex divide-x divide-stone-100">
          <div className="flex-1 px-6 py-4">
            <p className="text-xs text-stone-400 mt-0.5">SKU ทั้งหมด</p>
            <p className="text-2xl font-mono font-bold tabular-nums text-stone-900">{skuCount.toLocaleString()}</p>
          </div>
          <div className="flex-1 px-6 py-4">
            <p className="text-xs text-stone-400 mt-0.5">{t('label.total')} (฿)</p>
            <p className="text-2xl font-mono font-bold tabular-nums text-stone-900">{formatCurrency(totalValue, lang)}</p>
          </div>
          <div className="flex-1 px-6 py-4">
            <p className="text-xs text-stone-400 mt-0.5">ต่ำกว่า Reorder</p>
            <p className="text-2xl font-mono font-bold tabular-nums text-amber-700">{belowReorderCount}</p>
          </div>
          <div className="flex-1 px-6 py-4">
            <p className="text-xs text-stone-400 mt-0.5">สินค้าหมด</p>
            <p className="text-2xl font-mono font-bold tabular-nums text-red-700">{outOfStockCount}</p>
          </div>
        </div>

        {/* Warehouse summary cards */}
        {view === 'heatmap' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {warehouses.map((wh) => {
              const whTotal = pivotData.reduce((s, r) => s + (r.warehouses[wh.id] ?? 0), 0);
              const grandTotal = pivotData.reduce((s, r) => s + r.total, 0) || 1;
              const pct = (whTotal / grandTotal) * 100;
              const lowCount = pivotData.filter(r => (r.warehouses[wh.id] ?? 0) <= r.reorder_point && (r.warehouses[wh.id] ?? 0) > 0).length;
              const outCount = pivotData.filter(r => (r.warehouses[wh.id] ?? 0) === 0).length;
              
              return (
                <div key={wh.id} className="bg-white border border-stone-200 rounded-[10px] shadow-sm p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-mono font-bold text-stone-400 tabular-nums uppercase">{wh.code}</span>
                    <span className="text-[10px] text-stone-400">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="text-[14px] font-bold text-stone-900 truncate mb-2">{wh.name}</div>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-xl font-mono font-bold text-stone-900 tabular-nums">{formatQty(whTotal)}</span>
                    <span className="text-[11px] text-stone-400">{t('label.unit')}</span>
                  </div>
                  <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-500">{pivotData.length} SKU</span>
                    <div className="flex gap-2">
                      {lowCount > 0 && <span className="text-amber-600 font-bold">!{lowCount}</span>}
                      {outCount > 0 && <span className="text-red-600 font-bold">x{outCount}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-48">
            <SearchInput
              value={search}
              onSearch={handleSearch}
              placeholder={t('label.search_placeholder')}
            />
          </div>
          
          {/* Segment Control */}
          <div className="flex bg-stone-100 p-0.5 rounded-lg border border-stone-200">
            {(['all', 'low', 'out', 'top'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSegment(s)}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                  segment === s ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                {s === 'all' ? 'ทั้งหมด' : s === 'low' ? 'ใกล้หมด' : s === 'out' ? 'สินค้าหมด' : 'Top 10'}
              </button>
            ))}
          </div>

          <select
            value={warehouseFilter}
            onChange={(e) => { setWarehouseFilter(e.target.value); setPage(1); }}
            className="h-9 border border-stone-200 rounded-lg px-3 text-sm text-stone-700 bg-white focus:outline-none focus:ring-2 focus:ring-stone-300"
          >
            <option value="">{t('label.all')}{t('label.warehouse')}</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>{wh.code} – {wh.name}</option>
            ))}
          </select>
        </div>

        {/* Table / Card / Heatmap view */}
        {view === 'heatmap' ? (
          <div className="bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[1000px]">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide sticky left-0 bg-stone-50 z-10 w-[100px] border-r">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide sticky left-[100px] bg-stone-50 z-10 w-[240px] border-r">สินค้า / Product</th>
                  {warehouses.map((wh) => (
                    <th key={wh.id} className="px-4 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wide border-r min-w-[100px]">
                      {wh.code}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide w-[100px] bg-stone-50/50">รวม (Sum)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {allLoading ? (
                  <tr><td colSpan={warehouses.length + 3} className="px-4 py-12 text-center text-stone-400 text-sm">{t('label.loading')}</td></tr>
                ) : pivotData.length === 0 ? (
                  <tr><td colSpan={warehouses.length + 3} className="px-4 py-12 text-center text-stone-400 text-sm">{t('label.no_data')}</td></tr>
                ) : (
                  pivotData.map((row) => (
                    <tr key={row.sku} className="hover:bg-stone-50/50 transition-colors group">
                      <td className="px-4 py-2.5 font-mono text-[12px] text-stone-600 sticky left-0 bg-white group-hover:bg-stone-50/50 z-10 border-r">{row.sku}</td>
                      <td className="px-4 py-2.5 text-stone-800 font-medium truncate sticky left-[100px] bg-white group-hover:bg-stone-50/50 z-10 border-r" title={row.name_th}>
                        {localeName(row.name_th, row.name_en, lang)}
                      </td>
                      {warehouses.map((wh) => {
                        const qty = row.warehouses[wh.id] ?? 0;
                        const { bg, color } = getCellColor(qty, row.reorder_point, maxQty);
                        return (
                          <td key={wh.id} className="px-1 py-1 border-r text-center">
                            <div
                              className="h-8 flex items-center justify-center rounded-md font-mono font-bold text-[13px] tabular-nums transition-all"
                              style={{ backgroundColor: bg, color }}
                            >
                              {qty > 0 ? formatQty(qty) : qty === 0 ? '0' : '—'}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums text-stone-900 bg-stone-50/30">
                        {formatQty(row.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-stone-50/80 font-bold border-t-2 border-stone-200">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-right sticky left-0 bg-stone-50/80 z-10 border-r">ยอดรวมหน่วย (Total Units)</td>
                  {warehouses.map((wh) => {
                    const whTotal = pivotData.reduce((s, r) => s + (r.warehouses[wh.id] ?? 0), 0);
                    return (
                      <td key={wh.id} className="px-4 py-3 text-center font-mono tabular-nums border-r">
                        {formatQty(whTotal)}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatQty(pivotData.reduce((s, r) => s + r.total, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
            
            {/* Heatmap Legend */}
            <div className="px-6 py-3 border-t border-stone-100 flex items-center gap-6 text-[11px] text-stone-400 font-medium uppercase tracking-wider">
              <span>ระดับสต็อก:</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] bg-red-50 border border-red-200" /> หมด</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] bg-amber-50 border border-amber-300" /> ใกล้หมด</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] bg-indigo-50" /> น้อย</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] bg-indigo-500/60" /> กลาง</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] bg-indigo-500" /> สูง</span>
              </div>
            </div>
          </div>
        ) : view === 'table' ? (
          <div className="bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide">{t('label.sku')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide">{t('label.product')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide">{t('label.warehouse')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">คงเหลือ</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">พร้อมใช้</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">Reorder</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">มูลค่า</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wide">{t('label.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-400 text-sm">{t('label.loading')}</td></tr>
                ) : allItems.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-400 text-sm">{t('label.no_data')}</td></tr>
                ) : (
                  allItems.map((item) => (
                    <tr
                      key={`${item.product_id}-${item.warehouse_id}`}
                      onClick={() => router.push(`/app/inventory/${item.product_id}?warehouse=${item.warehouse_id}`)}
                      className={`cursor-pointer transition-colors hover:bg-stone-50 ${
                        item.qty_available <= item.reorder_point ? 'bg-red-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-stone-600">{item.sku}</td>
                      <td className="px-4 py-3 text-stone-800 font-medium max-w-[220px] truncate">{localeName(item.name_th, item.name_en, lang)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-stone-500">{item.warehouse_code}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-stone-700">{formatQty(item.qty_on_hand)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-stone-700">{formatQty(item.qty_available)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-stone-500">{formatQty(item.reorder_point)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-stone-600">{formatCurrency(item.qty_on_hand * item.unit_cost, lang)}</td>
                      <td className="px-4 py-3 text-center"><StockStatusPill item={item} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Card view */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {loading ? (
              <div className="col-span-4 text-center py-12 text-stone-400 text-sm">{t('label.loading')}</div>
            ) : allItems.map((item) => {
              const isOut = item.qty_available <= 0;
              const isLow = !isOut && item.qty_available <= item.reorder_point;
              return (
                <div
                  key={`${item.product_id}-${item.warehouse_id}`}
                  onClick={() => router.push(`/app/inventory/${item.product_id}?warehouse=${item.warehouse_id}`)}
                  className={`bg-white border rounded-[10px] p-4 cursor-pointer hover:shadow-md transition-all ${
                    isOut ? 'border-red-200 bg-red-50/30' : isLow ? 'border-amber-200 bg-amber-50/20' : 'border-stone-200'
                  }`}
                >
                  <p className="text-[10px] font-mono text-stone-400 tabular-nums">{item.sku} · {item.warehouse_code}</p>
                  <p className="text-[14px] font-semibold text-stone-900 mt-1 leading-snug line-clamp-2">{localeName(item.name_th, item.name_en, lang)}</p>
                  <div className="mt-3 flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-stone-400">พร้อมใช้</p>
                      <p className="text-xl font-mono font-bold tabular-nums text-stone-900">{formatQty(item.qty_available)}</p>
                    </div>
                    <StockStatusPill item={item} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {total > perPage && view !== 'heatmap' && (
          <div className="flex justify-center">
            <Pagination
              page={page}
              totalPages={Math.ceil(total / perPage)}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <ProductImportModal 
        open={showImport} 
        onClose={() => setShowImport(false)} 
        onSuccess={() => {
          setShowImport(false);
          fetchInventory();
        }}
      />
    </>
  );
}

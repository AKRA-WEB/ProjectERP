'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatQty } from '@/lib/format';
import { get } from '@/lib/api-client';
import { SearchInput, Pagination } from '@/components/ui';
import { Download, ScanLine, Home, ArrowLeftRight, ClipboardList, Boxes, Upload } from 'lucide-react';
import ProductImportModal from '@/components/inventory/ProductImportModal';
import { useT, useLanguage, localeName } from '@/lib/i18n';
import type { InventoryPageResult, StockItemRow } from '@/lib/queries/inventory';

interface StockItem {
  id?: string;
  product_id: string;
  sku: string;
  name_th: string;
  name_en: string;
  category?: string;
  warehouse_id?: string;
  warehouse_code: string;
  qty_on_hand: number;
  qty_reserved: number;
  qty_available: number;
  unit_cost: number;
  reorder_point: number;
}

function StockStatusPill({ item }: { item: StockItem }) {
  const t = useT();
  if (item.qty_available <= 0)
    return (
      <span className="text-[11px] font-bold text-red-700 border border-red-200 bg-red-50 rounded-full px-2 py-0.5 animate-pulse">
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

interface Props {
  initialData: InventoryPageResult;
}

export function InventoryClient({ initialData }: Props) {
  const router = useRouter();
  const t = useT();
  const { lang } = useLanguage();

  const [inventoryData, setInventoryData] = useState<InventoryPageResult | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [view, setView] = useState<'table' | 'card' | 'heatmap'>('heatmap');
  const [segment, setSegment] = useState<'all' | 'low' | 'out' | 'top'>('all');
  const [allStock, setAllStock] = useState<StockItemRow[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const fetchInventory = useCallback(async () => {
    if (page === 1 && !search && !warehouseFilter && segment === 'all') {
      setInventoryData(initialData);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (warehouseFilter) params.set('warehouse_id', warehouseFilter);
      if (segment === 'low' || segment === 'out') params.set('low_stock', 'true');
      params.set('page', String(page));
      params.set('limit', '30');
      const data = await get<InventoryPageResult>(`/api/inventory?${params.toString()}`);
      setInventoryData(data);
    } catch {
      setInventoryData(null);
    } finally {
      setLoading(false);
    }
  }, [search, page, warehouseFilter, segment, initialData]);

  const fetchAllStock = useCallback(async () => {
    setAllLoading(true);
    try {
      const params = new URLSearchParams({ limit: '500' });
      if (search) params.set('search', search);
      const data = await get<InventoryPageResult>(`/api/inventory?${params.toString()}`);
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

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setPage(1);
  }

  const allItems = inventoryData?.data ?? [];
  const total = inventoryData?.total ?? 0;
  const perPage = inventoryData?.per_page ?? 30;
  const warehouses = inventoryData?.warehouses ?? [];

  const skuCount = total;
  const belowReorderCount = allItems.filter((i) => Number(i.qty_available) <= Number(i.reorder_point) && Number(i.qty_available) > 0).length;
  const outOfStockCount = allItems.filter((i) => Number(i.qty_available) <= 0).length;

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
    
    const pct = Math.min(qty / max, 1);
    const lightPct = 95 - pct * 30;
    return { bg: `hsl(142, 70%, ${lightPct}%)`, color: '#064e3b' };
  }

  return (
    <>
      <div className="p-6 space-y-4 max-w-screen-xl mx-auto pb-24 font-sans select-none">
        
        {/* Header section with Premium design */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-100 pb-4">
          <div>
            <h1 className="text-[26px] font-bold text-stone-900 tracking-tight flex items-center gap-2.5">
              <Boxes className="w-7 h-7 text-stone-800" />
              {t('nav.inventory')}
            </h1>
            <p className="text-[13.5px] text-stone-500 mt-0.5">
              {t('label.total')} {skuCount.toLocaleString()} {t('label.product')} · {view === 'heatmap' ? 'แสดงผลลัพธ์แบบตารางความหนาแน่น' : 'แสดงรายการคลังแบบปกติ'}
            </p>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <button 
              onClick={() => setShowImport(true)}
              className="h-[32px] px-3.5 rounded-[8px] text-[13px] font-medium text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 shadow-[0_1px_0_rgba(15,23,42,.03)] inline-flex items-center gap-1.5 transition-all"
            >
              <Upload className="w-4 h-4 text-stone-500" />
              นำเข้า Excel
            </button>
            <button 
              className="h-[32px] px-3.5 rounded-[8px] text-[13px] font-medium text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 shadow-[0_1px_0_rgba(15,23,42,.03)] inline-flex items-center gap-1.5 transition-all"
            >
              <Download className="w-4 h-4 text-stone-500" />
              Export
            </button>
            <button 
              className="h-[32px] px-3.5 rounded-[8px] text-[13px] font-medium text-white bg-stone-900 hover:bg-stone-850 shadow-sm inline-flex items-center gap-1.5 transition-all"
            >
              <ScanLine className="w-4 h-4 text-stone-300" />
              สแกนบาร์โค้ด
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-stone-50 p-4 border border-stone-200 rounded-[12px] flex flex-col md:flex-row gap-3">
          <div className="w-full md:w-80">
            <SearchInput 
              value={search} 
              onChange={handleSearch} 
              placeholder="ค้นหาด้วย SKU หรือชื่อสินค้า..." 
            />
          </div>
          
          <div className="flex gap-2 flex-wrap flex-1">
            <div className="relative">
              <select
                value={warehouseFilter}
                onChange={(e) => { setWarehouseFilter(e.target.value); setPage(1); }}
                className="h-[34px] px-3.5 rounded-[8px] border border-stone-200 bg-white text-[13px] text-stone-600 focus:outline-none focus:border-stone-400 appearance-none min-w-[150px] shadow-[0_1px_0_rgba(15,23,42,.02)]"
              >
                <option value="">คลังสินค้าทั้งหมด</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>{wh.code} - {wh.name}</option>
                ))}
              </select>
            </div>

            {/* Toggle view button */}
            <div className="border border-stone-200 rounded-[8px] p-0.5 bg-white flex gap-0.5 shadow-[0_1px_0_rgba(15,23,42,.02)]">
              {(['table', 'card', 'heatmap'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`h-7 px-3 rounded-[6px] text-[12.5px] font-medium transition-all ${
                    view === v 
                      ? 'bg-stone-100 text-stone-900 font-semibold' 
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  {v === 'table' ? 'ตาราง' : v === 'card' ? 'การ์ด' : 'แมทริกซ์ความหนาแน่น'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic segmentation filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 select-none">
          {[
            { id: 'all', label: 'ทั้งหมด (All SKUs)', count: skuCount },
            { id: 'low', label: 'ใกล้หมด (Low Stock)', count: belowReorderCount, cls: 'text-amber-800 border-amber-200 bg-amber-50' },
            { id: 'out', label: 'หมดสต็อก (Out of Stock)', count: outOfStockCount, cls: 'text-red-800 border-red-200 bg-red-50' },
            { id: 'top', label: 'สินค้าจำนวนมากสุด (Top 10)', count: null },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => { setSegment(s.id as typeof segment); setPage(1); }}
              className={`h-[30px] px-3.5 rounded-full text-[12.5px] font-medium border transition-all inline-flex items-center gap-1.5 shrink-0 ${
                segment === s.id
                  ? 'bg-stone-900 text-white border-stone-950 font-semibold shadow-sm'
                  : s.cls 
                    ? `${s.cls} hover:opacity-90`
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
              }`}
            >
              <span>{s.label}</span>
              {s.count !== null && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  segment === s.id ? 'bg-stone-800 text-stone-300' : 'bg-stone-100 text-stone-500'
                }`}>
                  {s.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* View switching logic */}
        {view === 'heatmap' ? (
          /* Matrix Heatmap view */
          <div className="bg-white border border-stone-200 rounded-[12px] overflow-hidden shadow-sm">
            <div className="overflow-x-auto max-w-full">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-[11px] font-semibold tracking-wider text-stone-500 uppercase">
                    <th className="py-3.5 px-4 sticky left-0 bg-stone-50 border-r border-stone-200 z-10 min-w-[200px]">สินค้า / Product SKU</th>
                    {warehouses.map((wh) => (
                      <th key={wh.id} className="py-3.5 px-4 text-center border-r border-stone-150 min-w-[110px]">
                        {wh.code}
                        <span className="block text-[9.5px] text-stone-400 font-normal lowercase truncate mt-0.5">{wh.name}</span>
                      </th>
                    ))}
                    <th className="py-3.5 px-4 text-right min-w-[100px]">ยอดรวมสินค้า</th>
                  </tr>
                </thead>
                <tbody>
                  {allLoading ? (
                    <tr>
                      <td colSpan={warehouses.length + 2} className="py-12 text-center text-stone-400 italic">
                        กำลังดึงข้อมูลแมทริกซ์ความหนาแน่นสต็อกสินค้า...
                      </td>
                    </tr>
                  ) : pivotData.length === 0 ? (
                    <tr>
                      <td colSpan={warehouses.length + 2} className="py-12 text-center text-stone-400 italic">
                        ไม่พบข้อมูลสินค้าตรงตามตัวกรองที่เลือก
                      </td>
                    </tr>
                  ) : (
                    pivotData.map((row) => (
                      <tr key={row.sku} className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-medium text-stone-800 sticky left-0 bg-white border-r border-stone-200 z-10 flex flex-col min-w-[200px] leading-tight">
                          <span className="text-[13px] font-semibold text-stone-900 truncate max-w-[170px]">{localeName(row.name_th, row.name_en, lang)}</span>
                          <span className="text-[10px] text-stone-400 font-normal mt-0.5">{row.sku}</span>
                        </td>
                        {warehouses.map((wh) => {
                          const qty = row.warehouses[wh.id] ?? 0;
                          const color = getCellColor(qty, row.reorder_point, maxQty);
                          return (
                            <td 
                              key={wh.id} 
                              className="p-1 border-r border-stone-150 text-center font-mono tabular-nums text-xs"
                              style={{ backgroundColor: color.bg, color: color.color }}
                            >
                              <div className="font-semibold text-[13px]">{formatQty(qty)}</div>
                              {qty <= row.reorder_point && (
                                <div className="text-[8.5px] opacity-75 mt-0.5 font-sans font-medium uppercase tracking-tighter">
                                  {qty === 0 ? 'Out' : 'Low'}
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-stone-900 text-[13.5px] tabular-nums">
                          {formatQty(row.total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : view === 'table' ? (
          /* Normal List Table view */
          <div className="bg-white border border-stone-200 rounded-[12px] overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-[11px] font-semibold tracking-wider text-stone-500 uppercase">
                  <th className="py-3.5 px-4">SKU / รหัสสินค้า</th>
                  <th className="py-3.5 px-4">ชื่อสินค้า</th>
                  <th className="py-3.5 px-4">คลัง</th>
                  <th className="py-3.5 px-4 text-right">จำนวนจริง / On-hand</th>
                  <th className="py-3.5 px-4 text-right">พร้อมใช้ / Available</th>
                  <th className="py-3.5 px-4 text-right">Reorder Point</th>
                  <th className="py-3.5 px-4 text-right">มูลค่ารวมคลัง / Cost Value</th>
                  <th className="py-3.5 px-4 text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-stone-400 italic">
                      กำลังโหลดข้อมูลตาราง...
                    </td>
                  </tr>
                ) : allItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-stone-400 italic">
                      ไม่พบข้อมูล
                    </td>
                  </tr>
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
      <BottomTabBar />
    </>
  );
}

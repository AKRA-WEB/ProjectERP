'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatQty } from '@/lib/format';
import { SearchInput, Pagination } from '@/components/ui';
import { Filter, Download, ScanLine, Home, ArrowLeftRight, ClipboardList, Boxes, Upload } from 'lucide-react';
import ProductImportModal from '@/components/inventory/ProductImportModal';

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
      ปกติ
    </span>
  );
}

// ─── Bottom tab bar (mobile) ──────────────────────────────────────────────────

function BottomTabBar() {
  const router = useRouter();
  const tabs = [
    { key: 'home', label: 'หน้าหลัก', icon: Home, href: '/app' },
    { key: 'stock', label: 'สต็อก', icon: Boxes, href: '/app/inventory', active: true },
    { key: 'transfer', label: 'โอนย้าย', icon: ArrowLeftRight, href: '/app/transfer' },
    { key: 'count', label: 'นับสต็อก', icon: ClipboardList, href: '/app/cycle-count' },
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

  const [inventoryData, setInventoryData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [view, setView] = useState<'table' | 'card'>('table');
  const [showImport, setShowImport] = useState(false);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (warehouseFilter) params.set('warehouse_id', warehouseFilter);
      if (lowStockFilter) params.set('low_stock', '1');
      params.set('page', String(page));
      params.set('per_page', '30');
      const res = await fetch(`/api/inventory?${params.toString()}`);
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setInventoryData(json.data ?? json);
    } catch {
      setInventoryData(null);
    } finally {
      setLoading(false);
    }
  }, [search, page, warehouseFilter, lowStockFilter]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

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

  // ── Export CSV ──
  function exportCSV() {
    const headers = ['SKU', 'ชื่อสินค้า', 'คลัง', 'คงเหลือ', 'พร้อมใช้', 'Reorder'];
    const rows = allItems.map((i) => [i.sku, i.name_th, i.warehouse_code, formatQty(i.qty_on_hand), formatQty(i.qty_available), formatQty(i.reorder_point)]);
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
            <p className="text-[14px] font-semibold text-stone-900 leading-snug mt-0.5 truncate">{item.name_th}</p>
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
              <h1 className="text-[17px] font-bold text-stone-900">สต็อกสินค้า</h1>
              <p className="text-[12px] text-stone-400 mt-0.5 font-mono">{skuCount} รายการ</p>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setShowImport(true)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100" 
                aria-label="นำเข้า"
              >
                <Upload className="w-4 h-4 text-stone-600" />
              </button>
              <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100" aria-label="กรอง">
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
                placeholder="ค้นหาสินค้า, SKU..."
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
              ทุกคลัง
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
            <button
              onClick={() => { setLowStockFilter(!lowStockFilter); setPage(1); }}
              className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap flex-shrink-0 ${
                lowStockFilter ? 'bg-amber-500 text-white shadow-sm' : 'bg-stone-100 text-stone-600'
              }`}
            >
              ต่ำกว่า reorder
            </button>
          </div>

          {/* KPI mini cards — horizontal scroll */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <div className="w-36 flex-shrink-0 p-3 bg-white border border-stone-200 rounded-xl">
              <p className="text-[10px] text-stone-400">SKU ทั้งหมด</p>
              <p className="text-lg font-mono font-bold tabular-nums text-stone-900 mt-1">{skuCount.toLocaleString()}</p>
            </div>
            <div className="w-36 flex-shrink-0 p-3 bg-white border border-stone-200 rounded-xl">
              <p className="text-[10px] text-stone-400">ยอดคงเหลือ (฿)</p>
              <p className="text-lg font-mono font-bold tabular-nums text-stone-900 mt-1 truncate">{formatCurrency(totalValue)}</p>
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
            <div className="text-center py-12 text-stone-400 text-sm">กำลังโหลด...</div>
          ) : allItems.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm">ไม่พบรายการ</div>
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
            <h1 className="text-xl font-bold text-stone-900">สต็อกสินค้า</h1>
            <p className="text-sm text-stone-400 mt-0.5">Inventory · {skuCount.toLocaleString()} รายการ</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex border border-stone-200 rounded-lg overflow-hidden">
              {(['table', 'card'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    view === v ? 'bg-stone-950 text-white' : 'text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {v === 'table' ? 'ตาราง' : 'การ์ด'}
                </button>
                ))}
                </div>
                <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-emerald-100 shadow-sm"
                >
                <Upload className="w-3.5 h-3.5" />
                นำเข้าสินค้า (Excel)
                </button>
                <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 border border-stone-200 bg-white rounded-md px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50 shadow-sm"
                >
                <Download className="w-3.5 h-3.5" />
                Export CSV
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
            <p className="text-xs text-stone-400 mt-0.5">ยอดคงเหลือ (฿)</p>
            <p className="text-2xl font-mono font-bold tabular-nums text-stone-900">{formatCurrency(totalValue)}</p>
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

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-48">
            <SearchInput
              value={search}
              onSearch={handleSearch}
              placeholder="ค้นหาสินค้า, SKU, ชื่อ..."
            />
          </div>
          <select
            value={warehouseFilter}
            onChange={(e) => { setWarehouseFilter(e.target.value); setPage(1); }}
            className="h-9 border border-stone-200 rounded-lg px-3 text-sm text-stone-700 bg-white focus:outline-none focus:ring-2 focus:ring-stone-300"
          >
            <option value="">ทุกคลัง</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>{wh.code} – {wh.name}</option>
            ))}
          </select>
          <button
            onClick={() => { setLowStockFilter(!lowStockFilter); setPage(1); }}
            className={`px-3 py-1 rounded-full text-[11px] font-bold ${
              lowStockFilter ? 'bg-amber-500 text-white shadow-sm' : 'bg-stone-100 text-stone-600'
            }`}
          >
            ต่ำกว่า reorder
          </button>
        </div>

        {/* Table / Card view */}
        {view === 'table' ? (
          <div className="bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide">ชื่อสินค้า</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide">คลัง</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">คงเหลือ</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">พร้อมใช้</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">Reorder</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">มูลค่า</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wide">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-400 text-sm">กำลังโหลด...</td></tr>
                ) : allItems.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-400 text-sm">ไม่พบรายการ</td></tr>
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
                      <td className="px-4 py-3 text-stone-800 font-medium max-w-[220px] truncate">{item.name_th}</td>
                      <td className="px-4 py-3 font-mono text-xs text-stone-500">{item.warehouse_code}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-stone-700">{formatQty(item.qty_on_hand)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-stone-700">{formatQty(item.qty_available)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-stone-500">{formatQty(item.reorder_point)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-stone-600">{formatCurrency(item.qty_on_hand * item.unit_cost)}</td>
                      <td className="px-4 py-3 text-center"><StockStatusPill item={item} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Card view */
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {loading ? (
              <div className="col-span-4 text-center py-12 text-stone-400 text-sm">กำลังโหลด...</div>
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
                  <p className="text-[14px] font-semibold text-stone-900 mt-1 leading-snug line-clamp-2">{item.name_th}</p>
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
        {total > perPage && (
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

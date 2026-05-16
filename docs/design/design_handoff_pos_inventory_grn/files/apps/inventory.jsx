// Inventory page artboard — recreated from app/app/inventory/page.tsx
// Stock list with filters, status pills, low-stock row highlight.

const InventoryPage = function () {
  const M = window.ERP_MOCK;
  const I = window.ErpIcons;
  const { Sidebar, TopBar } = window.ErpShell;

  const total = M.stock.length;
  const lowCount = M.stock.filter((s) => s.low).length;
  const valuation = 1284560.50;
  const skuCount = 1842;

  // KPI strip card
  const Kpi = ({ label, value, unit, sub, accent }) => (
    <div className="flex-1 px-5 py-4 border-r border-stone-100 last:border-r-0">
      <div className="text-[11.5px] font-medium text-stone-500 uppercase tracking-wider">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={'font-display text-[26px] font-semibold tracking-tight tabular-nums ' + (accent || 'text-stone-900')}>{value}</span>
        {unit && <span className="text-[13px] text-stone-400 font-medium">{unit}</span>}
      </div>
      {sub && <div className="text-[11.5px] text-stone-400 mt-0.5">{sub}</div>}
    </div>
  );

  // Row status pill
  const StatusPill = ({ row }) => {
    if (row.available === 0) return <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-red-50 text-red-700 border border-red-200">หมด / Out</span>;
    if (row.low) return <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">ต่ำ / Low</span>;
    return <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">ปกติ / OK</span>;
  };

  return (
    <div className="flex w-full h-full text-[14px] font-sans" style={{ color: '#1c1917', background: '#fafaf9' }}>
      <Sidebar module="wms" activeHref="/app/inventory" />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar crumbs={['คลังสินค้า', 'Inventory', 'รายการสต็อก']} />

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-[1280px] mx-auto space-y-5">
            {/* Page header */}
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-[26px] font-semibold tracking-tight text-stone-900 leading-tight">สต็อกสินค้า / Inventory</h1>
                <p className="text-[13.5px] text-stone-500 mt-1">ยอดคงเหลือทุกคลัง · ปรับปรุงล่าสุด 14:31 น.</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="h-9 px-3.5 rounded-md text-[13px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50">Export CSV</button>
                <button className="h-9 px-3.5 rounded-md text-[13px] font-medium text-white bg-stone-900 hover:bg-stone-800 inline-flex items-center gap-1.5">
                  <span className="text-base leading-none">+</span> ปรับปรุงสต็อก
                </button>
              </div>
            </div>

            {/* KPI strip */}
            <div className="flex bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
              <Kpi label="SKU ทั้งหมด" value={skuCount.toLocaleString()} unit="รายการ" sub="3 คลัง · 7 หมวด" />
              <Kpi label="ยอดคงเหลือ (มูลค่า)" value={'฿' + (valuation/1000).toFixed(1) + 'k'} sub="ราคาทุน · WAC" />
              <Kpi label="ต่ำกว่า Reorder" value={lowCount} unit="SKU" sub="ต้องสั่งซื้อเพิ่ม" accent="text-amber-700" />
              <Kpi label="สินค้าหมด" value="3" unit="SKU" sub="ขาดส่งใน 7 วัน" accent="text-red-700" />
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">{I.search}</span>
                <div className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-lg text-[13px] text-stone-400">ค้นหา SKU / ชื่อสินค้า…</div>
              </div>
              <select className="h-9 px-3 pr-8 bg-white border border-stone-300 rounded-lg text-[13px] text-stone-700">
                <option>ทุกคลัง</option>
              </select>
              <select className="h-9 px-3 pr-8 bg-white border border-stone-300 rounded-lg text-[13px] text-stone-700">
                <option>ทุกหมวด</option>
              </select>
              <label className="flex items-center gap-2 text-[13px] text-stone-600 cursor-default px-3 h-9 border border-stone-300 bg-white rounded-lg">
                <span className="w-3.5 h-3.5 rounded border border-stone-400 inline-block"></span>
                <span>ต่ำกว่า reorder point</span>
              </label>
              <div className="ml-auto inline-flex bg-stone-100 border border-stone-200 rounded-lg p-0.5 text-[12px]">
                <button className="px-3 py-1 rounded-md bg-white shadow-sm font-semibold text-stone-900">ตาราง</button>
                <button className="px-3 py-1 rounded-md text-stone-500">การ์ด</button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr className="text-[10.5px] font-semibold text-stone-500 uppercase tracking-wider">
                    <th className="px-4 py-3 w-28">SKU</th>
                    <th className="px-4 py-3">สินค้า</th>
                    <th className="px-4 py-3 w-20">คลัง</th>
                    <th className="px-4 py-3 text-right w-24">คงเหลือ</th>
                    <th className="px-4 py-3 text-right w-20">จอง</th>
                    <th className="px-4 py-3 text-right w-24">พร้อมใช้</th>
                    <th className="px-4 py-3 text-right w-24">Reorder</th>
                    <th className="px-4 py-3 w-20">หน่วย</th>
                    <th className="px-4 py-3 w-24">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {M.stock.map((s, i) => (
                    <tr key={i} className={'hover:bg-stone-50/60 ' + (s.low ? 'bg-red-50/40' : '')}>
                      <td className="px-4 py-3 font-mono text-[12.5px] font-medium text-stone-700">{s.sku}</td>
                      <td className="px-4 py-3">
                        <div className="text-[13px] font-medium text-stone-900">{s.name_th}</div>
                        <div className="text-[11px] text-stone-400">{s.name_en}</div>
                      </td>
                      <td className="px-4 py-3 text-[12.5px] font-mono text-stone-600">{s.wh}</td>
                      <td className="px-4 py-3 text-right font-mono text-[13px] tabular-nums">{M.qty(s.onHand)}</td>
                      <td className="px-4 py-3 text-right font-mono text-[13px] text-stone-400 tabular-nums">{M.qty(s.reserved)}</td>
                      <td className={'px-4 py-3 text-right font-mono font-semibold tabular-nums text-[13px] ' + (s.available === 0 ? 'text-red-600' : s.low ? 'text-amber-700' : 'text-emerald-700')}>{M.qty(s.available)}</td>
                      <td className="px-4 py-3 text-right font-mono text-[13px] text-stone-500 tabular-nums">{M.qty(s.reorder)}</td>
                      <td className="px-4 py-3 text-[12.5px] text-stone-600">{s.uom}</td>
                      <td className="px-4 py-3"><StatusPill row={s} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Footer / pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100 bg-stone-50/40 text-[12px] text-stone-500">
                <span>แสดง <b className="text-stone-700">1 – {M.stock.length}</b> จาก <b className="text-stone-700">{total}</b> รายการ</span>
                <div className="flex items-center gap-1.5">
                  <button className="h-7 px-2.5 rounded-md border border-stone-200 bg-white text-stone-400 hover:bg-stone-50">‹ ก่อนหน้า</button>
                  <button className="h-7 w-7 rounded-md bg-stone-900 text-white text-[12px] font-medium">1</button>
                  <button className="h-7 w-7 rounded-md border border-stone-200 bg-white text-stone-700 hover:bg-stone-50">2</button>
                  <button className="h-7 w-7 rounded-md border border-stone-200 bg-white text-stone-700 hover:bg-stone-50">3</button>
                  <span className="text-stone-400 px-1">…</span>
                  <button className="h-7 w-7 rounded-md border border-stone-200 bg-white text-stone-700 hover:bg-stone-50">37</button>
                  <button className="h-7 px-2.5 rounded-md border border-stone-200 bg-white text-stone-700 hover:bg-stone-50">ถัดไป ›</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.InventoryPage = InventoryPage;

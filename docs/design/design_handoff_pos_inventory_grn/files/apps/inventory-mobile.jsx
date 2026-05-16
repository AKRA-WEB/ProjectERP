// Inventory Mobile — stock list as stacked cards for floor staff scanning on phones
// 390×844. KPI strip becomes a horizontal scroll. Table becomes detail cards.

const InventoryMobile = function () {
  const M = window.ERP_MOCK;
  const I = window.ErpIcons;

  const StatusPill = ({ row }) => {
    if (row.available === 0) return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">หมด</span>;
    if (row.low) return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">ต่ำ</span>;
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">ปกติ</span>;
  };

  const Kpi = ({ label, value, accent, sub }) => (
    <div className="shrink-0 w-[150px] bg-white border border-stone-200 rounded-xl p-3">
      <div className="text-[10px] font-medium text-stone-500 uppercase tracking-wider">{label}</div>
      <div className={'mt-1 text-[20px] font-display font-semibold tabular-nums leading-none ' + (accent || 'text-stone-900')}>{value}</div>
      {sub && <div className="text-[10px] text-stone-400 mt-1">{sub}</div>}
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col text-[14px] font-sans" style={{ background: '#fafaf9', color: '#1c1917' }}>
      {/* status bar */}
      <div className="h-9 px-5 flex items-center justify-between text-[13px] font-semibold shrink-0 text-stone-900">
        <span>14:32</span>
        <span className="flex items-center gap-1">
          <svg viewBox="0 0 18 12" className="w-[18px] h-3"><path d="M1 9h2v2H1zM5 7h2v4H5zM9 4h2v7H9zM13 1h2v10h-2z" fill="currentColor"/></svg>
          <span className="ml-1 inline-flex items-center"><span className="w-5 h-2.5 border border-current rounded-sm inline-block relative"><span className="absolute inset-0.5 bg-current rounded-[1px]"></span></span></span>
        </span>
      </div>

      {/* Header */}
      <div className="px-4 pt-1 pb-3 bg-white border-b border-stone-200 shrink-0">
        <div className="flex items-center justify-between">
          <button className="w-9 h-9 rounded-lg border border-stone-200 grid place-items-center text-stone-600">{I.back}</button>
          <div className="text-center">
            <div className="text-[14px] font-bold text-stone-900">สต็อกสินค้า</div>
            <div className="text-[10.5px] text-stone-400">Inventory · 1,842 SKU</div>
          </div>
          <button className="w-9 h-9 rounded-lg border border-stone-200 grid place-items-center text-stone-600">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 6h18M6 12h12M10 18h4"/></svg>
          </button>
        </div>
      </div>

      {/* Search + filter chips */}
      <div className="px-4 pt-3 pb-2 bg-white border-b border-stone-200 shrink-0 space-y-2.5">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">{I.search}</span>
          <div className="w-full pl-10 pr-12 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-[14px] text-stone-400">ค้นหา SKU / ชื่อ…</div>
          <button className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-md bg-stone-900 text-white grid place-items-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="6" width="18" height="12" rx="1"/><path d="M7 6v12M11 6v12M15 6v12M19 6v12"/></svg>
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1">
          <button className="shrink-0 px-3 py-1 rounded-full text-[11px] font-bold bg-stone-900 text-white">ทุกคลัง</button>
          <button className="shrink-0 px-3 py-1 rounded-full text-[11px] font-bold bg-stone-100 text-stone-600">WH-01</button>
          <button className="shrink-0 px-3 py-1 rounded-full text-[11px] font-bold bg-stone-100 text-stone-600">WH-02</button>
          <button className="shrink-0 px-3 py-1 rounded-full text-[11px] font-bold bg-stone-100 text-stone-600">WH-03</button>
          <button className="shrink-0 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">ต่ำกว่า reorder</button>
        </div>
      </div>

      {/* KPI scroll strip */}
      <div className="px-4 py-3 shrink-0">
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
          <Kpi label="SKU ทั้งหมด"        value="1,842" sub="3 คลัง · 7 หมวด" />
          <Kpi label="มูลค่าสต็อก"          value="฿1.28M" sub="WAC" />
          <Kpi label="ต่ำกว่า reorder"      value="6"     sub="ต้องสั่งซื้อ" accent="text-amber-700" />
          <Kpi label="สินค้าหมด"          value="3"     sub="ขาดส่ง" accent="text-red-700" />
        </div>
      </div>

      {/* Stock cards */}
      <div className="flex-1 overflow-auto px-4 pb-4 space-y-2">
        {M.stock.slice(0, 8).map((s, i) => (
          <div key={i} className={'bg-white rounded-xl border p-3 ' + (s.low ? 'border-red-200 bg-red-50/30' : 'border-stone-200')}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono text-stone-500 tracking-wide">{s.sku} · {s.wh}</div>
                <div className="text-[13.5px] font-medium text-stone-900 mt-0.5 leading-tight">{s.name_th}</div>
                <div className="text-[11px] text-stone-400 leading-tight">{s.name_en}</div>
              </div>
              <StatusPill row={s} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[9.5px] font-medium text-stone-400 uppercase tracking-wider">คงเหลือ</div>
                <div className="text-[15px] font-mono font-semibold text-stone-900 tabular-nums">{M.qty(s.onHand)}</div>
              </div>
              <div className="border-x border-stone-100">
                <div className="text-[9.5px] font-medium text-stone-400 uppercase tracking-wider">พร้อมใช้</div>
                <div className={'text-[15px] font-mono font-semibold tabular-nums ' + (s.available === 0 ? 'text-red-600' : s.low ? 'text-amber-700' : 'text-emerald-700')}>{M.qty(s.available)}</div>
              </div>
              <div>
                <div className="text-[9.5px] font-medium text-stone-400 uppercase tracking-wider">Reorder</div>
                <div className="text-[15px] font-mono font-semibold text-stone-500 tabular-nums">{M.qty(s.reorder)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom tab bar */}
      <div className="shrink-0 bg-white border-t border-stone-200 grid grid-cols-4 px-2 pt-1 pb-1">
        {[
          { ic: I.dashboard, l: 'หน้าหลัก' },
          { ic: I.archive,   l: 'สต็อก', a: true },
          { ic: I.swap,      l: 'โอนย้าย' },
          { ic: I.hash,      l: 'นับสต็อก' },
        ].map((t, i) => (
          <button key={i} className={'flex flex-col items-center gap-0.5 py-1.5 rounded-lg ' + (t.a ? 'text-emerald-600' : 'text-stone-400')}>
            <span>{t.ic}</span>
            <span className="text-[10px] font-medium">{t.l}</span>
          </button>
        ))}
      </div>
      <div className="h-6 flex justify-center items-end pb-1.5 shrink-0">
        <div className="w-32 h-[5px] rounded-full bg-stone-900"></div>
      </div>
    </div>
  );
};

window.InventoryMobile = InventoryMobile;

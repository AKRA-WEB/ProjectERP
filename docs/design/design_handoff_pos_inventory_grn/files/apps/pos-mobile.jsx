// POS Mobile — adapted for handheld/clerk-on-the-floor use
// 390×844 (iPhone 14 Pro). Single-column with Products/Cart tab swap and a sticky checkout footer.

const PosMobile = function () {
  const M = window.ERP_MOCK;
  const I = window.ErpIcons;

  // same totals as desktop preview
  const cart = M.cart;
  const subtotal = cart.reduce((s, x) => s + x.price * x.qty, 0);
  const total = Math.max(0, subtotal - 10);

  return (
    <div className="w-full h-full flex flex-col text-[14px] font-sans" style={{ background: '#fafaf9', color: '#1c1917' }}>
      {/* iOS-ish status bar */}
      <div className="h-9 px-5 flex items-center justify-between text-[13px] font-semibold shrink-0 text-stone-900">
        <span>14:32</span>
        <span className="flex items-center gap-1">
          <svg viewBox="0 0 18 12" className="w-[18px] h-3"><path d="M1 9h2v2H1zM5 7h2v4H5zM9 4h2v7H9zM13 1h2v10h-2z" fill="currentColor"/></svg>
          <svg viewBox="0 0 18 14" className="w-[18px] h-3.5"><path d="M9 4a8 8 0 015 1.8l-1.3 1.6A6 6 0 009 6a6 6 0 00-3.7 1.4L4 5.8A8 8 0 019 4zm0-4a12 12 0 018 3l-1.3 1.5A10 10 0 009 2a10 10 0 00-6.7 2.5L1 3a12 12 0 018-3zm0 8a4 4 0 012.5.9l-1.3 1.6a2 2 0 00-2.4 0L6.5 8.9A4 4 0 019 8zm0 4a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" fill="currentColor"/></svg>
          <span className="ml-1 inline-flex items-center"><span className="w-5 h-2.5 border border-current rounded-sm inline-block relative"><span className="absolute inset-0.5 bg-current rounded-[1px]"></span></span><span className="w-0.5 h-1.5 bg-current rounded-r ml-px"></span></span>
        </span>
      </div>

      {/* App header */}
      <div className="px-4 pt-1 pb-3 bg-white border-b border-stone-200 shrink-0">
        <div className="flex items-center justify-between">
          <button className="w-9 h-9 rounded-lg border border-stone-200 grid place-items-center text-stone-600">{I.back}</button>
          <div className="text-center">
            <div className="text-[14px] font-bold text-stone-900">POS Terminal</div>
            <div className="text-[10.5px] font-mono text-stone-400">PS-25051601 · กะเช้า</div>
          </div>
          <button className="w-9 h-9 rounded-lg border border-stone-200 grid place-items-center text-stone-600">⋯</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-3 shrink-0 bg-white">
        <button className="flex-1 py-2 rounded-t-lg text-[12.5px] font-bold border-x border-t border-stone-200 bg-white text-emerald-600">สินค้า</button>
        <button className="flex-1 py-2 rounded-t-lg text-[12.5px] font-bold text-stone-400 inline-flex items-center justify-center gap-1.5">
          ตะกร้า
          <span className="bg-emerald-600 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">{cart.length}</span>
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 bg-white border-b border-stone-200 shrink-0 space-y-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">{I.search}</span>
          <div className="w-full pl-10 pr-12 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-[14px] text-stone-400">สแกน / ค้นหา…</div>
          <button className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-md bg-emerald-600 text-white grid place-items-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="6" width="18" height="12" rx="1"/><path d="M7 6v12M11 6v12M15 6v12M19 6v12"/></svg>
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
          <button className="shrink-0 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-600 text-white">ทั้งหมด</button>
          {M.cats.map((c) => <button key={c.id} className="shrink-0 px-3 py-1 rounded-full text-[11px] font-bold bg-stone-100 text-stone-600">{c.name_th}</button>)}
        </div>
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-auto p-3">
        <div className="grid grid-cols-2 gap-2.5">
          {M.products.slice(0, 8).map((p) => (
            <div key={p.id} className={'flex flex-col bg-white rounded-xl border overflow-hidden ' + (p.out ? 'border-red-200' : p.low ? 'border-amber-200' : 'border-stone-200')}>
              <div className="relative aspect-square" style={{ background: p.swatch + '33' }}>
                <div className="absolute inset-0 grid place-items-center" style={{ color: p.swatch }}>
                  <svg viewBox="0 0 24 24" className="w-7 h-7 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M21 10v-3.5a1 1 0 0 0-.6-.9L12.6 2a1 1 0 0 0-1.2 0L3.6 5.6a1 1 0 0 0-.6.9V17a1 1 0 0 0 .6.9l7.8 3.5a1 1 0 0 0 .8 0l7.8-3.5a1 1 0 0 0 .6-.9V10"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/></svg>
                </div>
                <div className="absolute top-1.5 right-1.5">
                  {p.out ? <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full">หมด</span>
                   : p.low ? <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded-full">ต่ำ</span>
                   : <span className="px-1.5 py-0.5 bg-white/90 text-stone-600 text-[9px] font-bold rounded-full border border-stone-100">{M.qty(p.stock)}</span>}
                </div>
              </div>
              <div className="p-2.5">
                <div className="text-[11.5px] font-medium text-stone-900 leading-tight line-clamp-2 h-8">{p.name}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[12.5px] font-bold text-emerald-600">{M.baht(p.price)}</span>
                  <span className="text-[9px] text-stone-400 font-mono">{p.sku}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky checkout footer */}
      <div className="shrink-0 bg-white border-t border-stone-200 px-4 py-3">
        <button className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-between px-5 shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="relative grid place-items-center w-9 h-9 rounded-xl bg-white/15">
              {I.cart}
              <span className="absolute -top-1 -right-1 bg-amber-400 text-stone-900 text-[10px] font-bold rounded-full w-5 h-5 grid place-items-center">{cart.length}</span>
            </span>
            <span className="text-[13.5px] font-bold">ดูตะกร้า · ชำระเงิน</span>
          </div>
          <span className="text-[18px] font-mono font-black tabular-nums">{M.baht(total)}</span>
        </button>
      </div>

      {/* Home indicator */}
      <div className="h-6 flex justify-center items-end pb-1.5 shrink-0">
        <div className="w-32 h-[5px] rounded-full bg-stone-900"></div>
      </div>
    </div>
  );
};

window.PosMobile = PosMobile;

// GRN Mobile — Receiving Queue
// Staff lands here from the warehouse floor to see what's waiting to be received.
// 390×844. Segmented tabs (IO/PO), urgent badge, big "รับสินค้า" CTA per row.

const GrnMobileQueue = function () {
  const M = window.ERP_MOCK;
  const I = window.ErpIcons;

  return (
    <div className="w-full h-full flex flex-col text-[14px] font-sans" style={{ background: '#fafaf9', color: '#1c1917' }}>
      {/* status bar */}
      <div className="h-9 px-5 flex items-center justify-between text-[13px] font-semibold shrink-0 text-stone-900">
        <span>09:14</span>
        <span className="flex items-center gap-1">
          <svg viewBox="0 0 18 12" className="w-[18px] h-3"><path d="M1 9h2v2H1zM5 7h2v4H5zM9 4h2v7H9zM13 1h2v10h-2z" fill="currentColor"/></svg>
          <span className="ml-1 inline-flex items-center"><span className="w-5 h-2.5 border border-current rounded-sm inline-block relative"><span className="absolute inset-0.5 bg-current rounded-[1px]"></span></span></span>
        </span>
      </div>

      {/* App header */}
      <div className="px-4 pt-1 pb-3 bg-white border-b border-stone-200 shrink-0">
        <div className="flex items-center justify-between">
          <button className="w-9 h-9 rounded-lg border border-stone-200 grid place-items-center text-stone-600">{I.back}</button>
          <div className="text-center">
            <div className="text-[14px] font-bold text-stone-900">รายการรอรับ</div>
            <div className="text-[10.5px] text-stone-400">Receiving Queue · WH-01</div>
          </div>
          <button className="w-9 h-9 rounded-lg border border-stone-200 grid place-items-center text-stone-600">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 6h18M6 12h12M10 18h4"/></svg>
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2 px-4 pt-3 shrink-0">
        <div className="bg-white border border-amber-200 rounded-xl px-3 py-2.5">
          <div className="text-[9.5px] font-bold text-amber-700 uppercase tracking-wider">ด่วน</div>
          <div className="text-[18px] font-display font-semibold text-amber-700 tabular-nums leading-none mt-1">1</div>
          <div className="text-[10px] text-stone-400 mt-0.5">เกิน 4 ชม.</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl px-3 py-2.5">
          <div className="text-[9.5px] font-bold text-stone-500 uppercase tracking-wider">IO (LINE)</div>
          <div className="text-[18px] font-display font-semibold text-stone-900 tabular-nums leading-none mt-1">3</div>
          <div className="text-[10px] text-stone-400 mt-0.5">234 ชิ้น</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl px-3 py-2.5">
          <div className="text-[9.5px] font-bold text-stone-500 uppercase tracking-wider">PO</div>
          <div className="text-[18px] font-display font-semibold text-stone-900 tabular-nums leading-none mt-1">3</div>
          <div className="text-[10px] text-stone-400 mt-0.5">456 ชิ้น</div>
        </div>
      </div>

      {/* Segmented control */}
      <div className="px-4 pt-3 shrink-0">
        <div className="inline-flex w-full bg-stone-100 border border-stone-200 rounded-xl p-0.5 text-[12px]">
          <button className="flex-1 py-2 rounded-lg bg-white shadow-sm font-semibold text-stone-900 inline-flex items-center justify-center gap-1.5">
            Inbound Orders <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-mono text-[10px]">3</span>
          </button>
          <button className="flex-1 py-2 rounded-lg text-stone-500 inline-flex items-center justify-center gap-1.5">
            Purchase Orders <span className="px-1.5 py-0.5 bg-stone-50 text-stone-500 border border-stone-200 rounded font-mono text-[10px]">3</span>
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-4 pt-3 pb-4 space-y-2.5">
        {M.grn.queue.ios.map((io) => (
          <div key={io.id} className={'bg-white rounded-xl border p-3.5 ' + (io.urgent ? 'border-amber-300 ring-1 ring-amber-200/50' : 'border-stone-200')}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11.5px] font-mono font-semibold text-emerald-700">{io.no}</span>
                  {io.urgent && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-bold rounded uppercase tracking-wider">ด่วน</span>}
                </div>
                <div className="text-[13.5px] font-medium text-stone-900 mt-0.5 leading-tight">{io.vendor}</div>
                <div className="text-[10.5px] text-stone-400 mt-0.5">{io.age}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[9.5px] font-medium text-stone-400 uppercase tracking-wider">ค้างรับ</div>
                <div className="text-[18px] font-mono font-semibold text-stone-900 tabular-nums leading-none mt-0.5">{io.remaining}</div>
                <div className="text-[10px] text-stone-400">{io.lineCount} รายการ</div>
              </div>
            </div>
            <button className="mt-3 w-full h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-bold inline-flex items-center justify-center gap-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="6" width="18" height="12" rx="1"/><path d="M7 6v12M11 6v12M15 6v12M19 6v12"/></svg>
              เริ่มรับสินค้า
            </button>
          </div>
        ))}

        <div className="pt-2 pb-1 px-1 text-[10.5px] font-semibold text-stone-400 uppercase tracking-wider">Purchase Orders · 3 รายการ</div>
        {M.grn.queue.pos.slice(0, 2).map((po) => (
          <div key={po.id} className="bg-white rounded-xl border border-stone-200 p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] font-mono font-semibold text-blue-700">{po.no}</div>
                <div className="text-[13.5px] font-medium text-stone-900 mt-0.5 leading-tight">{po.vendor}</div>
                <div className="text-[10.5px] text-stone-400 mt-0.5">คาดรับ {po.expected}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[9.5px] font-medium text-stone-400 uppercase tracking-wider">ค้างรับ</div>
                <div className="text-[18px] font-mono font-semibold text-stone-900 tabular-nums leading-none mt-0.5">{po.remaining}</div>
                <div className="text-[10px] text-stone-400">{po.lineCount} รายการ</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom tab bar */}
      <div className="shrink-0 bg-white border-t border-stone-200 grid grid-cols-4 px-2 pt-1 pb-1">
        {[
          { ic: I.dashboard, l: 'หน้าหลัก' },
          { ic: I.packagePlus, l: 'รับสินค้า', a: true },
          { ic: I.archive,   l: 'สต็อก' },
          { ic: I.users,     l: 'โปรไฟล์' },
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

window.GrnMobileQueue = GrnMobileQueue;

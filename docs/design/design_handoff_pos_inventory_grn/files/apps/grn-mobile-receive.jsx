// GRN Mobile — Receive Items
// The actual receiving flow staff performs: scan, enter qty/lot/location, mark done.
// Shows IO mid-receipt: 2 lines done, 1 partial in progress, 3 pending.

const GrnMobileReceive = function () {
  const M = window.ERP_MOCK;
  const I = window.ErpIcons;
  const r = M.grn.receiving;
  const total = r.lines.length;
  const done = r.lines.filter((l) => l.status === 'done').length;
  const active = r.lines[r.activeLine];
  const progressPct = Math.round((done + 0.4) / total * 100); // active line counts ~40%

  // Status icon for each line in the list
  const LineStatusDot = ({ s }) => {
    if (s === 'done') return (
      <span className="w-6 h-6 rounded-full bg-emerald-500 text-white grid place-items-center shrink-0">
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
      </span>);

    if (s === 'partial') return (
      <span className="w-6 h-6 rounded-full bg-white border-2 border-amber-400 text-amber-600 grid place-items-center shrink-0">
        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
      </span>);

    return <span className="w-6 h-6 rounded-full bg-white border-2 border-stone-300 shrink-0"></span>;
  };

  return (
    <div className="w-full h-full flex flex-col text-[14px] font-sans" style={{ background: '#fafaf9', color: '#1c1917' }}>
      {/* status bar */}
      <div className="h-9 px-5 flex items-center justify-between text-[13px] font-semibold shrink-0 text-stone-900">
        <span>09:42</span>
        <span className="flex items-center gap-1">
          <svg viewBox="0 0 18 12" className="w-[18px] h-3"><path d="M1 9h2v2H1zM5 7h2v4H5zM9 4h2v7H9zM13 1h2v10h-2z" fill="currentColor" /></svg>
          <span className="ml-1 inline-flex items-center"><span className="w-5 h-2.5 border border-current rounded-sm inline-block relative"><span className="absolute inset-0.5 bg-current rounded-[1px]"></span></span></span>
        </span>
      </div>

      {/* Header */}
      <div className="px-4 pt-1 pb-3 bg-white border-b border-stone-200 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <button className="w-9 h-9 rounded-lg border border-stone-200 grid place-items-center text-stone-600">{I.back}</button>
          <div className="text-center min-w-0 px-2">
            <div className="text-[13.5px] font-bold text-stone-900 truncate">รับสินค้า · {r.io.no}</div>
            <div className="text-[10.5px] text-stone-400 truncate">{r.io.vendor}</div>
          </div>
          <button className="w-9 h-9 rounded-lg border border-stone-200 grid place-items-center text-stone-600">⋯</button>
        </div>
        {/* Progress */}
        <div className="flex items-center gap-2.5">
          <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: progressPct + '%' }}></div>
          </div>
          <span className="text-[11px] font-mono font-semibold text-stone-700 tabular-nums">{done}/{total}</span>
        </div>
      </div>

      {/* Scan banner */}
      <div className="px-4 pt-3 shrink-0">
        <div className="rounded-xl bg-stone-900 text-white p-3.5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-white/10 grid place-items-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="6" width="18" height="12" rx="1" /><path d="M7 6v12M11 6v12M15 6v12M19 6v12" /></svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold">สแกนบาร์โค้ดสินค้า</div>
            <div className="text-[10.5px] text-white/60">หรือกดที่รายการด้านล่างเพื่อรับด้วยมือ</div>
          </div>
          <button className="px-3 h-9 rounded-lg bg-white/10 hover:bg-white/15 text-[12px] font-semibold border border-white/15">เปิดกล้อง</button>
        </div>
      </div>

      {/* Active line card */}
      <div className="px-4 pt-3 shrink-0">
        <div className="rounded-2xl bg-white border-2 border-emerald-300 ring-2 ring-emerald-100 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-mono font-semibold text-emerald-700 tracking-wider">{active.sku}  ·  {active.uom}</div>
              <div className="text-[14.5px] font-semibold text-stone-900 leading-tight mt-0.5">{active.name}</div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-wider shrink-0">รับบางส่วน</span>
          </div>

          {/* Qty stepper */}
          <div className="rounded-xl bg-stone-50 border border-stone-200 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10.5px] font-bold text-stone-500 uppercase tracking-wider">จำนวนที่รับ</span>
              <span className="text-[10.5px] text-stone-400">สั่ง <b className="text-stone-700 font-mono">{active.ordered}</b> {active.uom}</span>
            </div>
            <div className="flex items-center justify-center gap-2.5">
              <button className="w-11 h-11 rounded-lg bg-white border border-stone-300 grid place-items-center text-stone-700 text-[18px] font-bold">−</button>
              <input type="text" defaultValue={active.received} className="w-32 h-11 rounded-lg bg-white border border-stone-300 text-center font-mono font-bold text-[24px] text-stone-900 tabular-nums" readOnly style={{ width: "188px" }} />
              <button className="w-11 h-11 rounded-lg bg-white border border-stone-300 grid place-items-center text-stone-700 text-[18px] font-bold">+</button>
            </div>
            <div className="flex gap-1.5 mt-2">
              {[10, 'รับครบ', '−1 ลัง'].map((q, i) =>
              <button key={i} className="flex-1 h-7 rounded-md bg-white border border-stone-200 text-[11.5px] text-stone-600 font-medium">{q}</button>
              )}
            </div>
          </div>

          {/* Lot + Location + Expiry */}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10.5px] font-bold text-stone-500 uppercase tracking-wider">Lot No.</span>
              <div className="mt-1 h-10 px-3 rounded-lg bg-white border border-stone-300 inline-flex items-center w-full font-mono text-[13px] text-stone-400">L260516</div>
            </label>
            <label className="block">
              <span className="text-[10.5px] font-bold text-stone-500 uppercase tracking-wider">ตำแหน่งเก็บ</span>
              <div className="mt-1 h-10 px-3 rounded-lg bg-white border border-stone-300 inline-flex items-center w-full font-mono text-[13px] text-stone-400">B-08</div>
            </label>
          </div>
          <label className="block">
            <span className="text-[10.5px] font-bold text-stone-500 uppercase tracking-wider inline-flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></svg>
              วันหมดอายุ
            </span>
            <div className="mt-1 h-10 rounded-lg bg-white border border-stone-300 flex items-center pl-3 pr-2">
              <span className="font-mono text-[13.5px] text-stone-700 tabular-nums">16/05/2570</span>
              <span className="ml-2 text-[10.5px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.5">เหลือ 365 วัน</span>
              <button className="ml-auto h-7 px-2.5 rounded-md text-[11.5px] text-stone-600 bg-stone-50 border border-stone-200 inline-flex items-center gap-1">เปลี่ยน</button>
            </div>
          </label>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button className="h-11 rounded-xl bg-white border border-stone-300 text-[13px] font-semibold text-stone-700">ข้ามไปก่อน</button>
            <button className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-bold">บันทึก →</button>
          </div>
        </div>
      </div>

      {/* Line checklist */}
      <div className="flex-1 overflow-auto px-4 pt-4 pb-3">
        <div className="text-[10.5px] font-semibold text-stone-400 uppercase tracking-wider px-1 pb-2">รายการทั้งหมด · {total} SKU</div>
        <div className="space-y-1.5">
          {r.lines.map((l, i) => {
            const isActive = i === r.activeLine;
            return (
              <div key={i} className={
              'rounded-xl border bg-white p-2.5 flex items-center gap-3 ' + (
              isActive ? 'border-emerald-300 ring-1 ring-emerald-100' : l.status === 'done' ? 'border-stone-200 opacity-70' : 'border-stone-200')
              }>
                <LineStatusDot s={l.status} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium text-stone-900 leading-tight truncate">{l.name}</div>
                  <div className="text-[10px] font-mono text-stone-400 mt-0.5">{l.sku}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={'text-[13px] font-mono font-bold tabular-nums leading-none ' + (l.status === 'done' ? 'text-emerald-700' : l.status === 'partial' ? 'text-amber-700' : 'text-stone-400')}>
                    {l.received} <span className="text-stone-400 font-normal">/{l.ordered}</span>
                  </div>
                  <div className="text-[9.5px] text-stone-400 mt-0.5">{l.uom}</div>
                </div>
              </div>);

          })}
        </div>
      </div>

      {/* Sticky submit */}
      <div className="shrink-0 bg-white border-t border-stone-200 px-4 py-2.5">
        <button disabled className="w-full h-12 rounded-2xl bg-stone-200 text-stone-400 text-[14px] font-bold flex items-center justify-center gap-2 cursor-not-allowed">
          ส่งใบรับสินค้า · ยังเหลืออีก {total - done} รายการ
        </button>
      </div>
      <div className="h-6 flex justify-center items-end pb-1.5 shrink-0">
        <div className="w-32 h-[5px] rounded-full bg-stone-900"></div>
      </div>
    </div>);

};

window.GrnMobileReceive = GrnMobileReceive;
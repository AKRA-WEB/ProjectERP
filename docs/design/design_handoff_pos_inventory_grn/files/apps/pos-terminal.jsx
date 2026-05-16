// POS Terminal artboard — recreated from app/app/pos/session/[id]/page.tsx
// Static snapshot showing a session mid-checkout: 4 items in cart, cash tendered, change calculated.

const PosTerminal = function () {
  const M = window.ERP_MOCK;
  const I = window.ErpIcons;
  const { Sidebar, TopBar } = window.ErpShell;

  // Pretend state — fixed for the screenshot
  const cart = M.cart;
  const subtotal = cart.reduce((s, x) => s + x.price * x.qty, 0); // 224
  const orderDiscount = 10;
  const memberDiscount = 0;
  const total = Math.max(0, subtotal - memberDiscount - orderDiscount); // 214
  const VAT = 0.07;
  const vat = Math.round(total * VAT / (1 + VAT) * 100) / 100;
  const exclVat = total - vat;
  const cashTendered = 500;
  const change = Math.max(0, cashTendered - total);

  const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

  // Status bar pieces
  const StatusBarItem = ({ label, value, accent }) =>
  <div className="flex items-center gap-2">
      <span className="text-[11px] text-stone-400 font-medium uppercase tracking-wider">{label}</span>
      <span className={'text-[13px] font-medium ' + (accent ? 'text-emerald-700 font-bold' : 'text-stone-700')}>{value}</span>
    </div>;


  // Product card
  const ProductCard = ({ p }) =>
  <div className={
  'group relative flex flex-col bg-white border rounded-xl overflow-hidden text-left ' + (
  p.out ? 'border-red-200' : p.low ? 'border-amber-200' : 'border-stone-200')
  }>
      {/* image */}
      <div className="relative aspect-square w-full overflow-hidden" style={{ background: p.swatch + '33' }}>
        <div className="absolute inset-0 grid place-items-center" style={{ color: p.swatch }}>
          <svg viewBox="0 0 24 24" className="w-9 h-9 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10v-3.5a1 1 0 0 0-.6-.9L12.6 2a1 1 0 0 0-1.2 0L3.6 5.6a1 1 0 0 0-.6.9V17a1 1 0 0 0 .6.9l7.8 3.5a1 1 0 0 0 .8 0l7.8-3.5a1 1 0 0 0 .6-.9V10" /><path d="M3.3 7L12 12l8.7-5M12 22V12" />
          </svg>
        </div>
        <div className="absolute top-2 right-2">
          {p.out ?
        <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full shadow-sm">หมด</span> :
        p.low ?
        <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full shadow-sm">สต็อกต่ำ</span> :

        <span className="px-2 py-0.5 bg-white/90 text-stone-600 text-[10px] font-bold rounded-full shadow-sm border border-stone-100">{M.qty(p.stock)}</span>
        }
        </div>
      </div>
      <div className="p-3 space-y-1 flex-1 flex flex-col">
        <h4 className="text-[12.5px] font-medium text-stone-900 leading-tight line-clamp-2 h-8">{p.name}</h4>
        <div className="flex items-center justify-between mt-auto pt-1.5">
          <span className="text-[14px] font-bold text-emerald-600">{M.baht(p.price)}</span>
          <span className="text-[10px] text-stone-400 font-mono">{p.sku}</span>
        </div>
      </div>
    </div>;


  return (
    <div className="flex w-full h-full text-[14px] font-sans" style={{ color: '#1c1917', background: '#fafaf9' }}>
      <Sidebar module="pos" activeHref="/app/pos" />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar crumbs={['ขายหน้าร้าน', 'POS Terminal', 'PS-25051601']} />

        <div className="flex flex-col flex-1 gap-4 p-5 min-h-0 overflow-hidden">
          {/* Status Bar */}
          <div className={CARD + ' px-5 py-3 flex items-center justify-between shrink-0'}>
            <div className="flex items-center gap-5">
              <StatusBarItem label="รอบการขาย" value={<span className="font-mono font-bold text-stone-900">PS-25051601</span>} />
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 uppercase tracking-wider">OPEN</span>
              <div className="h-4 w-px bg-stone-200" />
              <StatusBarItem label="คลัง" value="สาขาเซ็นทรัลปิ่นเกล้า" />
              <div className="h-4 w-px bg-stone-200" />
              <StatusBarItem label="กะ / Shift" value="กะเช้า (07:00–15:00)" accent />
              <div className="h-4 w-px bg-stone-200" />
              <StatusBarItem label="แคชเชียร์" value="ปริญญา ฉัตรชัย" />
              <div className="h-4 w-px bg-stone-200" />
              <StatusBarItem label="เวลา" value="14:32" />
            </div>
            <button className="h-9 px-3.5 rounded-md text-[13px] font-medium text-red-600 border border-stone-200 hover:bg-red-50">
              ปิดรอบ / Close
            </button>
          </div>

          {/* Three columns */}
          <div className="flex flex-1 gap-4 min-h-0">
            {/* ── Left: Products ── */}
            <div className="flex-[3] flex flex-col gap-3 min-w-0">
              <div className="flex items-center gap-2 px-1 shrink-0">
                <button className="px-4 py-2 rounded-t-lg font-bold text-[13px] bg-white border-x border-t border-stone-200 text-emerald-600">สินค้า / Products</button>
                <button className="px-4 py-2 rounded-t-lg font-bold text-[13px] text-stone-400">ประวัติ / History</button>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="text-[11px] text-stone-400 font-medium">บิลที่พัก:</span>
                  <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">2</span>
                </div>
              </div>

              <div className={CARD + ' p-4 shrink-0 space-y-3'}>
                {/* Search */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">{I.search}</span>
                  <div className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-lg text-[15px] text-stone-400">
                    ค้นหาสินค้าด้วย ชื่อ, SKU หรือ สแกนบาร์โค้ด…
                  </div>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-stone-400 border border-stone-200 bg-white rounded px-1.5 py-0.5">F2</span>
                </div>
                {/* Categories */}
                <div className="flex items-center gap-2 overflow-hidden">
                  <button className="px-4 py-1.5 rounded-full text-[11.5px] font-bold whitespace-nowrap bg-emerald-600 text-white shadow-sm">ทั้งหมด / All</button>
                  {M.cats.map((c) =>
                  <button key={c.id} className="px-4 py-1.5 rounded-full text-[11.5px] font-bold whitespace-nowrap bg-stone-100 text-stone-600">{c.name_th}</button>
                  )}
                </div>
              </div>

              {/* Product grid */}
              <div className="flex-1 overflow-hidden">
                <div className="grid grid-cols-4 gap-3 pb-2">
                  {M.products.slice(0, 12).map((p) => <ProductCard key={p.id} p={p} />)}
                </div>
              </div>
            </div>

            {/* ── Middle: Cart ── */}
            <div className="flex-[2] flex flex-col gap-4 min-w-0">
              <div className={CARD + ' flex-1 flex flex-col min-h-0'}>
                <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 shrink-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-stone-900 text-[14px]">รายการสินค้า / Cart</h3>
                    <span className="text-[11px] font-medium text-stone-500 bg-stone-200/60 px-2 py-0.5 rounded-full">{cart.length}</span>
                  </div>
                  <button className="h-8 px-2.5 rounded-md text-[12px] text-amber-700 border border-amber-200 bg-amber-50 hover:bg-amber-100">⏸ พักบิล / Hold</button>
                </div>
                <div className="flex-1 overflow-auto divide-y divide-stone-50">
                  {cart.map((item) => (
                    <div key={item.id} className="px-4 py-3 hover:bg-stone-50/50 group">
                      {/* Row 1: name (full width) + delete */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-medium text-stone-900 leading-snug">{item.name}</div>
                          <div className="text-[10.5px] text-stone-400 font-mono mt-0.5">{item.sku}</div>
                        </div>
                        <button className="text-stone-300 hover:text-red-500 p-0.5 -mt-0.5 shrink-0" aria-label="ลบ">✕</button>
                      </div>
                      {/* Row 2: qty stepper · unit price · total */}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="inline-flex items-center gap-1.5">
                          <button className="w-7 h-7 grid place-items-center rounded-md border border-stone-200 hover:bg-stone-100 text-stone-600 text-[15px] leading-none">−</button>
                          <span className="w-8 text-center font-mono font-bold text-[14px] tabular-nums">{item.qty}</span>
                          <button className="w-7 h-7 grid place-items-center rounded-md border border-stone-200 hover:bg-stone-100 text-stone-600 text-[15px] leading-none">+</button>
                          <span className="ml-2 text-[11.5px] text-stone-400 font-mono tabular-nums">× {M.baht(item.price)}</span>
                        </div>
                        <span className="font-mono font-bold text-[15px] text-stone-900 tabular-nums">{M.baht(item.price * item.qty)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Held cart strip */}
                <div className="border-t border-stone-100 px-4 py-2.5 bg-amber-50/40 flex items-center gap-2 text-[11.5px]">
                  <span className="text-amber-700 font-bold">บิลที่พัก:</span>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-amber-200 text-amber-800 font-mono">HC-2241</span>
                  <span className="text-stone-400">·</span>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-amber-200 text-amber-800 font-mono">HC-2242</span>
                  <span className="ml-auto text-stone-400">รวม 2 บิล · 7 รายการ</span>
                </div>
              </div>
            </div>

            {/* ── Right: Totals + Payment ── */}
            <div className="flex-[2] flex flex-col gap-3 min-w-0">
              {/* Totals */}
              <div className={CARD + ' p-4 space-y-2.5'}>
                <div className="flex justify-between text-[13px] text-stone-500">
                  <span>รวมสินค้า / Subtotal</span>
                  <span className="font-mono tabular-nums">{M.baht(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-[13px] text-stone-500">
                  <span>ส่วนลดท้ายบิล / Discount</span>
                  <div className="w-24 px-2 py-1 bg-stone-50 border border-stone-200 rounded text-right font-mono text-[13px] text-stone-900">−{M.baht(orderDiscount)}</div>
                </div>
                <div className="h-px bg-stone-100" />
                <div className="flex justify-between text-[12px] text-stone-400">
                  <span>ก่อนภาษี (excl. VAT)</span>
                  <span className="font-mono tabular-nums">{M.baht(exclVat)}</span>
                </div>
                <div className="flex justify-between text-[12px] text-stone-400">
                  <span>VAT 7%</span>
                  <span className="font-mono tabular-nums">{M.baht(vat)}</span>
                </div>
                <div className="h-px bg-stone-100" />
                <div className="flex justify-between items-end">
                  <span className="text-[12px] font-bold text-stone-900 uppercase tracking-wider">ยอดสุทธิ / Total</span>
                  <span className="text-[30px] font-black text-emerald-600 font-mono tracking-tighter tabular-nums leading-none">{M.baht(total)}</span>
                </div>
              </div>

              {/* Member */}
              <div className={CARD + ' p-4'}>
                <label className="text-[10.5px] font-bold text-stone-400 uppercase tracking-wider">สมาชิก / Member</label>
                <div className="mt-2 flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg">
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold text-emerald-800">สมศรี วงศ์ทอง</span>
                    <span className="text-[10.5px] text-emerald-600 font-medium tracking-wider">GOLD · ส่วนลด 5% · 1,240 pts</span>
                  </div>
                  <button className="text-emerald-400 hover:text-emerald-600 p-1">✕</button>
                </div>
              </div>

              {/* Payment */}
              <div className={CARD + ' p-4 flex-1 flex flex-col gap-3 min-h-0'}>
                <div className="grid grid-cols-3 gap-2 shrink-0">
                  <button className="py-2.5 rounded-lg border-2 border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm text-[12px] font-bold">💵 เงินสด</button>
                  <button className="py-2.5 rounded-lg border border-stone-200 text-stone-500 text-[12px] font-bold hover:bg-stone-50">💳 บัตร</button>
                  <button className="py-2.5 rounded-lg border border-stone-200 text-stone-500 text-[12px] font-bold hover:bg-stone-50">🔀 ผสม</button>
                </div>

                <div className="space-y-2 shrink-0">
                  <label className="text-[10.5px] font-bold text-stone-400 uppercase tracking-wider">เงินสดที่รับมา / Cash Tendered</label>
                  <div className="px-3 py-2 bg-white border border-stone-300 rounded-lg text-right text-[22px] font-mono font-bold text-stone-900 tabular-nums">{M.baht(cashTendered)}</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[20, 100, 500, 1000].map((amt) =>
                    <button key={amt} className="py-1.5 bg-stone-50 border border-stone-200 rounded text-[12px] text-stone-700 font-medium hover:bg-stone-100">{amt}</button>
                    )}
                  </div>
                </div>

                <div className="mt-auto pt-3 space-y-3">
                  <div className="flex justify-between items-center px-3 py-2.5 bg-amber-50 rounded-lg border border-amber-100">
                    <span className="text-[12px] font-bold text-amber-800 uppercase tracking-wider">เงินทอน / Change</span>
                    <span className="text-[22px] font-mono font-black text-amber-800 tabular-nums">{M.baht(change)}</span>
                  </div>
                  <button className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[16px] font-bold shadow-md">
                    ชำระเงิน / Checkout →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>);

};

window.PosTerminal = PosTerminal;
// GRN Desktop List — Admin view
// Faithful to app/app/grn/page.tsx — tabs by status, table, status pills, action bar.

const GrnDesktop = function () {
  const M = window.ERP_MOCK;
  const I = window.ErpIcons;
  const { Sidebar, TopBar } = window.ErpShell;

  const TABS = [
    { id: '', label: 'ทั้งหมด', count: 142 },
    { id: 'draft', label: 'ร่าง', count: 3 },
    { id: 'received', label: 'รับแล้ว', count: 8 },
    { id: 'qc_pending', label: 'รอ QC', count: 12, hot: true },
    { id: 'qc_passed', label: 'QC ผ่าน', count: 34 },
    { id: 'qc_failed', label: 'QC ไม่ผ่าน', count: 2 },
    { id: 'verified', label: 'ตรวจสอบแล้ว', count: 18 },
    { id: 'stocked', label: 'นำเข้าคลัง', count: 65 },
  ];
  const activeTab = 'qc_pending';

  const PILL = {
    draft:      { label: 'ร่าง',         c: 'text-stone-500 border-stone-200 bg-stone-50' },
    received:   { label: 'รับแล้ว',      c: 'text-blue-700 border-blue-200 bg-blue-50' },
    qc_pending: { label: 'รอ QC',        c: 'text-amber-700 border-amber-300 bg-amber-50' },
    qc_passed:  { label: 'QC ผ่าน',      c: 'text-emerald-700 border-emerald-200 bg-emerald-50' },
    qc_failed:  { label: 'QC ไม่ผ่าน',   c: 'text-red-700 border-red-200 bg-red-50' },
    verified:   { label: 'ตรวจสอบแล้ว', c: 'text-blue-700 border-blue-200 bg-blue-50' },
    stocked:    { label: 'นำเข้าคลัง',   c: 'text-emerald-700 border-emerald-200 bg-emerald-50' },
  };
  const Pill = ({ status }) => {
    const p = PILL[status] || PILL.draft;
    return (
      <span className={'inline-flex items-center gap-1.5 px-2 py-[2px] text-[11.5px] font-medium rounded-full border whitespace-nowrap ' + p.c}>
        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>{p.label}
      </span>
    );
  };

  return (
    <div className="flex w-full h-full text-[14px] font-sans" style={{ color: '#1c1917', background: '#fafaf9' }}>
      <Sidebar module="wms" activeHref="/app/grn" />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar crumbs={['คลังสินค้า', 'Goods Receive', 'รายการ GRN']} />

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-[1280px] mx-auto space-y-5">

            {/* Header */}
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h1 className="font-display text-[26px] font-semibold tracking-tight text-stone-950 leading-tight">ใบรับสินค้า</h1>
                <p className="text-[13.5px] text-stone-500 mt-1">Goods Receipt Notes · 142 รายการ · 12 รอ QC</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="h-9 px-3.5 rounded-md text-[13px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50">Export CSV</button>
                <button className="h-9 px-3.5 rounded-md text-[13px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50 inline-flex items-center gap-1.5">
                  <span className="text-stone-400">{I.clipboard}</span>
                  รายการรอรับ <span className="ml-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10.5px] font-mono">3 IO · 3 PO</span>
                </button>
                <button className="h-9 px-3.5 rounded-md text-[13px] font-medium text-white bg-stone-950 hover:bg-stone-800 inline-flex items-center gap-1.5">
                  <span className="text-base leading-none">+</span> สร้าง GRN
                </button>
              </div>
            </div>

            {/* Status tabs */}
            <div className="flex gap-0 border-b border-stone-200 overflow-x-auto">
              {TABS.map((t) => (
                <button key={t.id} className={
                  'px-3.5 py-2.5 text-[13.5px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ' +
                  (t.id === activeTab ? 'text-stone-950 border-stone-950' : 'text-stone-400 border-transparent hover:text-stone-700')
                }>
                  {t.label}
                  <span className={
                    'px-1.5 py-0.5 rounded text-[10.5px] font-mono ' +
                    (t.id === activeTab ? 'bg-stone-100 text-stone-700' : t.hot ? 'bg-amber-50 text-amber-700' : 'bg-stone-50 text-stone-400')
                  }>{t.count}</span>
                </button>
              ))}
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">{I.search}</span>
                <div className="w-full pl-9 pr-3 h-9 inline-flex items-center bg-white border border-stone-300 rounded-lg text-[13px] text-stone-400">ค้นหาเลข GRN / PO / IO…</div>
              </div>
              <select className="h-9 px-3 pr-8 bg-white border border-stone-300 rounded-lg text-[13px] text-stone-700"><option>ทุกคลัง</option></select>
              <select className="h-9 px-3 pr-8 bg-white border border-stone-300 rounded-lg text-[13px] text-stone-700"><option>วันนี้ + 7 วัน</option></select>
              <select className="h-9 px-3 pr-8 bg-white border border-stone-300 rounded-lg text-[13px] text-stone-700"><option>ผู้รับทุกคน</option></select>
            </div>

            {/* Table */}
            <div className="bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-[10.5px] font-semibold uppercase tracking-wider text-stone-500 bg-stone-50">
                    <th className="text-left px-4 py-3 border-b border-stone-200 w-36">เลข GRN</th>
                    <th className="text-left px-4 py-3 border-b border-stone-200 w-40">เอกสารอ้างอิง</th>
                    <th className="text-left px-4 py-3 border-b border-stone-200">คลังสินค้า</th>
                    <th className="text-left px-4 py-3 border-b border-stone-200">ผู้รับ</th>
                    <th className="text-left px-4 py-3 border-b border-stone-200 w-32">วันที่รับ</th>
                    <th className="text-center px-4 py-3 border-b border-stone-200 w-20">รายการ</th>
                    <th className="text-left px-4 py-3 border-b border-stone-200 w-32">สถานะ</th>
                    <th className="px-2 py-3 border-b border-stone-200 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {M.grn.rows.map((r) => (
                    <tr key={r.id} className="hover:bg-stone-50/60 cursor-default">
                      <td className="px-4 py-0 h-11 font-mono text-[12.5px] font-medium text-stone-700">{r.no}</td>
                      <td className="px-4 py-0 h-11 font-mono text-[12.5px]">
                        {r.ref ? (
                          <span className={r.refType === 'io' ? 'text-emerald-700 inline-flex items-center gap-1.5' : 'text-blue-700 inline-flex items-center gap-1.5'}>
                            <span className={'inline-block w-1 h-1 rounded-full ' + (r.refType === 'io' ? 'bg-emerald-500' : 'bg-blue-500')}></span>
                            {r.ref}
                          </span>
                        ) : <span className="text-stone-300">—</span>}
                      </td>
                      <td className="px-4 py-0 h-11 text-[12.5px] text-stone-600">
                        <span className="font-mono text-stone-700">{r.wh}</span> <span className="text-stone-400">·</span> {r.whName}
                      </td>
                      <td className="px-4 py-0 h-11 text-[12.5px] text-stone-600">{r.receivedBy}</td>
                      <td className="px-4 py-0 h-11 text-[12.5px] text-stone-500 font-mono">{M.fmtDate(r.date)}</td>
                      <td className="px-4 py-0 h-11 text-center text-[12.5px] font-mono tabular-nums text-stone-500">{r.lineCount}</td>
                      <td className="px-4 py-0 h-11"><Pill status={r.status} /></td>
                      <td className="px-2 py-0 h-11 text-stone-300">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100 bg-stone-50/40 text-[12px] text-stone-500">
                <span>แสดง <b className="text-stone-700">1 – 10</b> จาก <b className="text-stone-700">142</b> รายการ</span>
                <div className="flex items-center gap-1.5">
                  <button className="h-7 px-2.5 rounded-md border border-stone-200 bg-white text-stone-400">‹ ก่อนหน้า</button>
                  <button className="h-7 w-7 rounded-md bg-stone-900 text-white text-[12px] font-medium">1</button>
                  <button className="h-7 w-7 rounded-md border border-stone-200 bg-white text-stone-700">2</button>
                  <button className="h-7 w-7 rounded-md border border-stone-200 bg-white text-stone-700">3</button>
                  <span className="text-stone-400 px-1">…</span>
                  <button className="h-7 w-7 rounded-md border border-stone-200 bg-white text-stone-700">15</button>
                  <button className="h-7 px-2.5 rounded-md border border-stone-200 bg-white text-stone-700">ถัดไป ›</button>
                </div>
              </div>
            </div>

            <p className="text-[11.5px] text-stone-400 text-center">คลิกแถวเพื่อดูรายละเอียดในหน้าต่างแบบ modal · ใช้ ↑↓ + Enter เพื่อเปิดด้วยคีย์บอร์ด</p>
          </div>
        </div>
      </div>
    </div>
  );
};

window.GrnDesktop = GrnDesktop;

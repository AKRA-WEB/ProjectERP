// Payroll Run — monthly processing screen.
// Period header w/ workflow status · summary KPIs · employee earnings table w/ deductions.

const HrPayroll = function () {
  const H = window.HR_MOCK;
  const I = window.ErpIcons;
  const { Sidebar, TopBar } = window.ErpShell;

  const Avatar = ({ emp, size = 28 }) => (
    <div className="rounded-full grid place-items-center font-semibold shrink-0"
         style={{ width: size, height: size, background: emp.hue, color: emp.txt, fontSize: size * 0.42 }}>
      {emp.initials}
    </div>
  );

  const period = H.payrollPeriod;

  // Workflow steps
  const steps = [
    { key: 'draft',    label: 'ร่าง',         sub: 'รวบรวมข้อมูล' },
    { key: 'review',   label: 'ตรวจสอบ',   sub: 'ตรวจรายการ' },
    { key: 'approved', label: 'อนุมัติ',     sub: 'ผู้บริหารเซ็น' },
    { key: 'paid',     label: 'จ่ายแล้ว',     sub: 'โอนเงิน' },
  ];
  const stepIdx = steps.findIndex((s) => s.key === period.status);

  const Kpi = ({ label, value, sub, accent, mono = true }) => (
    <div className="flex-1 px-5 py-4 border-r border-stone-100 last:border-r-0">
      <div className="text-[11.5px] font-medium text-stone-500 uppercase tracking-wider">{label}</div>
      <div className={'mt-1.5 font-display text-[24px] font-semibold tracking-tight ' + (mono ? 'tabular-nums ' : '') + (accent || 'text-stone-900')}>{value}</div>
      {sub && <div className="text-[11.5px] text-stone-400 mt-0.5">{sub}</div>}
    </div>
  );

  return (
    <div className="flex w-full h-full text-[14px] font-sans" style={{ color: '#1c1917', background: '#fafaf9' }}>
      <Sidebar module="hr" activeHref="/app/hr/payroll" />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar crumbs={['บุคลากร', 'HR', 'เงินเดือน', period.code]} />

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-[1280px] mx-auto space-y-5">

            {/* Page header */}
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="font-display text-[26px] font-semibold tracking-tight text-stone-900 leading-tight">{period.label_th}</h1>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">รอตรวจสอบ</span>
                </div>
                <p className="text-[13.5px] text-stone-500 mt-1">{period.code} · ตัดยอด 25 พ.ค. · จ่าย 28 พ.ค. 2569 · {period.employees} คน</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="h-9 px-3.5 rounded-md text-[13px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50">Export ธ.ไทยพาณิชย์</button>
                <button className="h-9 px-3.5 rounded-md text-[13px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50">พิมพ์สลิป</button>
                <button className="h-9 px-3.5 rounded-md text-[13px] font-medium text-white bg-stone-900 hover:bg-stone-800 inline-flex items-center gap-1.5">
                  ส่งให้ผู้บริหารอนุมัติ →
                </button>
              </div>
            </div>

            {/* Workflow stepper */}
            <div className="bg-white border border-stone-200 rounded-[10px] shadow-sm p-5">
              <div className="grid grid-cols-4 gap-2">
                {steps.map((s, i) => {
                  const done = i < stepIdx;
                  const current = i === stepIdx;
                  return (
                    <div key={s.key} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={'w-8 h-8 rounded-full grid place-items-center text-[12px] font-bold border-2 ' +
                          (done ? 'bg-stone-900 border-stone-900 text-white' :
                           current ? 'bg-white border-stone-900 text-stone-900' :
                           'bg-white border-stone-200 text-stone-400')}>
                          {done ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg> : (i + 1)}
                        </div>
                        {i < steps.length - 1 && <div className={'w-px h-6 ' + (done ? 'bg-stone-900' : 'bg-stone-200')}></div>}
                      </div>
                      <div className="pb-4">
                        <div className={'text-[13px] font-semibold ' + (current ? 'text-stone-900' : done ? 'text-stone-700' : 'text-stone-400')}>{s.label}</div>
                        <div className="text-[11.5px] text-stone-400">{s.sub}</div>
                        {current && <div className="mt-1 text-[10.5px] font-mono text-amber-700 tabular-nums">เริ่ม 14 พ.ค. · 14:22</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* KPI strip */}
            <div className="flex bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
              <Kpi label="ยอดรวม (Gross)"        value={H.baht(period.grossTotal)}  sub={`${period.employees} คน · เฉลี่ย ${H.baht(Math.round(period.grossTotal/period.employees))}`} />
              <Kpi label="ประกันสังคม (5%)"     value={H.baht(period.sso)}        sub="หักจากพนักงาน · ฝั่งบริษัทเท่ากัน" accent="text-stone-700" />
              <Kpi label="กองทุนสำรองฯ (3%)" value={H.baht(period.pvf)}        sub="93 คนสมัครเข้าร่วม" accent="text-stone-700" />
              <Kpi label="ภาษีหัก ณ ที่จ่าย"        value={H.baht(period.tax)}        sub="ภ.ง.ด.1 · ส่ง 7 มิ.ย." accent="text-stone-700" />
              <Kpi label="ยอดสุทธิ (Net)"         value={H.baht(period.netTotal)}    sub="พร้อมโอน 28 พ.ค." accent="text-emerald-700" />
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">{I.search}</span>
                <div className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-lg text-[13px] text-stone-400">ค้นหาชื่อ / รหัสพนักงาน…</div>
              </div>
              <select className="h-9 px-3 pr-8 bg-white border border-stone-300 rounded-lg text-[13px] text-stone-700">
                <option>ทุกแผนก</option>
              </select>
              <select className="h-9 px-3 pr-8 bg-white border border-stone-300 rounded-lg text-[13px] text-stone-700">
                <option>ทุกสาขา</option>
              </select>
              <label className="flex items-center gap-2 text-[13px] text-stone-600 cursor-default px-3 h-9 border border-stone-300 bg-white rounded-lg">
                <span className="w-3.5 h-3.5 rounded border border-stone-400 inline-block"></span>
                <span>เฉพาะที่มีค่าล่วงเวลา</span>
              </label>
            </div>

            {/* Payroll table */}
            <div className="bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr className="text-[10.5px] font-semibold text-stone-500 uppercase tracking-wider">
                    <th className="px-4 py-3 w-8"></th>
                    <th className="px-4 py-3 w-28">รหัส</th>
                    <th className="px-4 py-3">พนักงาน</th>
                    <th className="px-4 py-3 text-right w-28">ฐานเงินเดือน</th>
                    <th className="px-4 py-3 text-right w-24">OT</th>
                    <th className="px-4 py-3 text-right w-24">เบี้ยเลี้ยง</th>
                    <th className="px-4 py-3 text-right w-28">รวม (Gross)</th>
                    <th className="px-4 py-3 text-right w-20">SSO</th>
                    <th className="px-4 py-3 text-right w-20">PVF</th>
                    <th className="px-4 py-3 text-right w-20">ภาษี</th>
                    <th className="px-4 py-3 text-right w-28">สุทธิ (Net)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {H.payrollRows.map((r) => {
                    const e = H.empById[r.empId];
                    return (
                      <tr key={e.id} className="hover:bg-stone-50/60">
                        <td className="px-4 py-3"><span className="w-3.5 h-3.5 rounded border border-stone-300 inline-block"></span></td>
                        <td className="px-4 py-3 font-mono text-[12.5px] font-medium text-stone-700">{e.code}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar emp={e} size={28} />
                            <div className="min-w-0">
                              <div className="text-[13px] font-medium text-stone-900 truncate">{e.name_th}</div>
                              <div className="text-[10.5px] text-stone-400 truncate">{e.position}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[13px] tabular-nums text-stone-800">{H.baht(r.base)}</td>
                        <td className={'px-4 py-3 text-right font-mono text-[13px] tabular-nums ' + (r.ot > 0 ? 'text-stone-700' : 'text-stone-300')}>{r.ot > 0 ? H.baht(r.ot) : '—'}</td>
                        <td className={'px-4 py-3 text-right font-mono text-[13px] tabular-nums ' + (r.allowance > 0 ? 'text-stone-700' : 'text-stone-300')}>{r.allowance > 0 ? H.baht(r.allowance) : '—'}</td>
                        <td className="px-4 py-3 text-right font-mono text-[13px] tabular-nums font-semibold text-stone-900">{H.baht(r.gross)}</td>
                        <td className="px-4 py-3 text-right font-mono text-[12.5px] tabular-nums text-stone-500">−{H.baht(r.sso)}</td>
                        <td className="px-4 py-3 text-right font-mono text-[12.5px] tabular-nums text-stone-500">−{H.baht(r.pvf)}</td>
                        <td className="px-4 py-3 text-right font-mono text-[12.5px] tabular-nums text-stone-500">−{H.baht(r.tax)}</td>
                        <td className="px-4 py-3 text-right font-mono text-[13.5px] tabular-nums font-bold text-emerald-700">{H.baht(r.net)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-stone-50 border-t border-stone-200">
                  <tr className="text-[12.5px] font-semibold text-stone-700">
                    <td className="px-4 py-3" colSpan={3}>รวม 12 จาก {period.employees} คน · เฉพาะหน้านี้</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{H.baht(H.payrollRows.reduce((s,r)=>s+r.base,0))}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{H.baht(H.payrollRows.reduce((s,r)=>s+r.ot,0))}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{H.baht(H.payrollRows.reduce((s,r)=>s+r.allowance,0))}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{H.baht(H.payrollRows.reduce((s,r)=>s+r.gross,0))}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-stone-500">−{H.baht(H.payrollRows.reduce((s,r)=>s+r.sso,0))}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-stone-500">−{H.baht(H.payrollRows.reduce((s,r)=>s+r.pvf,0))}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-stone-500">−{H.baht(H.payrollRows.reduce((s,r)=>s+r.tax,0))}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-700">{H.baht(H.payrollRows.reduce((s,r)=>s+r.net,0))}</td>
                  </tr>
                </tfoot>
              </table>
              <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100 bg-stone-50/40 text-[12px] text-stone-500">
                <span>แสดง <b className="text-stone-700">1 – 12</b> จาก <b className="text-stone-700">{period.employees}</b> คน</span>
                <div className="flex items-center gap-1.5">
                  <button className="h-7 px-2.5 rounded-md border border-stone-200 bg-white text-stone-400 hover:bg-stone-50">‹ ก่อนหน้า</button>
                  <button className="h-7 w-7 rounded-md bg-stone-900 text-white text-[12px] font-medium">1</button>
                  <button className="h-7 w-7 rounded-md border border-stone-200 bg-white text-stone-700 hover:bg-stone-50">2</button>
                  <button className="h-7 w-7 rounded-md border border-stone-200 bg-white text-stone-700 hover:bg-stone-50">3</button>
                  <span className="text-stone-400 px-1">…</span>
                  <button className="h-7 w-7 rounded-md border border-stone-200 bg-white text-stone-700 hover:bg-stone-50">9</button>
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

window.HrPayroll = HrPayroll;

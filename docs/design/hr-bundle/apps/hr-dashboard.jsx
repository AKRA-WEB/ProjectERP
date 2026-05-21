// HR Dashboard — desktop overview screen.
// KPI strip · today's attendance feed · pending leave queue · headcount by dept · upcoming events.

const HrDashboard = function () {
  const H = window.HR_MOCK;
  const I = window.ErpIcons;
  const { Sidebar, TopBar } = window.ErpShell;

  // ── Avatar pill (re-used)
  const Avatar = ({ emp, size = 28 }) => (
    <div className="rounded-full grid place-items-center font-semibold shrink-0"
         style={{ width: size, height: size, background: emp.hue, color: emp.txt, fontSize: size * 0.42 }}>
      {emp.initials}
    </div>
  );

  // KPI strip card
  const Kpi = ({ label, value, unit, sub, accent, trend }) => (
    <div className="flex-1 px-5 py-4 border-r border-stone-100 last:border-r-0">
      <div className="text-[11.5px] font-medium text-stone-500 uppercase tracking-wider">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={'font-display text-[26px] font-semibold tracking-tight tabular-nums ' + (accent || 'text-stone-900')}>{value}</span>
        {unit && <span className="text-[13px] text-stone-400 font-medium">{unit}</span>}
        {trend && <span className="ml-1 text-[11px] font-mono text-emerald-600 tabular-nums">{trend}</span>}
      </div>
      {sub && <div className="text-[11.5px] text-stone-400 mt-0.5">{sub}</div>}
    </div>
  );

  const pendingLeave = H.leaveRequests.filter((l) => l.status === 'pending');
  const onTime  = H.attendance.filter((a) => a.status === 'on_time').length;
  const late    = H.attendance.filter((a) => a.status === 'late').length;
  const onLeave = H.attendance.filter((a) => a.status === 'on_leave').length;
  const totalHeadcount = H.depts.reduce((s, d) => s + d.count, 0);
  const maxDept = Math.max(...H.depts.map((d) => d.count));

  return (
    <div className="flex w-full h-full text-[14px] font-sans" style={{ color: '#1c1917', background: '#fafaf9' }}>
      <Sidebar module="hr" activeHref="/app/hr" />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar crumbs={['บุคลากร', 'HR', 'ภาพรวม']} />

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-[1280px] mx-auto space-y-5">
            {/* Page header */}
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-[26px] font-semibold tracking-tight text-stone-900 leading-tight">ภาพรวมบุคลากร / HR Dashboard</h1>
                <p className="text-[13.5px] text-stone-500 mt-1">อังคารที่ 16 พฤษภาคม 2569 · ข้อมูลล่าสุด 14:31 น.</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="h-9 px-3.5 rounded-md text-[13px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50">รายงานประจำเดือน</button>
                <button className="h-9 px-3.5 rounded-md text-[13px] font-medium text-white bg-stone-900 hover:bg-stone-800 inline-flex items-center gap-1.5">
                  <span className="text-base leading-none">+</span> เพิ่มพนักงาน
                </button>
              </div>
            </div>

            {/* KPI strip */}
            <div className="flex bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
              <Kpi label="พนักงานทั้งหมด"    value={totalHeadcount} unit="คน" sub="ทดลองงาน 3 · ลาออกเดือนนี้ 1" trend="+2" />
              <Kpi label="เข้างานวันนี้"        value={onTime + late} unit={'/ ' + (totalHeadcount - onLeave)} sub={`ตรงเวลา ${onTime} · สาย ${late}`} accent={late > 0 ? 'text-amber-700' : 'text-emerald-700'} />
              <Kpi label="คำขอลาที่ค้าง"      value={pendingLeave.length} unit="ใบ" sub="ต้องอนุมัติภายใน 24 ชม." accent="text-amber-700" />
              <Kpi label="เงินเดือนงวดนี้"     value="฿3.28M" sub="105 คน · จ่าย 28 พ.ค." />
            </div>

            {/* Row 1: Attendance feed + Leave queue */}
            <div className="grid grid-cols-12 gap-5">
              {/* Attendance today */}
              <section className="col-span-7 bg-white border border-stone-200 rounded-[10px] shadow-sm">
                <header className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100">
                  <div>
                    <h2 className="text-[14.5px] font-semibold text-stone-900">เวลาเข้างานวันนี้</h2>
                    <p className="text-[11.5px] text-stone-400">10 คนล่าสุด · เรียงตามเวลาเข้างาน</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11.5px]">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">ตรงเวลา {onTime}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">สาย {late}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200 font-semibold">ลา {onLeave}</span>
                  </div>
                </header>
                <ul className="divide-y divide-stone-100">
                  {H.attendance.slice(0, 8).map((a, i) => {
                    const e = H.empById[a.empId];
                    return (
                      <li key={i} className="flex items-center gap-3 px-5 py-2.5">
                        <Avatar emp={e} size={32} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-stone-900 truncate">{e.name_th}</div>
                          <div className="text-[11px] text-stone-400 truncate">{e.position} · {a.shift}</div>
                        </div>
                        <div className="text-right shrink-0">
                          {a.clockIn ? (
                            <>
                              <div className={'font-mono text-[14px] tabular-nums font-semibold ' + (a.status === 'late' ? 'text-amber-700' : 'text-stone-900')}>{a.clockIn}</div>
                              <div className="text-[10.5px] text-stone-400 mt-0.5">
                                {a.status === 'late' ? <span className="text-amber-600 font-medium">สาย {a.late} นาที</span> : 'ตรงเวลา'}
                              </div>
                            </>
                          ) : a.status === 'on_leave' ? (
                            <>
                              <div className="text-[12px] font-semibold text-red-600">{a.leave}</div>
                              <div className="text-[10.5px] text-stone-400 mt-0.5">อนุมัติแล้ว</div>
                            </>
                          ) : (
                            <>
                              <div className="text-[12px] font-medium text-stone-400">— : —</div>
                              <div className="text-[10.5px] text-stone-400 mt-0.5">รอเข้ากะ</div>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <footer className="px-5 py-2.5 border-t border-stone-100 bg-stone-50/40 text-[11.5px] text-stone-500 flex items-center justify-between">
                  <span>แสดง <b className="text-stone-700">8</b> จาก <b className="text-stone-700">128</b> รายการ</span>
                  <a className="text-stone-700 font-medium hover:underline">ดูทั้งหมด →</a>
                </footer>
              </section>

              {/* Leave queue */}
              <section className="col-span-5 bg-white border border-stone-200 rounded-[10px] shadow-sm">
                <header className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100">
                  <div>
                    <h2 className="text-[14.5px] font-semibold text-stone-900">คำขอลาที่รออนุมัติ</h2>
                    <p className="text-[11.5px] text-stone-400">{pendingLeave.length} คำขอ · เก่าสุด 6 ชม.</p>
                  </div>
                  <a className="text-[12px] text-stone-700 font-medium hover:underline">จัดการ →</a>
                </header>
                <ul className="divide-y divide-stone-100">
                  {pendingLeave.slice(0, 4).map((lv) => {
                    const e = H.empById[lv.empId];
                    return (
                      <li key={lv.id} className="px-5 py-3">
                        <div className="flex items-start gap-3">
                          <Avatar emp={e} size={32} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium text-stone-900 truncate">{e.name_th}</span>
                              {lv.urgent && <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider">ด่วน</span>}
                            </div>
                            <div className="text-[11px] text-stone-400 truncate">{lv.reason}</div>
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className={'px-1.5 py-0.5 rounded text-[10px] font-semibold ' + (lv.type === 'ลาป่วย' ? 'bg-red-50 text-red-700 border border-red-200' : lv.type === 'ลาพักร้อน' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200')}>{lv.type}</span>
                              <span className="text-[11px] font-mono text-stone-600 tabular-nums">{lv.from.slice(8)} {lv.from === lv.to ? '' : '– ' + lv.to.slice(8)} · {lv.days} วัน</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2.5 ml-11">
                          <button className="h-7 px-3 rounded-md text-[11.5px] font-semibold bg-stone-900 text-white hover:bg-stone-800">อนุมัติ</button>
                          <button className="h-7 px-3 rounded-md text-[11.5px] font-semibold bg-white border border-stone-200 text-stone-700 hover:bg-stone-50">ปฏิเสธ</button>
                          <span className="text-[10.5px] text-stone-400 ml-auto">{lv.submitted}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>

            {/* Row 2: Headcount by dept + Upcoming */}
            <div className="grid grid-cols-12 gap-5">
              {/* Headcount */}
              <section className="col-span-7 bg-white border border-stone-200 rounded-[10px] shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-[14.5px] font-semibold text-stone-900">จำนวนพนักงานตามแผนก</h2>
                    <p className="text-[11.5px] text-stone-400">รวม {totalHeadcount} คน · 6 แผนก · 3 สาขา + สนญ.</p>
                  </div>
                  <div className="inline-flex bg-stone-100 border border-stone-200 rounded-md p-0.5 text-[11.5px]">
                    <button className="px-2.5 py-1 rounded bg-white shadow-sm font-semibold text-stone-900">แผนก</button>
                    <button className="px-2.5 py-1 rounded text-stone-500">สาขา</button>
                  </div>
                </div>
                <ul className="space-y-3">
                  {H.depts.map((d) => {
                    const pct = (d.count / maxDept) * 100;
                    return (
                      <li key={d.id} className="grid grid-cols-[180px_1fr_auto] items-center gap-3">
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-stone-900 truncate">{d.name_th}</div>
                          <div className="text-[10.5px] text-stone-400 uppercase tracking-wider">{d.name_en}</div>
                        </div>
                        <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: pct + '%', background: d.color }}></div>
                        </div>
                        <div className="text-right tabular-nums font-mono text-[13px] text-stone-700 w-12">{d.count}</div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/* Upcoming */}
              <section className="col-span-5 bg-white border border-stone-200 rounded-[10px] shadow-sm">
                <header className="px-5 py-3.5 border-b border-stone-100">
                  <h2 className="text-[14.5px] font-semibold text-stone-900">7 วันข้างหน้า</h2>
                  <p className="text-[11.5px] text-stone-400">วันเกิด · ครบรอบทำงาน · พนักงานใหม่</p>
                </header>
                <ul className="divide-y divide-stone-100">
                  {H.upcoming.map((u, i) => {
                    const e = H.empById[u.empId];
                    const tag = u.kind === 'bday' ? { bg: 'bg-rose-50', tx: 'text-rose-700', br: 'border-rose-200', label: '🎂' } :
                                u.kind === 'anniv' ? { bg: 'bg-amber-50', tx: 'text-amber-800', br: 'border-amber-200', label: '🏆' } :
                                { bg: 'bg-emerald-50', tx: 'text-emerald-700', br: 'border-emerald-200', label: '✨' };
                    return (
                      <li key={i} className="flex items-center gap-3 px-5 py-3">
                        <div className="w-12 shrink-0 text-center">
                          <div className="font-display text-[15px] font-semibold text-stone-900 leading-none">{u.date.split(' ')[0]}</div>
                          <div className="text-[10px] text-stone-400 uppercase tracking-wider mt-0.5">{u.date.split(' ')[1]}</div>
                        </div>
                        <Avatar emp={e} size={32} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-stone-900 truncate">{e.name_th}</div>
                          <div className="text-[11px] text-stone-400 truncate">{u.label} · {u.sub}</div>
                        </div>
                        <span className={'shrink-0 px-2 py-0.5 rounded-full text-[10.5px] font-semibold ' + tag.bg + ' ' + tag.tx + ' border ' + tag.br}>{tag.label}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.HrDashboard = HrDashboard;

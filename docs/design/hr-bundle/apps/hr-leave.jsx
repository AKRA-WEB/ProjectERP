// Leave Management — pending approval queue (left) + team calendar (right)
// Team calendar is a month grid (May 2026) showing leave bars per employee row.

const HrLeave = function () {
  const H = window.HR_MOCK;
  const I = window.ErpIcons;
  const { Sidebar, TopBar } = window.ErpShell;

  const Avatar = ({ emp, size = 28 }) => (
    <div className="rounded-full grid place-items-center font-semibold shrink-0"
         style={{ width: size, height: size, background: emp.hue, color: emp.txt, fontSize: size * 0.42 }}>
      {emp.initials}
    </div>
  );

  // Month grid for May 2026: 31 days, starts Friday (day-of-week index of 1 May 2026 = 5)
  const MONTH = 'พฤษภาคม 2569';
  const DAYS = 31;
  const startWeekday = 5; // Friday = 5 (0=Sun)
  const today = 16;
  const weekdayLabels = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const isWeekend = (day) => {
    const dow = (startWeekday + day - 1) % 7;
    return dow === 0 || dow === 6;
  };

  // Approver/team employees that appear on the calendar (8 rows)
  const teamIds = ['e001', 'e005', 'e004', 'e010', 'e011', 'e007', 'e003', 'e009', 'e012', 'e006'];
  const team = teamIds.map((id) => H.empById[id]);

  // Filter leaves per employee
  const leaveByEmp = teamIds.reduce((acc, id) => {
    acc[id] = H.calendarLeave.filter((l) => l.empId === id);
    return acc;
  }, {});

  const pendingLeave = H.leaveRequests.filter((l) => l.status === 'pending');

  // Stat strip
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

  // Cell width / row height for calendar
  const CELL = 30;
  const ROW  = 36;

  return (
    <div className="flex w-full h-full text-[14px] font-sans" style={{ color: '#1c1917', background: '#fafaf9' }}>
      <Sidebar module="hr" activeHref="/app/hr/leave" />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar crumbs={['บุคลากร', 'HR', 'การลา', 'คำขอลา']} />

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-[1280px] mx-auto space-y-5">
            {/* Page header */}
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-[26px] font-semibold tracking-tight text-stone-900 leading-tight">การลา / Leave</h1>
                <p className="text-[13.5px] text-stone-500 mt-1">{pendingLeave.length} คำขอรออนุมัติ · ปฏิทินทีม {MONTH}</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="h-9 px-3.5 rounded-md text-[13px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50">ตั้งค่าโควต้า</button>
                <button className="h-9 px-3.5 rounded-md text-[13px] font-medium text-white bg-stone-900 hover:bg-stone-800 inline-flex items-center gap-1.5">
                  <span className="text-base leading-none">+</span> ลาแทนพนักงาน
                </button>
              </div>
            </div>

            {/* KPI strip */}
            <div className="flex bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
              <Kpi label="รออนุมัติ"     value={pendingLeave.length}  unit="ใบ"  sub="ค่าเฉลี่ยอนุมัติ 4 ชม."   accent="text-amber-700" />
              <Kpi label="ลาวันนี้"       value={2}  unit="คน"  sub="ลาป่วย 2"   />
              <Kpi label="ลาทั้งเดือน"   value={47} unit="วัน-คน" sub="พักร้อน 28 · ป่วย 14 · กิจ 5" />
              <Kpi label="โควต้าใช้ไป"  value="38%" sub="เฉลี่ยทั้งบริษัท · ปี 2569" />
            </div>

            {/* Body — pending + calendar */}
            <div className="grid grid-cols-12 gap-5">
              {/* Pending list */}
              <section className="col-span-4 bg-white border border-stone-200 rounded-[10px] shadow-sm">
                <header className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-[14.5px] font-semibold text-stone-900">รออนุมัติ</h2>
                    <p className="text-[11.5px] text-stone-400">{pendingLeave.length} คำขอ</p>
                  </div>
                  <div className="inline-flex bg-stone-100 border border-stone-200 rounded-md p-0.5 text-[11px]">
                    <button className="px-2 py-0.5 rounded bg-white shadow-sm font-semibold text-stone-900">ของฉัน</button>
                    <button className="px-2 py-0.5 rounded text-stone-500">ทั้งหมด</button>
                  </div>
                </header>
                <ul className="divide-y divide-stone-100">
                  {pendingLeave.map((lv, i) => {
                    const e = H.empById[lv.empId];
                    const selected = i === 0;
                    return (
                      <li key={lv.id} className={'px-5 py-3.5 cursor-pointer ' + (selected ? 'bg-stone-50 border-l-2 border-stone-900 -ml-px pl-[18px]' : 'hover:bg-stone-50/60')}>
                        <div className="flex items-start gap-3">
                          <Avatar emp={e} size={32} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium text-stone-900 truncate">{e.name_th}</span>
                              {lv.urgent && <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider">ด่วน</span>}
                            </div>
                            <div className="text-[11px] text-stone-400 truncate">{e.position}</div>
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className={'px-1.5 py-0.5 rounded text-[10px] font-semibold ' + (lv.type === 'ลาป่วย' ? 'bg-red-50 text-red-700 border border-red-200' : lv.type === 'ลาพักร้อน' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200')}>{lv.type}</span>
                              <span className="text-[11px] font-mono text-stone-600 tabular-nums">{lv.days} วัน</span>
                              <span className="text-[10.5px] text-stone-400 ml-auto">{lv.submitted}</span>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <footer className="px-5 py-2.5 border-t border-stone-100 bg-stone-50/40 text-[11.5px] text-stone-500">
                  ดูที่อนุมัติ/ปฏิเสธแล้ว <a className="text-stone-700 font-medium hover:underline">→</a>
                </footer>
              </section>

              {/* Selected leave detail + calendar */}
              <div className="col-span-8 space-y-5">
                {/* Detail card for selected leave (lv1: e004) */}
                {(() => {
                  const lv = pendingLeave[0];
                  const e = H.empById[lv.empId];
                  const quota = { total: 10, used: 2, requesting: lv.days, remain: 10 - 2 - lv.days };
                  return (
                    <section className="bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
                      <header className="px-5 py-4 border-b border-stone-100 flex items-start gap-4">
                        <Avatar emp={e} size={44} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h2 className="text-[15px] font-semibold text-stone-900">{e.name_th}</h2>
                            <span className="text-[11.5px] font-mono text-stone-400">{e.code}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">{lv.type}</span>
                          </div>
                          <p className="text-[12px] text-stone-500 mt-0.5">{e.position} · {e.branch}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button className="h-9 px-3.5 rounded-md text-[13px] font-medium bg-white border border-stone-200 text-stone-700 hover:bg-stone-50">ปฏิเสธ</button>
                          <button className="h-9 px-3.5 rounded-md text-[13px] font-medium bg-stone-900 text-white hover:bg-stone-800 inline-flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                            อนุมัติ
                          </button>
                        </div>
                      </header>
                      <div className="grid grid-cols-4 divide-x divide-stone-100">
                        <div className="px-5 py-3.5">
                          <div className="text-[10.5px] font-semibold text-stone-400 uppercase tracking-wider">ช่วงวันลา</div>
                          <div className="font-display text-[15px] font-semibold text-stone-900 tabular-nums mt-1">19 – 21 พ.ค.</div>
                          <div className="text-[11px] text-stone-500 mt-0.5">อ. – พฤ.</div>
                        </div>
                        <div className="px-5 py-3.5">
                          <div className="text-[10.5px] font-semibold text-stone-400 uppercase tracking-wider">จำนวนวัน</div>
                          <div className="font-display text-[15px] font-semibold text-stone-900 tabular-nums mt-1">{lv.days} วัน</div>
                          <div className="text-[11px] text-stone-500 mt-0.5">เต็มวัน</div>
                        </div>
                        <div className="px-5 py-3.5">
                          <div className="text-[10.5px] font-semibold text-stone-400 uppercase tracking-wider">คงเหลือหลังลา</div>
                          <div className="font-display text-[15px] font-semibold text-emerald-700 tabular-nums mt-1">{quota.remain} วัน</div>
                          <div className="text-[11px] text-stone-500 mt-0.5">จากโควต้า {quota.total} วัน</div>
                        </div>
                        <div className="px-5 py-3.5">
                          <div className="text-[10.5px] font-semibold text-stone-400 uppercase tracking-wider">ผู้อนุมัติ</div>
                          <div className="text-[13px] font-medium text-stone-900 mt-1">{lv.approver}</div>
                          <div className="text-[11px] text-stone-500 mt-0.5">ผู้จัดการสาขา</div>
                        </div>
                      </div>
                      <div className="px-5 py-3 border-t border-stone-100 bg-stone-50/40">
                        <div className="text-[10.5px] font-semibold text-stone-400 uppercase tracking-wider mb-1">เหตุผล</div>
                        <p className="text-[13px] text-stone-700">{lv.reason}</p>
                      </div>
                    </section>
                  );
                })()}

                {/* Team calendar */}
                <section className="bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
                  <header className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between">
                    <div>
                      <h2 className="text-[14.5px] font-semibold text-stone-900">ปฏิทินทีม · {MONTH}</h2>
                      <p className="text-[11.5px] text-stone-400">ทีมหน้าร้าน + คลังสินค้า · 10 คน</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-3 text-[10.5px] text-stone-500">
                        <span className="inline-flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style={{background:'#7da78a'}}></span>พักร้อน</span>
                        <span className="inline-flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style={{background:'#c87a7a'}}></span>ป่วย</span>
                        <span className="inline-flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style={{background:'#c89a48'}}></span>กิจ</span>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button className="w-7 h-7 rounded-md border border-stone-200 bg-white text-stone-500 grid place-items-center hover:bg-stone-50">‹</button>
                        <button className="h-7 px-2.5 rounded-md border border-stone-200 bg-white text-[11.5px] font-medium text-stone-700">วันนี้</button>
                        <button className="w-7 h-7 rounded-md border border-stone-200 bg-white text-stone-500 grid place-items-center hover:bg-stone-50">›</button>
                      </div>
                    </div>
                  </header>
                  <div className="overflow-x-auto">
                    {/* Header row with day numbers */}
                    <div className="grid" style={{ gridTemplateColumns: `170px repeat(${DAYS}, ${CELL}px)` }}>
                      <div className="px-3 py-2 border-r border-b border-stone-200 bg-stone-50 text-[10.5px] font-semibold text-stone-400 uppercase tracking-wider">พนักงาน</div>
                      {Array.from({ length: DAYS }).map((_, i) => {
                        const day = i + 1;
                        const dow = (startWeekday + i) % 7;
                        const we = isWeekend(day);
                        const isToday = day === today;
                        return (
                          <div key={day} className={'border-r border-b border-stone-200 px-1 py-1 text-center ' + (we ? 'bg-stone-100/70' : 'bg-stone-50') + (isToday ? ' bg-amber-50' : '')}>
                            <div className={'text-[10px] font-medium ' + (isToday ? 'text-amber-700' : 'text-stone-400')}>{weekdayLabels[dow]}</div>
                            <div className={'text-[11.5px] font-mono tabular-nums ' + (isToday ? 'font-bold text-amber-900' : we ? 'text-stone-500' : 'text-stone-700')}>{day}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Body rows */}
                    {team.map((e) => (
                      <div key={e.id} className="grid relative" style={{ gridTemplateColumns: `170px repeat(${DAYS}, ${CELL}px)`, height: ROW + 'px' }}>
                        <div className="px-3 flex items-center gap-2 border-r border-b border-stone-100 bg-white">
                          <Avatar emp={e} size={22} />
                          <div className="min-w-0">
                            <div className="text-[12px] font-medium text-stone-900 truncate leading-tight">{e.name_th}</div>
                            <div className="text-[9.5px] text-stone-400 truncate uppercase tracking-wider">{H.deptById[e.dept].name_en}</div>
                          </div>
                        </div>
                        {Array.from({ length: DAYS }).map((_, i) => {
                          const day = i + 1;
                          const we = isWeekend(day);
                          const isToday = day === today;
                          return <div key={day} className={'border-r border-b border-stone-100 ' + (we ? 'bg-stone-50/70' : '') + (isToday ? ' bg-amber-50/40' : '')}></div>;
                        })}

                        {/* Overlaid leave bars */}
                        {leaveByEmp[e.id].map((lv, idx) => {
                          const left = 170 + (lv.from - 1) * CELL + 2;
                          const width = (lv.to - lv.from + 1) * CELL - 4;
                          return (
                            <div key={idx}
                              className="absolute top-1/2 -translate-y-1/2 rounded text-[10px] font-semibold text-white px-1.5 flex items-center shadow-sm"
                              style={{ left, width, height: 18, background: lv.color }}>
                              <span className="truncate">{lv.type}</span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.HrLeave = HrLeave;

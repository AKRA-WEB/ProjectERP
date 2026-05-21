// Employee directory — searchable table with filters, status pills, avatars.

const HrEmployees = function () {
  const H = window.HR_MOCK;
  const I = window.ErpIcons;
  const { Sidebar, TopBar } = window.ErpShell;

  const Avatar = ({ emp, size = 32 }) => (
    <div className="rounded-full grid place-items-center font-semibold shrink-0"
         style={{ width: size, height: size, background: emp.hue, color: emp.txt, fontSize: size * 0.42 }}>
      {emp.initials}
    </div>
  );

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + (d.getFullYear() + 543);
  };
  const yearsAt = (iso) => {
    const d = new Date(iso);
    const now = new Date('2026-05-16');
    const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (months < 12) return months + ' เดือน';
    return (months / 12 < 2 ? (months/12).toFixed(1) : Math.floor(months/12)) + ' ปี';
  };

  const StatusPill = ({ s }) => {
    if (s === 'probation') return <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">ทดลองงาน</span>;
    return <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">ทำงานอยู่</span>;
  };

  const EmpType = ({ t }) => (
    t === 'part'
      ? <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">Part-time</span>
      : <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">Full-time</span>
  );

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

  const total = H.employees.length;

  return (
    <div className="flex w-full h-full text-[14px] font-sans" style={{ color: '#1c1917', background: '#fafaf9' }}>
      <Sidebar module="hr" activeHref="/app/hr/employees" />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar crumbs={['บุคลากร', 'HR', 'รายชื่อพนักงาน']} />

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-[1280px] mx-auto space-y-5">
            {/* Page header */}
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-[26px] font-semibold tracking-tight text-stone-900 leading-tight">รายชื่อพนักงาน / Employees</h1>
                <p className="text-[13.5px] text-stone-500 mt-1">105 คนทำงานอยู่ · 3 ทดลองงาน · ปรับปรุง 14:31 น.</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="h-9 px-3.5 rounded-md text-[13px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50">นำเข้า Excel</button>
                <button className="h-9 px-3.5 rounded-md text-[13px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50">Export CSV</button>
                <button className="h-9 px-3.5 rounded-md text-[13px] font-medium text-white bg-stone-900 hover:bg-stone-800 inline-flex items-center gap-1.5">
                  <span className="text-base leading-none">+</span> เพิ่มพนักงาน
                </button>
              </div>
            </div>

            {/* KPI strip */}
            <div className="flex bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
              <Kpi label="พนักงานทั้งหมด" value={105} unit="คน" sub="Full-time 92 · Part-time 13" />
              <Kpi label="เข้าใหม่เดือนนี้"   value={2} unit="คน" sub="ทดลองงาน · 119 วันเหลือ" accent="text-emerald-700" />
              <Kpi label="หมุนเวียน (3 เดือน)" value="2.8%" sub="ลาออก 3 · เข้าใหม่ 5" />
              <Kpi label="อายุงานเฉลี่ย"     value="3.4" unit="ปี" sub="พนักงานเก่าสุด 8 ปี" />
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">{I.search}</span>
                <div className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-lg text-[13px] text-stone-400">ค้นหาชื่อ / รหัสพนักงาน / ตำแหน่ง…</div>
              </div>
              <select className="h-9 px-3 pr-8 bg-white border border-stone-300 rounded-lg text-[13px] text-stone-700">
                <option>ทุกแผนก</option>
              </select>
              <select className="h-9 px-3 pr-8 bg-white border border-stone-300 rounded-lg text-[13px] text-stone-700">
                <option>ทุกสาขา</option>
              </select>
              <select className="h-9 px-3 pr-8 bg-white border border-stone-300 rounded-lg text-[13px] text-stone-700">
                <option>สถานะ: ทำงานอยู่</option>
              </select>
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
                    <th className="px-4 py-3 w-8"><span className="w-3.5 h-3.5 rounded border border-stone-400 inline-block"></span></th>
                    <th className="px-4 py-3 w-28">รหัส</th>
                    <th className="px-4 py-3">ชื่อ-ตำแหน่ง</th>
                    <th className="px-4 py-3 w-32">แผนก</th>
                    <th className="px-4 py-3 w-44">สาขา</th>
                    <th className="px-4 py-3 w-28">เริ่มงาน</th>
                    <th className="px-4 py-3 w-24">อายุงาน</th>
                    <th className="px-4 py-3 w-24">ประเภท</th>
                    <th className="px-4 py-3 w-24">สถานะ</th>
                    <th className="px-4 py-3 text-right w-28">เงินเดือน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {H.employees.map((e) => {
                    const dept = H.deptById[e.dept];
                    return (
                      <tr key={e.id} className="hover:bg-stone-50/60">
                        <td className="px-4 py-3"><span className="w-3.5 h-3.5 rounded border border-stone-300 inline-block"></span></td>
                        <td className="px-4 py-3 font-mono text-[12.5px] font-medium text-stone-700">{e.code}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar emp={e} size={32} />
                            <div className="min-w-0">
                              <div className="text-[13px] font-medium text-stone-900 truncate">{e.name_th}</div>
                              <div className="text-[11px] text-stone-400 truncate">{e.position} · {e.name_en}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-stone-700">
                            <span className="w-2 h-2 rounded-full" style={{ background: dept.color }}></span>
                            {dept.name_th}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[12.5px] text-stone-600 truncate">{e.branch}</td>
                        <td className="px-4 py-3 font-mono text-[12px] text-stone-600 tabular-nums">{fmtDate(e.start)}</td>
                        <td className="px-4 py-3 text-[12.5px] text-stone-600 tabular-nums">{yearsAt(e.start)}</td>
                        <td className="px-4 py-3"><EmpType t={e.employment} /></td>
                        <td className="px-4 py-3"><StatusPill s={e.status} /></td>
                        <td className="px-4 py-3 text-right font-mono text-[13px] tabular-nums font-medium text-stone-800">{H.baht(e.salary)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Footer / pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100 bg-stone-50/40 text-[12px] text-stone-500">
                <span>แสดง <b className="text-stone-700">1 – {total}</b> จาก <b className="text-stone-700">108</b> คน</span>
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

window.HrEmployees = HrEmployees;

// HR Mobile Self-Service — employee app
// 390×844 (iPhone 14 Pro). Today's shift + clock in/out · leave quota · this week · payslip.

const HrMobile = function () {
  const H = window.HR_MOCK;
  const I = window.ErpIcons;
  const me = H.empById[H.me.empId];

  const Avatar = ({ emp, size }) => (
    <div className="rounded-full grid place-items-center font-semibold shrink-0"
         style={{ width: size, height: size, background: emp.hue, color: emp.txt, fontSize: size * 0.42 }}>
      {emp.initials}
    </div>
  );

  // Sample state: clocked in already at 08:04
  const clockedIn = true;
  const clockInTime = '08:04';
  const minutesWorked = 6 * 60 + 27;
  const hours = Math.floor(minutesWorked / 60);
  const mins  = minutesWorked % 60;

  const colorMap = {
    emerald: { ring: 'stroke-emerald-500', bg: 'bg-emerald-50', tx: 'text-emerald-700', bar: 'bg-emerald-500' },
    amber:   { ring: 'stroke-amber-500',   bg: 'bg-amber-50',   tx: 'text-amber-800',   bar: 'bg-amber-500' },
    sky:     { ring: 'stroke-sky-500',     bg: 'bg-sky-50',     tx: 'text-sky-700',     bar: 'bg-sky-500' },
  };

  return (
    <div className="w-full h-full flex flex-col text-[14px] font-sans" style={{ background: '#fafaf9', color: '#1c1917' }}>
      {/* iOS-ish status bar */}
      <div className="h-9 px-5 flex items-center justify-between text-[13px] font-semibold shrink-0 text-stone-900">
        <span>14:31</span>
        <span className="flex items-center gap-1">
          <svg viewBox="0 0 18 12" className="w-[18px] h-3"><path d="M1 9h2v2H1zM5 7h2v4H5zM9 4h2v7H9zM13 1h2v10h-2z" fill="currentColor"/></svg>
          <svg viewBox="0 0 18 14" className="w-[18px] h-3.5"><path d="M9 4a8 8 0 015 1.8l-1.3 1.6A6 6 0 009 6a6 6 0 00-3.7 1.4L4 5.8A8 8 0 019 4zm0-4a12 12 0 018 3l-1.3 1.5A10 10 0 009 2a10 10 0 00-6.7 2.5L1 3a12 12 0 018-3zm0 8a4 4 0 012.5.9l-1.3 1.6a2 2 0 00-2.4 0L6.5 8.9A4 4 0 019 8zm0 4a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" fill="currentColor"/></svg>
          <span className="ml-1 inline-flex items-center"><span className="w-5 h-2.5 border border-current rounded-sm inline-block relative"><span className="absolute inset-0.5 bg-current rounded-[1px]"></span></span><span className="w-0.5 h-1.5 bg-current rounded-r ml-px"></span></span>
        </span>
      </div>

      {/* App header */}
      <div className="px-4 pt-1 pb-3 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar emp={me} size={40} />
          <div>
            <div className="text-[11px] text-stone-400">สวัสดี</div>
            <div className="text-[15px] font-bold text-stone-900 leading-tight">{me.name_th.split(' ')[0]}</div>
          </div>
        </div>
        <button className="w-10 h-10 rounded-full border border-stone-200 grid place-items-center text-stone-600 relative bg-white">
          {I.bell}
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 border border-white"></span>
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto px-4 pb-3 space-y-3">
        {/* Clock card */}
        <section className="rounded-2xl p-4 shadow-sm" style={{ background: '#1c1917', color: '#fafaf9' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10.5px] uppercase tracking-wider text-stone-400">วันนี้ · อ. 16 พ.ค.</div>
              <div className="text-[13.5px] font-semibold mt-0.5">กะเช้า · 08:00 – 17:00</div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">เข้างานแล้ว</span>
          </div>

          {/* Big timer */}
          <div className="flex items-end justify-between">
            <div>
              <div className="font-display font-bold text-[44px] leading-none tabular-nums">{hours}:{String(mins).padStart(2,'0')}</div>
              <div className="text-[11.5px] text-stone-400 mt-1">ชั่วโมงที่ทำงาน · เข้างาน {clockInTime}</div>
            </div>
            <button className="h-12 px-5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[13px] font-bold shadow-md inline-flex items-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
              ออกงาน
            </button>
          </div>

          {/* Mini progress */}
          <div className="mt-4">
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: '72%' }}></div>
            </div>
            <div className="flex justify-between text-[10px] text-stone-400 mt-1.5 tabular-nums">
              <span>08:00</span>
              <span className="text-stone-300">14:31 · ตอนนี้</span>
              <span>17:00</span>
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: '✈', label: 'ขอลา', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
            { icon: '⏱', label: 'ขอ OT', color: 'text-amber-700 bg-amber-50 border-amber-100' },
            { icon: '฿', label: 'สลิป', color: 'text-stone-700 bg-stone-100 border-stone-200' },
            { icon: '☰', label: 'อื่นๆ', color: 'text-stone-700 bg-stone-100 border-stone-200' },
          ].map((a, i) => (
            <button key={i} className={'flex flex-col items-center gap-1.5 py-3 rounded-xl border ' + a.color}>
              <span className="w-9 h-9 rounded-lg bg-white grid place-items-center text-[18px] font-bold">{a.icon}</span>
              <span className="text-[11.5px] font-semibold">{a.label}</span>
            </button>
          ))}
        </div>

        {/* Leave quota */}
        <section className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13.5px] font-semibold text-stone-900">โควต้าวันลา · ปี 2569</h2>
            <a className="text-[11.5px] font-medium text-stone-500">ดูทั้งหมด</a>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {H.me.quotas.map((q) => {
              const c = colorMap[q.color];
              const pct = q.used / q.total;
              const circ = 2 * Math.PI * 24;
              return (
                <div key={q.type} className="flex flex-col items-center text-center">
                  <div className="relative w-16 h-16">
                    <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                      <circle cx="28" cy="28" r="24" className="stroke-stone-100" strokeWidth="6" fill="none" />
                      <circle cx="28" cy="28" r="24" className={c.ring} strokeWidth="6" fill="none" strokeLinecap="round"
                              strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} />
                    </svg>
                    <div className="absolute inset-0 grid place-items-center">
                      <div className="font-display text-[15px] font-bold text-stone-900 tabular-nums">{q.remain}</div>
                    </div>
                  </div>
                  <div className="text-[11.5px] font-semibold text-stone-900 mt-2">{q.type}</div>
                  <div className="text-[10px] text-stone-400 tabular-nums">เหลือ {q.remain}/{q.total} วัน</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* This week */}
        <section className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13.5px] font-semibold text-stone-900">สัปดาห์นี้</h2>
            <div className="text-[11px] font-mono tabular-nums text-stone-500">{H.me.thisMonth.worked} วัน · OT {H.me.thisMonth.ot} ชม.</div>
          </div>
          <div className="flex justify-between gap-1">
            {H.me.weeklySchedule.map((d, i) => {
              const isToday = d.status === 'today';
              const isOff = d.status === 'off';
              const isDone = d.status === 'done';
              return (
                <div key={i} className={'flex-1 flex flex-col items-center py-2 px-1 rounded-lg ' +
                  (isToday ? 'bg-stone-900 text-white' :
                   isOff ? 'bg-stone-50 text-stone-400' :
                   isDone ? 'bg-emerald-50 text-emerald-700' :
                   'bg-white border border-stone-100 text-stone-600')}>
                  <div className="text-[10px] font-medium opacity-80">{d.day}</div>
                  <div className="font-display text-[14px] font-bold tabular-nums my-0.5">{d.date}</div>
                  {isOff ? <div className="text-[8.5px]">หยุด</div>
                    : isToday ? <div className="w-1 h-1 rounded-full bg-emerald-400"></div>
                    : isDone ? <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    : <div className="text-[8.5px]">เช้า</div>}
                </div>
              );
            })}
          </div>
        </section>

        {/* Last payslip */}
        <section className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10.5px] uppercase tracking-wider text-stone-400">สลิปเงินเดือนล่าสุด</div>
              <div className="text-[13.5px] font-semibold text-stone-900 mt-0.5">{H.me.lastPayslip.period}</div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">โอนแล้ว</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10.5px] text-stone-400">รายได้รวม</div>
              <div className="font-display text-[18px] font-semibold text-stone-900 tabular-nums">{H.baht(H.me.lastPayslip.gross)}</div>
            </div>
            <div>
              <div className="text-[10.5px] text-stone-400">รับสุทธิ</div>
              <div className="font-display text-[18px] font-bold text-emerald-700 tabular-nums">{H.baht(H.me.lastPayslip.net)}</div>
            </div>
          </div>
          <button className="w-full mt-3 h-10 rounded-lg bg-stone-100 hover:bg-stone-200 text-[12.5px] font-semibold text-stone-700 inline-flex items-center justify-center gap-1.5">
            ดูสลิปเต็ม → ดาวน์โหลด PDF
          </button>
        </section>
      </div>

      {/* Bottom tab bar */}
      <div className="shrink-0 bg-white border-t border-stone-200 grid grid-cols-4 gap-1 px-3 pt-1.5 pb-1">
        {[
          { icon: I.dashboard, label: 'หน้าหลัก', active: true },
          { icon: I.clock,     label: 'เวลางาน' },
          { icon: I.plane,     label: 'การลา' },
          { icon: I.wallet,    label: 'สลิป' },
        ].map((t, i) => (
          <button key={i} className={'flex flex-col items-center gap-0.5 py-1.5 rounded-lg ' + (t.active ? 'text-stone-900' : 'text-stone-400')}>
            {t.icon}
            <span className="text-[10px] font-semibold">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Home indicator */}
      <div className="h-6 flex justify-center items-end pb-1.5 shrink-0">
        <div className="w-32 h-[5px] rounded-full bg-stone-900"></div>
      </div>
    </div>
  );
};

window.HrMobile = HrMobile;

// Mock HR data — Thai-context employee directory, leave, payroll.
// Reasonable scale: ~120 employees, 6 departments, 3 branches.

window.HR_MOCK = (function () {
  const baht  = (n) => '฿' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const baht2 = (n) => '฿' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const depts = [
    { id: 'd1', name_th: 'หน้าร้าน',       name_en: 'Retail Ops',  count: 48, color: '#7c8c70' },
    { id: 'd2', name_th: 'คลังสินค้า',      name_en: 'Warehouse',   count: 32, color: '#9c7c5c' },
    { id: 'd3', name_th: 'จัดซื้อ',         name_en: 'Purchasing',  count: 9,  color: '#5c7c9c' },
    { id: 'd4', name_th: 'บัญชี-การเงิน',   name_en: 'Finance',     count: 7,  color: '#9c5c8c' },
    { id: 'd5', name_th: 'บุคคล',          name_en: 'HR',          count: 4,  color: '#bc8848' },
    { id: 'd6', name_th: 'ไอที',          name_en: 'IT',          count: 5,  color: '#4a6c8c' },
  ];

  // 12 employees we'll show in directory — extend visually with pagination
  const employees = [
    { id: 'e001', code: 'EM-0042', name_th: 'ปริญญา ฉัตรชัย',         name_en: 'Parinya Chatchai',       initials: 'ปร', position: 'ผู้จัดการสาขา',         dept: 'd1', branch: 'สาขาเซ็นทรัลปิ่นเกล้า',  start: '2018-03-12', employment: 'full', status: 'active',  salary: 62000, hue: '#efece4', txt: '#44403c' },
    { id: 'e002', code: 'EM-0107', name_th: 'นวลละออง อมรเลิศ',     name_en: 'Nuanlaong Amornlert',    initials: 'นว', position: 'หัวหน้าฝ่ายบุคคล',      dept: 'd5', branch: 'สำนักงานใหญ่',        start: '2019-08-01', employment: 'full', status: 'active',  salary: 58000, hue: '#f5e3d6', txt: '#8a4a2a' },
    { id: 'e003', code: 'EM-0118', name_th: 'จิรพันธ์ พัฒนาเดช',       name_en: 'Jiraphan Pattanadej',    initials: 'จิ', position: 'นักบัญชีอาวุโส',        dept: 'd4', branch: 'สำนักงานใหญ่',        start: '2020-05-04', employment: 'full', status: 'active',  salary: 48000, hue: '#e6deea', txt: '#5c3a78' },
    { id: 'e004', code: 'EM-0152', name_th: 'อรุณี สันติสุข',          name_en: 'Arunee Santisuk',        initials: 'อร', position: 'พนักงานคลังสินค้า',     dept: 'd2', branch: 'สาขาลาดพร้าว',       start: '2021-02-15', employment: 'full', status: 'active',  salary: 22000, hue: '#e4ddcc', txt: '#6c5a30' },
    { id: 'e005', code: 'EM-0163', name_th: 'สมชาย ไตรรัตน์',        name_en: 'Somchai Trairat',        initials: 'สม', position: 'หัวหน้ากะ POS',         dept: 'd1', branch: 'สาขาเซ็นทรัลปิ่นเกล้า',  start: '2021-06-21', employment: 'full', status: 'active',  salary: 31000, hue: '#dde6dc', txt: '#3a6048' },
    { id: 'e006', code: 'EM-0179', name_th: 'ชัยรัตน์ ขยายงาม',       name_en: 'Chairat Khayaingam',     initials: 'ชั', position: 'พนักงานคลังสินค้า',     dept: 'd2', branch: 'สาขาชิดลดา',          start: '2022-01-10', employment: 'full', status: 'active',  salary: 19500, hue: '#dde5e6', txt: '#3a5a68' },
    { id: 'e007', code: 'EM-0188', name_th: 'ไพบูลย์ สิริวรรณ',        name_en: 'Phaiboon Siriwan',        initials: 'ไพ', position: 'พนักงานคลังสินค้า',     dept: 'd2', branch: 'สาขาชิดลดา',          start: '2022-04-03', employment: 'full', status: 'active',  salary: 19500, hue: '#e8dadf', txt: '#7a3a4a' },
    { id: 'e008', code: 'EM-0204', name_th: 'ภัทรพล วงศ์อนันต์',     name_en: 'Phattaraphon Wonganan',  initials: 'ภั', position: 'นักพัฒนาระบบ',        dept: 'd6', branch: 'สำนักงานใหญ่',        start: '2022-09-19', employment: 'full', status: 'active',  salary: 55000, hue: '#dde0eb', txt: '#3a4a78' },
    { id: 'e009', code: 'EM-0231', name_th: 'นภัสกร โชคชัย',          name_en: 'Naphatkorn Chokchai',    initials: 'นภ', position: 'นักจัดซื้อ',             dept: 'd3', branch: 'สำนักงานใหญ่',        start: '2023-02-06', employment: 'full', status: 'active',  salary: 35000, hue: '#dde8e6', txt: '#3a6864' },
    { id: 'e010', code: 'EM-0258', name_th: 'พรพิมล รุ่งเรือง',         name_en: 'Pornpimon Rungrueang',   initials: 'พร', position: 'พนักงานแคชเชียร์',     dept: 'd1', branch: 'สาขาลาดพร้าว',       start: '2023-07-24', employment: 'full', status: 'active',  salary: 17500, hue: '#f0e2d4', txt: '#7a4c28' },
    { id: 'e011', code: 'EM-0276', name_th: 'ธนกร เกียรติประเสริฐ',   name_en: 'Thanakorn Kiat',          initials: 'ธน', position: 'พนักงานแคชเชียร์ (PT)',  dept: 'd1', branch: 'สาขาเซ็นทรัลปิ่นเกล้า',  start: '2024-01-08', employment: 'part', status: 'active',  salary: 12000, hue: '#dee6df', txt: '#3a604a' },
    { id: 'e012', code: 'EM-0289', name_th: 'มัณฑนา ศรีวิไล',         name_en: 'Manthana Sriwilai',       initials: 'มั', position: 'นักจัดซื้อ (ทดลองงาน)',  dept: 'd3', branch: 'สำนักงานใหญ่',        start: '2026-04-15', employment: 'full', status: 'probation', salary: 28000, hue: '#ecdee8', txt: '#783a68' },
  ];

  const empById = Object.fromEntries(employees.map((e) => [e.id, e]));
  const deptById = Object.fromEntries(depts.map((d) => [d.id, d]));

  // ── Today's attendance feed
  const today = '2026-05-16';
  const attendance = [
    { empId: 'e005', clockIn: '07:42', clockOut: null,    shift: 'กะเช้า · 08:00–17:00', status: 'on_time', late: 0 },
    { empId: 'e001', clockIn: '07:55', clockOut: null,    shift: 'กะเช้า · 08:00–17:00', status: 'on_time', late: 0 },
    { empId: 'e004', clockIn: '07:58', clockOut: null,    shift: 'กะเช้า · 08:00–17:00', status: 'on_time', late: 0 },
    { empId: 'e010', clockIn: '08:04', clockOut: null,    shift: 'กะเช้า · 08:00–17:00', status: 'on_time', late: 0 },
    { empId: 'e002', clockIn: '08:15', clockOut: null,    shift: 'งานสำนักงาน · 09:00–18:00', status: 'on_time', late: 0 },
    { empId: 'e006', clockIn: '08:23', clockOut: null,    shift: 'กะเช้า · 08:00–17:00', status: 'late', late: 23 },
    { empId: 'e003', clockIn: '08:51', clockOut: null,    shift: 'งานสำนักงาน · 09:00–18:00', status: 'on_time', late: 0 },
    { empId: 'e008', clockIn: '09:12', clockOut: null,    shift: 'งานสำนักงาน · 09:00–18:00', status: 'late', late: 12 },
    { empId: 'e007', clockIn: null,    clockOut: null,    shift: 'กะเช้า · 08:00–17:00', status: 'on_leave', leave: 'ลาป่วย' },
    { empId: 'e011', clockIn: null,    clockOut: null,    shift: 'กะบ่าย · 14:00–22:00', status: 'scheduled' },
  ];

  // ── Pending leave requests (queue)
  const leaveRequests = [
    { id: 'lv1', empId: 'e004', type: 'ลาพักร้อน',  type_en: 'Vacation', days: 3, from: '2026-05-19', to: '2026-05-21', reason: 'พาครอบครัวไปต่างจังหวัด', submitted: '2 ชั่วโมงที่แล้ว',  status: 'pending',  approver: 'ปริญญา ฉัตรชัย' },
    { id: 'lv2', empId: 'e010', type: 'ลาป่วย',     type_en: 'Sick',     days: 1, from: '2026-05-16', to: '2026-05-16', reason: 'มีไข้ ไอ',              submitted: '6 ชั่วโมงที่แล้ว',  status: 'pending',  approver: 'สมชาย ไตรรัตน์',   urgent: true },
    { id: 'lv3', empId: 'e011', type: 'ลากิจ',       type_en: 'Personal', days: 2, from: '2026-05-23', to: '2026-05-24', reason: 'ธุระส่วนตัว',              submitted: 'เมื่อวานนี้',         status: 'pending',  approver: 'ปริญญา ฉัตรชัย' },
    { id: 'lv4', empId: 'e009', type: 'ลาพักร้อน',  type_en: 'Vacation', days: 5, from: '2026-06-02', to: '2026-06-06', reason: 'เดินทางต่างประเทศ',     submitted: 'เมื่อวานนี้',         status: 'pending',  approver: 'นวลละออง อมรเลิศ' },
    { id: 'lv5', empId: 'e006', type: 'ลาป่วย',     type_en: 'Sick',     days: 1, from: '2026-05-15', to: '2026-05-15', reason: 'ปวดหัวรุนแรง',           submitted: '2 วันที่แล้ว',       status: 'approved', approver: 'ปริญญา ฉัตรชัย' },
    { id: 'lv6', empId: 'e007', type: 'ลาป่วย',     type_en: 'Sick',     days: 2, from: '2026-05-16', to: '2026-05-17', reason: 'หวัด',                    submitted: '3 วันที่แล้ว',       status: 'approved', approver: 'ปริญญา ฉัตรชัย' },
  ];

  // ── Payroll period (current run)
  const payrollPeriod = {
    code: 'PR-202605',
    label_th: 'งวดเงินเดือน · พฤษภาคม 2569',
    label_en: 'Payroll Period · May 2026',
    cutoff: '2026-05-25',
    payDate: '2026-05-28',
    status: 'review',  // draft → review → approved → paid
    employees: 105,
    grossTotal: 3284500,
    sso: 75000,
    pvf: 98535,
    tax: 187220,
    netTotal: 2923745,
  };

  // Payroll rows for visible table — derived from employees
  const payrollRows = employees.map((e) => {
    const base = e.salary;
    const ot   = (e.id === 'e005' || e.id === 'e006') ? 1850 : (e.employment === 'part' ? 0 : Math.round((base * 0.04) / 100) * 100);
    const allowance = e.position.includes('ผู้จัดการ') ? 4000 : (e.position.includes('หัวหน้า') ? 2500 : 0);
    const gross = base + ot + allowance;
    const sso = Math.min(750, Math.round(gross * 0.05));
    const pvf = Math.round(base * 0.03);
    const tax = Math.max(0, Math.round((gross - 11000) * 0.05));
    const net = gross - sso - pvf - tax;
    return { empId: e.id, base, ot, allowance, gross, sso, pvf, tax, net };
  });

  // ── Calendar / team calendar — leave bars positioned on a month grid (May 2026)
  const calendarLeave = [
    { empId: 'e004', from: 19, to: 21, type: 'ลาพักร้อน', color: '#7da78a' },
    { empId: 'e007', from: 16, to: 17, type: 'ลาป่วย',     color: '#c87a7a' },
    { empId: 'e011', from: 23, to: 24, type: 'ลากิจ',       color: '#c89a48' },
    { empId: 'e009', from: 27, to: 31, type: 'ลาพักร้อน', color: '#7da78a' },
    { empId: 'e003', from: 8,  to: 8,  type: 'ลาป่วย',     color: '#c87a7a' },
    { empId: 'e006', from: 15, to: 15, type: 'ลาป่วย',     color: '#c87a7a' },
    { empId: 'e012', from: 4,  to: 5,  type: 'ลาพักร้อน', color: '#7da78a' },
    { empId: 'e008', from: 12, to: 12, type: 'ลากิจ',       color: '#c89a48' },
  ];

  // ── Upcoming events (birthdays, anniversaries)
  const upcoming = [
    { kind: 'bday',  empId: 'e003', date: '17 พ.ค.', label: 'วันเกิด',           sub: '31 ปี' },
    { kind: 'anniv', empId: 'e001', date: '18 พ.ค.', label: 'ครบรอบทำงาน',     sub: '8 ปี' },
    { kind: 'hire',  empId: 'e012', date: '19 พ.ค.', label: 'พนักงานใหม่',     sub: 'ผ่านทดลองงาน' },
    { kind: 'bday',  empId: 'e006', date: '22 พ.ค.', label: 'วันเกิด',           sub: '28 ปี' },
    { kind: 'anniv', empId: 'e002', date: '01 มิ.ย.', label: 'ครบรอบทำงาน',     sub: '7 ปี' },
  ];

  // ── My (for mobile screen) — pretend it's "พรพิมล รุ่งเรือง"
  const me = {
    empId: 'e010',
    quotas: [
      { type: 'ลาพักร้อน', total: 10, used: 2, remain: 8,  color: 'emerald' },
      { type: 'ลาป่วย',    total: 30, used: 1, remain: 29, color: 'amber' },
      { type: 'ลากิจ',      total: 5,  used: 0, remain: 5,  color: 'sky' },
    ],
    thisMonth: { worked: 13, ot: 6.5, late: 0, leave: 0 },
    weeklySchedule: [
      { day: 'จ',  date: 11, shift: 'กะเช้า', time: '08:00–17:00', status: 'done' },
      { day: 'อ',  date: 12, shift: 'กะเช้า', time: '08:00–17:00', status: 'done' },
      { day: 'พ',  date: 13, shift: 'หยุด',   time: '—',          status: 'off' },
      { day: 'พฤ', date: 14, shift: 'กะเช้า', time: '08:00–17:00', status: 'done' },
      { day: 'ศ',  date: 15, shift: 'กะเช้า', time: '08:00–17:00', status: 'done' },
      { day: 'ส',  date: 16, shift: 'กะเช้า', time: '08:00–17:00', status: 'today' },
      { day: 'อา', date: 17, shift: 'หยุด',   time: '—',          status: 'upcoming' },
    ],
    lastPayslip: { period: 'เมษายน 2569', gross: 17500, net: 16012 },
  };

  return { depts, employees, empById, deptById, attendance, leaveRequests, payrollPeriod, payrollRows, calendarLeave, upcoming, me, today, baht, baht2 };
})();

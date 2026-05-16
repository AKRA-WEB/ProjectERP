// Mock data for POS + Inventory mockups
// Pulled from real schema in /types and adapted for static display.

window.ERP_MOCK = (function () {
  const baht = (n) => '฿' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const qty = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 3 });

  // ── Products for POS grid (visual placeholders, no images) ──
  const cats = [
    { id: 'c1', name_th: 'เครื่องดื่ม' },
    { id: 'c2', name_th: 'ขนม' },
    { id: 'c3', name_th: 'ของใช้' },
    { id: 'c4', name_th: 'อาหารพร้อมทาน' },
    { id: 'c5', name_th: 'นม & ไข่' },
  ];

  const products = [
    { id: 'p1',  cat: 'c1', sku: 'BV-1001', name: 'น้ำดื่มสิงห์ 600ml',          price: 12,   stock: 240, swatch: '#bdd9e6' },
    { id: 'p2',  cat: 'c1', sku: 'BV-1002', name: 'เป๊ปซี่ กระป๋อง',              price: 18,   stock: 86,  swatch: '#1f4d8a' },
    { id: 'p3',  cat: 'c1', sku: 'BV-1003', name: 'โออิชิ ชาเขียว 500ml',       price: 25,   stock: 18,  swatch: '#7fa05a', low: true },
    { id: 'p4',  cat: 'c1', sku: 'BV-1004', name: 'กาแฟเนสกาแฟ กระป๋อง',      price: 22,   stock: 0,   swatch: '#4a2c1f', out: true },
    { id: 'p5',  cat: 'c1', sku: 'BV-1005', name: 'มินิทเมด ส้ม 350ml',         price: 30,   stock: 64,  swatch: '#e89a2f' },
    { id: 'p6',  cat: 'c2', sku: 'SN-2001', name: 'เลย์ คลาสสิค 75g',           price: 30,   stock: 124, swatch: '#e8b347' },
    { id: 'p7',  cat: 'c2', sku: 'SN-2002', name: 'ทเวสตี้ส์ ออริจินอล',           price: 20,   stock: 92,  swatch: '#d35e3a' },
    { id: 'p8',  cat: 'c2', sku: 'SN-2003', name: 'มาม่า คัพ ต้มยำ',                price: 15,   stock: 156, swatch: '#c93a3a' },
    { id: 'p9',  cat: 'c2', sku: 'SN-2004', name: 'ปอกกี้ ช็อกโกแลต',            price: 25,   stock: 12,  swatch: '#7a4a2c', low: true },
    { id: 'p10', cat: 'c2', sku: 'SN-2005', name: 'คุกกี้ออริโอ้ 137g',              price: 45,   stock: 38,  swatch: '#2a2520' },
    { id: 'p11', cat: 'c3', sku: 'HS-3001', name: 'ผงซักฟอกบรีส 800g',         price: 95,   stock: 24,  swatch: '#3a72b8' },
    { id: 'p12', cat: 'c3', sku: 'HS-3002', name: 'น้ำยาล้างจาน ซันไลต์',           price: 65,   stock: 31,  swatch: '#e8d847' },
    { id: 'p13', cat: 'c3', sku: 'HS-3003', name: 'กระดาษทิชชู่ Scott',           price: 89,   stock: 48,  swatch: '#e8e0d0' },
    { id: 'p14', cat: 'c4', sku: 'RE-4001', name: 'ข้าวกะเพรา 7-Eleven',          price: 45,   stock: 22,  swatch: '#7a4628' },
    { id: 'p15', cat: 'c4', sku: 'RE-4002', name: 'แซนวิชแฮม-ชีส',                  price: 39,   stock: 16,  swatch: '#e8c878' },
    { id: 'p16', cat: 'c5', sku: 'DA-5001', name: 'นมโฟร์โมสต์ จืด 200ml',     price: 14,   stock: 96,  swatch: '#e8e8e0' },
    { id: 'p17', cat: 'c5', sku: 'DA-5002', name: 'นมเปรี้ยวดัชชี่ 700ml',          price: 49,   stock: 28,  swatch: '#c93a64' },
    { id: 'p18', cat: 'c5', sku: 'DA-5003', name: 'ไข่ไก่เบอร์ 2 (แพ็ค 10)',        price: 55,   stock: 0,   swatch: '#d8b878', out: true },
  ];

  // ── Cart for POS terminal preview ──
  const cart = [
    { id: 'p2', sku: 'BV-1002', name: 'เป๊ปซี่ กระป๋อง',                  price: 18,   qty: 2 },
    { id: 'p6', sku: 'SN-2001', name: 'เลย์ คลาสสิค 75g',                price: 30,   qty: 1 },
    { id: 'p11', sku: 'HS-3001', name: 'ผงซักฟอกบรีส 800g',             price: 95,   qty: 1 },
    { id: 'p16', sku: 'DA-5001', name: 'นมโฟร์โมสต์ จืด 200ml',         price: 14,   qty: 3 },
  ];

  // ── Inventory stock rows ──
  const stock = [
    { sku: 'BV-1001', name_th: 'น้ำดื่มสิงห์ 600ml',           name_en: 'Singha Water 600ml',           wh: 'WH-01', onHand: 240, reserved: 12,  available: 228, reorder: 100, uom: 'ขวด' },
    { sku: 'BV-1002', name_th: 'เป๊ปซี่ กระป๋อง 325ml',         name_en: 'Pepsi Can 325ml',              wh: 'WH-01', onHand: 86,  reserved: 4,   available: 82,  reorder: 60,  uom: 'กระป๋อง' },
    { sku: 'BV-1003', name_th: 'โออิชิ ชาเขียว 500ml',        name_en: 'Oishi Green Tea 500ml',         wh: 'WH-01', onHand: 18,  reserved: 6,   available: 12,  reorder: 40,  uom: 'ขวด', low: true },
    { sku: 'BV-1004', name_th: 'กาแฟเนสกาแฟ กระป๋อง',         name_en: 'Nescafe Can',                  wh: 'WH-01', onHand: 0,   reserved: 0,   available: 0,   reorder: 30,  uom: 'กระป๋อง', low: true },
    { sku: 'SN-2001', name_th: 'เลย์ คลาสสิค 75g',             name_en: 'Lays Classic 75g',             wh: 'WH-01', onHand: 124, reserved: 8,   available: 116, reorder: 50,  uom: 'ห่อ' },
    { sku: 'SN-2003', name_th: 'มาม่า คัพ ต้มยำ',                  name_en: 'Mama Cup Tom Yum',             wh: 'WH-02', onHand: 156, reserved: 0,   available: 156, reorder: 80,  uom: 'ถ้วย' },
    { sku: 'SN-2004', name_th: 'ปอกกี้ ช็อกโกแลต',              name_en: 'Pocky Chocolate',              wh: 'WH-01', onHand: 12,  reserved: 0,   available: 12,  reorder: 30,  uom: 'กล่อง', low: true },
    { sku: 'SN-2005', name_th: 'คุกกี้ออริโอ้ 137g',                name_en: 'Oreo Cookies 137g',            wh: 'WH-02', onHand: 38,  reserved: 2,   available: 36,  reorder: 25,  uom: 'แพ็ค' },
    { sku: 'HS-3001', name_th: 'ผงซักฟอกบรีส 800g',           name_en: 'Breeze Powder 800g',           wh: 'WH-02', onHand: 24,  reserved: 0,   available: 24,  reorder: 20,  uom: 'ถุง' },
    { sku: 'HS-3002', name_th: 'น้ำยาล้างจาน ซันไลต์ 600ml',     name_en: 'Sunlight Dish Soap 600ml',     wh: 'WH-02', onHand: 31,  reserved: 4,   available: 27,  reorder: 20,  uom: 'ขวด' },
    { sku: 'HS-3003', name_th: 'กระดาษทิชชู่ Scott 12 ม้วน',     name_en: 'Scott Tissue 12 Rolls',        wh: 'WH-01', onHand: 48,  reserved: 0,   available: 48,  reorder: 25,  uom: 'แพ็ค' },
    { sku: 'RE-4001', name_th: 'ข้าวกะเพราหมูสับ',                name_en: 'Krapao Pork Rice',             wh: 'WH-03', onHand: 22,  reserved: 6,   available: 16,  reorder: 30,  uom: 'กล่อง', low: true },
    { sku: 'RE-4002', name_th: 'แซนวิชแฮม-ชีส',                    name_en: 'Ham-Cheese Sandwich',          wh: 'WH-03', onHand: 16,  reserved: 0,   available: 16,  reorder: 20,  uom: 'ชิ้น', low: true },
    { sku: 'DA-5001', name_th: 'นมโฟร์โมสต์ จืด 200ml',         name_en: 'Foremost Plain Milk 200ml',    wh: 'WH-01', onHand: 96,  reserved: 0,   available: 96,  reorder: 40,  uom: 'กล่อง' },
    { sku: 'DA-5002', name_th: 'นมเปรี้ยวดัชชี่ 700ml',            name_en: 'Dutchie Yogurt 700ml',         wh: 'WH-02', onHand: 28,  reserved: 4,   available: 24,  reorder: 20,  uom: 'ขวด' },
    { sku: 'DA-5003', name_th: 'ไข่ไก่เบอร์ 2 (แพ็ค 10)',          name_en: 'Egg Size 2 (10-Pack)',         wh: 'WH-03', onHand: 0,   reserved: 0,   available: 0,   reorder: 50,  uom: 'แพ็ค', low: true },
  ];

  // ── Date helper ──
  const fmtDate = (d) => {
    const date = new Date(d);
    const dd = String(date.getDate()).padStart(2,'0');
    const mm = String(date.getMonth()+1).padStart(2,'0');
    const yy = date.getFullYear() + 543;
    return `${dd}/${mm}/${yy}`;
  };

  // ── GRN data ──
  const grn = {
    rows: [
      { id: 'g1',  no: 'GRN-25051601', ref: 'IO-25051502', refType: 'io', wh: 'WH-01', whName: 'สาขาเซ็นทรัลปิ่นเกล้า', receivedBy: 'สมชาย ไตรรัตน์', date: '2026-05-16', lineCount: 12, status: 'qc_pending' },
      { id: 'g2',  no: 'GRN-25051502', ref: 'PO-25050988', refType: 'po', wh: 'WH-01', whName: 'สาขาเซ็นทรัลปิ่นเกล้า', receivedBy: 'ชัยรัตน์ ขยายงาม',  date: '2026-05-15', lineCount: 8,  status: 'qc_passed' },
      { id: 'g3',  no: 'GRN-25051501', ref: 'PO-25050977', refType: 'po', wh: 'WH-02', whName: 'สาขาชิดลดา',           receivedBy: 'ไพบูลย์ สิริวรรณ',   date: '2026-05-15', lineCount: 24, status: 'stocked' },
      { id: 'g4',  no: 'GRN-25051403', ref: 'IO-25051401', refType: 'io', wh: 'WH-03', whName: 'สาขาลาดพร้าว',         receivedBy: 'อรุณี สันติสุข',     date: '2026-05-14', lineCount: 6,  status: 'received' },
      { id: 'g5',  no: 'GRN-25051402', ref: 'PO-25050945', refType: 'po', wh: 'WH-01', whName: 'สาขาเซ็นทรัลปิ่นเกล้า', receivedBy: 'สมชาย ไตรรัตน์',     date: '2026-05-14', lineCount: 15, status: 'qc_failed' },
      { id: 'g6',  no: 'GRN-25051401', ref: 'PO-25050932', refType: 'po', wh: 'WH-02', whName: 'สาขาชิดลดา',           receivedBy: 'ชัยรัตน์ ขยายงาม',   date: '2026-05-14', lineCount: 4,  status: 'stocked' },
      { id: 'g7',  no: 'GRN-25051304', ref: 'IO-25051301', refType: 'io', wh: 'WH-03', whName: 'สาขาลาดพร้าว',         receivedBy: 'อรุณี สันติสุข',     date: '2026-05-13', lineCount: 9,  status: 'verified' },
      { id: 'g8',  no: 'GRN-25051303', ref: 'PO-25050901', refType: 'po', wh: 'WH-01', whName: 'สาขาเซ็นทรัลปิ่นเกล้า', receivedBy: 'ไพบูลย์ สิริวรรณ',   date: '2026-05-13', lineCount: 11, status: 'qc_passed' },
      { id: 'g9',  no: 'GRN-25051302', ref: null,          refType: null, wh: 'WH-02', whName: 'สาขาชิดลดา',           receivedBy: 'สมชาย ไตรรัตน์',     date: '2026-05-13', lineCount: 2,  status: 'draft' },
      { id: 'g10', no: 'GRN-25051301', ref: 'IO-25051201', refType: 'io', wh: 'WH-01', whName: 'สาขาเซ็นทรัลปิ่นเกล้า', receivedBy: 'ชัยรัตน์ ขยายงาม',   date: '2026-05-12', lineCount: 18, status: 'stocked' },
    ],
    queue: {
      ios: [
        { id: 'io1', no: 'IO-25051502', vendor: 'บริษัท สยามมาคระไทย จำกัด', wh: 'WH-01', remaining: 142, lineCount: 12, age: 'เมื่อ 30 น. ที่ผ่านมา', urgent: true },
        { id: 'io2', no: 'IO-25051501', vendor: 'สมบูรณ์บรรจุภัณฑ์',           wh: 'WH-01', remaining: 64,  lineCount: 5,  age: 'เมื่อ 2 ชม. ที่ผ่านมา' },
        { id: 'io3', no: 'IO-25051402', vendor: 'ไทยเบฟเวอริจ ฟู้ดส์',          wh: 'WH-01', remaining: 28,  lineCount: 3,  age: 'เมื่อวาน' },
      ],
      pos: [
        { id: 'po1', no: 'PO-25050988', vendor: 'ยูนิลีเวอร์',                   wh: 'WH-01', remaining: 96,  lineCount: 8,  expected: '16/05/2569' },
        { id: 'po2', no: 'PO-25050977', vendor: 'บี.เจ.ชี.',                       wh: 'WH-02', remaining: 240, lineCount: 24, expected: '16/05/2569' },
        { id: 'po3', no: 'PO-25050945', vendor: 'ไทยประกันชีวิต',                wh: 'WH-01', remaining: 120, lineCount: 15, expected: '17/05/2569' },
      ],
    },
    receiving: {
      io: { no: 'IO-25051502', vendor: 'บริษัท สยามมาคระไทย จำกัด', wh: 'WH-01', whName: 'สาขาเซ็นทรัลปิ่นเกล้า' },
      lines: [
        { sku: 'BV-1001', name: 'น้ำดื่มสิงห์ 600ml',          uom: 'ขวด',    ordered: 48, received: 48, lot: 'L260513', loc: 'A-12', status: 'done' },
        { sku: 'BV-1002', name: 'เป๊ปซี่ กระป๋อง',              uom: 'ลัง',    ordered: 24, received: 24, lot: 'L260514', loc: 'A-14', status: 'done' },
        { sku: 'SN-2001', name: 'เลย์ คลาสสิค 75g',          uom: 'ลัง',    ordered: 36, received: 24, lot: '',        loc: '',     status: 'partial' },
        { sku: 'SN-2003', name: 'มาม่า คัพ ต้มยำ',                uom: 'ลัง',    ordered: 60, received: 0,  lot: '',        loc: '',     status: 'pending' },
        { sku: 'DA-5001', name: 'นมโฟร์โมสต์ จืด 200ml',    uom: 'กล่อง',  ordered: 24, received: 0,  lot: '',        loc: '',     status: 'pending' },
        { sku: 'DA-5002', name: 'นมเปรี้ยวดัชชี่ 700ml',         uom: 'ขวด',    ordered: 12, received: 0,  lot: '',        loc: '',     status: 'pending' },
      ],
      activeLine: 2,
    },
  };

  return { cats, products, cart, stock, grn, baht, qty, fmtDate };
})();

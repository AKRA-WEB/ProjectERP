// data.jsx — mock data for ERP (retail). Thai content.

const SALES_30D = [
  142, 168, 155, 178, 192, 210, 245, 198, 184, 220,
  235, 260, 248, 232, 268, 285, 272, 295, 310, 288,
  302, 325, 342, 318, 305, 348, 372, 358, 380, 412,
];
const SALES_30D_PREV = [
  130, 142, 138, 156, 168, 175, 198, 178, 165, 188,
  198, 210, 215, 198, 220, 232, 225, 240, 252, 245,
  258, 268, 282, 268, 258, 285, 298, 290, 308, 322,
];

const KPIS = [
  { id: "rev", label: "ยอดขายวันนี้", value: "412,580", unit: "฿", delta: 12.4, dir: "up", spark: [40,42,38,55,52,60,58,72,68,80] },
  { id: "ord", label: "ออเดอร์", value: "1,247", unit: "รายการ", delta: 8.2, dir: "up", spark: [30,35,38,32,42,48,45,52,55,62] },
  { id: "cus", label: "ลูกค้าใหม่", value: "84", unit: "คน", delta: -3.1, dir: "down", spark: [50,55,60,58,52,48,52,45,42,40] },
  { id: "stk", label: "สินค้าใกล้หมด", value: "23", unit: "รายการ", delta: 5, dir: "up", warn: true, spark: [12,14,15,18,16,19,20,21,22,23] },
];

const ORDERS = [
  { id: "ORD-2845", customer: "บจก. สยามรีเทล", items: 12, total: 18450, status: "paid", branch: "สยาม", time: "09:42" },
  { id: "ORD-2844", customer: "คุณ ปรีดา ภัทรกุล", items: 3, total: 2890, status: "shipping", branch: "ทองหล่อ", time: "09:31" },
  { id: "ORD-2843", customer: "บจก. ทรูเนเจอร์", items: 28, total: 42180, status: "paid", branch: "เอกมัย", time: "09:18" },
  { id: "ORD-2842", customer: "คุณ มาลี วงศ์ใหญ่", items: 1, total: 1290, status: "pending", branch: "อารีย์", time: "08:55" },
  { id: "ORD-2841", customer: "คุณ ธนวัฒน์ ศรีสุข", items: 5, total: 6720, status: "paid", branch: "สยาม", time: "08:42" },
  { id: "ORD-2840", customer: "บจก. กรีนลีฟ", items: 18, total: 24600, status: "refunded", branch: "ทองหล่อ", time: "08:18" },
  { id: "ORD-2839", customer: "คุณ สุภาพร เจริญทรัพย์", items: 2, total: 3450, status: "paid", branch: "เอกมัย", time: "08:05" },
];

const TOP_PRODUCTS = [
  { sku: "TS-001", name: "เสื้อยืดผ้าฝ้าย Premium", cat: "เสื้อผ้า", sold: 248, revenue: 124000, change: 18.2 },
  { sku: "JN-014", name: "กางเกงยีนส์ Slim Fit", cat: "เสื้อผ้า", sold: 186, revenue: 167400, change: 12.5 },
  { sku: "SN-203", name: "รองเท้าผ้าใบ Daily", cat: "รองเท้า", sold: 142, revenue: 213000, change: -4.2 },
  { sku: "BG-088", name: "กระเป๋าสะพายข้าง", cat: "เครื่องประดับ", sold: 98, revenue: 78400, change: 22.8 },
  { sku: "CP-057", name: "หมวกแก๊ป Logo", cat: "เครื่องประดับ", sold: 84, revenue: 33600, change: 6.1 },
];

const BRANCHES = [
  { name: "สาขาสยาม", revenue: 142500, target: 150000, orders: 412, change: 8.2 },
  { name: "สาขาทองหล่อ", revenue: 118200, target: 120000, orders: 358, change: 14.5 },
  { name: "สาขาเอกมัย", revenue: 98400, target: 110000, orders: 296, change: -2.1 },
  { name: "สาขาอารีย์", revenue: 53480, target: 80000, orders: 181, change: -8.4 },
];

const INVENTORY_ALERTS = [
  { sku: "TS-001", name: "เสื้อยืดผ้าฝ้าย Premium", stock: 8, reorder: 50, days: 2 },
  { sku: "SN-203", name: "รองเท้าผ้าใบ Daily", stock: 3, reorder: 30, days: 1 },
  { sku: "BG-088", name: "กระเป๋าสะพายข้าง", stock: 12, reorder: 40, days: 4 },
  { sku: "CP-057", name: "หมวกแก๊ป Logo", stock: 18, reorder: 60, days: 6 },
];

const ACTIVITIES = [
  { who: "ปริญญา", whoColor: "#a78bfa", what: "อนุมัติคำสั่งซื้อ", target: "PO-1284", time: "2 นาทีที่แล้ว" },
  { who: "นภาพร", whoColor: "#fb923c", what: "เพิ่มสินค้าใหม่", target: "TS-099", time: "12 นาทีที่แล้ว" },
  { who: "ระบบ", whoColor: "#64748b", what: "แจ้งเตือนสต็อกต่ำ", target: "4 รายการ", time: "28 นาทีที่แล้ว" },
  { who: "วรรณนภา", whoColor: "#22c55e", what: "ออกใบกำกับภาษี", target: "INV-3821", time: "1 ชั่วโมงที่แล้ว" },
  { who: "ธนกร", whoColor: "#0ea5e9", what: "ปรับราคา", target: "JN-014", time: "2 ชั่วโมงที่แล้ว" },
];

const STATUS_TH = {
  paid: { th: "ชำระแล้ว", cls: "ok" },
  pending: { th: "รอชำระ", cls: "warn" },
  shipping: { th: "กำลังจัดส่ง", cls: "info" },
  refunded: { th: "คืนเงิน", cls: "muted" },
  cancelled: { th: "ยกเลิก", cls: "danger" },
};

window.MockData = { SALES_30D, SALES_30D_PREV, KPIS, ORDERS, TOP_PRODUCTS, BRANCHES, INVENTORY_ALERTS, ACTIVITIES, STATUS_TH };

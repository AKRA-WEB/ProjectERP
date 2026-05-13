// wms.jsx — Warehouse Management modules.

const WI = window.Icons;
const wfmt = (n) => Number(n).toLocaleString("th-TH");

// ---------- Shared data ----------
const WAREHOUSES = [
  { id: "WH-01", name: "คลังกลาง บางนา", city: "สมุทรปราการ" },
  { id: "WH-02", name: "คลังสาขาเหนือ", city: "เชียงใหม่" },
  { id: "WH-03", name: "คลังสาขาใต้", city: "สุราษฎร์ธานี" },
  { id: "WH-04", name: "คลังสาขาสยาม", city: "กรุงเทพฯ" },
];

const WMS_PRODUCTS = [
  { sku: "TS-001", name: "เสื้อยืดผ้าฝ้าย Premium", unit: "ตัว",
    stock: { "WH-01": 248, "WH-02": 86, "WH-03": 42, "WH-04": 28 } },
  { sku: "TS-002", name: "เสื้อยืด Oversize", unit: "ตัว",
    stock: { "WH-01": 412, "WH-02": 142, "WH-03": 88, "WH-04": 56 } },
  { sku: "JN-014", name: "กางเกงยีนส์ Slim Fit", unit: "ตัว",
    stock: { "WH-01": 186, "WH-02": 64, "WH-03": 28, "WH-04": 12 } },
  { sku: "SN-203", name: "รองเท้าผ้าใบ Daily", unit: "คู่",
    stock: { "WH-01": 28, "WH-02": 12, "WH-03": 0, "WH-04": 8 } },
  { sku: "BG-088", name: "กระเป๋าสะพายข้าง", unit: "ใบ",
    stock: { "WH-01": 64, "WH-02": 22, "WH-03": 18, "WH-04": 12 } },
  { sku: "CP-057", name: "หมวกแก๊ป Logo", unit: "ชิ้น",
    stock: { "WH-01": 142, "WH-02": 48, "WH-03": 36, "WH-04": 18 } },
  { sku: "WT-031", name: "นาฬิกาข้อมือ Classic", unit: "เรือน",
    stock: { "WH-01": 86, "WH-02": 28, "WH-03": 16, "WH-04": 12 } },
];

const PO_QUEUE = [
  { id: "PO-2426", po: "PO-2426", vendor: "บจก. ผ้าฝ้ายไทย", eta: "11 พ.ค. 09:30", dock: "Dock A", status: "arriving", lines: 4, units: 480 },
  { id: "PO-2425", po: "PO-2425", vendor: "บจก. ลิตเติ้ลโจ ฟุตแวร์", eta: "11 พ.ค. 10:15", dock: "Dock B", status: "arriving", lines: 2, units: 120 },
  { id: "PO-2424", po: "PO-2424", vendor: "หจก. เด่นชัยการ์เม้นท์", eta: "11 พ.ค. 13:00", dock: "Dock A", status: "scheduled", lines: 6, units: 760 },
  { id: "PO-2423", po: "PO-2423", vendor: "บจก. สยามเลทเธอร์", eta: "11 พ.ค. 15:45", dock: "Dock C", status: "scheduled", lines: 3, units: 240 },
  { id: "PO-2422", po: "PO-2422", vendor: "บจก. เอเซียไทม์พีซ", eta: "12 พ.ค. 09:00", dock: "Dock A", status: "tomorrow", lines: 1, units: 60 },
];

const LEDGER_INIT = [
  { ts: "11 พ.ค. 09:42", type: "in", ref: "GRN-0142", sku: "TS-001", name: "เสื้อยืดผ้าฝ้าย Premium", wh: "WH-01", qty: +120, balance: 248, by: "สมชาย" },
  { ts: "11 พ.ค. 09:18", type: "out", ref: "SO-2843", sku: "TS-001", name: "เสื้อยืดผ้าฝ้าย Premium", wh: "WH-01", qty: -28, balance: 128, by: "ระบบ POS" },
  { ts: "11 พ.ค. 08:55", type: "transfer", ref: "TR-0086", sku: "JN-014", name: "กางเกงยีนส์ Slim Fit", wh: "WH-01 → WH-04", qty: -24, balance: 186, by: "นภาพร" },
  { ts: "11 พ.ค. 08:30", type: "adjust", ref: "ADJ-0021", sku: "SN-203", name: "รองเท้าผ้าใบ Daily", wh: "WH-01", qty: -3, balance: 28, by: "วราภรณ์" },
  { ts: "10 พ.ค. 17:12", type: "in", ref: "GRN-0140", sku: "JN-014", name: "กางเกงยีนส์ Slim Fit", wh: "WH-01", qty: +58, balance: 210, by: "ธีรพงษ์" },
  { ts: "10 พ.ค. 15:48", type: "out", ref: "SO-2825", sku: "BG-088", name: "กระเป๋าสะพายข้าง", wh: "WH-04", qty: -12, balance: 12, by: "ระบบ POS" },
];

const TRANSFERS_INIT = [
  { id: "TR-0086", from: "WH-01", to: "WH-04", date: "11 พ.ค. 2569", items: 1, units: 24, status: "transit", by: "นภาพร" },
  { id: "TR-0085", from: "WH-01", to: "WH-02", date: "10 พ.ค. 2569", items: 3, units: 86, status: "received", by: "สมชาย" },
  { id: "TR-0084", from: "WH-02", to: "WH-03", date: "09 พ.ค. 2569", items: 2, units: 48, status: "received", by: "ธนกร" },
];

const CYCLE_COUNTS = [
  { id: "CC-2569-018", date: "11 พ.ค. 2569", wh: "WH-01", zone: "Zone A · เสื้อผ้า", expected: 248, counted: 246, variance: -2, status: "pending" },
  { id: "CC-2569-017", date: "10 พ.ค. 2569", wh: "WH-01", zone: "Zone B · รองเท้า", expected: 96, counted: 96, variance: 0, status: "approved" },
  { id: "CC-2569-016", date: "09 พ.ค. 2569", wh: "WH-04", zone: "Zone A · เสื้อผ้า", expected: 142, counted: 145, variance: +3, status: "approved" },
];

// ============================================================
// WMS App Shell
// ============================================================
function WMSApp() {
  const [view, setView] = React.useState("queue");
  const menu = [
    { id: "queue", label: "คิวงานรับสินค้า", icon: "Calendar", group: "งานประจำวัน" },
    { id: "grn", label: "Goods Receipt (GRN)", icon: "ClipboardCheck", group: "งานประจำวัน" },
    { id: "qc", label: "QC Control", icon: "Shield", group: "งานประจำวัน" },
    { id: "balances", label: "Stock Balances", icon: "Box", group: "สต็อก" },
    { id: "ledger", label: "Stock Ledger", icon: "Receipt", group: "สต็อก" },
    { id: "transfer", label: "Internal Transfers", icon: "Truck", group: "สต็อก" },
    { id: "cycle", label: "Cycle Counts", icon: "Refresh", group: "ตรวจสอบ" },
  ];
  const groups = [...new Set(menu.map(m => m.group))];
  const cur = menu.find(m => m.id === view);

  const renderView = () => {
    switch (view) {
      case "queue": return <ReceivingQueueView />;
      case "grn": return <GRNView />;
      case "qc": return <QCView />;
      case "balances": return <StockBalancesView />;
      case "ledger": return <StockLedgerView />;
      case "transfer": return <TransfersView />;
      case "cycle": return <CycleCountView />;
      default: return null;
    }
  };

  return (
    <div className="wms-app">
      <aside className="wms-sb">
        <div className="wms-brand">
          <div className="wms-logo">อ</div>
          <div>
            <div className="wms-brand-name">อรุณ WMS</div>
            <div className="wms-brand-sub">Warehouse</div>
          </div>
        </div>
        <a className="wms-back" href="main-menu.html">← เมนูหลัก</a>

        {groups.map(g => (
          <React.Fragment key={g}>
            <div className="wms-section">{g}</div>
            <nav className="wms-nav">
              {menu.filter(m => m.group === g).map(it => {
                const Ic = WI[it.icon];
                return (
                  <a key={it.id} className={"wms-item" + (view === it.id ? " is-active" : "")}
                     onClick={() => setView(it.id)}>
                    <Ic w={17} h={17} />
                    <span>{it.label}</span>
                  </a>
                );
              })}
            </nav>
          </React.Fragment>
        ))}

        <div className="wms-foot">
          <div className="wms-user">
            <div className="wms-av">นภ</div>
            <div>
              <div className="wms-user-name">นภาพร เจริญผล</div>
              <div className="wms-user-role">หัวหน้าคลัง · WH-01</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="wms-main">
        <header className="wms-tb">
          <div>
            <div className="wms-tb-crumb">WMS / {cur.group}</div>
            <h1 className="wms-tb-title">{cur.label}</h1>
          </div>
          <div className="hstack">
            <select className="wms-wh-select">
              {WAREHOUSES.map(w => <option key={w.id}>{w.id} · {w.name}</option>)}
            </select>
            <button className="btn"><WI.Bell w={15} h={15} /></button>
          </div>
        </header>
        <div className="wms-page">{renderView()}</div>
      </main>
    </div>
  );
}

// ============================================================
// 1) Receiving Queue
// ============================================================
function ReceivingQueueView() {
  const statusPill = (s) =>
    s === "arriving" ? { cls: "warn", th: "กำลังมาถึง" } :
    s === "scheduled" ? { cls: "info", th: "นัดหมายแล้ว" } :
    { cls: "muted", th: "พรุ่งนี้" };
  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: 18 }}>
        <div className="kpi"><div className="kpi-label">รถเข้ารับวันนี้</div><div className="kpi-value tnum">{PO_QUEUE.filter(p=>p.status!=="tomorrow").length}<span className="unit">เที่ยว</span></div><div className="muted xs">{PO_QUEUE.filter(p=>p.status==="arriving").length} กำลังมา</div></div>
        <div className="kpi"><div className="kpi-label">รายการรวม</div><div className="kpi-value tnum">{PO_QUEUE.reduce((s,p)=>s+p.lines,0)}<span className="unit">SKU</span></div><div className="muted xs">{PO_QUEUE.reduce((s,p)=>s+p.units,0).toLocaleString()} หน่วย</div></div>
        <div className="kpi"><div className="kpi-label">Dock ว่าง</div><div className="kpi-value tnum">1<span className="unit">/3</span></div><div className="muted xs">A, B ใช้งาน · C ว่าง</div></div>
        <div className="kpi"><div className="kpi-label">รอ QC</div><div className="kpi-value tnum" style={{color:"#b45309"}}>2</div><div className="muted xs">งานค้างจากเมื่อวาน</div></div>
      </div>

      <div className="card">
        <div className="card-h">
          <div><div className="card-title">คิวรับสินค้า · วันนี้และล่วงหน้า</div><div className="card-sub">เรียงตามเวลาที่นัดหมาย</div></div>
          <button className="btn sm primary"><WI.Plus w={13} h={13}/> เพิ่มนัดหมาย</button>
        </div>
        <div className="card-body flush">
          <table className="tbl">
            <thead><tr><th>PO</th><th>Vendor</th><th>ETA</th><th>Dock</th><th className="num">รายการ</th><th className="num">หน่วย</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              {PO_QUEUE.map(p => {
                const st = statusPill(p.status);
                return (
                  <tr key={p.id}>
                    <td className="mono" style={{fontSize:12.5}}>{p.po}</td>
                    <td>{p.vendor}</td>
                    <td className="mono">{p.eta}</td>
                    <td><span className="pill info">{p.dock}</span></td>
                    <td className="num mono">{p.lines}</td>
                    <td className="num mono">{p.units}</td>
                    <td><span className={"pill "+st.cls}>{st.th}</span></td>
                    <td style={{width:80}}><button className="btn sm">เริ่มรับ</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ============================================================
// 2) GRN — Goods Receipt
// ============================================================
function GRNView() {
  const [tab, setTab] = React.useState("pending");
  const grns = [
    { id: "GRN-0142", po: "PO-2426", vendor: "บจก. ผ้าฝ้ายไทย", date: "11 พ.ค. 2569", lines: 4, units: 480, status: "pending" },
    { id: "GRN-0141", po: "PO-2425", vendor: "บจก. ลิตเติ้ลโจ ฟุตแวร์", date: "11 พ.ค. 2569", lines: 2, units: 120, status: "qc" },
    { id: "GRN-0140", po: "PO-2424", vendor: "หจก. เด่นชัยการ์เม้นท์", date: "10 พ.ค. 2569", lines: 6, units: 758, status: "completed" },
    { id: "GRN-0139", po: "IO-1184", vendor: "หจก. กรีนเฮ้าส์", date: "10 พ.ค. 2569", lines: 5, units: 200, status: "completed" },
    { id: "GRN-0138", po: "PO-2421", vendor: "บจก. เอเซียไทม์พีซ", date: "09 พ.ค. 2569", lines: 1, units: 24, status: "completed" },
  ];
  const tabs = [
    { id: "pending", label: "กำลังรับ", n: grns.filter(g=>g.status==="pending").length },
    { id: "qc", label: "รอ QC", n: grns.filter(g=>g.status==="qc").length },
    { id: "completed", label: "เข้าสต็อกแล้ว", n: grns.filter(g=>g.status==="completed").length },
  ];
  const filtered = grns.filter(g => g.status === tab);
  const st = (s) => s==="pending"?{cls:"warn",th:"กำลังรับ"}:s==="qc"?{cls:"info",th:"รอ QC"}:{cls:"ok",th:"เข้าสต็อก"};
  return (
    <>
      <div className="hstack" style={{marginBottom:14}}>
        <div className="tabs" style={{flex:1, borderBottom:0, marginBottom:0}}>
          {tabs.map(t => <button key={t.id} className={"tab"+(tab===t.id?" is-active":"")} onClick={()=>setTab(t.id)}>{t.label} <span className="tab-count">{t.n}</span></button>)}
        </div>
        <button className="btn primary"><WI.Plus w={13} h={13}/> สร้าง GRN จาก PO/IO</button>
      </div>
      <div className="card">
        <div className="card-body flush">
          <table className="tbl">
            <thead><tr><th>GRN</th><th>อ้างอิง</th><th>Vendor</th><th>วันที่</th><th className="num">รายการ</th><th className="num">หน่วย</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              {filtered.map(g => {
                const s = st(g.status);
                return (
                  <tr key={g.id}>
                    <td className="mono" style={{fontSize:12.5}}>{g.id}</td>
                    <td className="mono muted">{g.po}</td>
                    <td>{g.vendor}</td>
                    <td className="muted">{g.date}</td>
                    <td className="num mono">{g.lines}</td>
                    <td className="num mono">{g.units}</td>
                    <td><span className={"pill "+s.cls}>{s.th}</span></td>
                    <td style={{width:28}}><WI.ChevronRight w={14} h={14}/></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ============================================================
// 3) QC Control
// ============================================================
function QCView() {
  const items = [
    { sku: "TS-001", name: "เสื้อยืดผ้าฝ้าย Premium", grn: "GRN-0141", qty: 80, passed: 76, failed: 4, status: "partial" },
    { sku: "TS-002", name: "เสื้อยืด Oversize", grn: "GRN-0141", qty: 40, passed: 40, failed: 0, status: "pass" },
    { sku: "SN-203", name: "รองเท้าผ้าใบ Daily", grn: "GRN-0142", qty: 120, passed: 0, failed: 0, status: "pending" },
    { sku: "BG-088", name: "กระเป๋าสะพายข้าง", grn: "GRN-0140", qty: 24, passed: 0, failed: 24, status: "fail" },
  ];
  const pill = (s) => s==="pass"?{cls:"ok",th:"ผ่าน"}:s==="fail"?{cls:"danger",th:"ไม่ผ่าน"}:s==="partial"?{cls:"warn",th:"ผ่านบางส่วน"}:{cls:"muted",th:"รอตรวจ"};
  return (
    <>
      <div className="kpi-grid" style={{marginBottom:18}}>
        <div className="kpi"><div className="kpi-label">รอตรวจ QC</div><div className="kpi-value tnum">{items.filter(i=>i.status==="pending").length}</div><div className="muted xs">รายการ</div></div>
        <div className="kpi"><div className="kpi-label">ผ่านวันนี้</div><div className="kpi-value tnum" style={{color:"#059669"}}>{items.reduce((s,i)=>s+i.passed,0)}</div><div className="muted xs">หน่วย</div></div>
        <div className="kpi"><div className="kpi-label">ไม่ผ่าน</div><div className="kpi-value tnum" style={{color:"#dc2626"}}>{items.reduce((s,i)=>s+i.failed,0)}</div><div className="muted xs">หน่วย · ส่งคืน vendor</div></div>
        <div className="kpi"><div className="kpi-label">อัตราผ่าน</div><div className="kpi-value tnum">96<span className="unit">%</span></div><div className="muted xs">เดือนนี้</div></div>
      </div>
      <div className="card">
        <div className="card-h"><div className="card-title">รายการที่ต้องตรวจสอบ</div><button className="btn sm"><WI.Filter w={13} h={13}/> ตัวกรอง</button></div>
        <div className="card-body flush">
          <table className="tbl">
            <thead><tr><th>สินค้า</th><th>GRN</th><th className="num">จำนวน</th><th className="num">ผ่าน</th><th className="num">ไม่ผ่าน</th><th>สถานะ</th><th>ตรวจ</th></tr></thead>
            <tbody>
              {items.map(i => {
                const p = pill(i.status);
                return (
                  <tr key={i.sku+i.grn}>
                    <td><div style={{fontWeight:500}}>{i.name}</div><div className="muted xs mono">{i.sku}</div></td>
                    <td className="mono muted">{i.grn}</td>
                    <td className="num mono">{i.qty}</td>
                    <td className="num mono" style={{color:"#059669"}}>{i.passed||"—"}</td>
                    <td className="num mono" style={{color:i.failed?"#dc2626":"var(--ink-3)"}}>{i.failed||"—"}</td>
                    <td><span className={"pill "+p.cls}>{p.th}</span></td>
                    <td>
                      <div className="hstack" style={{gap:4}}>
                        <button className="btn sm" style={{color:"#059669"}}>✓ ผ่าน</button>
                        <button className="btn sm" style={{color:"#dc2626"}}>✗ ไม่ผ่าน</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ============================================================
// 4) Stock Balances
// ============================================================
function StockBalancesView() {
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState("all"); // all | low | out | top
  const [sortBy, setSortBy] = React.useState("name"); // name | total

  // Compute totals
  const products = WMS_PRODUCTS.map(p => ({
    ...p,
    total: Object.values(p.stock).reduce((a,b)=>a+b,0),
    isOut: Object.values(p.stock).some(v => v === 0),
    isLow: Object.values(p.stock).some(v => v > 0 && v < 20),
  }));
  const grandTotal = products.reduce((s,p)=>s+p.total,0);
  const whTotals = WAREHOUSES.map(w => ({
    ...w,
    total: products.reduce((s,p)=>s+p.stock[w.id],0),
    skus: products.filter(p => p.stock[w.id] > 0).length,
    out: products.filter(p => p.stock[w.id] === 0).length,
    low: products.filter(p => p.stock[w.id] > 0 && p.stock[w.id] < 20).length,
  }));
  const lowSkus = products.filter(p => p.isLow).length;
  const outSkus = products.filter(p => p.isOut).length;

  let filtered = products.filter(p =>
    !q.trim() ||
    p.sku.toLowerCase().includes(q.toLowerCase()) ||
    p.name.toLowerCase().includes(q.toLowerCase())
  );
  if (filter === "low") filtered = filtered.filter(p => p.isLow);
  if (filter === "out") filtered = filtered.filter(p => p.isOut);
  if (filter === "top") filtered = [...filtered].sort((a,b)=>b.total-a.total).slice(0,5);
  if (sortBy === "total" && filter !== "top") filtered = [...filtered].sort((a,b)=>b.total-a.total);

  // Heatmap color helper
  const cellColor = (v, max) => {
    if (v === 0) return { bg: "#fef2f2", color: "#991b1b" };
    if (v < 20) return { bg: "#fffbeb", color: "#92400e" };
    const intensity = Math.min(1, v / max);
    const a = 0.10 + intensity * 0.55;
    return { bg: `rgba(99, 102, 241, ${a.toFixed(2)})`, color: intensity > 0.6 ? "white" : "#312e81" };
  };
  const maxCell = Math.max(...products.flatMap(p => Object.values(p.stock)));

  return (
    <>
      {/* KPI row */}
      <div className="kpi-grid" style={{marginBottom:18}}>
        <div className="kpi">
          <div className="kpi-label">SKU ทั้งหมด</div>
          <div className="kpi-value tnum">{products.length}</div>
          <div className="muted xs">ใน {WAREHOUSES.length} คลัง</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">หน่วยสินค้ารวม</div>
          <div className="kpi-value tnum">{wfmt(grandTotal)}</div>
          <div className="muted xs">มูลค่าประมาณ ฿{wfmt(grandTotal * 450)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label" style={{color:"#b45309"}}>ใกล้หมด (&lt;20)</div>
          <div className="kpi-value tnum" style={{color:"#b45309"}}>{lowSkus}</div>
          <div className="muted xs">รายการต้อง reorder</div>
        </div>
        <div className="kpi">
          <div className="kpi-label" style={{color:"#dc2626"}}>หมดสต็อก</div>
          <div className="kpi-value tnum" style={{color:"#dc2626"}}>{outSkus}</div>
          <div className="muted xs">รายการในบางคลัง</div>
        </div>
      </div>

      {/* Warehouse cards */}
      <div className="wms-wh-cards">
        {whTotals.map(w => {
          const pct = (w.total / grandTotal) * 100;
          return (
            <div key={w.id} className="wms-wh-card">
              <div className="wms-wh-card-h">
                <div>
                  <div className="wms-wh-id mono">{w.id}</div>
                  <div className="wms-wh-name">{w.name}</div>
                  <div className="muted xs">{w.city}</div>
                </div>
                <div className="wms-wh-icon"><WI.Box w={18} h={18}/></div>
              </div>
              <div className="wms-wh-total mono">{wfmt(w.total)}<span className="unit"> หน่วย</span></div>
              <div className="wms-wh-bar"><div className="wms-wh-bar-fill" style={{width: pct + "%"}}></div></div>
              <div className="wms-wh-meta">
                <span><b>{w.skus}</b> SKU</span>
                {w.low > 0 && <span style={{color:"#b45309"}}>● {w.low} ใกล้หมด</span>}
                {w.out > 0 && <span style={{color:"#dc2626"}}>● {w.out} หมด</span>}
                <span className="spacer"></span>
                <span className="muted">{pct.toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Matrix */}
      <div className="card">
        <div className="card-h">
          <div>
            <div className="card-title">ยอดคงเหลือ Real-time · ทุกคลัง</div>
            <div className="card-sub">อัปเดตล่าสุด เมื่อ 12 วินาทีที่แล้ว · <span style={{color:"#059669"}}>● LIVE</span></div>
          </div>
          <div className="hstack" style={{gap:8}}>
            <div className="seg">
              <button className={"seg-btn" + (filter==="all"?" is-active":"")} onClick={()=>setFilter("all")}>ทั้งหมด</button>
              <button className={"seg-btn" + (filter==="low"?" is-active":"")} onClick={()=>setFilter("low")}>ใกล้หมด</button>
              <button className={"seg-btn" + (filter==="out"?" is-active":"")} onClick={()=>setFilter("out")}>หมด</button>
              <button className={"seg-btn" + (filter==="top"?" is-active":"")} onClick={()=>setFilter("top")}>Top 5</button>
            </div>
            <div className="tb-search" style={{width:220, margin:0}}><WI.Search w={14} h={14}/><input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="ค้นหา SKU / ชื่อ..."/></div>
            <button className="btn sm"><WI.Download w={13} h={13}/> Export</button>
          </div>
        </div>
        <div className="card-body flush">
          <table className="tbl wms-balance-tbl">
            <thead>
              <tr>
                <th style={{width:90}}>SKU</th>
                <th>สินค้า</th>
                <th className="num" style={{width:60}}>หน่วย</th>
                {WAREHOUSES.map(w => <th key={w.id} className="num heat-h">{w.id}</th>)}
                <th className="num" style={{width:80, cursor:"pointer"}} onClick={()=>setSortBy(sortBy==="total"?"name":"total")}>
                  รวม {sortBy==="total" && "↓"}
                </th>
                <th style={{width:80}}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const status = p.isOut ? {cls:"danger", th:"หมดบางคลัง"} : p.isLow ? {cls:"warn", th:"ใกล้หมด"} : {cls:"ok", th:"พอ"};
                return (
                  <tr key={p.sku}>
                    <td className="mono" style={{fontSize:12.5}}>{p.sku}</td>
                    <td><div style={{fontWeight:500}}>{p.name}</div></td>
                    <td className="num muted small">{p.unit}</td>
                    {WAREHOUSES.map(w => {
                      const v = p.stock[w.id];
                      const c = cellColor(v, maxCell);
                      return (
                        <td key={w.id} className="num mono heat-cell" style={{background:c.bg, color:c.color, fontWeight: v===0?700:500}}>
                          {v}
                        </td>
                      );
                    })}
                    <td className="num mono" style={{fontWeight:700, fontSize:14}}>{p.total}</td>
                    <td><span className={"pill "+status.cls}>{status.th}</span></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={WAREHOUSES.length+5} style={{textAlign:"center", padding:32, color:"var(--ink-3)"}}>ไม่พบสินค้าที่ตรงเงื่อนไข</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="wms-balance-foot">
                <td colSpan={3} style={{fontWeight:600}}>รวมทั้งคลัง</td>
                {whTotals.map(w => <td key={w.id} className="num mono" style={{fontWeight:700}}>{wfmt(w.total)}</td>)}
                <td className="num mono" style={{fontWeight:700, fontSize:14}}>{wfmt(grandTotal)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="wms-heat-legend">
          <span className="muted xs">ระดับสต็อก:</span>
          <span className="heat-chip" style={{background:"#fef2f2", color:"#991b1b"}}>หมด</span>
          <span className="heat-chip" style={{background:"#fffbeb", color:"#92400e"}}>&lt;20 ใกล้หมด</span>
          <span className="heat-chip" style={{background:"rgba(99,102,241,0.15)", color:"#312e81"}}>ปกติ (น้อย)</span>
          <span className="heat-chip" style={{background:"rgba(99,102,241,0.45)", color:"#312e81"}}>ปานกลาง</span>
          <span className="heat-chip" style={{background:"rgba(99,102,241,0.65)", color:"white"}}>สูง</span>
        </div>
      </div>
    </>
  );
}

// ============================================================
// 5) Stock Ledger
// ============================================================
function StockLedgerView() {
  const typeBadge = (t) => ({
    in: { cls: "ok", th: "รับเข้า", ic: "ArrowDown" },
    out: { cls: "danger", th: "ตัดออก", ic: "ArrowUp" },
    transfer: { cls: "info", th: "โอนย้าย", ic: "ArrowRight" },
    adjust: { cls: "warn", th: "ปรับยอด", ic: "Refresh" },
  })[t];
  return (
    <div className="card">
      <div className="card-h">
        <div><div className="card-title">Stock Ledger · ทุกความเคลื่อนไหว</div><div className="card-sub">เรียงตามเวลาล่าสุด</div></div>
        <div className="hstack">
          <div className="seg">
            <button className="seg-btn is-active">ทั้งหมด</button>
            <button className="seg-btn">รับเข้า</button>
            <button className="seg-btn">ตัดออก</button>
            <button className="seg-btn">โอนย้าย</button>
          </div>
          <button className="btn sm"><WI.Download w={13} h={13}/> Export</button>
        </div>
      </div>
      <div className="card-body flush">
        <table className="tbl">
          <thead><tr><th>เวลา</th><th>ประเภท</th><th>เอกสาร</th><th>สินค้า</th><th>คลัง</th><th className="num">จำนวน</th><th className="num">คงเหลือ</th><th>ผู้ทำรายการ</th></tr></thead>
          <tbody>
            {LEDGER_INIT.map((l,i) => {
              const b = typeBadge(l.type);
              const Ic = WI[b.ic];
              return (
                <tr key={i}>
                  <td className="mono muted" style={{fontSize:12}}>{l.ts}</td>
                  <td><span className={"pill "+b.cls}><Ic w={10} h={10} sw={2.4}/> {b.th}</span></td>
                  <td className="mono">{l.ref}</td>
                  <td><div style={{fontWeight:500}}>{l.name}</div><div className="muted xs mono">{l.sku}</div></td>
                  <td className="mono small">{l.wh}</td>
                  <td className="num mono" style={{color: l.qty>0?"#059669":"#dc2626", fontWeight:600}}>{l.qty>0?"+":""}{l.qty}</td>
                  <td className="num mono">{l.balance}</td>
                  <td className="muted small">{l.by}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// 6) Internal Transfers
// ============================================================
function TransfersView() {
  const pill = (s) => s==="transit"?{cls:"warn",th:"กำลังขนส่ง"}:s==="received"?{cls:"ok",th:"รับครบ"}:{cls:"muted",th:"ร่าง"};
  return (
    <>
      <div className="hstack" style={{marginBottom:14}}>
        <div>
          <h3 style={{margin:0}}>การโอนย้ายระหว่างคลัง</h3>
          <div className="muted small">ตรวจสอบสิทธิ์อัตโนมัติทั้งคลังต้นทางและปลายทาง</div>
        </div>
        <span className="spacer"></span>
        <button className="btn primary"><WI.Plus w={13} h={13}/> สร้างใบโอน</button>
      </div>

      <div className="card">
        <div className="card-body flush">
          <table className="tbl">
            <thead><tr><th>เลขที่</th><th>จากคลัง</th><th>ปลายทาง</th><th>วันที่</th><th className="num">รายการ</th><th className="num">หน่วย</th><th>ผู้ทำรายการ</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              {TRANSFERS_INIT.map(t => {
                const p = pill(t.status);
                return (
                  <tr key={t.id}>
                    <td className="mono" style={{fontSize:12.5}}>{t.id}</td>
                    <td><span className="pill info">{t.from}</span></td>
                    <td>
                      <span className="hstack" style={{gap:6}}>
                        <WI.ArrowRight w={12} h={12}/>
                        <span className="pill info">{t.to}</span>
                      </span>
                    </td>
                    <td className="muted small">{t.date}</td>
                    <td className="num mono">{t.items}</td>
                    <td className="num mono">{t.units}</td>
                    <td>{t.by}</td>
                    <td><span className={"pill "+p.cls}>{p.th}</span></td>
                    <td style={{width:80}}>{t.status==="transit" && <button className="btn sm">รับเข้า</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ============================================================
// 7) Cycle Counts
// ============================================================
function CycleCountView() {
  const pill = (s) => s==="pending"?{cls:"warn",th:"รออนุมัติ"}:s==="approved"?{cls:"ok",th:"ปรับยอดแล้ว"}:{cls:"muted",th:"ร่าง"};
  return (
    <>
      <div className="kpi-grid" style={{marginBottom:18}}>
        <div className="kpi"><div className="kpi-label">งวดนี้</div><div className="kpi-value tnum">3<span className="unit">ใบ</span></div><div className="muted xs">สัปดาห์ที่ 19</div></div>
        <div className="kpi"><div className="kpi-label">ความแม่นยำ</div><div className="kpi-value tnum">99.2<span className="unit">%</span></div><div className="muted xs">เป้า 98%</div></div>
        <div className="kpi"><div className="kpi-label">ผลต่างสุทธิ</div><div className="kpi-value tnum" style={{color:"#059669"}}>+1</div><div className="muted xs">หน่วย</div></div>
        <div className="kpi"><div className="kpi-label">รออนุมัติ</div><div className="kpi-value tnum" style={{color:"#b45309"}}>1</div><div className="muted xs">ใบปรับยอด</div></div>
      </div>

      <div className="card">
        <div className="card-h">
          <div className="card-title">รอบการตรวจนับ</div>
          <button className="btn primary"><WI.Plus w={13} h={13}/> เริ่มรอบนับใหม่</button>
        </div>
        <div className="card-body flush">
          <table className="tbl">
            <thead><tr><th>เลขที่</th><th>วันที่</th><th>คลัง</th><th>โซน</th><th className="num">ระบบบันทึก</th><th className="num">นับได้</th><th className="num">ผลต่าง</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              {CYCLE_COUNTS.map(c => {
                const p = pill(c.status);
                return (
                  <tr key={c.id}>
                    <td className="mono" style={{fontSize:12.5}}>{c.id}</td>
                    <td className="muted small">{c.date}</td>
                    <td><span className="pill info">{c.wh}</span></td>
                    <td>{c.zone}</td>
                    <td className="num mono">{c.expected}</td>
                    <td className="num mono">{c.counted}</td>
                    <td className="num mono" style={{color: c.variance===0?"var(--ink-3)":c.variance>0?"#059669":"#dc2626", fontWeight:600}}>{c.variance>0?"+":""}{c.variance}</td>
                    <td><span className={"pill "+p.cls}>{p.th}</span></td>
                    <td style={{width:80}}>{c.status==="pending"&&<button className="btn sm primary">อนุมัติ</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

window.WMSApp = WMSApp;

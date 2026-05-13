// views.jsx — Dashboard, Sales, Inventory, Customers, generic.

const { KPIS, ORDERS, TOP_PRODUCTS, BRANCHES, INVENTORY_ALERTS, ACTIVITIES, SALES_30D, SALES_30D_PREV, STATUS_TH } = window.MockData;
const Iv = window.Icons;

const fmtTHB = (n) => n.toLocaleString("th-TH");

// ============================================================
// DASHBOARD
// ============================================================
function DashboardView({ direction, onOpenOrder }) {
  const [range, setRange] = React.useState("30d");
  return (
    <div className="page" data-direction={direction}>
      <div className="page-h">
        <div>
          <h1 className="page-h-title">สวัสดีตอนเช้า, ปริญญา 👋</h1>
          <div className="page-h-sub">ภาพรวมธุรกิจของคุณวันนี้ · จันทร์ที่ 11 พฤษภาคม 2569</div>
        </div>
        <div className="page-h-actions">
          <div className="seg">
            {["7d","30d","90d","ปี"].map(r => (
              <button key={r} className={"seg-btn" + (range === r ? " is-active" : "")}
                      onClick={() => setRange(r)}>{r === "7d" ? "7 วัน" : r === "30d" ? "30 วัน" : r === "90d" ? "90 วัน" : r}</button>
            ))}
          </div>
          <button className="btn"><Iv.Download w={14} h={14} /> ส่งออก</button>
          <button className="btn primary"><Iv.Plus w={14} h={14} /> สร้างออเดอร์</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: "var(--gap-section)" }}>
        {KPIS.map(k => <KpiCard key={k.id} k={k} />)}
      </div>

      {/* Chart + Top products */}
      <div className="grid-2" style={{ marginBottom: "var(--gap-section)" }}>
        <div className="card">
          <div className="card-h">
            <div>
              <div className="card-title">แนวโน้มยอดขาย</div>
              <div className="card-sub">฿ ต่อวัน · 30 วันล่าสุด</div>
            </div>
            <div className="hstack">
              <div className="chart-legend" style={{ padding: 0, fontSize: 12 }}>
                <span><span className="sw" style={{ background: "var(--accent)" }}></span>เดือนนี้</span>
                <span><span className="sw" style={{ background: "#a8a29e" }}></span>เดือนที่แล้ว</span>
              </div>
              <button className="btn sm ghost"><Iv.More w={14} h={14} /></button>
            </div>
          </div>
          <div className="card-body" style={{ paddingTop: 8, paddingBottom: 8 }}>
            <SalesChart data={SALES_30D} prev={SALES_30D_PREV} height={240} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderTop: "1px solid var(--line-soft)" }}>
            {[
              { l: "ยอดรวม 30 วัน", v: "฿8.42M", d: "+18.4%" },
              { l: "ค่าเฉลี่ย/วัน", v: "฿280,667", d: "+12.1%" },
              { l: "ออเดอร์เฉลี่ย", v: "฿2,148", d: "+4.8%" },
            ].map((s, i) => (
              <div key={i} style={{ padding: "14px 18px", borderRight: i < 2 ? "1px solid var(--line-soft)" : "0" }}>
                <div className="muted xs" style={{ marginBottom: 2 }}>{s.l}</div>
                <div className="hstack" style={{ gap: 8 }}>
                  <span className="mono" style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-.01em" }}>{s.v}</span>
                  <span className="kpi-delta up xs">{s.d}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <TopProductsCard />
      </div>

      {/* Recent orders + Branch perf */}
      <div className="grid-2" style={{ marginBottom: "var(--gap-section)" }}>
        <RecentOrdersCard onOpen={onOpenOrder} />
        <BranchPerfCard />
      </div>

      <div className="grid-2-eq">
        <InventoryAlertsCard />
        <ActivityCard />
      </div>
    </div>
  );
}

// ------------------------------- Sub-cards -------------------------------
function TopProductsCard() {
  return (
    <div className="card">
      <div className="card-h">
        <div>
          <div className="card-title">สินค้าขายดี</div>
          <div className="card-sub">5 อันดับแรก · 30 วัน</div>
        </div>
        <button className="btn sm ghost">ดูทั้งหมด <Iv.ArrowRight w={12} h={12} /></button>
      </div>
      <div className="row-list">
        {TOP_PRODUCTS.map((p, i) => (
          <div key={p.sku} className="row-list-item" style={{ alignItems: "flex-start" }}>
            <div className="mono xs muted" style={{ width: 18, paddingTop: 4 }}>{(i+1).toString().padStart(2,"0")}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.name}
              </div>
              <div className="hstack xs muted" style={{ marginTop: 2 }}>
                <span className="mono">{p.sku}</span>
                <span>·</span>
                <span>{p.cat}</span>
                <span>·</span>
                <span>ขายไป {p.sold}</span>
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div className="mono tnum" style={{ fontSize: 13, fontWeight: 500 }}>฿{fmtTHB(p.revenue)}</div>
              <div className={"kpi-delta xs " + (p.change > 0 ? "up" : "down")} style={{ marginTop: 2 }}>
                {p.change > 0 ? <Iv.ArrowUp w={10} h={10} sw={2.4} /> : <Iv.ArrowDown w={10} h={10} sw={2.4} />}
                {Math.abs(p.change)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentOrdersCard({ onOpen }) {
  return (
    <div className="card">
      <div className="card-h">
        <div>
          <div className="card-title">ออเดอร์ล่าสุด</div>
          <div className="card-sub">วันนี้ · 1,247 ออเดอร์</div>
        </div>
        <div className="hstack">
          <button className="btn sm ghost"><Iv.Filter w={13} h={13} /> กรอง</button>
          <button className="btn sm">ดูทั้งหมด</button>
        </div>
      </div>
      <div className="card-body flush">
        <table className="tbl">
          <thead>
            <tr>
              <th>เลขที่</th>
              <th>ลูกค้า</th>
              <th>สาขา</th>
              <th>สถานะ</th>
              <th className="num">ยอด</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ORDERS.slice(0, 6).map(o => {
              const st = STATUS_TH[o.status];
              return (
                <tr key={o.id} onClick={() => onOpen && onOpen(o)}>
                  <td className="mono" style={{ fontSize: 12.5 }}>{o.id}</td>
                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.customer}</td>
                  <td className="muted small">{o.branch}</td>
                  <td><span className={"pill " + st.cls}>{st.th}</span></td>
                  <td className="num mono">฿{fmtTHB(o.total)}</td>
                  <td style={{ width: 28, paddingLeft: 0 }}><Iv.ChevronRight w={14} h={14} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BranchPerfCard() {
  return (
    <div className="card">
      <div className="card-h">
        <div>
          <div className="card-title">ผลการดำเนินงานสาขา</div>
          <div className="card-sub">เป้าหมายเดือนนี้</div>
        </div>
        <button className="btn sm ghost"><Iv.More w={14} h={14} /></button>
      </div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {BRANCHES.map(b => {
          const pct = Math.min(100, (b.revenue / b.target) * 100);
          const fillCls = pct >= 90 ? "" : pct >= 70 ? "" : pct >= 50 ? "warn" : "danger";
          return (
            <div key={b.name}>
              <div className="hstack" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{b.name}</span>
                <span className={"kpi-delta xs " + (b.change > 0 ? "up" : "down")}>
                  {b.change > 0 ? <Iv.ArrowUp w={10} h={10} sw={2.4} /> : <Iv.ArrowDown w={10} h={10} sw={2.4} />}
                  {Math.abs(b.change)}%
                </span>
                <span className="spacer"></span>
                <span className="mono tnum xs muted">{b.orders} ออเดอร์</span>
              </div>
              <div className="bar"><div className={"bar-fill " + fillCls} style={{ width: pct + "%" }}></div></div>
              <div className="hstack xs muted" style={{ marginTop: 4 }}>
                <span className="mono">฿{fmtTHB(b.revenue)}</span>
                <span className="spacer"></span>
                <span>เป้า ฿{fmtTHB(b.target)} · {pct.toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InventoryAlertsCard() {
  return (
    <div className="card">
      <div className="card-h">
        <div>
          <div className="card-title hstack" style={{ gap: 8 }}>
            สต็อกใกล้หมด
            <span className="pill warn" style={{ fontSize: 10.5 }}>4 รายการ</span>
          </div>
          <div className="card-sub">ต้องสั่งเพิ่มภายในสัปดาห์นี้</div>
        </div>
        <button className="btn sm">สร้าง PO</button>
      </div>
      <div className="row-list">
        {INVENTORY_ALERTS.map(p => {
          const pct = (p.stock / p.reorder) * 100;
          return (
            <div key={p.sku} className="row-list-item">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                <div className="hstack xs muted" style={{ marginTop: 2 }}>
                  <span className="mono">{p.sku}</span>
                  <span>·</span>
                  <span>เหลือพอ {p.days} วัน</span>
                </div>
              </div>
              <div style={{ width: 84 }}>
                <div className="bar"><div className={"bar-fill " + (pct < 20 ? "danger" : "warn")} style={{ width: pct + "%" }}></div></div>
                <div className="hstack xs muted" style={{ marginTop: 4, justifyContent: "space-between" }}>
                  <span className="mono">{p.stock}</span>
                  <span className="mono">/{p.reorder}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivityCard() {
  return (
    <div className="card">
      <div className="card-h">
        <div>
          <div className="card-title">กิจกรรมล่าสุด</div>
          <div className="card-sub">การเปลี่ยนแปลงในระบบ</div>
        </div>
        <button className="btn sm ghost">ดูทั้งหมด</button>
      </div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {ACTIVITIES.map((a, i) => (
          <div key={i} className="hstack" style={{ alignItems: "flex-start", gap: 11 }}>
            <div className="av" style={{ background: a.whoColor + "22", color: a.whoColor }}>
              {a.who.slice(0, 2)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                <span style={{ fontWeight: 500 }}>{a.who}</span>
                <span className="muted"> {a.what} </span>
                <span className="mono" style={{ fontSize: 12.5, color: "var(--accent-ink)", background: "var(--accent-soft)", padding: "0 5px", borderRadius: 4 }}>{a.target}</span>
              </div>
              <div className="muted xs" style={{ marginTop: 2 }}>{a.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// SALES VIEW
// ============================================================
function SalesView({ onOpenOrder }) {
  const [tab, setTab] = React.useState("all");
  const tabs = [
    { id: "all", label: "ทั้งหมด", count: 1247 },
    { id: "paid", label: "ชำระแล้ว", count: 892 },
    { id: "pending", label: "รอชำระ", count: 18 },
    { id: "shipping", label: "กำลังจัดส่ง", count: 124 },
    { id: "refunded", label: "คืนเงิน", count: 8 },
  ];
  const filtered = tab === "all" ? ORDERS : ORDERS.filter(o => o.status === tab);
  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1 className="page-h-title">การขาย</h1>
          <div className="page-h-sub">จัดการออเดอร์และการชำระเงิน</div>
        </div>
        <div className="page-h-actions">
          <button className="btn"><Iv.Download w={14} h={14} /> ส่งออก</button>
          <button className="btn primary"><Iv.Plus w={14} h={14} /> ออเดอร์ใหม่</button>
        </div>
      </div>

      <div className="tabs">
        {tabs.map(t => (
          <button key={t.id} className={"tab" + (tab === t.id ? " is-active" : "")} onClick={() => setTab(t.id)}>
            {t.label} <span className="tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-h">
          <div className="hstack">
            <div className="tb-search" style={{ width: 260, margin: 0 }}>
              <Iv.Search w={14} h={14} />
              <input placeholder="ค้นหาเลขที่ออเดอร์ ลูกค้า..." />
            </div>
            <button className="btn sm"><Iv.Filter w={13} h={13} /> ตัวกรอง</button>
            <button className="btn sm"><Iv.Calendar w={13} h={13} /> วันที่</button>
          </div>
          <div className="muted small">{filtered.length} รายการ</div>
        </div>
        <div className="card-body flush">
          <table className="tbl">
            <thead>
              <tr>
                <th>เลขที่</th>
                <th>ลูกค้า</th>
                <th>สาขา</th>
                <th>สินค้า</th>
                <th>เวลา</th>
                <th>สถานะ</th>
                <th className="num">ยอดรวม</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const st = STATUS_TH[o.status];
                return (
                  <tr key={o.id} onClick={() => onOpenOrder && onOpenOrder(o)}>
                    <td className="mono" style={{ fontSize: 12.5 }}>{o.id}</td>
                    <td>{o.customer}</td>
                    <td className="muted">{o.branch}</td>
                    <td className="num mono">{o.items}</td>
                    <td className="muted mono">{o.time}</td>
                    <td><span className={"pill " + st.cls}>{st.th}</span></td>
                    <td className="num mono">฿{fmtTHB(o.total)}</td>
                    <td style={{ width: 28, paddingLeft: 0 }}><Iv.ChevronRight w={14} h={14} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// INVENTORY VIEW
// ============================================================
function InventoryView({ onAdd }) {
  const products = [
    { sku: "TS-001", name: "เสื้อยืดผ้าฝ้าย Premium", cat: "เสื้อผ้า", stock: 8, price: 590, status: "low" },
    { sku: "TS-002", name: "เสื้อยืด Oversize", cat: "เสื้อผ้า", stock: 142, price: 690, status: "ok" },
    { sku: "JN-014", name: "กางเกงยีนส์ Slim Fit", cat: "เสื้อผ้า", stock: 86, price: 1290, status: "ok" },
    { sku: "JN-022", name: "กางเกงขาสั้น Linen", cat: "เสื้อผ้า", stock: 54, price: 890, status: "ok" },
    { sku: "SN-203", name: "รองเท้าผ้าใบ Daily", cat: "รองเท้า", stock: 3, price: 1990, status: "critical" },
    { sku: "SN-211", name: "รองเท้าหนัง Loafer", cat: "รองเท้า", stock: 28, price: 2890, status: "ok" },
    { sku: "BG-088", name: "กระเป๋าสะพายข้าง", cat: "เครื่องประดับ", stock: 12, price: 1490, status: "low" },
    { sku: "CP-057", name: "หมวกแก๊ป Logo", cat: "เครื่องประดับ", stock: 18, price: 490, status: "low" },
    { sku: "WT-031", name: "นาฬิกาข้อมือ Classic", cat: "เครื่องประดับ", stock: 64, price: 4290, status: "ok" },
  ];
  const stCls = { ok: "ok", low: "warn", critical: "danger" };
  const stTh = { ok: "ปกติ", low: "ใกล้หมด", critical: "วิกฤต" };
  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1 className="page-h-title">สินค้าคงคลัง</h1>
          <div className="page-h-sub">จัดการสต็อกและรหัสสินค้า · 1,842 SKU</div>
        </div>
        <div className="page-h-actions">
          <button className="btn"><Iv.Download w={14} h={14} /> นำเข้า</button>
          <button className="btn primary" onClick={onAdd}><Iv.Plus w={14} h={14} /> เพิ่มสินค้า</button>
        </div>
      </div>

      {/* Mini KPIs */}
      <div className="kpi-grid" style={{ marginBottom: "var(--gap-section)" }}>
        <div className="kpi">
          <div className="kpi-label">มูลค่าสต็อกรวม</div>
          <div className="kpi-value tnum">฿4.82<span className="unit">M</span></div>
          <div className="kpi-delta up xs"><Iv.ArrowUp w={10} h={10} sw={2.4}/>2.4%</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">SKU ทั้งหมด</div>
          <div className="kpi-value tnum">1,842</div>
          <div className="muted xs">+12 ในเดือนนี้</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">ใกล้หมด</div>
          <div className="kpi-value tnum" style={{ color: "#b45309" }}>23</div>
          <div className="muted xs">ต้องสั่งเพิ่ม</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">หมุนเวียน (วัน)</div>
          <div className="kpi-value tnum">42</div>
          <div className="kpi-delta up xs"><Iv.ArrowDown w={10} h={10} sw={2.4}/>3 วัน</div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <div className="hstack">
            <div className="tb-search" style={{ width: 260, margin: 0 }}>
              <Iv.Search w={14} h={14} />
              <input placeholder="ค้นหา SKU หรือชื่อสินค้า..." />
            </div>
            <div className="seg">
              <button className="seg-btn is-active">ทั้งหมด</button>
              <button className="seg-btn">เสื้อผ้า</button>
              <button className="seg-btn">รองเท้า</button>
              <button className="seg-btn">เครื่องประดับ</button>
            </div>
          </div>
        </div>
        <div className="card-body flush">
          <table className="tbl">
            <thead>
              <tr>
                <th>SKU</th>
                <th>ชื่อสินค้า</th>
                <th>หมวดหมู่</th>
                <th className="num">คงเหลือ</th>
                <th className="num">ราคา</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.sku}>
                  <td className="mono" style={{ fontSize: 12.5 }}>{p.sku}</td>
                  <td>{p.name}</td>
                  <td className="muted">{p.cat}</td>
                  <td className="num mono" style={{ color: p.status === "critical" ? "var(--danger)" : p.status === "low" ? "#b45309" : "var(--ink-1)" }}>{p.stock}</td>
                  <td className="num mono">฿{fmtTHB(p.price)}</td>
                  <td><span className={"pill " + stCls[p.status]}>{stTh[p.status]}</span></td>
                  <td style={{ width: 28, paddingLeft: 0 }}><Iv.More w={14} h={14} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CUSTOMERS VIEW
// ============================================================
function CustomersView() {
  const customers = [
    { name: "บจก. สยามรีเทล", type: "นิติบุคคล", orders: 248, ltv: 2_450_000, status: "vip", color: "#a78bfa" },
    { name: "บจก. ทรูเนเจอร์", type: "นิติบุคคล", orders: 186, ltv: 1_890_000, status: "vip", color: "#22c55e" },
    { name: "คุณ ปรีดา ภัทรกุล", type: "บุคคล", orders: 42, ltv: 285_000, status: "active", color: "#f97316" },
    { name: "คุณ มาลี วงศ์ใหญ่", type: "บุคคล", orders: 28, ltv: 168_000, status: "active", color: "#0ea5e9" },
    { name: "บจก. กรีนลีฟ", type: "นิติบุคคล", orders: 124, ltv: 1_240_000, status: "active", color: "#ec4899" },
    { name: "คุณ ธนวัฒน์ ศรีสุข", type: "บุคคล", orders: 12, ltv: 84_500, status: "new", color: "#8b5cf6" },
    { name: "คุณ สุภาพร เจริญทรัพย์", type: "บุคคล", orders: 18, ltv: 124_000, status: "active", color: "#06b6d4" },
    { name: "บจก. โอเชี่ยนบลู", type: "นิติบุคคล", orders: 6, ltv: 95_000, status: "new", color: "#84cc16" },
  ];
  const stCls = { vip: "info", active: "ok", new: "muted" };
  const stTh = { vip: "VIP", active: "ลูกค้าประจำ", new: "ใหม่" };
  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1 className="page-h-title">ลูกค้า</h1>
          <div className="page-h-sub">8,452 บัญชี · 84 ใหม่เดือนนี้</div>
        </div>
        <div className="page-h-actions">
          <button className="btn"><Iv.Download w={14} h={14} /> ส่งออก</button>
          <button className="btn primary"><Iv.Plus w={14} h={14} /> เพิ่มลูกค้า</button>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <div className="hstack">
            <div className="tb-search" style={{ width: 260, margin: 0 }}>
              <Iv.Search w={14} h={14} />
              <input placeholder="ค้นหาลูกค้า..." />
            </div>
            <button className="btn sm"><Iv.Filter w={13} h={13} /> ตัวกรอง</button>
          </div>
        </div>
        <div className="card-body flush">
          <table className="tbl">
            <thead>
              <tr>
                <th>ลูกค้า</th>
                <th>ประเภท</th>
                <th className="num">ออเดอร์</th>
                <th className="num">มูลค่ารวม (LTV)</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.name}>
                  <td>
                    <div className="hstack">
                      <div className="av" style={{ background: c.color + "22", color: c.color }}>
                        {c.name.replace(/^(บจก\.|คุณ)\s*/, "").slice(0, 2)}
                      </div>
                      <span style={{ fontWeight: 500 }}>{c.name}</span>
                    </div>
                  </td>
                  <td className="muted">{c.type}</td>
                  <td className="num mono">{c.orders}</td>
                  <td className="num mono">฿{fmtTHB(c.ltv)}</td>
                  <td><span className={"pill " + stCls[c.status]}>{stTh[c.status]}</span></td>
                  <td style={{ width: 28, paddingLeft: 0 }}><Iv.ChevronRight w={14} h={14} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PLACEHOLDER VIEW
// ============================================================
function PlaceholderView({ title, desc, icon }) {
  const Ic = Iv[icon] || Iv.Box;
  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1 className="page-h-title">{title}</h1>
          <div className="page-h-sub">{desc}</div>
        </div>
      </div>
      <div className="card">
        <div className="empty">
          <div style={{ display: "inline-grid", placeItems: "center", width: 48, height: 48, borderRadius: 12, background: "var(--bg-sunken)", marginBottom: 14, color: "var(--ink-3)" }}>
            <Ic w={22} h={22} />
          </div>
          <h4>กำลังเตรียมข้อมูล</h4>
          <div style={{ marginTop: 4 }}>หน้านี้อยู่ระหว่างพัฒนา ดูแดชบอร์ด การขาย หรือสินค้าคงคลังก่อนได้</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// GOODS RECEIVING VIEW — พนักงานรับลงสินค้า
// ============================================================

const VENDORS = [
  "บจก. ผ้าฝ้ายไทย",
  "หจก. เด่นชัยการ์เม้นท์",
  "บจก. ลิตเติ้ลโจ ฟุตแวร์",
  "บจก. สยามเลทเธอร์",
  "หจก. กรีนเฮ้าส์ แอคเซสซอรี่",
  "บจก. เอเซียไทม์พีซ",
];

const RECEIVERS = ["สมชาย ใจดี", "วราภรณ์ พันธุ์ทอง", "ธีรพงษ์ ศรีสกุล", "นภาพร เจริญผล"];

const UNITS = ["ชิ้น", "ตัว", "คู่", "กล่อง", "แพ็ค", "โหล", "ม้วน"];

const CATALOG = [
  { sku: "TS-001", name: "เสื้อยืดผ้าฝ้าย Premium", unit: "ตัว" },
  { sku: "TS-002", name: "เสื้อยืด Oversize", unit: "ตัว" },
  { sku: "JN-014", name: "กางเกงยีนส์ Slim Fit", unit: "ตัว" },
  { sku: "JN-022", name: "กางเกงขาสั้น Linen", unit: "ตัว" },
  { sku: "SN-203", name: "รองเท้าผ้าใบ Daily", unit: "คู่" },
  { sku: "SN-211", name: "รองเท้าหนัง Loafer", unit: "คู่" },
  { sku: "BG-088", name: "กระเป๋าสะพายข้าง", unit: "ใบ" },
  { sku: "CP-057", name: "หมวกแก๊ป Logo", unit: "ชิ้น" },
  { sku: "WT-031", name: "นาฬิกาข้อมือ Classic", unit: "เรือน" },
];

const INIT_RECEIPTS = [
  {
    id: "GR-2569-0142",
    date: "2026-05-11",
    vendor: "บจก. ผ้าฝ้ายไทย",
    receiver: "สมชาย ใจดี",
    note: "ของครบตามใบส่งของ ไม่มีตำหนิ",
    status: "complete",
    items: [
      { sku: "TS-001", name: "เสื้อยืดผ้าฝ้าย Premium", qty: 120, unit: "ตัว" },
      { sku: "TS-002", name: "เสื้อยืด Oversize", qty: 80, unit: "ตัว" },
    ],
  },
  {
    id: "GR-2569-0141",
    date: "2026-05-11",
    vendor: "บจก. ลิตเติ้ลโจ ฟุตแวร์",
    receiver: "วราภรณ์ พันธุ์ทอง",
    note: "นับลงได้ครบ 45 คู่",
    status: "complete",
    items: [{ sku: "SN-203", name: "รองเท้าผ้าใบ Daily", qty: 45, unit: "คู่" }],
  },
  {
    id: "GR-2569-0140",
    date: "2026-05-10",
    vendor: "หจก. เด่นชัยการ์เม้นท์",
    receiver: "ธีรพงษ์ ศรีสกุล",
    note: "ขาด 2 ตัว แจ้ง vendor แล้ว",
    status: "partial",
    items: [
      { sku: "JN-014", name: "กางเกงยีนส์ Slim Fit", qty: 58, unit: "ตัว" },
      { sku: "JN-022", name: "กางเกงขาสั้น Linen", qty: 30, unit: "ตัว" },
    ],
  },
  {
    id: "GR-2569-0139",
    date: "2026-05-10",
    vendor: "หจก. กรีนเฮ้าส์ แอคเซสซอรี่",
    receiver: "นภาพร เจริญผล",
    note: "",
    status: "complete",
    items: [
      { sku: "BG-088", name: "กระเป๋าสะพายข้าง", qty: 40, unit: "ใบ" },
      { sku: "CP-057", name: "หมวกแก๊ป Logo", qty: 60, unit: "ชิ้น" },
    ],
  },
  {
    id: "GR-2569-0138",
    date: "2026-05-09",
    vendor: "บจก. เอเซียไทม์พีซ",
    receiver: "สมชาย ใจดี",
    note: "",
    status: "complete",
    items: [{ sku: "WT-031", name: "นาฬิกาข้อมือ Classic", qty: 24, unit: "เรือน" }],
  },
];

const fmtDateTH = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${parseInt(y, 10) + 543}`;
};

function GoodsReceivingView() {
  const [receipts, setReceipts] = React.useState(INIT_RECEIPTS);
  const [open, setOpen] = React.useState(false);
  const [detail, setDetail] = React.useState(null);
  const [query, setQuery] = React.useState("");

  const filtered = receipts.filter((r) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      r.vendor.toLowerCase().includes(q) ||
      r.receiver.toLowerCase().includes(q) ||
      r.items.some((it) => it.name.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q))
    );
  });

  const today = receipts.filter((r) => r.date === "2026-05-11");
  const totalUnitsToday = today.reduce((s, r) => s + r.items.reduce((a, i) => a + i.qty, 0), 0);
  const totalLinesToday = today.reduce((s, r) => s + r.items.length, 0);

  const onSave = (rec) => {
    setReceipts([rec, ...receipts]);
    setOpen(false);
  };

  const statusPill = (s) =>
    s === "complete" ? { cls: "ok", th: "ครบถ้วน" } :
    s === "partial" ? { cls: "warn", th: "ขาด/เกิน" } :
    { cls: "muted", th: "ร่าง" };

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1 className="page-h-title">รับสินค้าเข้าคลัง</h1>
          <div className="page-h-sub">บันทึกการนับและรับสินค้าจาก Vendor · จันทร์ที่ 11 พฤษภาคม 2569</div>
        </div>
        <div className="page-h-actions">
          <button className="btn"><Iv.Download w={14} h={14} /> ส่งออก</button>
          <button className="btn primary" onClick={() => setOpen(true)}>
            <Iv.Plus w={14} h={14} /> บันทึกรับสินค้า
          </button>
        </div>
      </div>

      {/* Mini KPIs */}
      <div className="kpi-grid" style={{ marginBottom: "var(--gap-section)" }}>
        <div className="kpi">
          <div className="kpi-label">ใบรับวันนี้</div>
          <div className="kpi-value tnum">{today.length}<span className="unit">ใบ</span></div>
          <div className="muted xs">{totalLinesToday} รายการสินค้า</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">จำนวนรวมที่นับลง</div>
          <div className="kpi-value tnum">{totalUnitsToday.toLocaleString()}</div>
          <div className="muted xs">หน่วยรวม วันนี้</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Vendor วันนี้</div>
          <div className="kpi-value tnum">{new Set(today.map(r => r.vendor)).size}</div>
          <div className="muted xs">รายเข้าส่งของ</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">รอตรวจสอบ</div>
          <div className="kpi-value tnum" style={{ color: "#b45309" }}>
            {receipts.filter(r => r.status === "partial").length}
          </div>
          <div className="muted xs">ใบที่นับไม่ตรง</div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <div className="hstack">
            <div className="tb-search" style={{ width: 300, margin: 0 }}>
              <Iv.Search w={14} h={14} />
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                     placeholder="ค้นหา Vendor, ผู้รับ, สินค้า..." />
            </div>
            <button className="btn sm"><Iv.Calendar w={13} h={13} /> วันที่</button>
            <button className="btn sm"><Iv.Filter w={13} h={13} /> ตัวกรอง</button>
          </div>
          <div className="muted small">{filtered.length} ใบ</div>
        </div>
        <div className="card-body flush">
          <table className="tbl">
            <thead>
              <tr>
                <th>เลขที่</th>
                <th>วันที่มาส่ง</th>
                <th>Vendor</th>
                <th>รายการสินค้า</th>
                <th className="num">จำนวนที่นับลง</th>
                <th>ผู้รับ</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const st = statusPill(r.status);
                const totalQty = r.items.reduce((a, i) => a + i.qty, 0);
                const preview = r.items[0]?.name + (r.items.length > 1 ? ` +${r.items.length - 1}` : "");
                return (
                  <tr key={r.id} onClick={() => setDetail(r)}>
                    <td className="mono" style={{ fontSize: 12.5 }}>{r.id}</td>
                    <td className="mono" style={{ fontSize: 12.5 }}>{fmtDateTH(r.date)}</td>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.vendor}</td>
                    <td className="muted" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}</td>
                    <td className="num mono">{totalQty.toLocaleString()}</td>
                    <td>{r.receiver}</td>
                    <td><span className={"pill " + st.cls}>{st.th}</span></td>
                    <td style={{ width: 28, paddingLeft: 0 }}><Iv.ChevronRight w={14} h={14} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {open && <ReceiveGoodsModal onClose={() => setOpen(false)} onSave={onSave} nextSeq={receipts.length + 143} />}
      {detail && <ReceiptDetailModal receipt={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

// -------- Receive Goods Modal (the form) --------
function ReceiveGoodsModal({ onClose, onSave, nextSeq }) {
  const [date, setDate] = React.useState("2026-05-11");
  const [vendor, setVendor] = React.useState(VENDORS[0]);
  const [receiver, setReceiver] = React.useState(RECEIVERS[0]);
  const [note, setNote] = React.useState("");
  const [items, setItems] = React.useState([
    { id: 1, sku: "", name: "", qty: "", unit: "ชิ้น" },
  ]);

  const addRow = () =>
    setItems([...items, { id: Date.now(), sku: "", name: "", qty: "", unit: "ชิ้น" }]);
  const removeRow = (id) =>
    setItems(items.length > 1 ? items.filter((i) => i.id !== id) : items);

  const updateRow = (id, patch) =>
    setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const onPickProduct = (id, sku) => {
    const p = CATALOG.find((c) => c.sku === sku);
    if (p) updateRow(id, { sku: p.sku, name: p.name, unit: p.unit });
    else updateRow(id, { sku });
  };

  const totalQty = items.reduce((s, i) => s + (parseInt(i.qty, 10) || 0), 0);
  const valid = vendor && receiver && date && items.some((i) => i.name && (parseInt(i.qty, 10) || 0) > 0);

  const handleSave = () => {
    const rec = {
      id: `GR-2569-${String(nextSeq).padStart(4, "0")}`,
      date,
      vendor,
      receiver,
      note,
      status: "complete",
      items: items
        .filter((i) => i.name && (parseInt(i.qty, 10) || 0) > 0)
        .map((i) => ({ sku: i.sku || "—", name: i.name, qty: parseInt(i.qty, 10), unit: i.unit })),
    };
    onSave(rec);
  };

  return (
    <Modal onClose={onClose} size="lg">
      <div className="modal-h">
        <div>
          <h3 className="hstack" style={{ gap: 10 }}>
            <window.Icons.ClipboardCheck w={18} h={18} />
            บันทึกรับสินค้าเข้าคลัง
          </h3>
          <div className="modal-sub">กรอกข้อมูลการรับและนับลงสินค้าจาก Vendor</div>
        </div>
        <button className="tb-icon-btn" onClick={onClose}><window.Icons.Close w={16} h={16} /></button>
      </div>

      <div className="modal-body">
        {/* Header form */}
        <div className="field-row">
          <div className="field">
            <label>วันที่มาส่ง</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Vendor</label>
            <select value={vendor} onChange={(e) => setVendor(e.target.value)}>
              {VENDORS.map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>ผู้รับ</label>
            <select value={receiver} onChange={(e) => setReceiver(e.target.value)}>
              {RECEIVERS.map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label>หมายเหตุ</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
                   placeholder="เช่น ของครบ ไม่มีตำหนิ" />
          </div>
        </div>

        {/* Items table */}
        <div className="gr-items-h">
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--ink-3)" }}>
            รายการสินค้า · นับลง
          </div>
          <span className="spacer"></span>
          <span className="muted xs mono">รวมทั้งหมด {totalQty.toLocaleString()} หน่วย</span>
        </div>

        <div className="gr-items">
          <div className="gr-row gr-row-h">
            <div>รายการสินค้า</div>
            <div className="num">จำนวนที่นับลง</div>
            <div>หน่วย</div>
            <div></div>
          </div>
          {items.map((it, idx) => (
            <div key={it.id} className="gr-row">
              <div className="gr-prod">
                <select value={it.sku} onChange={(e) => onPickProduct(it.id, e.target.value)}>
                  <option value="">— เลือกสินค้า —</option>
                  {CATALOG.map((p) => (
                    <option key={p.sku} value={p.sku}>{p.sku} · {p.name}</option>
                  ))}
                </select>
                {it.name && <div className="muted xs mono" style={{ marginTop: 4 }}>{it.sku} · {it.name}</div>}
              </div>
              <input className="gr-qty" type="number" min="0" inputMode="numeric"
                     value={it.qty} onChange={(e) => updateRow(it.id, { qty: e.target.value })}
                     placeholder="0" />
              <select value={it.unit} onChange={(e) => updateRow(it.id, { unit: e.target.value })}>
                {UNITS.concat(it.unit && !UNITS.includes(it.unit) ? [it.unit] : []).map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
              <button className="tb-icon-btn gr-del" onClick={() => removeRow(it.id)}
                      disabled={items.length === 1} title="ลบบรรทัด">
                <window.Icons.Trash w={15} h={15} />
              </button>
            </div>
          ))}
        </div>

        <button className="btn sm" style={{ marginTop: 10 }} onClick={addRow}>
          <window.Icons.Plus w={13} h={13} /> เพิ่มบรรทัด
        </button>
      </div>

      <div className="modal-foot">
        <span className="muted xs">{items.filter((i) => i.name).length} รายการ · {totalQty.toLocaleString()} หน่วย</span>
        <span className="spacer"></span>
        <button className="btn" onClick={onClose}>ยกเลิก</button>
        <button className="btn primary" onClick={handleSave} disabled={!valid}>
          <window.Icons.ClipboardCheck w={13} h={13} /> บันทึกการรับ
        </button>
      </div>
    </Modal>
  );
}

// -------- Receipt Detail Modal --------
function ReceiptDetailModal({ receipt, onClose }) {
  const st = receipt.status === "complete" ? { cls: "ok", th: "ครบถ้วน" } :
             receipt.status === "partial" ? { cls: "warn", th: "ขาด/เกิน" } :
             { cls: "muted", th: "ร่าง" };
  const totalQty = receipt.items.reduce((a, i) => a + i.qty, 0);
  return (
    <Modal onClose={onClose} size="lg">
      <div className="modal-h">
        <div>
          <h3 className="hstack" style={{ gap: 10 }}>
            <span className="mono">{receipt.id}</span>
            <span className={"pill " + st.cls}>{st.th}</span>
          </h3>
          <div className="modal-sub">รับเข้า {fmtDateTH(receipt.date)} · {receipt.vendor}</div>
        </div>
        <button className="tb-icon-btn" onClick={onClose}><window.Icons.Close w={16} h={16} /></button>
      </div>
      <div className="modal-body">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 }}>
          {[
            { l: "วันที่มาส่ง", v: fmtDateTH(receipt.date) },
            { l: "Vendor", v: receipt.vendor },
            { l: "ผู้รับ", v: receipt.receiver },
          ].map((s, i) => (
            <div key={i} style={{ background: "var(--bg-soft)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px" }}>
              <div className="muted xs" style={{ marginBottom: 2 }}>{s.l}</div>
              <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.v}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 8 }}>รายการที่นับลง</div>
        <div className="card" style={{ marginBottom: 16 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>รายการสินค้า</th>
                <th className="num">จำนวนที่นับลง</th>
                <th>หน่วย</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((it) => (
                <tr key={it.sku}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{it.name}</div>
                    <div className="muted xs mono">{it.sku}</div>
                  </td>
                  <td className="num mono">{it.qty.toLocaleString()}</td>
                  <td className="muted">{it.unit}</td>
                </tr>
              ))}
              <tr>
                <td style={{ fontWeight: 600 }}>รวม</td>
                <td className="num mono" style={{ fontWeight: 600 }}>{totalQty.toLocaleString()}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        {receipt.note && (
          <div style={{ background: "var(--bg-soft)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px" }}>
            <div className="muted xs" style={{ marginBottom: 2 }}>หมายเหตุ</div>
            <div style={{ fontSize: 13 }}>{receipt.note}</div>
          </div>
        )}
      </div>
      <div className="modal-foot">
        <button className="btn ghost"><window.Icons.Receipt w={14} h={14} /> พิมพ์ใบรับ</button>
        <span className="spacer"></span>
        <button className="btn" onClick={onClose}>ปิด</button>
      </div>
    </Modal>
  );
}

Object.assign(window, { DashboardView, SalesView, InventoryView, CustomersView, PlaceholderView, GoodsReceivingView });

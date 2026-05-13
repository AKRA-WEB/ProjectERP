// app.jsx — main App orchestrator. State, navigation, modals, tweaks.

const { useState: uS, useEffect: uE } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "comfortable",
  "sidebar": "expanded",
  "direction": "balanced",
  "menuHidden": []
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = uS("dashboard");
  const [orderModal, setOrderModal] = uS(null);
  const [addProductOpen, setAddProductOpen] = uS(false);
  const [menuEditing, setMenuEditing] = uS(false);

  const toggleHidden = (id) => {
    if (id === "__reset") { setTweak("menuHidden", []); return; }
    const cur = t.menuHidden || [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    setTweak("menuHidden", next);
  };

  const collapsed = t.sidebar === "collapsed";

  const viewMap = {
    dashboard: { title: "แดชบอร์ด", crumbs: ["หน้าหลัก", "แดชบอร์ด"] },
    sales: { title: "การขาย", crumbs: ["การดำเนินงาน", "การขาย"] },
    inventory: { title: "สินค้าคงคลัง", crumbs: ["การดำเนินงาน", "สินค้าคงคลัง"] },
    pos: { title: "POS Terminal", crumbs: ["หน้าร้าน", "POS Terminal"] },
    receiving: { title: "รับสินค้า", crumbs: ["การดำเนินงาน", "รับสินค้าเข้าคลัง"] },
    customers: { title: "ลูกค้า", crumbs: ["การดำเนินงาน", "ลูกค้า"] },
    suppliers: { title: "ผู้จำหน่าย", crumbs: ["การดำเนินงาน", "ผู้จำหน่าย"] },
    reports: { title: "รายงาน", crumbs: ["ภาพรวม", "รายงาน"] },
    billing: { title: "การเรียกเก็บเงิน", crumbs: ["การเงิน", "การเรียกเก็บเงิน"] },
    wallet: { title: "บัญชี", crumbs: ["การเงิน", "บัญชี"] },
    settings: { title: "ตั้งค่า", crumbs: ["ระบบ", "ตั้งค่า"] },
  };
  const cur = viewMap[view];

  const renderView = () => {
    switch (view) {
      case "dashboard": return <DashboardView direction={t.direction} onOpenOrder={setOrderModal} />;
      case "sales":     return <SalesView onOpenOrder={setOrderModal} />;
      case "inventory": return <InventoryView onAdd={() => setAddProductOpen(true)} />;
      case "pos":       return <POSView />;
      case "receiving": return <GoodsReceivingView />;
      case "customers": return <CustomersView />;
      case "suppliers": return <PlaceholderView title="ผู้จำหน่าย" desc="จัดการคู่ค้าและสัญญา" icon="Truck" />;
      case "reports":   return <PlaceholderView title="รายงาน" desc="วิเคราะห์ผลประกอบการเชิงลึก" icon="Chart" />;
      case "billing":   return <PlaceholderView title="การเรียกเก็บเงิน" desc="ใบแจ้งหนี้และใบกำกับภาษี" icon="Receipt" />;
      case "wallet":    return <PlaceholderView title="บัญชี" desc="กระแสเงินสดและการเงิน" icon="Wallet" />;
      case "settings":  return <PlaceholderView title="ตั้งค่า" desc="ผู้ใช้ บทบาท และการตั้งค่าระบบ" icon="Cog" />;
      default: return null;
    }
  };

  return (
    <div className="app" data-density={t.density} data-sidebar={collapsed ? "collapsed" : "expanded"}>
      <Sidebar active={view} onNav={setView}
               collapsed={collapsed}
               onToggle={() => setTweak("sidebar", collapsed ? "expanded" : "collapsed")}
               hidden={t.menuHidden || []}
               editing={menuEditing}
               onToggleHidden={toggleHidden}
               onToggleEditing={() => setMenuEditing((v) => !v)} />
      <div className="main">
        <Topbar crumbs={cur.crumbs}
                onToggleSidebar={() => setTweak("sidebar", collapsed ? "expanded" : "collapsed")} />
        {renderView()}
      </div>

      {orderModal && <OrderDetailModal order={orderModal} onClose={() => setOrderModal(null)} />}
      {addProductOpen && <AddProductModal onClose={() => setAddProductOpen(false)} />}

      <TweaksPanel>
        <TweakSection label="เลย์เอาต์" />
        <TweakRadio label="ความหนาแน่น" value={t.density}
                    options={[
                      { value: "compact", label: "Compact" },
                      { value: "comfortable", label: "Comfortable" },
                    ]}
                    onChange={(v) => setTweak("density", v)} />
        <TweakRadio label="แถบเมนู" value={t.sidebar}
                    options={[
                      { value: "expanded", label: "เต็ม" },
                      { value: "collapsed", label: "ไอคอน" },
                    ]}
                    onChange={(v) => setTweak("sidebar", v)} />
        <TweakSection label="ทิศทางแดชบอร์ด" />
        <TweakRadio label="สไตล์ KPI" value={t.direction}
                    options={[
                      { value: "balanced", label: "สมดุล" },
                      { value: "calm", label: "เงียบ" },
                      { value: "command", label: "เน้นกราฟ" },
                    ]}
                    onChange={(v) => setTweak("direction", v)} />
      </TweaksPanel>
    </div>
  );
}

// ============================================================
// Order Detail Modal
// ============================================================
function OrderDetailModal({ order, onClose }) {
  const st = window.MockData.STATUS_TH[order.status];
  const items = [
    { sku: "TS-001", name: "เสื้อยืดผ้าฝ้าย Premium", qty: 4, price: 590 },
    { sku: "JN-014", name: "กางเกงยีนส์ Slim Fit", qty: 2, price: 1290 },
    { sku: "BG-088", name: "กระเป๋าสะพายข้าง", qty: 1, price: 1490 },
  ];
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const vat = Math.round(subtotal * 0.07);
  return (
    <Modal onClose={onClose} size="lg">
      <div className="modal-h">
        <div>
          <h3 className="hstack" style={{ gap: 10 }}>
            <span className="mono">{order.id}</span>
            <span className={"pill " + st.cls}>{st.th}</span>
          </h3>
          <div className="modal-sub">{order.customer} · สาขา{order.branch} · เวลา {order.time}</div>
        </div>
        <button className="tb-icon-btn" onClick={onClose}><window.Icons.Close w={16} h={16} /></button>
      </div>
      <div className="modal-body">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 }}>
          {[
            { l: "ลูกค้า", v: order.customer },
            { l: "วันที่", v: "11 พ.ค. 2569" },
            { l: "ช่องทาง", v: "หน้าร้าน" },
          ].map((s, i) => (
            <div key={i} style={{ background: "var(--bg-soft)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px" }}>
              <div className="muted xs" style={{ marginBottom: 2 }}>{s.l}</div>
              <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.v}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 8 }}>รายการสินค้า</div>
        <div className="card" style={{ marginBottom: 16 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>สินค้า</th>
                <th className="num">จำนวน</th>
                <th className="num">ราคา</th>
                <th className="num">รวม</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.sku}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{it.name}</div>
                    <div className="muted xs mono">{it.sku}</div>
                  </td>
                  <td className="num mono">{it.qty}</td>
                  <td className="num mono">฿{it.price.toLocaleString()}</td>
                  <td className="num mono">฿{(it.qty * it.price).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
          <div className="hstack"><span className="muted">ยอดรวม</span><span className="spacer"></span><span className="mono">฿{subtotal.toLocaleString()}</span></div>
          <div className="hstack"><span className="muted">ภาษีมูลค่าเพิ่ม (7%)</span><span className="spacer"></span><span className="mono">฿{vat.toLocaleString()}</span></div>
          <div className="hstack" style={{ paddingTop: 8, borderTop: "1px solid var(--line-soft)", marginTop: 4 }}>
            <span style={{ fontWeight: 600 }}>ยอดสุทธิ</span>
            <span className="spacer"></span>
            <span className="mono" style={{ fontSize: 17, fontWeight: 600 }}>฿{order.total.toLocaleString()}</span>
          </div>
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn ghost"><window.Icons.Receipt w={14} h={14} /> พิมพ์ใบเสร็จ</button>
        <span className="spacer"></span>
        <button className="btn" onClick={onClose}>ปิด</button>
        <button className="btn primary">ดูรายละเอียดเต็ม</button>
      </div>
    </Modal>
  );
}

// ============================================================
// Add Product Modal
// ============================================================
function AddProductModal({ onClose }) {
  return (
    <Modal onClose={onClose}>
      <div className="modal-h">
        <div>
          <h3>เพิ่มสินค้าใหม่</h3>
          <div className="modal-sub">กรอกข้อมูลพื้นฐาน · สามารถแก้ไขเพิ่มเติมในภายหลัง</div>
        </div>
        <button className="tb-icon-btn" onClick={onClose}><window.Icons.Close w={16} h={16} /></button>
      </div>
      <div className="modal-body">
        <div className="field">
          <label>ชื่อสินค้า</label>
          <input type="text" defaultValue="เสื้อยืดผ้าฝ้าย Premium" />
        </div>
        <div className="field-row">
          <div className="field">
            <label>SKU</label>
            <input type="text" placeholder="TS-100" />
          </div>
          <div className="field">
            <label>หมวดหมู่</label>
            <select>
              <option>เสื้อผ้า</option>
              <option>รองเท้า</option>
              <option>เครื่องประดับ</option>
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>ราคาขาย (บาท)</label>
            <input type="number" placeholder="590" />
          </div>
          <div className="field">
            <label>ต้นทุน (บาท)</label>
            <input type="number" placeholder="220" />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>คงคลังเริ่มต้น</label>
            <input type="number" placeholder="100" />
          </div>
          <div className="field">
            <label>จุดสั่งซื้อใหม่</label>
            <input type="number" placeholder="20" />
          </div>
        </div>
        <div className="field">
          <label>คำอธิบาย</label>
          <textarea rows={3} placeholder="รายละเอียดสินค้า..."></textarea>
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>ยกเลิก</button>
        <button className="btn primary" onClick={onClose}>
          <window.Icons.Plus w={13} h={13} /> เพิ่มสินค้า
        </button>
      </div>
    </Modal>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

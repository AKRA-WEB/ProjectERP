// pos.jsx — POS Terminal. Session, Cart, Multi-payment, Receipt, Stock locks.

const PosI = window.Icons;
const fmtTHBpos = (n) => Number(n).toLocaleString("th-TH");

// ---------- Catalog (POS-quick products) ----------
const POS_CATALOG = [
  { sku: "TS-001", barcode: "8851234500011", name: "เสื้อยืดผ้าฝ้าย Premium", cat: "เสื้อผ้า", price: 590, stock: 28 },
  { sku: "TS-002", barcode: "8851234500028", name: "เสื้อยืด Oversize", cat: "เสื้อผ้า", price: 690, stock: 142 },
  { sku: "TS-099", barcode: "8851234500998", name: "เสื้อโปโล Slimfit", cat: "เสื้อผ้า", price: 790, stock: 64 },
  { sku: "JN-014", barcode: "8851234500141", name: "กางเกงยีนส์ Slim Fit", cat: "เสื้อผ้า", price: 1290, stock: 86 },
  { sku: "JN-022", barcode: "8851234500226", name: "กางเกงขาสั้น Linen", cat: "เสื้อผ้า", price: 890, stock: 54 },
  { sku: "JK-041", barcode: "8851234500417", name: "แจ็คเก็ตยีนส์", cat: "เสื้อผ้า", price: 1890, stock: 22 },
  { sku: "SN-203", barcode: "8851234502034", name: "รองเท้าผ้าใบ Daily", cat: "รองเท้า", price: 1990, stock: 8 },
  { sku: "SN-211", barcode: "8851234502119", name: "รองเท้าหนัง Loafer", cat: "รองเท้า", price: 2890, stock: 28 },
  { sku: "SN-220", barcode: "8851234502201", name: "รองเท้าแตะ Slip-on", cat: "รองเท้า", price: 590, stock: 96 },
  { sku: "BG-088", barcode: "8851234500880", name: "กระเป๋าสะพายข้าง", cat: "กระเป๋า", price: 1490, stock: 12 },
  { sku: "BG-092", barcode: "8851234500927", name: "กระเป๋าเป้ Daily", cat: "กระเป๋า", price: 1890, stock: 18 },
  { sku: "CP-057", barcode: "8851234500576", name: "หมวกแก๊ป Logo", cat: "เครื่องประดับ", price: 490, stock: 18 },
  { sku: "WT-031", barcode: "8851234500316", name: "นาฬิกาข้อมือ Classic", cat: "เครื่องประดับ", price: 4290, stock: 64 },
  { sku: "BL-110", barcode: "8851234501104", name: "เข็มขัดหนัง", cat: "เครื่องประดับ", price: 790, stock: 42 },
  { sku: "SC-201", barcode: "8851234502010", name: "ผ้าพันคอ Soft", cat: "เครื่องประดับ", price: 390, stock: 88 },
  { sku: "SK-016", barcode: "8851234500163", name: "ถุงเท้า Crew (แพ็ค 3)", cat: "เครื่องประดับ", price: 290, stock: 124 },
];

const POS_CATS = ["ทั้งหมด", "เสื้อผ้า", "รองเท้า", "กระเป๋า", "เครื่องประดับ"];

// ---------- View ----------
function POSView() {
  // Session
  const [session, setSession] = React.useState(null); // { id, cashier, openedAt, openCash }
  const [openModal, setOpenModal] = React.useState(false);
  const [closeModal, setCloseModal] = React.useState(false);

  // Cart
  const [cart, setCart] = React.useState([]); // { sku, name, price, qty, lockExpiresAt }
  const [discount, setDiscount] = React.useState(0); // percent
  const [customer, setCustomer] = React.useState(null);
  const [members, setMembers] = React.useState(window.POS_MEMBERS_SEED || [
    { code: "M0001", name: "สมหญิง วิภาวดี", phone: "081-234-5678", tier: "Gold", points: 1240, joined: "12 ม.ค. 2568" },
    { code: "M0002", name: "ธนกฤต ศรีสุวรรณ", phone: "089-123-4567", tier: "Silver", points: 480, joined: "03 มี.ค. 2568" },
    { code: "M0003", name: "วราภรณ์ ใจดี", phone: "092-555-1111", tier: "Bronze", points: 120, joined: "22 ก.พ. 2569" },
    { code: "M0004", name: "ปิยะ กล้าหาญ", phone: "086-888-9999", tier: "Platinum", points: 5820, joined: "08 พ.ย. 2567" },
  ]);
  const [memberLookupOpen, setMemberLookupOpen] = React.useState(false);
  const [addMemberOpen, setAddMemberOpen] = React.useState(false);

  // Member tier auto-discount
  const TIER_DISCOUNTS = { Bronze: 3, Silver: 5, Gold: 8, Platinum: 12 };
  const memberDiscount = customer ? (TIER_DISCOUNTS[customer.tier] || 0) : 0;

  // UI
  const [cat, setCat] = React.useState("ทั้งหมด");
  const [query, setQuery] = React.useState("");
  const [payOpen, setPayOpen] = React.useState(false);
  const [receipt, setReceipt] = React.useState(null);
  const scanRef = React.useRef(null);

  // History (last 3 receipts this session)
  const [history, setHistory] = React.useState([]);

  // tick for stock-lock countdown
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Available stock = catalog stock - reserved in cart (locked)
  const reservedBySku = React.useMemo(() => {
    const m = {};
    cart.forEach((l) => (m[l.sku] = (m[l.sku] || 0) + l.qty));
    return m;
  }, [cart]);
  const availableFor = (sku) => {
    const p = POS_CATALOG.find((x) => x.sku === sku);
    if (!p) return 0;
    return p.stock - (reservedBySku[sku] || 0);
  };

  // Filtered grid
  const filtered = POS_CATALOG.filter((p) => {
    if (cat !== "ทั้งหมด" && p.cat !== cat) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode.includes(q)
    );
  });

  // Add by barcode (Enter in scan input)
  const onScanSubmit = (e) => {
    e.preventDefault();
    const code = query.trim();
    if (!code) return;
    const hit = POS_CATALOG.find((p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase());
    if (hit) {
      addToCart(hit);
      setQuery("");
      scanRef.current?.focus();
    }
  };

  const LOCK_MS = 90 * 1000;
  const addToCart = (p) => {
    if (!session) return;
    if (availableFor(p.sku) <= 0) return;
    const exp = Date.now() + LOCK_MS;
    setCart((prev) => {
      const i = prev.findIndex((l) => l.sku === p.sku);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1, lockExpiresAt: exp };
        return next;
      }
      return [...prev, { sku: p.sku, name: p.name, price: p.price, qty: 1, lockExpiresAt: exp }];
    });
  };

  const setQty = (sku, qty) => {
    const p = POS_CATALOG.find((x) => x.sku === sku);
    const maxQty = (p?.stock || 0);
    const next = Math.max(0, Math.min(maxQty, qty));
    if (next === 0) {
      setCart((prev) => prev.filter((l) => l.sku !== sku));
    } else {
      setCart((prev) => prev.map((l) => (l.sku === sku ? { ...l, qty: next, lockExpiresAt: Date.now() + LOCK_MS } : l)));
    }
  };

  const removeLine = (sku) => setCart((prev) => prev.filter((l) => l.sku !== sku));
  const clearCart = () => { setCart([]); setDiscount(0); setCustomer(null); };

  // Auto-release expired locks
  React.useEffect(() => {
    const now = Date.now();
    const expired = cart.filter((l) => l.lockExpiresAt && l.lockExpiresAt < now);
    if (expired.length) {
      setCart((prev) => prev.filter((l) => l.lockExpiresAt >= now));
    }
  }); // run every render (we tick every 1s)

  // Totals
  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const effectiveDiscount = Math.max(discount, memberDiscount);
  const discountAmt = Math.round(subtotal * (effectiveDiscount / 100));
  const afterDisc = subtotal - discountAmt;
  const vat = Math.round((afterDisc * 7) / 107); // VAT-included pricing
  const grandTotal = afterDisc;

  // Session ops
  const openSession = ({ cashier, openCash }) => {
    setSession({
      id: "SH-2569-" + String(142 + history.length).padStart(4, "0"),
      cashier,
      openedAt: new Date(),
      openCash,
    });
    setOpenModal(false);
  };
  const completePayment = (payments, change) => {
    const id = "RC-2569-" + String(8421 + history.length).padStart(4, "0");
    const rec = {
      id,
      time: new Date(),
      session,
      items: cart,
      subtotal, discount, discountAmt, vat, grandTotal,
      payments, change,
      customer,
    };
    setHistory((h) => [rec, ...h]);
    setReceipt(rec);
    setPayOpen(false);
    clearCart();
  };

  return (
    <div className="pos-shell">
      {/* Session bar */}
      <SessionBar session={session}
                  onOpen={() => setOpenModal(true)}
                  onClose={() => setCloseModal(true)}
                  cartLocks={cart.length}
                  history={history} />

      {/* Two-column terminal */}
      <div className="pos-grid">
        {/* LEFT — product pad */}
        <section className="pos-pad">
          <form className="pos-scan" onSubmit={onScanSubmit}>
            <PosI.Barcode w={20} h={20} />
            <input ref={scanRef}
                   value={query}
                   onChange={(e) => setQuery(e.target.value)}
                   placeholder={session ? "ยิงบาร์โค้ด หรือพิมพ์ SKU / ชื่อสินค้า…" : "เปิดรอบการขายก่อนเริ่มทำรายการ"}
                   disabled={!session}
                   autoFocus />
            <kbd className="pos-kbd">Enter</kbd>
          </form>

          <div className="pos-cats">
            {POS_CATS.map((c) => (
              <button key={c}
                      className={"pos-cat" + (cat === c ? " is-active" : "")}
                      onClick={() => setCat(c)}>{c}</button>
            ))}
            <span className="spacer"></span>
            <span className="muted xs mono">{filtered.length} รายการ</span>
          </div>

          <div className="pos-pad-grid">
            {filtered.map((p) => {
              const avail = availableFor(p.sku);
              const low = p.stock <= 10;
              const out = avail <= 0;
              return (
                <button key={p.sku}
                        className={"pos-card" + (out ? " is-out" : "") + (low ? " is-low" : "")}
                        onClick={() => addToCart(p)}
                        disabled={!session || out}>
                  <div className="pos-card-thumb">
                    <span className="mono">{p.sku}</span>
                  </div>
                  <div className="pos-card-name">{p.name}</div>
                  <div className="pos-card-foot">
                    <span className="mono pos-card-price">฿{fmtTHBpos(p.price)}</span>
                    <span className={"pos-card-stock" + (low ? " is-low" : "")}>
                      คงเหลือ {avail}
                    </span>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="pos-empty">ไม่พบสินค้าตรงกับ "{query}"</div>
            )}
          </div>
        </section>

        {/* RIGHT — cart */}
        <aside className="pos-cart">
          <div className="pos-cart-h">
            <div>
              <div className="pos-cart-title">รายการขาย</div>
              <div className="muted xs">{cart.length} รายการ · {cart.reduce((s,l)=>s+l.qty,0)} ชิ้น</div>
            </div>
            <button className="btn sm ghost" onClick={clearCart} disabled={!cart.length}>
              <PosI.Trash w={13} h={13} /> ล้าง
            </button>
          </div>

          {/* Member chip */}
          <div className={"pos-member" + (customer ? " is-on tier-" + customer.tier.toLowerCase() : "")}>
            {customer ? (
              <>
                <div className="pos-member-av">{customer.name.slice(0,1)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="pos-member-name">{customer.name}
                    <span className={"pos-tier-badge tier-" + customer.tier.toLowerCase()}>{customer.tier}</span>
                  </div>
                  <div className="muted xs"><span className="mono">{customer.code}</span> · {customer.phone} · <b style={{color:"#059669"}}>{customer.points} pts</b></div>
                </div>
                <button className="pos-member-x" onClick={() => setCustomer(null)} title="นำสมาชิกออก"><PosI.Close w={13} h={13} /></button>
              </>
            ) : (
              <>
                <div className="pos-member-icon"><PosI.User w={15} h={15} /></div>
                <div style={{ flex: 1 }}>
                  <div className="pos-member-name">ขายให้สมาชิก</div>
                  <div className="muted xs">รับส่วนลดอัตโนมัติ · สะสมแต้ม</div>
                </div>
                <button className="btn sm" onClick={() => setMemberLookupOpen(true)}>เลือก</button>
                <button className="btn sm primary" onClick={() => setAddMemberOpen(true)} title="เพิ่มสมาชิกใหม่"><PosI.Plus w={13} h={13} /></button>
              </>
            )}
          </div>

          <div className="pos-cart-body">
            {cart.length === 0 ? (
              <div className="pos-cart-empty">
                <PosI.Cart w={28} h={28} />
                <div style={{ marginTop: 10 }}>ยังไม่มีรายการ</div>
                <div className="muted xs" style={{ marginTop: 4 }}>เลือกสินค้าจากแผงด้านซ้าย หรือยิงบาร์โค้ด</div>
              </div>
            ) : (
              cart.map((l) => {
                const remaining = Math.max(0, (l.lockExpiresAt - Date.now()) / 1000);
                const lockPct = Math.max(0, Math.min(100, (remaining / 90) * 100));
                const expSoon = remaining < 20;
                return (
                  <div key={l.sku} className="pos-line">
                    <div className="pos-line-main">
                      <div className="pos-line-name">{l.name}</div>
                      <div className="hstack xs muted" style={{ gap: 8, marginTop: 2 }}>
                        <span className="mono">{l.sku}</span>
                        <span>·</span>
                        <span className="mono">฿{fmtTHBpos(l.price)}</span>
                      </div>
                      <div className="pos-lock" title="สต็อกถูกล็อกระหว่างทำรายการ">
                        <PosI.Lock w={10} h={10} sw={2} />
                        <div className="pos-lock-bar"><div className={"pos-lock-fill" + (expSoon ? " warn" : "")} style={{ width: lockPct + "%" }}></div></div>
                        <span className={"mono xs" + (expSoon ? " expsoon" : "")}>{Math.ceil(remaining)}s</span>
                      </div>
                    </div>
                    <div className="pos-line-qty">
                      <button onClick={() => setQty(l.sku, l.qty - 1)}><PosI.Minus w={12} h={12} sw={2.4} /></button>
                      <span className="mono">{l.qty}</span>
                      <button onClick={() => setQty(l.sku, l.qty + 1)}><PosI.Plus w={12} h={12} sw={2.4} /></button>
                    </div>
                    <div className="pos-line-tot mono">฿{fmtTHBpos(l.price * l.qty)}</div>
                    <button className="pos-line-x" onClick={() => removeLine(l.sku)} title="ลบ">
                      <PosI.Close w={14} h={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Totals */}
          <div className="pos-totals">
            <div className="hstack"><span className="muted">ยอดรวม</span><span className="spacer"></span><span className="mono">฿{fmtTHBpos(subtotal)}</span></div>
            <div className="hstack">
              <span className="muted">ส่วนลด{customer && memberDiscount >= discount ? <span className="pos-disc-from"> (สมาชิก {customer.tier})</span> : null}</span>
              <div className="pos-disc">
                {[0, 5, 10, 15].map((d) => (
                  <button key={d}
                          className={"pos-disc-btn" + (discount === d ? " is-active" : "")}
                          onClick={() => setDiscount(d)}>{d}%</button>
                ))}
              </div>
              <span className="spacer"></span>
              <span className="mono" style={{ color: discountAmt ? "var(--danger,#dc2626)" : "var(--ink-3)" }}>
                −฿{fmtTHBpos(discountAmt)} ({effectiveDiscount}%)
              </span>
            </div>
            <div className="hstack"><span className="muted">VAT 7% (รวมในราคา)</span><span className="spacer"></span><span className="mono muted">฿{fmtTHBpos(vat)}</span></div>
            <div className="pos-grand">
              <span>ยอดสุทธิ</span>
              <span className="spacer"></span>
              <span className="mono">฿{fmtTHBpos(grandTotal)}</span>
            </div>

            <button className="pos-pay-btn"
                    onClick={() => setPayOpen(true)}
                    disabled={!session || !cart.length}>
              <PosI.Cash w={16} h={16} />
              ชำระเงิน {cart.length ? `฿${fmtTHBpos(grandTotal)}` : ""}
            </button>

            {!session && (
              <div className="pos-warn">
                <PosI.Power w={14} h={14} />
                ยังไม่ได้เปิดรอบการขาย — กด "เปิดรอบ" ที่แถบด้านบน
              </div>
            )}
          </div>
        </aside>
      </div>

      {openModal && <OpenSessionModal onClose={() => setOpenModal(false)} onConfirm={openSession} />}
      {closeModal && session && (
        <CloseSessionModal session={session} history={history}
                           onClose={() => setCloseModal(false)}
                           onConfirm={() => { setSession(null); setHistory([]); setCloseModal(false); }} />
      )}
      {payOpen && (
        <PaymentModal total={grandTotal}
                      onClose={() => setPayOpen(false)}
                      onComplete={completePayment} />
      )}
      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
      {memberLookupOpen && (
        <MemberLookupModal
          members={members}
          onClose={() => setMemberLookupOpen(false)}
          onSelect={(m) => { setCustomer(m); setMemberLookupOpen(false); }}
          onAddNew={() => { setMemberLookupOpen(false); setAddMemberOpen(true); }}
        />
      )}
      {addMemberOpen && (
        <AddMemberModal
          onClose={() => setAddMemberOpen(false)}
          onCreate={(m) => {
            const code = "M" + String(members.length + 1).padStart(4, "0");
            const rec = { ...m, code, points: 0, tier: m.tier || "Bronze", joined: new Date().toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" }) };
            setMembers([rec, ...members]);
            setCustomer(rec);
            setAddMemberOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Member Lookup Modal
// ============================================================
function MemberLookupModal({ members, onClose, onSelect, onAddNew }) {
  const [q, setQ] = React.useState("");
  const filtered = members.filter(m =>
    !q.trim() ||
    m.name.includes(q) ||
    m.code.toLowerCase().includes(q.toLowerCase()) ||
    m.phone.includes(q)
  );
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div>
            <div className="modal-title">เลือกสมาชิก</div>
            <div className="modal-sub">ค้นหาจากชื่อ รหัสสมาชิก หรือเบอร์โทร</div>
          </div>
          <button className="modal-x" onClick={onClose}><PosI.Close w={16} h={16} /></button>
        </div>
        <div className="modal-body">
          <div className="pos-member-search">
            <PosI.Search w={15} h={15} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="ชื่อสมาชิก / M0001 / 081-xxx-xxxx" />
          </div>
          <div className="pos-member-list">
            {filtered.length === 0 ? (
              <div className="pos-member-empty">
                <div>ไม่พบสมาชิก "{q}"</div>
                <button className="btn primary sm" style={{ marginTop: 10 }} onClick={onAddNew}><PosI.Plus w={12} h={12} /> เพิ่มสมาชิกใหม่</button>
              </div>
            ) : (
              filtered.map(m => (
                <div key={m.code} className="pos-member-row" onClick={() => onSelect(m)}>
                  <div className={"pos-member-av tier-" + m.tier.toLowerCase()}>{m.name.slice(0,1)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="pos-member-name">{m.name}
                      <span className={"pos-tier-badge tier-" + m.tier.toLowerCase()}>{m.tier}</span>
                    </div>
                    <div className="muted xs"><span className="mono">{m.code}</span> · {m.phone} · เข้าร่วม {m.joined}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="mono" style={{ color: "#059669", fontWeight: 600 }}>{m.points} pts</div>
                    <div className="muted xs">ส่วนลด {({Bronze:3,Silver:5,Gold:8,Platinum:12})[m.tier]}%</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onAddNew}><PosI.Plus w={13} h={13} /> เพิ่มสมาชิกใหม่</button>
          <span className="spacer"></span>
          <button className="btn ghost" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Add Member Modal
// ============================================================
function AddMemberModal({ onClose, onCreate }) {
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [tier, setTier] = React.useState("Bronze");
  const canSave = name.trim().length >= 2 && phone.trim().length >= 9;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div>
            <div className="modal-title">เพิ่มสมาชิกใหม่</div>
            <div className="modal-sub">รหัสสมาชิกจะถูกสร้างอัตโนมัติ</div>
          </div>
          <button className="modal-x" onClick={onClose}><PosI.Close w={16} h={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <label className="field">
              <span>ชื่อ-นามสกุล <em>*</em></span>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น สมชาย ใจดี" />
            </label>
            <label className="field">
              <span>เบอร์โทร <em>*</em></span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="081-234-5678" />
            </label>
            <label className="field">
              <span>อีเมล (ถ้ามี)</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
            </label>
            <label className="field">
              <span>ระดับสมาชิกเริ่มต้น</span>
              <div className="pos-tier-pick">
                {["Bronze","Silver","Gold","Platinum"].map(t => (
                  <button key={t} type="button"
                          className={"pos-tier-opt tier-" + t.toLowerCase() + (tier === t ? " is-active" : "")}
                          onClick={() => setTier(t)}>
                    <span className="pos-tier-name">{t}</span>
                    <span className="pos-tier-disc">−{({Bronze:3,Silver:5,Gold:8,Platinum:12})[t]}%</span>
                  </button>
                ))}
              </div>
            </label>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>ยกเลิก</button>
          <span className="spacer"></span>
          <button className="btn primary" disabled={!canSave} onClick={() => onCreate({ name, phone, email, tier })}>
            <PosI.Plus w={13} h={13} /> เพิ่มสมาชิก
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Session Bar
// ============================================================
function SessionBar({ session, onOpen, onClose, cartLocks, history }) {
  const elapsed = session ? Math.floor((Date.now() - session.openedAt) / 60000) : 0;
  const hrs = Math.floor(elapsed / 60), mins = elapsed % 60;
  const sales = history.reduce((s, r) => s + r.grandTotal, 0);
  return (
    <div className={"pos-session" + (session ? " is-open" : "")}>
      <div className="pos-session-l">
        <div className={"pos-session-dot" + (session ? " on" : "")}></div>
        {session ? (
          <>
            <div>
              <div className="pos-session-id mono">{session.id}</div>
              <div className="muted xs">แคชเชียร์ <b style={{ color: "var(--ink-1)" }}>{session.cashier}</b> · เปิดมา {hrs > 0 ? hrs + " ชม. " : ""}{mins} นาที</div>
            </div>
            <div className="pos-session-stat">
              <div className="muted xs">เงินสดต้นรอบ</div>
              <div className="mono">฿{fmtTHBpos(session.openCash)}</div>
            </div>
            <div className="pos-session-stat">
              <div className="muted xs">ยอดขายในรอบ</div>
              <div className="mono">฿{fmtTHBpos(sales)}</div>
            </div>
            <div className="pos-session-stat">
              <div className="muted xs">ใบเสร็จ</div>
              <div className="mono">{history.length}</div>
            </div>
          </>
        ) : (
          <div>
            <div className="pos-session-id">ยังไม่ได้เปิดรอบการขาย</div>
            <div className="muted xs">ต้องเปิดรอบก่อนเริ่มขาย เพื่อบันทึกรายรับเงินสดประจำกะ</div>
          </div>
        )}
      </div>
      <div className="pos-session-r">
        {session && cartLocks > 0 && (
          <div className="pos-lock-chip" title="สต็อกถูกล็อกขณะทำรายการ">
            <span className="pulse-dot"></span>
            <PosI.Lock w={12} h={12} sw={2} />
            ล็อกสต็อก {cartLocks} รายการ
          </div>
        )}
        {session ? (
          <button className="btn" onClick={onClose}>
            <PosI.Power w={14} h={14} /> ปิดรอบ
          </button>
        ) : (
          <button className="btn primary" onClick={onOpen}>
            <PosI.Power w={14} h={14} /> เปิดรอบการขาย
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Open Session Modal
// ============================================================
function OpenSessionModal({ onClose, onConfirm }) {
  const [cashier, setCashier] = React.useState("ปริญญา ฉัตรชัย");
  const [openCash, setOpenCash] = React.useState("2000");
  return (
    <Modal onClose={onClose}>
      <div className="modal-h">
        <div>
          <h3 className="hstack" style={{ gap: 10 }}><PosI.Power w={18} h={18} /> เปิดรอบการขาย</h3>
          <div className="modal-sub">บันทึกแคชเชียร์และเงินสดตั้งต้นในลิ้นชัก</div>
        </div>
        <button className="tb-icon-btn" onClick={onClose}><PosI.Close w={16} h={16} /></button>
      </div>
      <div className="modal-body">
        <div className="field">
          <label>แคชเชียร์</label>
          <select value={cashier} onChange={(e) => setCashier(e.target.value)}>
            <option>ปริญญา ฉัตรชัย</option>
            <option>นภาพร เจริญผล</option>
            <option>วราภรณ์ พันธุ์ทอง</option>
            <option>ธนกร สุวรรณรัตน์</option>
          </select>
        </div>
        <div className="field">
          <label>เงินสดในลิ้นชัก (ต้นรอบ)</label>
          <input type="number" value={openCash} onChange={(e) => setOpenCash(e.target.value)} placeholder="2000" />
        </div>
        <div style={{ background: "var(--bg-soft)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: "var(--ink-2)", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <PosI.Bolt w={16} h={16} />
          <div>ระบบจะเริ่มล็อกสต็อกอัตโนมัติทุกครั้งที่เพิ่มสินค้าเข้ารายการ ป้องกันการขายซ้ำซ้อนระหว่างหลายเครื่อง</div>
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>ยกเลิก</button>
        <button className="btn primary" onClick={() => onConfirm({ cashier, openCash: parseInt(openCash) || 0 })}>
          <PosI.Power w={13} h={13} /> เปิดรอบ
        </button>
      </div>
    </Modal>
  );
}

// ============================================================
// Close Session Modal
// ============================================================
function CloseSessionModal({ session, history, onClose, onConfirm }) {
  const sales = history.reduce((s, r) => s + r.grandTotal, 0);
  const cashSales = history.reduce((s, r) => s + (r.payments?.cash || 0), 0);
  const cardSales = history.reduce((s, r) => s + (r.payments?.card || 0), 0);
  const qrSales = history.reduce((s, r) => s + (r.payments?.qr || 0), 0);
  const expectedCash = session.openCash + cashSales;
  const [counted, setCounted] = React.useState(String(expectedCash));
  const variance = (parseInt(counted) || 0) - expectedCash;
  return (
    <Modal onClose={onClose} size="lg">
      <div className="modal-h">
        <div>
          <h3 className="hstack" style={{ gap: 10 }}><PosI.Power w={18} h={18} /> ปิดรอบการขาย · <span className="mono">{session.id}</span></h3>
          <div className="modal-sub">นับเงินสด ปิดยอด และสรุปการรับจ่ายประจำกะ</div>
        </div>
        <button className="tb-icon-btn" onClick={onClose}><PosI.Close w={16} h={16} /></button>
      </div>
      <div className="modal-body">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
          {[
            { l: "ยอดขายรวม", v: "฿" + fmtTHBpos(sales) },
            { l: "เงินสด", v: "฿" + fmtTHBpos(cashSales) },
            { l: "บัตรเครดิต", v: "฿" + fmtTHBpos(cardSales) },
            { l: "QR / โอน", v: "฿" + fmtTHBpos(qrSales) },
          ].map((s, i) => (
            <div key={i} style={{ background: "var(--bg-soft)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px" }}>
              <div className="muted xs" style={{ marginBottom: 2 }}>{s.l}</div>
              <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{s.v}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 8 }}>นับเงินสดในลิ้นชัก</div>
        <div className="pos-cash-count">
          <div>
            <div className="muted xs">ตั้งต้น</div>
            <div className="mono" style={{ fontSize: 16 }}>฿{fmtTHBpos(session.openCash)}</div>
          </div>
          <div className="muted">+</div>
          <div>
            <div className="muted xs">เงินสดรับเข้า</div>
            <div className="mono" style={{ fontSize: 16 }}>฿{fmtTHBpos(cashSales)}</div>
          </div>
          <div className="muted">=</div>
          <div>
            <div className="muted xs">ควรมี</div>
            <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>฿{fmtTHBpos(expectedCash)}</div>
          </div>
          <div className="spacer"></div>
          <div className="field" style={{ margin: 0, minWidth: 180 }}>
            <label>นับได้จริง</label>
            <input type="number" value={counted} onChange={(e) => setCounted(e.target.value)} />
          </div>
        </div>

        <div className={"pos-variance " + (variance === 0 ? "ok" : variance > 0 ? "over" : "short")}>
          {variance === 0 ? "ยอดตรงพอดี ✓" :
           variance > 0 ? `เกิน ฿${fmtTHBpos(variance)}` :
           `ขาด ฿${fmtTHBpos(Math.abs(variance))}`}
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>กลับ</button>
        <button className="btn primary" onClick={onConfirm}>
          <PosI.Power w={13} h={13} /> ปิดรอบและพิมพ์สรุป
        </button>
      </div>
    </Modal>
  );
}

// ============================================================
// Multi-Payment Modal
// ============================================================
function PaymentModal({ total, onClose, onComplete }) {
  const [method, setMethod] = React.useState("single"); // single | split
  const [cash, setCash] = React.useState("");
  const [card, setCard] = React.useState("");
  const [qr, setQr] = React.useState("");
  const [single, setSingle] = React.useState("cash"); // cash|card|qr

  const cashN = parseInt(cash) || 0;
  const cardN = parseInt(card) || 0;
  const qrN = parseInt(qr) || 0;

  let pays = { cash: 0, card: 0, qr: 0 };
  if (method === "single") {
    pays[single] = total;
    if (single === "cash") pays.cash = cashN; // use tendered for change calc
  } else {
    pays = { cash: cashN, card: cardN, qr: qrN };
  }
  const paid = pays.cash + pays.card + pays.qr;
  const remaining = total - (method === "single" ? total : paid);
  const change = method === "single" && single === "cash" ? Math.max(0, cashN - total) : 0;
  const canComplete =
    method === "single"
      ? (single !== "cash" || cashN >= total)
      : paid >= total;

  // Quick-cash chips
  const quick = [total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000]
    .filter((v, i, a) => v >= total && a.indexOf(v) === i)
    .slice(0, 4);

  const submit = () => {
    if (method === "single") {
      const p = { cash: 0, card: 0, qr: 0 };
      if (single === "cash") p.cash = total;
      else p[single] = total;
      onComplete(p, change);
    } else {
      // normalize so payments sum equals total (clip overpay to last cash)
      const p = { ...pays };
      onComplete(p, Math.max(0, paid - total));
    }
  };

  return (
    <Modal onClose={onClose} size="lg">
      <div className="modal-h">
        <div>
          <h3>ชำระเงิน · <span className="mono">฿{fmtTHBpos(total)}</span></h3>
          <div className="modal-sub">เลือกวิธีชำระ — ชำระเต็มในรูปแบบเดียว หรือแบ่งจ่ายผสมหลายช่องทาง</div>
        </div>
        <button className="tb-icon-btn" onClick={onClose}><PosI.Close w={16} h={16} /></button>
      </div>
      <div className="modal-body">
        <div className="seg" style={{ marginBottom: 18 }}>
          <button className={"seg-btn" + (method === "single" ? " is-active" : "")} onClick={() => setMethod("single")}>ช่องทางเดียว</button>
          <button className={"seg-btn" + (method === "split" ? " is-active" : "")} onClick={() => setMethod("split")}>แบ่งจ่ายผสม</button>
        </div>

        {method === "single" ? (
          <>
            <div className="pos-pay-grid">
              {[
                { id: "cash", label: "เงินสด", icon: "Cash" },
                { id: "card", label: "บัตรเครดิต", icon: "CreditCard" },
                { id: "qr", label: "QR / พร้อมเพย์", icon: "QR" },
              ].map((m) => {
                const Ic = PosI[m.icon];
                return (
                  <button key={m.id}
                          className={"pos-pay-tile" + (single === m.id ? " is-active" : "")}
                          onClick={() => setSingle(m.id)}>
                    <Ic w={26} h={26} />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            {single === "cash" && (
              <div className="pos-cash-zone">
                <div className="field" style={{ margin: 0 }}>
                  <label>รับเงินสดจากลูกค้า</label>
                  <input type="number" value={cash} onChange={(e) => setCash(e.target.value)}
                         placeholder={String(total)} autoFocus />
                </div>
                <div className="pos-quick">
                  {quick.map((v) => (
                    <button key={v} className="pos-quick-btn" onClick={() => setCash(String(v))}>
                      ฿{fmtTHBpos(v)}
                    </button>
                  ))}
                </div>
                <div className="pos-change">
                  <span className="muted">เงินทอน</span>
                  <span className="spacer"></span>
                  <span className={"mono" + (change > 0 ? " has-change" : "")}>฿{fmtTHBpos(change)}</span>
                </div>
              </div>
            )}
            {single === "card" && (
              <div className="pos-card-zone">
                <div className="hstack" style={{ gap: 8 }}>
                  <span className="pill ok">รูดบัตรที่เครื่อง EDC</span>
                  <span className="muted xs">รอผลอนุมัติจากเครื่อง...</span>
                </div>
                <div className="muted xs" style={{ marginTop: 10 }}>ระบบจะบันทึกหมายเลขอ้างอิงจาก EDC อัตโนมัติ</div>
              </div>
            )}
            {single === "qr" && (
              <div className="pos-qr-zone">
                <div className="pos-qr-img">
                  <PosI.QR w={120} h={120} sw={1} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>สแกนเพื่อชำระ ฿{fmtTHBpos(total)}</div>
                  <div className="muted xs">PromptPay · บจก. อรุณ รีเทล (0107555000123)</div>
                  <div className="muted xs" style={{ marginTop: 8 }}>ระบบจะตรวจสอบการชำระอัตโนมัติ</div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="pos-split">
              {[
                { id: "cash", label: "เงินสด", icon: "Cash", value: cash, set: setCash },
                { id: "card", label: "บัตรเครดิต", icon: "CreditCard", value: card, set: setCard },
                { id: "qr", label: "QR / พร้อมเพย์", icon: "QR", value: qr, set: setQr },
              ].map((m) => {
                const Ic = PosI[m.icon];
                return (
                  <div key={m.id} className="pos-split-row">
                    <div className="pos-split-l"><Ic w={18} h={18} /> {m.label}</div>
                    <input type="number" value={m.value} onChange={(e) => m.set(e.target.value)} placeholder="0" />
                    <span className="muted xs">บาท</span>
                  </div>
                );
              })}
            </div>
            <div className="pos-split-totals">
              <div className="hstack"><span className="muted">รับชำระแล้ว</span><span className="spacer"></span><span className="mono">฿{fmtTHBpos(paid)}</span></div>
              <div className="hstack">
                <span className="muted">{remaining > 0 ? "ยังขาด" : remaining < 0 ? "เกินมา (ทอน)" : "พอดี"}</span>
                <span className="spacer"></span>
                <span className={"mono " + (remaining === 0 ? "" : remaining > 0 ? "neg" : "pos")}>
                  ฿{fmtTHBpos(Math.abs(remaining))}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>ยกเลิก</button>
        <button className="btn primary" onClick={submit} disabled={!canComplete}>
          <PosI.Printer w={13} h={13} /> ยืนยัน · พิมพ์ใบเสร็จ
        </button>
      </div>
    </Modal>
  );
}

// ============================================================
// Receipt Modal (thermal style)
// ============================================================
function ReceiptModal({ receipt, onClose }) {
  const t = receipt.time;
  const time = t.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = t.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
  const payLines = [
    receipt.payments.cash ? ["เงินสด", receipt.payments.cash] : null,
    receipt.payments.card ? ["บัตรเครดิต", receipt.payments.card] : null,
    receipt.payments.qr ? ["QR / พร้อมเพย์", receipt.payments.qr] : null,
  ].filter(Boolean);

  return (
    <Modal onClose={onClose}>
      <div className="modal-h">
        <div>
          <h3 className="hstack" style={{ gap: 10 }}><PosI.Printer w={18} h={18} /> ใบเสร็จรับเงิน (ฉบับย่อ)</h3>
          <div className="modal-sub">กำลังพิมพ์ออกเครื่องพิมพ์ความร้อน 80mm · <span className="mono">{receipt.id}</span></div>
        </div>
        <button className="tb-icon-btn" onClick={onClose}><PosI.Close w={16} h={16} /></button>
      </div>
      <div className="modal-body" style={{ background: "var(--bg-sunken)", padding: 24 }}>
        <div className="thermal">
          <div className="thermal-tear top"></div>
          <div className="thermal-paper">
            <div className="thermal-head">
              <div className="thermal-logo">อรุณ</div>
              <div>บจก. อรุณ รีเทล</div>
              <div>123/45 ถ.สุขุมวิท แขวงคลองตัน</div>
              <div>เขตวัฒนา กรุงเทพฯ 10110</div>
              <div>เลขประจำตัวผู้เสียภาษี 0107555000123</div>
              <div>โทร 02-555-1234</div>
            </div>
            <div className="thermal-rule"></div>
            <div className="thermal-meta">
              <div><span>ใบเสร็จเลขที่</span><span>{receipt.id}</span></div>
              <div><span>วันที่</span><span>{date} {time}</span></div>
              <div><span>แคชเชียร์</span><span>{receipt.session.cashier}</span></div>
              <div><span>รอบ</span><span>{receipt.session.id}</span></div>
            </div>
            <div className="thermal-rule"></div>
            <div className="thermal-items">
              {receipt.items.map((l) => (
                <div key={l.sku} className="thermal-line">
                  <div className="thermal-name">{l.name}</div>
                  <div className="thermal-calc">
                    <span>{l.qty} × ฿{fmtTHBpos(l.price)}</span>
                    <span>฿{fmtTHBpos(l.qty * l.price)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="thermal-rule"></div>
            <div className="thermal-totals">
              <div><span>ยอดรวม</span><span>฿{fmtTHBpos(receipt.subtotal)}</span></div>
              {receipt.discountAmt > 0 && (
                <div><span>ส่วนลด {receipt.discount}%</span><span>−฿{fmtTHBpos(receipt.discountAmt)}</span></div>
              )}
              <div className="muted"><span>VAT 7% (รวมแล้ว)</span><span>฿{fmtTHBpos(receipt.vat)}</span></div>
              <div className="thermal-grand"><span>สุทธิ</span><span>฿{fmtTHBpos(receipt.grandTotal)}</span></div>
            </div>
            <div className="thermal-rule"></div>
            <div className="thermal-pay">
              {payLines.map(([l, v]) => (
                <div key={l}><span>{l}</span><span>฿{fmtTHBpos(v)}</span></div>
              ))}
              {receipt.change > 0 && (
                <div><span>เงินทอน</span><span>฿{fmtTHBpos(receipt.change)}</span></div>
              )}
            </div>
            <div className="thermal-rule dashed"></div>
            <div className="thermal-foot">
              <div>ขอบคุณที่ใช้บริการ</div>
              <div>กรุณาเก็บใบเสร็จไว้เป็นหลักฐาน</div>
              <div className="thermal-barcode">
                <PosI.Barcode w={140} h={36} sw={1.4} />
                <div className="mono" style={{ fontSize: 9, letterSpacing: ".2em" }}>{receipt.id}</div>
              </div>
            </div>
          </div>
          <div className="thermal-tear bot"></div>
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn ghost"><PosI.Receipt w={14} h={14} /> ส่ง SMS / Email</button>
        <span className="spacer"></span>
        <button className="btn" onClick={onClose}>ปิด</button>
        <button className="btn primary" onClick={onClose}><PosI.Printer w={13} h={13} /> พิมพ์อีกฉบับ</button>
      </div>
    </Modal>
  );
}

window.POSView = POSView;

// components.jsx — Sidebar, Topbar, Chart, KPI cards, shared atoms.

const { useState, useEffect, useRef, useMemo } = React;
const I = window.Icons;

// ------------------------------- Sidebar -------------------------------
function Sidebar({ active, onNav, collapsed, onToggle, hidden = [], editing = false, onToggleHidden, onToggleEditing }) {
  const allGroups = [
    {
      label: "ภาพรวม",
      items: [
        { id: "dashboard", label: "แดชบอร์ด", icon: "Home" },
        { id: "reports", label: "รายงาน", icon: "Chart" },
      ],
    },
    {
      label: "หน้าร้าน",
      items: [
        { id: "pos", label: "POS Terminal", icon: "POS" },
      ],
    },
    {
      label: "การดำเนินงาน",
      items: [
        { id: "sales", label: "การขาย", icon: "Cart", badge: "24" },
        { id: "inventory", label: "สินค้าคงคลัง", icon: "Box", badge: "23", badgeWarn: true },
        { id: "receiving", label: "รับสินค้า", icon: "ClipboardCheck" },
        { id: "customers", label: "ลูกค้า", icon: "Users" },
        { id: "suppliers", label: "ผู้จำหน่าย", icon: "Truck" },
      ],
    },
    {
      label: "การเงิน",
      items: [
        { id: "billing", label: "การเรียกเก็บเงิน", icon: "Receipt" },
        { id: "wallet", label: "บัญชี", icon: "Wallet" },
      ],
    },
  ];
  const isHidden = (id) => hidden.includes(id);
  const groups = editing
    ? allGroups
    : allGroups.map((g) => ({ ...g, items: g.items.filter((it) => !isHidden(it.id)) })).filter((g) => g.items.length > 0);
  const visibleCount = allGroups.reduce((s, g) => s + g.items.filter((it) => !isHidden(it.id)).length, 0) + (isHidden("settings") ? 0 : 1);
  const totalCount = allGroups.reduce((s, g) => s + g.items.length, 0) + 1;
  return (
    <aside className={"sb" + (editing ? " is-editing" : "")}>
      <div className="sb-brand">
        <div className="sb-logo">อ</div>
        <div className="sb-brand-text">
          <div className="sb-brand-name">อรุณ</div>
          <div className="sb-brand-sub">retail · ERP</div>
        </div>
        <button className="sb-collapse-btn" onClick={onToggle}
                title={collapsed ? "ขยายเมนู" : "ย่อเมนู"}>
          {collapsed ? <I.ChevronRight w={15} h={15} /> : <I.Sidebar w={15} h={15} />}
        </button>
      </div>

      {editing && (
        <div className="sb-edit-banner">
          <div>
            <div className="sb-edit-title">จัดการเมนู</div>
            <div className="sb-edit-sub">ติ๊กเพื่อเปิด-ปิดเมนู ({visibleCount}/{totalCount})</div>
          </div>
          <button className="btn sm primary" onClick={onToggleEditing}>เสร็จ</button>
        </div>
      )}

      {groups.map((g) => (
        <React.Fragment key={g.label}>
          <div className="sb-section">{g.label}</div>
          <nav className="sb-nav">
            {g.items.map((it) => {
              const hide = isHidden(it.id);
              return (
                <a key={it.id}
                   className={"sb-item" + (active === it.id && !editing ? " is-active" : "") + (editing && hide ? " is-off" : "")}
                   onClick={() => editing ? onToggleHidden(it.id) : onNav(it.id)}>
                  {editing && (
                    <span className={"sb-check" + (!hide ? " on" : "")}>{!hide && <I.Check w={11} h={11} sw={3} />}</span>
                  )}
                  <span className="sb-icon">{React.createElement(I[it.icon], { w: 17, h: 17 })}</span>
                  <span className="sb-item-label">{it.label}</span>
                  {it.badge && !editing && <span className="sb-item-badge"
                    style={it.badgeWarn ? { color: "#b45309", borderColor: "#fcd34d", background: "#fffbeb" } : null}>{it.badge}</span>}
                </a>
              );
            })}
          </nav>
        </React.Fragment>
      ))}

      {(!isHidden("settings") || editing) && (
        <>
          <div className="sb-section">ระบบ</div>
          <nav className="sb-nav">
            <a className={"sb-item" + (active === "settings" && !editing ? " is-active" : "") + (editing && isHidden("settings") ? " is-off" : "")}
               onClick={() => editing ? onToggleHidden("settings") : onNav("settings")}>
              {editing && (
                <span className={"sb-check" + (!isHidden("settings") ? " on" : "")}>{!isHidden("settings") && <I.Check w={11} h={11} sw={3} />}</span>
              )}
              <span className="sb-icon"><I.Cog w={17} h={17} /></span>
              <span className="sb-item-label">ตั้งค่า</span>
            </a>
          </nav>
        </>
      )}

      <div className="sb-foot">
        {!editing ? (
          <>
            <button className="sb-edit-btn" onClick={onToggleEditing}>
              <I.Sliders w={14} h={14} /> <span>จัดการเมนู</span>
            </button>
            <div className="sb-user">
              <div className="sb-avatar">ปร</div>
              <div className="sb-user-text" style={{ minWidth: 0 }}>
                <div className="sb-user-name" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>ปริญญา ฉัตรชัย</div>
                <div className="sb-user-role">ผู้จัดการทั่วไป</div>
              </div>
            </div>
          </>
        ) : (
          <button className="sb-edit-btn ghost" onClick={() => onToggleHidden("__reset")}>
            คืนค่าเริ่มต้น (แสดงทั้งหมด)
          </button>
        )}
      </div>
    </aside>
  );
}

// ------------------------------- Topbar -------------------------------
function Topbar({ crumbs, onToggleSidebar }) {
  return (
    <header className="tb">
      <button className="tb-icon-btn" onClick={onToggleSidebar} title="ย่อ/ขยายเมนู">
        <I.Sidebar w={18} h={18} />
      </button>
      <div className="tb-crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <I.ChevronRight w={14} h={14} />}
            <span className={i === crumbs.length - 1 ? "now" : ""}>{c}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="tb-search">
        <I.Search w={15} h={15} />
        <input placeholder="ค้นหาออเดอร์ สินค้า ลูกค้า..." />
        <span className="tb-kbd">⌘K</span>
      </div>
      <button className="tb-icon-btn">
        <I.Bell w={18} h={18} />
        <span className="tb-dot"></span>
      </button>
      <button className="tb-icon-btn"><I.Calendar w={17} h={17} /></button>
      <div style={{ width: 1, height: 22, background: "var(--line)" }}></div>
      <button className="btn sm">
        <I.Plus w={14} h={14} /> สร้างใหม่
      </button>
    </header>
  );
}

// ------------------------------- Sparkline -------------------------------
function Sparkline({ data, color = "var(--accent)", w = 64, h = 24 }) {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const area = path + ` L ${w},${h} L 0,${h} Z`;
  const id = "spark-" + useMemo(() => Math.random().toString(36).slice(2, 7), []);
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ------------------------------- KPI Card -------------------------------
function KpiCard({ k }) {
  const dirIcon = k.dir === "up" ? <I.ArrowUp w={12} h={12} sw={2.2} /> : <I.ArrowDown w={12} h={12} sw={2.2} />;
  const cls = k.warn ? "down" : (k.dir === "up" ? "up" : "down");
  return (
    <div className="kpi">
      <div className="kpi-label">{k.label}</div>
      <div className="kpi-value tnum">
        {k.unit === "฿" && <span className="unit" style={{ marginRight: 4, marginLeft: 0 }}>฿</span>}
        {k.value}
        {k.unit !== "฿" && <span className="unit">{k.unit}</span>}
      </div>
      <div className="hstack" style={{ gap: 8 }}>
        <span className={"kpi-delta " + cls}>
          {dirIcon}{Math.abs(k.delta)}%
        </span>
        <span className="muted xs">เทียบเมื่อวาน</span>
      </div>
      <div className="kpi-spark">
        <Sparkline data={k.spark} color={k.warn ? "#d97706" : (k.dir === "up" ? "#10b981" : "#94a3b8")} w={64} h={24} />
      </div>
    </div>
  );
}

// ------------------------------- Sales Chart -------------------------------
function SalesChart({ data, prev, height = 240 }) {
  const W = 800, H = height, padL = 44, padR = 16, padT = 16, padB = 28;
  const all = [...data, ...prev];
  const max = Math.ceil(Math.max(...all) / 50) * 50 + 30;
  const min = 0;
  const range = max - min;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const x = (i) => padL + (i / (data.length - 1)) * innerW;
  const y = (v) => padT + innerH - ((v - min) / range) * innerH;

  const line = (arr) => arr.map((v, i) => (i === 0 ? "M" : "L") + x(i).toFixed(1) + "," + y(v).toFixed(1)).join(" ");
  const area = line(data) + ` L ${x(data.length - 1)},${padT + innerH} L ${padL},${padT + innerH} Z`;

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => min + (i / yTicks) * range);

  const xLabels = [0, 9, 19, 29].map((i) => ({ i, label: 30 - i + " วัน" }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sales-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity=".18" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* y grid */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)}
                stroke="#f1efee" strokeWidth="1" />
          <text x={padL - 8} y={y(t) + 3.5}
                fontSize="10.5" textAnchor="end" fill="#a8a29e"
                fontFamily="IBM Plex Mono, monospace">
            {t === 0 ? "0" : (t / 1000).toFixed(0) + "k"}
          </text>
        </g>
      ))}
      {/* prev (faint dashed) */}
      <path d={line(prev)} fill="none" stroke="#a8a29e" strokeWidth="1.2"
            strokeDasharray="3 3" strokeLinecap="round" strokeLinejoin="round" opacity=".7" />
      {/* current area + line */}
      <path d={area} fill="url(#sales-grad)" />
      <path d={line(data)} fill="none" stroke="#10b981" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" />
      {/* end dot */}
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="4"
              fill="#10b981" stroke="white" strokeWidth="2" />
      {/* x labels */}
      {xLabels.map((l, i) => (
        <text key={i} x={x(l.i)} y={H - 8}
              fontSize="10.5" textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"}
              fill="#a8a29e">{l.label}</text>
      ))}
    </svg>
  );
}

// ------------------------------- Modal -------------------------------
function Modal({ children, onClose, size }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={"modal " + (size || "")} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

Object.assign(window, { Sidebar, Topbar, Sparkline, KpiCard, SalesChart, Modal });

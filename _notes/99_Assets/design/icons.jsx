// icons.jsx — inline SVG icons. Stroke-based, 1.5px. Lucide-ish.

const Ic = ({ d, children, w = 18, h = 18, sw = 1.6 }) => (
  <svg width={w} height={h} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={sw}
       strokeLinecap="round" strokeLinejoin="round">
    {d ? <path d={d} /> : children}
  </svg>
);

const Icons = {
  Home: (p) => <Ic {...p}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></Ic>,
  Cart: (p) => <Ic {...p}><circle cx="9" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.5a2 2 0 0 0 2-1.5L20.5 8H6" /></Ic>,
  Box: (p) => <Ic {...p}><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" /></Ic>,
  Users: (p) => <Ic {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6" /><path d="M16 11a3.5 3.5 0 0 0 0-7" /><path d="M22 21c0-2.6-1.7-4.7-4-5.6" /></Ic>,
  Truck: (p) => <Ic {...p}><path d="M2 7h11v9H2z" /><path d="M13 10h5l3 3v3h-8" /><circle cx="6" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></Ic>,
  Chart: (p) => <Ic {...p}><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></Ic>,
  Cog: (p) => <Ic {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 14a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H10a1.7 1.7 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V10a1.7 1.7 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Ic>,
  Search: (p) => <Ic {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></Ic>,
  Bell: (p) => <Ic {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z" /><path d="M10 20a2 2 0 0 0 4 0" /></Ic>,
  Plus: (p) => <Ic {...p}><path d="M12 5v14M5 12h14" /></Ic>,
  ArrowUp: (p) => <Ic {...p}><path d="M7 14l5-5 5 5" /></Ic>,
  ArrowDown: (p) => <Ic {...p}><path d="M7 10l5 5 5-5" /></Ic>,
  ArrowRight: (p) => <Ic {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Ic>,
  ChevronRight: (p) => <Ic {...p}><path d="M9 6l6 6-6 6" /></Ic>,
  ChevronDown: (p) => <Ic {...p}><path d="M6 9l6 6 6-6" /></Ic>,
  Close: (p) => <Ic {...p}><path d="M6 6l12 12M18 6L6 18" /></Ic>,
  Filter: (p) => <Ic {...p}><path d="M3 5h18l-7 9v6l-4-2v-4z" /></Ic>,
  Download: (p) => <Ic {...p}><path d="M12 4v12m0 0l-4-4m4 4l4-4" /><path d="M4 20h16" /></Ic>,
  Calendar: (p) => <Ic {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></Ic>,
  Wallet: (p) => <Ic {...p}><path d="M3 7a2 2 0 0 1 2-2h13v4" /><path d="M3 7v11a2 2 0 0 0 2 2h15v-5" /><path d="M21 11h-5a2 2 0 0 0 0 4h5z" /></Ic>,
  Tag: (p) => <Ic {...p}><path d="M3 3h8l10 10-8 8L3 11z" /><circle cx="8" cy="8" r="1.5" /></Ic>,
  Receipt: (p) => <Ic {...p}><path d="M5 3v18l3-2 2 2 2-2 2 2 2-2 3 2V3z" /><path d="M9 8h6M9 12h6M9 16h4" /></Ic>,
  Shield: (p) => <Ic {...p}><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z" /></Ic>,
  Spark: (p) => <Ic {...p}><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></Ic>,
  Pkg: (p) => <Ic {...p}><path d="M21 8v8l-9 5-9-5V8l9-5z" /><path d="M3.3 8L12 13l8.7-5" /><path d="M12 13v8" /></Ic>,
  Store: (p) => <Ic {...p}><path d="M3 9l1.5-5h15L21 9" /><path d="M3 9v11h18V9" /><path d="M3 9c0 2 2 3 3 3s3-1 3-3c0 2 2 3 3 3s3-1 3-3c0 2 2 3 3 3s3-1 3-3" /></Ic>,
  More: (p) => <Ic {...p}><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></Ic>,
  Sidebar: (p) => <Ic {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></Ic>,
  Sliders: (p) => <Ic {...p}><path d="M4 6h7M14 6h6M4 12h3M10 12h10M4 18h11M18 18h2" /><circle cx="12.5" cy="6" r="1.8" /><circle cx="8.5" cy="12" r="1.8" /><circle cx="16.5" cy="18" r="1.8" /></Ic>,
  Star: (p) => <Ic {...p}><path d="M12 3l3 6 6 1-4.5 4.5L18 21l-6-3-6 3 1.5-6.5L3 10l6-1z" /></Ic>,
  Refresh: (p) => <Ic {...p}><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></Ic>,
  Eye: (p) => <Ic {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Ic>,
  ClipboardCheck: (p) => <Ic {...p}><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" /><path d="M9 13l2.2 2.2L15 11" /></Ic>,
  Trash: (p) => <Ic {...p}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></Ic>,
  Barcode: (p) => <Ic {...p}><path d="M4 5v14M7 5v14M10 5v14M13 5v14M16 5v14M19 5v14" /></Ic>,
  CreditCard: (p) => <Ic {...p}><rect x="2.5" y="5.5" width="19" height="13" rx="2" /><path d="M2.5 10h19M6 15h3" /></Ic>,
  Cash: (p) => <Ic {...p}><rect x="2.5" y="6" width="19" height="12" rx="1.5" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9v.01M18 15v.01" /></Ic>,
  QR: (p) => <Ic {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v3M14 20h7M17 17h4" /></Ic>,
  Printer: (p) => <Ic {...p}><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="9" rx="2" /><path d="M6 14h12v7H6z" /><circle cx="18" cy="12" r=".7" fill="currentColor" /></Ic>,
  Lock: (p) => <Ic {...p}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Ic>,
  Power: (p) => <Ic {...p}><path d="M12 3v9" /><path d="M5.6 7.4a8 8 0 1 0 12.8 0" /></Ic>,
  POS: (p) => <Ic {...p}><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 9h18M7 13h4M14 13h3M7 16h2" /></Ic>,
  Minus: (p) => <Ic {...p}><path d="M5 12h14" /></Ic>,
  Bolt: (p) => <Ic {...p}><path d="M13 3L4 14h7l-1 7 9-11h-7z" /></Ic>,
  Check: (p) => <Ic {...p}><path d="M5 12l5 5 9-11" /></Ic>,
  User: (p) => <Ic {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" /></Ic>,
};

window.Icons = Icons;

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { formatCurrency } from '@/lib/format';
import {
  ArrowLeft,
  MoreHorizontal,
  Search,
  ScanLine,
  ShoppingCart,
  X,
  Box,
  CheckCircle2,
  Printer,
  Mail,
  MessageSquare,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { OverridePinModal } from '@/components/auth/OverridePinModal';
import { get, post } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { PosPickingSlip, PosPickingSlipStatus } from '@/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const VAT_INCLUSIVE_RATE = 7 / 107;

const TIER_COLORS: Record<string, string> = {
  bronze: 'bg-stone-100 text-stone-600 border-stone-200',
  silver: 'bg-slate-100 text-slate-600 border-slate-200',
  gold: 'bg-amber-50 text-amber-700 border-amber-200',
  platinum: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface POSSession {
  id: string;
  session_number: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  shift_name: string;
  cashier_name: string;
  status: 'open' | 'closed';
  opened_at: string;
}

interface Product {
  id: string;
  sku: string;
  name_th: string;
  name_en: string;
  price: number;
  category: string;
  stock_qty: number;
  reorder_point: number;
  image_url: string | null;
}

interface CartItem {
  product_id: string;
  sku: string;
  name_th: string;
  price: number;
  qty: number;
  lockedAt: number; // timestamp
}

interface HeldCart {
  id: string;
  label: string;
  items: CartItem[];
  is_hybrid?: boolean;
  picking_slip_status?: PosPickingSlipStatus;
}

interface Member {
  id: string;
  phone: string;
  name: string;
  tier: string;
  points: number;
}

interface CompletedOrder {
  order_number: string;
  created_at: string;
  total: number;
  items: CartItem[];
  payment_method: string;
  cash_tendered: number | null;
  change: number;
}

type PaymentMethod = 'cash' | 'card' | 'mixed';
type MobileTab = 'products' | 'cart';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StockBadge({ product }: { product: Product }) {
  if (product.stock_qty <= 0)
    return (
      <span className="absolute top-1.5 right-1.5 text-[9px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none">
        หมด
      </span>
    );
  if (product.stock_qty <= product.reorder_point)
    return (
      <span className="absolute top-1.5 right-1.5 text-[9px] font-bold bg-amber-400 text-white rounded-full px-1.5 py-0.5 leading-none">
        สต็อกต่ำ
      </span>
    );
  return (
    <span className="absolute top-1.5 right-1.5 text-[9px] font-bold bg-white/80 border border-stone-200 text-stone-600 rounded-full px-1.5 py-0.5 leading-none font-mono tabular-nums">
      {product.stock_qty}
    </span>
  );
}

function productCardCls(product: Product) {
  if (product.stock_qty <= 0) return 'border-red-200 bg-red-50/30';
  if (product.stock_qty <= product.reorder_point) return 'border-amber-200 bg-amber-50/20';
  return 'border-stone-200 bg-white';
}

function productImgCls(product: Product) {
  if (product.stock_qty <= 0) return 'bg-red-100';
  if (product.stock_qty <= product.reorder_point) return 'bg-amber-100';
  return 'bg-stone-100';
}

// ─── Product card ─────────────────────────────────────────────────────────────

function ProductCard({ product, onAdd }: { product: Product; onAdd: (p: Product) => void }) {
  return (
    <button
      onClick={() => product.stock_qty > 0 && onAdd(product)}
      disabled={product.stock_qty <= 0}
      className={`relative rounded-xl border overflow-hidden text-left transition-all active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed ${productCardCls(product)}`}
    >
      <div className={`aspect-square flex items-center justify-center relative ${productImgCls(product)}`}>
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.name_th} className="w-full h-full object-cover" />
        ) : (
          <Box className="w-8 h-8 text-stone-300" />
        )}
        <StockBadge product={product} />
      </div>
      <div className="p-2">
        <p className="text-xs text-stone-800 font-medium line-clamp-2 leading-tight">{product.name_th}</p>
        <p className="text-emerald-600 font-bold text-[13px] mt-1">{formatCurrency(product.price)}</p>
        <p className="text-[10px] font-mono text-stone-400 tabular-nums">{product.sku}</p>
      </div>
    </button>
  );
}

// ─── Cart item row ────────────────────────────────────────────────────────────

function CartItemRow({
  item,
  onQtyChange,
  onRemove,
}: {
  item: CartItem;
  onQtyChange: (pid: string, qty: number) => void;
  onRemove: (pid: string) => void;
}) {
  const EXPIRE_MS = 15 * 60 * 1000;
  const elapsed = Date.now() - item.lockedAt;
  const remaining = Math.max(0, EXPIRE_MS - elapsed);
  const pct = (remaining / EXPIRE_MS) * 100;
  const barColor = remaining < 60000 ? 'bg-red-500' : remaining < 300000 ? 'bg-amber-400' : 'bg-emerald-500';

  return (
    <div className="py-3 px-4 space-y-2 relative overflow-hidden group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-stone-800 truncate">{item.name_th}</p>
          <p className="text-[10px] font-mono text-stone-400 tabular-nums">{item.sku}</p>
        </div>
        <button
          onClick={() => onRemove(item.product_id)}
          className="w-6 h-6 flex items-center justify-center text-stone-300 hover:text-red-500 transition-colors flex-shrink-0"
          aria-label="ลบ"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onQtyChange(item.product_id, item.qty - 1)}
            className="w-7 h-7 rounded-lg border border-stone-200 flex items-center justify-center text-stone-600 hover:bg-stone-100 font-bold text-sm"
          >
            −
          </button>
          <span className="w-8 text-center font-mono tabular-nums text-sm">{item.qty}</span>
          <button
            onClick={() => onQtyChange(item.product_id, item.qty + 1)}
            className="w-7 h-7 rounded-lg border border-stone-200 flex items-center justify-center text-stone-600 hover:bg-stone-100 font-bold text-sm"
          >
            +
          </button>
          <span className="ml-1 text-stone-400 text-[12px]">× {formatCurrency(item.price)}</span>
        </div>
        <span className="font-mono font-bold text-[15px] tabular-nums">{formatCurrency(item.price * item.qty)}</span>
      </div>
      {/* Timer bar */}
      <div className="absolute bottom-0 left-0 h-[2px] w-full bg-stone-100">
        <div 
          className={`h-full transition-all duration-1000 ${barColor}`} 
          style={{ width: `${pct}%` }} 
        />
      </div>
    </div>
  );
}

// ─── Receipt Modal ────────────────────────────────────────────────────────────

function ReceiptModal({
  order,
  onClose,
}: {
  order: CompletedOrder;
  onClose: () => void;
}) {
  return (
    <Modal open={!!order} onClose={onClose} title="การชำระเงินเสร็จสิ้น">
      <div className="flex flex-col items-center py-4">
        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-stone-900">ชำระเงินสำเร็จ</h3>
        <p className="text-sm text-stone-500 mt-1">เลขที่อ้างอิง: {order.order_number}</p>

        {/* Thermal Receipt Simulation */}
        <div className="w-full max-w-[300px] bg-white border border-stone-200 shadow-sm mt-8 p-6 font-mono text-[12px] leading-relaxed text-stone-800">
          <div className="text-center mb-4">
            <p className="font-bold text-[14px]">AKRA ERP POS</p>
            <p>สาขาสำนักงานใหญ่</p>
            <p>{new Date(order.created_at).toLocaleString('th-TH')}</p>
          </div>

          <div className="border-t border-dashed border-stone-300 my-3" />

          <div className="space-y-1.5">
            {order.items.map((i, idx) => (
              <div key={idx} className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <p>{i.name_th}</p>
                  <p className="text-stone-400">{i.qty} x {formatCurrency(i.price)}</p>
                </div>
                <p className="font-bold">{formatCurrency(i.price * i.qty)}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-stone-300 my-3" />

          <div className="space-y-1">
            <div className="flex justify-between">
              <span>ยอดรวม (Total)</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
            <div className="flex justify-between font-bold text-[13px] pt-1">
              <span>ยอดสุทธิ (Net)</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-stone-300 my-3" />

          <div className="space-y-1">
            <div className="flex justify-between">
              <span>ชำระด้วย ({order.payment_method.toUpperCase()})</span>
              <span>{formatCurrency(order.cash_tendered || order.total)}</span>
            </div>
            {order.cash_tendered !== null && (
              <div className="flex justify-between">
                <span>เงินทอน (Change)</span>
                <span>{formatCurrency(order.change)}</span>
              </div>
            )}
          </div>

          <div className="text-center mt-6 pt-4 border-t border-stone-100">
            <p>ขอบคุณที่ใช้บริการ</p>
            <p className="text-[10px] text-stone-400 mt-1 uppercase">Powered by AKRA ERP</p>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 w-full mt-8">
          <Button variant="outline" className="flex items-center gap-2">
            <Printer className="w-4 h-4" /> พิมพ์บิล
          </Button>
          <Button variant="outline" className="flex items-center gap-2" disabled>
            <Mail className="w-4 h-4" /> อีเมล
          </Button>
          <Button variant="outline" className="flex items-center gap-2 col-span-2" disabled>
            <MessageSquare className="w-4 h-4" /> ส่ง SMS (เร็วๆ นี้)
          </Button>
          <Button className="col-span-2 mt-2" onClick={onClose}>
            ปิดหน้าต่าง
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function POSSessionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const toast = useToast();

  const [session, setSession] = useState<POSSession | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [isHybrid, setIsHybrid] = useState(false);
  const [currentHeldCartId, setCurrentHeldCartId] = useState<string | null>(null);

  const [member, setMember] = useState<Member | null>(null);
  const [memberPhone, setMemberPhone] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashTendered, setCashTendered] = useState(0);
  const [checkingOut, setCheckingOut] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<CompletedOrder | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));
  const [timerTick, setTimerTick] = useState(0);
  const [mobileTab, setMobileTab] = useState<MobileTab>('products');
  const [desktopTab, setDesktopTab] = useState<'products' | 'history'>('products');
  const searchRef = useRef<HTMLInputElement>(null);

  const [overrideToken, setOverrideToken] = useState<string | null>(null);
  const [overrideReasonCode, setOverrideReasonCode] = useState<string | null>(null);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);

  // ── Keyboard Shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Clock ──
  useEffect(() => {
    const iv = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));
      setTimerTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const fetchHeldCarts = useCallback(async () => {
    try {
      const res = await get<HeldCart[]>(`/api/pos/held-carts?session_id=${sessionId}`);
      setHeldCarts(res.map(hc => ({
        id: hc.id,
        label: hc.label || 'Held Cart',
        items: [],
        is_hybrid: hc.is_hybrid,
        picking_slip_status: hc.picking_slip_status
      })));
    } catch { /* silent */ }
  }, [sessionId]);

  // ── Load session + products ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const sessionRes = await fetch(`/api/pos/sessions/${sessionId}`);
      let warehouseId = '';
      if (sessionRes.ok) {
        const sj = await sessionRes.json();
        const sessionData = sj.data ?? sj;
        setSession(sessionData);
        warehouseId = sessionData.warehouse_id;
      }

      if (warehouseId) {
        const productsRes = await fetch(`/api/pos/products?warehouse_id=${warehouseId}`);
        if (productsRes.ok) {
          const pj = await productsRes.json();
          const rawProds = pj.data ?? pj;
          interface ApiProduct {
            id: string;
            sku: string;
            barcode?: string;
            name_th: string;
            name_en: string;
            selling_price?: string | number;
            price?: number;
            qty_available?: string | number;
            stock_qty?: number;
            reorder_point?: string | number;
            image_url: string | null;
            category?: string;
          }
          const prods: Product[] = rawProds.map((p: ApiProduct) => ({
            id: p.id,
            sku: p.sku,
            name_th: p.name_th,
            name_en: p.name_en,
            price: Number(p.selling_price || p.price || 0),
            category: p.category || '',
            stock_qty: Number(p.qty_available || p.stock_qty || 0),
            reorder_point: Number(p.reorder_point || 0),
            image_url: p.image_url || null,
          }));
          setProducts(prods);
          const cats = Array.from(new Set(prods.map((p) => p.category).filter(Boolean)));
          setCategories(cats);
        }
      }
      await fetchHeldCarts();
    } catch {
      // silent fail — page still renders
    } finally {
      setLoading(false);
    }
  }, [sessionId, fetchHeldCarts]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Cart helpers ──
  const cartTotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const subtotal = cartTotal;
  const discountAmt = discount;
  const afterDiscount = Math.max(0, subtotal - discountAmt);
  const vatAmt = afterDiscount * VAT_INCLUSIVE_RATE;
  const preVat = afterDiscount - vatAmt;
  const total = afterDiscount;
  const change = Math.max(0, cashTendered - total);
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);

  function addToCart(product: Product) {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) return prev.map((i) => i.product_id === product.id ? { ...i, qty: i.qty + 1, lockedAt: Date.now() } : i);
      return [...prev, { product_id: product.id, sku: product.sku, name_th: product.name_th, price: product.price, qty: 1, lockedAt: Date.now() }];
    });

    if (member?.id) {
      get<{ history: { unit_price: number; invoice_no: string; sold_at: string } | null }>(
        `/api/pos/price-history?customer_id=${member.id}&product_id=${product.id}`
      ).then((res) => {
        if (res?.history) {
          const dateStr = new Date(res.history.sold_at).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
          toast(
            'info',
            `ลูกค้ารายนี้ซื้อล่าสุด: ${formatCurrency(res.history.unit_price)} เมื่อ ${dateStr} (${res.history.invoice_no})`
          );
        }
      }).catch((err) => {
        console.error('Failed to fetch product price history:', err);
      });
    }
  }

  function changeQty(pid: string, qty: number) {
    if (qty <= 0) removeItem(pid);
    else setCartItems((prev) => prev.map((i) => i.product_id === pid ? { ...i, qty } : i));
  }

  function removeItem(pid: string) {
    setCartItems((prev) => prev.filter((i) => i.product_id !== pid));
  }

  async function holdCart() {
    if (cartItems.length === 0) return;
    try {
      await post('/api/pos/held-carts', {
        session_id: sessionId,
        warehouse_id: session?.warehouse_id,
        lines: cartItems.map(i => ({
          product_id: i.product_id,
          qty: i.qty,
          unit_price: i.price,
          discount_amount: 0,
        }))
      });
      setCartItems([]);
      setCurrentHeldCartId(null);
      setIsHybrid(false);
      fetchHeldCarts();
    } catch (err: unknown) {
      console.error('Hold cart error:', err);
      alert('พักบิลไม่สำเร็จ');
    }
  }

  async function restoreHeld(hc: HeldCart) {
    if (cartItems.length > 0) {
      // Prompt or auto-hold
      if (!confirm('สลับบิล? บิลปัจจุบันจะถูกพักไว้')) return;
      await holdCart();
    }
    
    setLoading(true);
    try {
      const res = await get<{ lines: { product_id: string; sku: string; name_th: string; unit_price: number | string; qty: number | string; }[]; is_hybrid: boolean }>(`/api/pos/held-carts/${hc.id}`);
      setCartItems(res.lines.map((l) => ({
        product_id: l.product_id,
        sku: l.sku,
        name_th: l.name_th,
        price: Number(l.unit_price),
        qty: Number(l.qty),
        lockedAt: Date.now()
      })));
      setCurrentHeldCartId(hc.id);
      setIsHybrid(res.is_hybrid ?? false);
      
      // Remove from list while active
      setHeldCarts(prev => prev.filter(h => h.id !== hc.id));
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'status' in err && err.status === 409) {
        alert('ใบหยิบสินค้ายังหยิบไม่เสร็จ (Picking in progress)');
      } else {
        alert('โหลดข้อมูลบิลไม่สำเร็จ');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePrintPickingSlip() {
    if (cartItems.length === 0) return;
    setCheckingOut(true);
    try {
      // 1. Hold cart if not already held
      let heldId = currentHeldCartId;
      if (!heldId) {
        const hcRes = await post<{ id: string }>('/api/pos/held-carts', {
          session_id: sessionId,
          warehouse_id: session?.warehouse_id,
          lines: cartItems.map(i => ({
            product_id: i.product_id,
            qty: i.qty,
            unit_price: i.price,
            discount_amount: 0,
          }))
        });
        heldId = hcRes.id;
        setCurrentHeldCartId(heldId);
      }

      // 2. Create picking slip (W2)
      const whs = await get<{ id: string; code: string }[]>('/api/admin/warehouses');
      const w2 = whs.find(w => w.code.includes('W2')) || whs[0];

      const res = await post<{ slip: PosPickingSlip }>(`/api/pos/carts/${heldId}/picking-slip`, {
        source_warehouse_id: w2.id
      });
      
      alert(`ออกใบหยิบสินค้าสำเร็จ: ${res.slip.doc_no}\nกรุณาส่งใบนี้ให้แผนกคลังสินค้า`);
      
      // Clear cart
      setCartItems([]);
      setCurrentHeldCartId(null);
      setIsHybrid(false);
      fetchHeldCarts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to print picking slip');
    } finally {
      setCheckingOut(false);
    }
  }

  // ── Member search ──
  async function searchMember() {
    if (!memberPhone.trim()) return;
    try {
      const res = await fetch(`/api/pos/members?q=${encodeURIComponent(memberPhone)}`);
      if (res.ok) {
        const j = await res.json();
        const membersList = j.data?.data;
        if (Array.isArray(membersList) && membersList.length > 0) {
          const m = membersList[0];
          setMember({
            id: m.id,
            phone: m.phone,
            name: m.name_th,
            tier: m.tier,
            points: m.point_balance,
          });
        } else {
          setMember(null);
          toast('error', 'ไม่พบสมาชิกเบอร์นี้ / Member not found');
        }
      } else {
        toast('error', 'เกิดข้อผิดพลาดในการค้นหา / Search error');
      }
    } catch (err) {
      console.error(err);
      toast('error', 'เกิดข้อผิดพลาดในการค้นหา / Search error');
    }
  }

  // ── Checkout ──
  async function handleCheckout(overrideTok?: string, overrideReason?: string) {
    if (cartItems.length === 0 || checkingOut) return;
    setCheckingOut(true);
    try {
      const tok = overrideTok || overrideToken || undefined;
      const reason = overrideReason || overrideReasonCode || undefined;
      const body = {
        session_id: sessionId,
        lines: cartItems.map(i => ({
          product_id: i.product_id,
          qty: i.qty,
          unit_price: i.price,
          discount_amount: 0,
        })),
        discount_amount: discountAmt,
        payment_method: paymentMethod,
        cash_tendered: paymentMethod === 'cash' || paymentMethod === 'mixed' ? cashTendered : null,
        member_id: member?.id ?? null,
        override_token: tok,
        reason_code: reason,
      };
      const res = await fetch('/api/pos/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      
      if (res.status === 409) {
        const j = await res.json();
        if (j.details?.code === 'MIN_PRICE_VIOLATION') {
          setCheckingOut(false);
          setIsOverrideModalOpen(true);
          return;
        }
        throw new Error(j.error || 'Checkout failed');
      }

      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || 'Checkout failed');
      }
      
      const order = await res.json();
      setCompletedOrder({
        order_number: order.receipt_number || 'POS-' + Date.now().toString().slice(-6),
        created_at: new Date().toISOString(),
        total,
        items: [...cartItems],
        payment_method: paymentMethod,
        cash_tendered: paymentMethod === 'cash' || paymentMethod === 'mixed' ? cashTendered : null,
        change,
      });

      setCartItems([]);
      setDiscount(0);
      setCashTendered(0);
      setMember(null);
      setMemberPhone('');
      setOverrideToken(null);
      setOverrideReasonCode(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Checkout failed';
      alert(msg);
    } finally {
      setCheckingOut(false);
    }
  }

  // ── Close session ──
  async function handleCloseSession() {
    try {
      await fetch(`/api/pos/sessions/${sessionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'close' }) });
      router.push('/app/pos');
    } catch { /* silent */ }
  }

  // ── Auto-remove expired cart items ──
  useEffect(() => {
    const now = Date.now();
    const EXPIRE_MS = 15 * 60 * 1000;
    setCartItems((prev) => {
      const filtered = prev.filter((i) => now - i.lockedAt < EXPIRE_MS);
      if (filtered.length !== prev.length) return filtered;
      return prev;
    });
  }, [timerTick]);

  // ── Filtered products ──
  const filteredProducts = products.filter((p) => {
    const matchCat = !activeCategory || p.category === activeCategory;
    const q = searchQuery.toLowerCase();
    const matchQ = !q || p.name_th.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stone-50">
        <LoadingSpinner />
      </div>
    );
  }

  // ════════════════════════════════════════
  // SHARED: Products panel content
  // ════════════════════════════════════════
  const ProductsContent = (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาสินค้า..."
            className="w-full h-11 pl-9 pr-14 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
          <kbd className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-0.5 text-[10px] font-mono text-stone-400 border border-stone-200 rounded px-1 py-0.5">
            F2
          </kbd>
        </div>
        <button className="hidden md:flex w-11 h-11 items-center justify-center bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex-shrink-0">
          <ScanLine className="w-4.5 h-4.5" />
        </button>
        {/* Mobile scan button */}
        <button className="flex md:hidden w-11 h-11 items-center justify-center bg-stone-950 text-white rounded-lg flex-shrink-0">
          <ScanLine className="w-4 h-4" />
        </button>
      </div>

      {/* Category chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 flex-shrink-0">
        <button
          onClick={() => setActiveCategory('')}
          className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap flex-shrink-0 ${
            activeCategory === '' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-stone-100 text-stone-600'
          }`}
        >
          ทั้งหมด
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap flex-shrink-0 ${
              activeCategory === cat ? 'bg-emerald-600 text-white shadow-sm' : 'bg-stone-100 text-stone-600'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product grid — 4 cols desktop, 2 cols mobile */}
      <div className="overflow-y-auto flex-1">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
          {filteredProducts.map((p) => (
            <ProductCard key={p.id} product={p} onAdd={addToCart} />
          ))}
        </div>
        {filteredProducts.length === 0 && (
          <div className="text-center py-12 text-stone-400 text-sm">ไม่พบสินค้า</div>
        )}
      </div>
    </div>
  );

  // ════════════════════════════════════════
  // SHARED: Cart panel content
  // ════════════════════════════════════════
  const CartContent = (
    <div className="flex flex-col h-full">
      {/* Cart header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-stone-800">รายการสินค้า / Cart</span>
          {cartCount > 0 && (
            <span className="bg-stone-100 text-stone-600 text-xs px-1.5 py-0.5 rounded-full font-mono tabular-nums">{cartCount}</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsHybrid(!isHybrid)}
            className={`text-[11px] font-bold px-2 py-1.5 rounded-lg border transition-colors ${
              isHybrid ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-stone-500 border-stone-200'
            }`}
          >
            {isHybrid ? '📦 Hybrid ON' : 'Hybrid?'}
          </button>
          <button
            onClick={holdCart}
            disabled={cartItems.length === 0}
            className="flex items-center gap-1 text-[12px] font-semibold text-amber-700 border border-amber-300 bg-amber-50 rounded-lg px-2.5 py-1.5 hover:bg-amber-100 disabled:opacity-40"
          >
            ⏸ พักบิล
          </button>
        </div>
      </div>

      {/* Cart items */}
      <div className="overflow-y-auto flex-1 divide-y divide-stone-50">
        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-stone-300">
            <ShoppingCart className="w-8 h-8 mb-2" />
            <p className="text-sm">ตะกร้าว่าง</p>
          </div>
        ) : (
          cartItems.map((item) => (
            <CartItemRow key={item.product_id} item={item} onQtyChange={changeQty} onRemove={removeItem} />
          ))
        )}
      </div>

      {/* Held cart chips */}
      {heldCarts.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto py-2 border-t border-stone-100 flex-shrink-0">
          {heldCarts.map((hc) => (
            <button
              key={hc.id}
              onClick={() => restoreHeld(hc)}
              className={`text-[11px] font-bold border rounded-full px-2.5 py-1 whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 ${
                hc.is_hybrid 
                  ? hc.picking_slip_status === 'picked' ? 'text-emerald-700 border-emerald-300 bg-emerald-50' : 'text-indigo-700 border-indigo-300 bg-indigo-50'
                  : 'text-amber-700 border-amber-300 bg-amber-50'
              }`}
            >
              {hc.is_hybrid && <Box className="w-3 h-3" />}
              {hc.label} {hc.is_hybrid && `(${hc.picking_slip_status === 'picked' ? 'หยิบแล้ว' : 'รอหยิบ'})`}
            </button>
          ))}
        </div>
      )}

      {/* Summary muted */}
      {cartItems.length > 0 && (
        <div className="space-y-2 mt-2">
          {isHybrid && (
            <Button 
              onClick={handlePrintPickingSlip} 
              variant="outline" 
              className="w-full text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 h-10 flex items-center justify-center gap-2"
              loading={checkingOut}
            >
              <Printer className="w-4 h-4" /> พิมพ์ใบหยิบสินค้า (W2)
            </Button>
          )}
          <div className="text-right text-[11px] text-stone-400 py-1 border-t border-stone-50 flex-shrink-0">
            {cartCount} ชิ้น · {formatCurrency(subtotal)}
          </div>
        </div>
      )}
    </div>
  );

  // ════════════════════════════════════════════════════════════════
  // DESKTOP LAYOUT (≥ md)
  // ════════════════════════════════════════════════════════════════
  return (
    <>
      {completedOrder && (
        <ReceiptModal order={completedOrder} onClose={() => setCompletedOrder(null)} />
      )}
      {/* ═══ MOBILE (< md) ═══════════════════════════════════════════ */}
      <div className="flex flex-col h-screen bg-stone-50 md:hidden">

        {/* Mobile Header */}
        <div className="flex items-center px-4 pt-4 pb-3 bg-white border-b border-stone-100 flex-shrink-0">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100 -ml-1"
            aria-label="ย้อนกลับ"
          >
            <ArrowLeft className="w-5 h-5 text-stone-700" />
          </button>
          <div className="flex-1 text-center">
            <p className="text-[15px] font-semibold text-stone-900 leading-tight">POS Terminal</p>
            <p className="text-[12px] text-stone-400 leading-tight mt-0.5">
              {session?.session_number ?? '—'} · {session?.shift_name ?? '—'}
            </p>
          </div>
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100" aria-label="เมนู">
            <MoreHorizontal className="w-5 h-5 text-stone-700" />
          </button>
        </div>

        {/* Mobile Tabs */}
        <div className="flex border-b border-stone-200 bg-white flex-shrink-0">
          <button
            onClick={() => setMobileTab('products')}
            className={`flex-1 py-2.5 text-[13px] font-semibold transition-colors ${
              mobileTab === 'products'
                ? 'border-b-2 border-stone-950 text-stone-950 -mb-px'
                : 'text-stone-400 border-b-2 border-transparent'
            }`}
          >
            สินค้า
          </button>
          <button
            onClick={() => setMobileTab('cart')}
            className={`flex-1 py-2.5 text-[13px] font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              mobileTab === 'cart'
                ? 'border-b-2 border-stone-950 text-stone-950 -mb-px'
                : 'text-stone-400 border-b-2 border-transparent'
            }`}
          >
            ตะกร้า
            {cartCount > 0 && (
              <span className="bg-emerald-600 text-white rounded-full text-xs px-1.5 py-0.5 font-mono leading-none">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {/* Mobile content */}
        <div className="flex-1 overflow-hidden px-4 pt-3 pb-24">
          {mobileTab === 'products' ? ProductsContent : CartContent}
        </div>

        {/* Mobile Sticky Bottom */}
        <div className="fixed bottom-0 inset-x-0 p-3 bg-white border-t border-stone-200 z-40">
          <button
            onClick={() => {
              if (mobileTab === 'products') setMobileTab('cart');
              else handleCheckout();
            }}
            disabled={cartItems.length === 0}
            className="w-full h-14 bg-emerald-600 text-white rounded-xl flex items-center justify-between px-5 disabled:opacity-50 hover:bg-emerald-700 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="bg-white/20 rounded-full text-xs px-1.5 py-0.5 font-mono">{cartCount}</span>
              )}
              <span className="text-[14px] font-semibold">
                {mobileTab === 'products' ? 'ดูตะกร้า · ชำระเงิน' : 'ชำระเงิน'}
              </span>
            </div>
            <span className="font-mono font-bold text-lg tabular-nums">{formatCurrency(total)}</span>
          </button>
        </div>
      </div>

      {/* ═══ DESKTOP (≥ md) ═══════════════════════════════════════════ */}
      <div className="hidden md:flex flex-col h-screen bg-stone-50 p-4 gap-4 overflow-hidden">

        {/* 1. Status bar */}
        <div className="bg-white border border-stone-200 rounded-[10px] shadow-sm p-3 px-5 flex items-center gap-4 flex-shrink-0">
          {/* Session */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[12px] text-stone-500">รอบการขาย</span>
            <span className="font-mono font-bold text-[13px] tabular-nums text-stone-900">{session?.session_number ?? '—'}</span>
            <span className="text-[10px] font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-full px-1.5 py-0.5">
              OPEN
            </span>
          </div>
          <div className="h-4 w-px bg-stone-200 flex-shrink-0" />
          {/* Warehouse */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[12px] text-stone-500">คลัง</span>
            <span className="font-mono text-[12px] text-stone-700 font-semibold">{session?.warehouse_code ?? '—'}</span>
          </div>
          <div className="h-4 w-px bg-stone-200 flex-shrink-0" />
          {/* Shift */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[12px] text-stone-500">กะ/SHIFT</span>
            <span className="text-[13px] font-bold text-emerald-700">{session?.shift_name ?? '—'}</span>
          </div>
          <div className="h-4 w-px bg-stone-200 flex-shrink-0" />
          {/* Cashier */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[12px] text-stone-500">แคชเชียร์</span>
            <span className="text-[13px] text-stone-700">{session?.cashier_name ?? '—'}</span>
          </div>
          <div className="h-4 w-px bg-stone-200 flex-shrink-0" />
          {/* Time */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="font-mono text-[13px] text-stone-700 tabular-nums">{currentTime}</span>
          </div>
          {/* Spacer */}
          <div className="flex-1" />
          {/* Close session */}
          <button
            onClick={handleCloseSession}
            className="text-red-600 border border-stone-200 rounded-md px-3 py-1 text-sm flex-shrink-0 hover:bg-red-50"
          >
            ปิดรอบ / Close
          </button>
        </div>

        {/* 2. Body */}
        <div className="flex flex-1 gap-4 overflow-hidden">

          {/* ── Products col (flex-[3]) ── */}
          <div className="flex-[3] flex flex-col bg-white border border-stone-200 rounded-[10px] shadow-sm p-4 overflow-hidden">

            {/* Tab strip */}
            <div className="flex items-center border-b border-stone-200 mb-3 flex-shrink-0">
              {(['products', 'history'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setDesktopTab(t)}
                  className={`px-3 py-2 text-[13px] font-medium transition-colors ${
                    desktopTab === t
                      ? 'border-b-2 border-stone-950 text-stone-950 -mb-px'
                      : 'text-stone-400 border-b-2 border-transparent hover:text-stone-600'
                  }`}
                >
                  {t === 'products' ? 'สินค้า' : 'ประวัติ'}
                </button>
              ))}
              {heldCarts.length > 0 && (
                <span className="ml-auto text-[11px] font-bold text-amber-700 border border-amber-300 bg-amber-50 rounded-full px-2 py-0.5">
                  บิลที่พัก: {heldCarts.length}
                </span>
              )}
            </div>

            {desktopTab === 'products' ? ProductsContent : (
              <div className="flex items-center justify-center h-full text-stone-400 text-sm">ประวัติการขาย</div>
            )}
          </div>

          {/* ── Cart col (flex-[2]) ── */}
          <div className="flex-[2] flex flex-col bg-white border border-stone-200 rounded-[10px] shadow-sm p-4 overflow-hidden">
            {CartContent}
          </div>

          {/* ── Right panel (flex-[2]) ── */}
          <div className="flex-[2] flex flex-col space-y-4 overflow-y-auto">

            {/* Totals card */}
            <div className="bg-white border border-stone-200 rounded-[10px] shadow-sm p-4 space-y-2.5 flex-shrink-0">
              <div className="flex justify-between text-sm text-stone-700">
                <span>ยอดรวม</span>
                <span className="font-mono tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-stone-700 items-center">
                <span>ส่วนลด</span>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                  className="w-24 text-right font-mono tabular-nums border border-stone-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                  min={0}
                />
              </div>
              <hr className="border-stone-100" />
              <div className="flex justify-between text-sm text-stone-400">
                <span>ก่อน VAT</span>
                <span className="font-mono tabular-nums">{formatCurrency(preVat)}</span>
              </div>
              <div className="flex justify-between text-sm text-stone-400">
                <span>VAT 7%</span>
                <span className="font-mono tabular-nums">{formatCurrency(vatAmt)}</span>
              </div>
              <hr className="border-stone-100" />
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-semibold text-stone-700">ยอดสุทธิ</span>
                <span className="text-emerald-600 text-3xl font-black font-mono tabular-nums">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Member card */}
            <div className="bg-white border border-stone-200 rounded-[10px] shadow-sm p-4 flex-shrink-0">
              <p className="text-[12px] font-semibold text-stone-500 mb-2 uppercase tracking-wide">สมาชิก</p>
              {member ? (
                <div className={`flex items-center justify-between border rounded-lg px-3 py-2 ${TIER_COLORS[member.tier.toLowerCase()] ?? 'bg-emerald-50 text-emerald-900 border-emerald-200'}`}>
                  <div>
                    <p className="text-[13px] font-semibold">{member.name}</p>
                    <p className="text-[11px] font-mono opacity-80">{member.tier.toUpperCase()} · {member.points} pts</p>
                  </div>
                  <button onClick={() => setMember(null)} className="opacity-40 hover:opacity-100">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={memberPhone}
                    onChange={(e) => setMemberPhone(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchMember()}
                    placeholder="เบอร์โทร"
                    className="flex-1 h-9 px-3 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 font-mono"
                  />
                  <button
                    onClick={searchMember}
                    className="h-9 px-3 bg-stone-950 text-white rounded-lg text-sm hover:bg-stone-800"
                  >
                    ค้นหา
                  </button>
                </div>
              )}
            </div>

            {/* Payment card */}
            <div className="bg-white border border-stone-200 rounded-[10px] shadow-sm p-4 flex flex-col gap-3 flex-shrink-0">
              <p className="text-[12px] font-semibold text-stone-500 uppercase tracking-wide">ชำระเงิน</p>

              {/* Payment method grid */}
              <div className="grid grid-cols-3 gap-2">
                {(['cash', 'card', 'mixed'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2 rounded-lg text-[12px] font-semibold border transition-colors ${
                      paymentMethod === m
                        ? 'border-emerald-500 border-2 bg-emerald-50 text-emerald-700'
                        : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {m === 'cash' ? 'เงินสด' : m === 'card' ? 'บัตร' : 'ผสม'}
                  </button>
                ))}
              </div>

              {/* Cash tendered */}
              {(paymentMethod === 'cash' || paymentMethod === 'mixed') && (
                <>
                  <input
                    type="number"
                    value={cashTendered || ''}
                    onChange={(e) => setCashTendered(Number(e.target.value))}
                    placeholder="จำนวนเงินที่รับ"
                    className="w-full h-12 text-right font-mono tabular-nums text-2xl border border-stone-200 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    min={0}
                  />

                  {/* Quick amounts */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[20, 100, 500, 1000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setCashTendered((prev) => prev + amt)}
                        className="py-1.5 border border-stone-200 rounded-lg text-[12px] font-mono font-bold text-stone-700 hover:bg-stone-50"
                      >
                        {amt}
                      </button>
                    ))}
                  </div>

                  {/* Change */}
                  {cashTendered >= total && total > 0 && (
                    <div className="bg-amber-50 rounded-lg px-4 py-3 flex justify-between items-center">
                      <span className="text-[12px] text-amber-700 font-medium">เงินทอน</span>
                      <span className="text-amber-800 font-mono font-black text-2xl tabular-nums">{formatCurrency(change)}</span>
                    </div>
                  )}
                </>
              )}

              {/* Checkout */}
              <button
                onClick={() => handleCheckout()}
                disabled={cartItems.length === 0 || checkingOut}
                className="w-full py-3.5 rounded-xl text-base font-semibold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkingOut ? 'กำลังประมวลผล...' : `ชำระเงิน ${formatCurrency(total)}`}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <OverridePinModal
        isOpen={isOverrideModalOpen}
        action="min_price_override"
        onSuccess={(token, reasonCode) => {
          setIsOverrideModalOpen(false);
          setOverrideToken(token);
          setOverrideReasonCode(reasonCode);
          handleCheckout(token, reasonCode);
        }}
        onClose={() => setIsOverrideModalOpen(false)}
      />
    </>
  );
}

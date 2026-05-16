'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { get, post, patch, del } from '@/lib/api-client';
import { formatCurrency, formatQty } from '@/lib/format';
import { VAT_RATE } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { PosSession, PosProduct, PosTransaction, PosPaymentMethod, ProductCategory, PosMember, PosHeldCart, SessionUser } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

interface CartItem extends PosProduct {
  qty: number;
}

export default function PosTerminalPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { data: authSession } = useSession();
  const currentUser = authSession?.user as unknown as SessionUser;

  const [session, setSession] = useState<PosSession | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Product grid state
  const [allProducts, setAllProducts] = useState<PosProduct[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderDiscount, setOrderDiscount] = useState(0);

  // Member state
  const [member, setMember] = useState<PosMember | null>(null);
  const [memberPhone, setMemberPhone] = useState('');
  const [searchingMember, setSearchingMember] = useState(false);

  // Held carts state
  const [heldCarts, setHeldCarts] = useState<PosHeldCart[]>([]);
  const [loadingHeld, setLoadingHeld] = useState(false);

  // Tabs state
  const [activeTab, setActiveTab] = useState<'products' | 'history'>('products');
  const [sessionTransactions, setSessionTransactions] = useState<PosTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Scanner state
  const [scannerFlash, setScannerFlash] = useState(false);
  const barcodeBuffer = useRef<string>('');
  const lastKeystrokeTime = useRef<number>(0);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [cardAmount, setCardAmount] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Receipt modal state
  const [lastTransaction, setLastTransaction] = useState<PosTransaction | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Close session modal
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [closingFloat, setClosingFloat] = useState('');
  const [closing, setClosing] = useState(false);

  const fetchSession = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<PosSession>(`/api/pos/sessions/${id}`);
      if (res.status === 'closed') {
        router.push('/app/pos');
        return;
      }
      setSession(res);
    } catch (error) {
      console.error('Failed to fetch session:', error);
      router.push('/app/pos');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const fetchProducts = useCallback(async () => {
    if (!session) return;
    try {
      const results = await get<PosProduct[]>(`/api/pos/products?warehouse_id=${session.warehouse_id}&limit=100`);
      setAllProducts(results);
    } catch {
      // Ignore
    }
  }, [session]);

  const fetchCategories = useCallback(async () => {
    try {
      const results = await get<ProductCategory[]>('/api/product-categories');
      setCategories(results);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  }, []);

  const fetchHeldCarts = useCallback(async () => {
    if (!session) return;
    setLoadingHeld(true);
    try {
      const res = await get<PosHeldCart[]>(`/api/pos/held-carts?session_id=${id}`);
      setHeldCarts(res);
    } catch (error) {
      console.error('Failed to fetch held carts:', error);
    } finally {
      setLoadingHeld(false);
    }
  }, [id, session]);

  const fetchSessionTransactions = useCallback(async () => {
    if (!session) return;
    setLoadingHistory(true);
    try {
      const res = await get<{ data: PosTransaction[] }>(`/api/pos/transactions?session_id=${id}`);
      setSessionTransactions(res.data);
    } catch (error) {
      console.error('Failed to fetch session history:', error);
    } finally {
      setLoadingHistory(false);
    }
  }, [id, session]);

  useEffect(() => {
    fetchSession();
    fetchCategories();
    // Focus search input on mount
    searchInputRef.current?.focus();
  }, [fetchSession, fetchCategories]);

  useEffect(() => {
    if (session) {
      fetchProducts();
      fetchHeldCarts();
    }
  }, [session, fetchProducts, fetchHeldCarts]);

  useEffect(() => {
    if (activeTab === 'history' && session) {
      fetchSessionTransactions();
      const interval = setInterval(fetchSessionTransactions, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab, session, fetchSessionTransactions]);

  async function handleVoidTransaction(txnId: string) {
    const reason = prompt('ระบุเหตุผลการยกเลิก / Void Reason:');
    if (!reason) return;
    
    try {
      await patch(`/api/pos/transactions/${txnId}`, {
        action: 'void',
        void_reason: reason
      });
      fetchSessionTransactions();
      fetchProducts(); // Refresh stock
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Void failed');
    }
  }

  // Scanner Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is in an input or textarea, unless it's the search input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        if (target !== searchInputRef.current) return;
      }

      const now = Date.now();
      const diff = now - lastKeystrokeTime.current;
      lastKeystrokeTime.current = now;

      if (e.key === 'Enter') {
        const barcode = barcodeBuffer.current.trim();
        if (barcode.length >= 3) {
          const found = allProducts.find(p => p.barcode === barcode || p.sku === barcode);
          if (found) {
            addToCart(found);
            setScannerFlash(true);
            setTimeout(() => setScannerFlash(false), 300);
            barcodeBuffer.current = '';
            e.preventDefault();
            return;
          }
        }
        barcodeBuffer.current = '';
      } else if (e.key.length === 1) {
        // If time since last key > 50ms, it's likely human typing, restart buffer
        if (diff > 50) {
          barcodeBuffer.current = e.key;
        } else {
          barcodeBuffer.current += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allProducts, addToCart]);

  const addToCart = useCallback((product: PosProduct) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  }, []);

  const searchProducts = useCallback(async () => {
    if (!session) return;
    setSearching(true);
    try {
      const results = await get<PosProduct[]>(`/api/pos/products?warehouse_id=${session.warehouse_id}&q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(results);
      
      // If exactly 1 result with exact barcode/sku match, add to cart immediately and clear search
      if (results.length === 1 && (results[0].barcode === searchQuery || results[0].sku === searchQuery)) {
        addToCart(results[0]);
        setSearchQuery('');
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  }, [session, searchQuery, addToCart]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchProducts();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, searchProducts]);

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => item.id === productId ? { ...item, qty } : item));
  }

  function removeFromCart(productId: string) {
    setCart(prev => prev.filter(item => item.id !== productId));
  }

  const displayedProducts = useMemo(() => {
    let filtered = allProducts;
    if (selectedCategory) {
      filtered = filtered.filter(p => p.category_id === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name_th.toLowerCase().includes(q) || 
        p.sku.toLowerCase().includes(q) || 
        (p.barcode && p.barcode.includes(q))
      );
    }
    return filtered;
  }, [allProducts, selectedCategory, searchQuery]);

  const searchMember = useCallback(async () => {
    if (!memberPhone || memberPhone.length < 9) return;
    setSearchingMember(true);
    try {
      const res = await get<PosMember[]>(`/api/pos/members?q=${memberPhone}`);
      if (res.length > 0) {
        setMember(res[0]);
      } else {
        alert('ไม่พบสมาชิก / Member not found');
      }
    } catch (error) {
      console.error('Member lookup failed:', error);
    } finally {
      setSearchingMember(false);
    }
  }, [memberPhone]);

  // Totals
  const totals = useMemo(() => {
    const subtotalBeforeOrderDiscount = cart.reduce((sum, item) => sum + (item.selling_price * item.qty), 0);
    
    // Member discount
    const memberDiscount = member ? Math.round(subtotalBeforeOrderDiscount * member.discount_rate * 100) / 100 : 0;
    
    const total = Math.max(0, subtotalBeforeOrderDiscount - memberDiscount - orderDiscount);
    const vatAmount = Math.round(total * VAT_RATE / (1 + VAT_RATE) * 100) / 100;
    const subtotalExclVat = total - vatAmount;
    
    return {
      subtotalBeforeOrderDiscount,
      memberDiscount,
      total,
      vatAmount,
      subtotalExclVat
    };
  }, [cart, orderDiscount, member]);

  const changeGiven = useMemo(() => {
    const tendered = parseFloat(cashTendered || '0') + parseFloat(cardAmount || '0');
    return Math.max(0, tendered - totals.total);
  }, [cashTendered, cardAmount, totals.total]);

  async function handleHoldBill() {
    if (cart.length === 0 || !session) return;
    try {
      await post('/api/pos/held-carts', {
        session_id: id,
        warehouse_id: session.warehouse_id,
        lines: cart.map(item => ({
          product_id: item.id,
          qty: item.qty,
          unit_price: item.selling_price,
          discount_amount: 0,
        })),
      });
      setCart([]);
      setMember(null);
      setMemberPhone('');
      fetchHeldCarts();
    } catch {
      alert('Failed to hold bill');
    }
  }

  async function handleResumeCart(heldCartId: string) {
    try {
      const fullHeld = await get<PosHeldCart & { lines: PosHeldCartLine[] }>(`/api/pos/held-carts/${heldCartId}`);
      if (cart.length > 0 && !confirm('การดึงบิลที่พักไว้จะเขียนทับตะกร้าปัจจุบัน ยืนยันหรือไม่?\nResuming will replace current cart. Continue?')) return;
      
      const newCart: CartItem[] = fullHeld.lines.map(line => ({
        id: line.product_id,
        sku: line.sku!,
        name_th: line.name_th!,
        selling_price: line.unit_price,
        qty: line.qty,
        qty_available: 0, 
        barcode: null,
        name_en: null,
      }));
      setCart(newCart);
      
      await del(`/api/pos/held-carts/${heldCartId}`);
      fetchHeldCarts();
    } catch {
      alert('Failed to resume bill');
    }
  }

  async function handleCheckout() {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const res = await post<{ id: string; receipt_number: string }>('/api/pos/transactions', {
        session_id: id,
        lines: cart.map(item => ({
          product_id: item.id,
          qty: item.qty,
          unit_price: item.selling_price,
          discount_amount: 0, // line discount not yet implemented in UI
        })),
        payment_method: paymentMethod,
        cash_tendered: paymentMethod !== 'card' ? parseFloat(cashTendered || '0') : 0,
        card_amount: paymentMethod !== 'cash' ? parseFloat(cardAmount || '0') : 0,
        discount_amount: orderDiscount + totals.memberDiscount,
        member_id: member?.id || null,
      });

      // Fetch full transaction details for receipt
      const fullTxn = await get<PosTransaction>(`/api/pos/transactions/${res.id}`);
      setLastTransaction(fullTxn);
      setIsReceiptModalOpen(true);
      
      // Clear cart
      setCart([]);
      setOrderDiscount(0);
      setMember(null);
      setMemberPhone('');
      setCashTendered('');
      setCardAmount('');
      setSearchQuery('');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCloseSession() {
    setClosing(true);
    try {
      await patch(`/api/pos/sessions/${id}`, {
        action: 'close_session',
        closing_float: parseFloat(closingFloat || '0'),
      });
      router.push('/app/pos');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to close session');
    } finally {
      setClosing(false);
    }
  }

  if (loading) return <div className="flex justify-center py-24"><LoadingSpinner /></div>;
  if (!session) return <div className="text-center py-24">Session not found</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] gap-4">
      {/* Status Bar */}
      <div className={`${CARD} px-5 py-3 flex items-center justify-between shrink-0`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400 font-medium uppercase tracking-wider">รอบการขาย</span>
            <span className="font-mono font-bold text-stone-900">{session.session_number}</span>
            <StatusBadge status={session.status} />
          </div>
          <div className="h-4 w-px bg-stone-200" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400 font-medium uppercase tracking-wider">คลัง</span>
            <span className="text-sm font-medium text-stone-700">{session.warehouse_name_th}</span>
          </div>
          <div className="h-4 w-px bg-stone-200" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400 font-medium uppercase tracking-wider">กะ / Shift</span>
            <span className="text-sm font-bold text-emerald-700">{session.shift_name_th || 'ไม่ระบุ'}</span>
          </div>
          <div className="h-4 w-px bg-stone-200" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400 font-medium uppercase tracking-wider">แคชเชียร์</span>
            <span className="text-sm font-medium text-stone-700">{session.opened_by_name}</span>
          </div>
        </div>
        <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setIsCloseModalOpen(true)}>
          ปิดรอบ / Close
        </Button>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Left: Search & Products Grid / History */}
        <div className="flex-[3] flex flex-col gap-4 min-w-0">
          {/* Tabs */}
          <div className="flex items-center gap-2 px-1 shrink-0">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-all ${activeTab === 'products' ? 'bg-white border-x border-t border-stone-200 text-emerald-600' : 'text-stone-400 hover:text-stone-600'}`}
            >
              สินค้า / Products
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-all ${activeTab === 'history' ? 'bg-white border-x border-t border-stone-200 text-emerald-600' : 'text-stone-400 hover:text-stone-600'}`}
            >
              ประวัติ / History
            </button>
            <div className="ml-auto flex items-center gap-4">
              <div className="flex items-center gap-1">
                <span className="text-xs text-stone-400 font-medium">บิลที่พัก:</span>
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">{heldCarts.length}</span>
              </div>
            </div>
          </div>

          {activeTab === 'products' ? (
            <>
              {/* Category Tabs & Search */}
              <div className={`${CARD} p-4 shrink-0 space-y-4`}>
                {/* Search */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔍</span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="ค้นหาสินค้าด้วย ชื่อ, SKU หรือ สแกนบาร์โค้ด..."
                    className={`w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${scannerFlash ? 'ring-2 ring-emerald-500' : ''}`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <LoadingSpinner size="sm" />
                    </div>
                  )}
                </div>

                {/* Categories */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${!selectedCategory ? 'bg-emerald-600 text-white shadow-sm' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                  >
                    ทั้งหมด / All
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${selectedCategory === cat.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                    >
                      {cat.name_th}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Grid */}
              <div className="flex-1 overflow-y-auto min-h-0 pr-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-4">
                  {displayedProducts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className={`group relative flex flex-col bg-white border rounded-xl overflow-hidden hover:shadow-md transition-all text-left ${
                        p.qty_available <= 0 ? 'border-red-200' : 
                        p.qty_available <= (p.reorder_point || 0) ? 'border-amber-200' : 'border-stone-200'
                      }`}
                    >
                      <div className="relative aspect-square w-full bg-stone-50 overflow-hidden">
                        <img 
                          src={p.image_url || '/placeholder-product.png'} 
                          alt={p.name_th}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.png'; }}
                        />
                        {/* Stock Badge */}
                        <div className="absolute top-2 right-2">
                          {p.qty_available <= 0 ? (
                            <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full shadow-sm">หมด</span>
                          ) : p.qty_available <= (p.reorder_point || 0) ? (
                            <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full shadow-sm">สต็อกต่ำ</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-white/90 text-stone-600 text-[10px] font-bold rounded-full shadow-sm backdrop-blur-sm border border-stone-100">
                              {formatQty(p.qty_available)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="p-3 space-y-1 flex-1 flex flex-col">
                        <h4 className="text-[13px] font-medium text-stone-900 line-clamp-2 leading-tight h-8">{p.name_th}</h4>
                        <div className="flex items-center justify-between mt-auto pt-2">
                          <span className="text-sm font-bold text-emerald-600">{formatCurrency(p.selling_price)}</span>
                          <span className="text-[10px] text-stone-400 font-mono">{p.sku}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col gap-4 min-h-0">
              {/* Held Carts Section */}
              <div className={`${CARD} flex-1 flex flex-col min-h-0`}>
                <div className="px-5 py-3 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between">
                  <h3 className="font-semibold text-stone-900">บิลที่พักไว้ / Held Carts</h3>
                  {loadingHeld && <LoadingSpinner size="sm" />}
                </div>
                <div className="flex-1 overflow-y-auto">
                  {heldCarts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-stone-300 p-8">
                      <span className="text-4xl mb-2">📄</span>
                      <p className="text-sm">ไม่มีบิลที่พักไว้</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-stone-50">
                      {heldCarts.map((hc) => (
                        <div key={hc.id} className="p-4 hover:bg-stone-50/50 flex items-center justify-between group transition-colors">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-stone-900">{hc.hold_number}</span>
                            <span className="text-[11px] text-stone-400">
                              {new Date(hc.created_at).toLocaleTimeString('th-TH')} • {hc.line_count} รายการ
                            </span>
                            {hc.note && <span className="text-xs text-amber-600 mt-1">📝 {hc.note}</span>}
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleResumeCart(hc.id)}>ดึงข้อมูล / Resume</Button>
                            <Button variant="outline" size="sm" className="text-red-500 hover:bg-red-50" onClick={async () => {
                              if (confirm('ลบบิลที่พักไว้?')) {
                                await del(`/api/pos/held-carts/${hc.id}`);
                                fetchHeldCarts();
                              }
                            }}>ลบ</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* History Section */}
              <div className={`${CARD} flex-1 flex flex-col min-h-0`}>
                <div className="px-5 py-3 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between">
                  <h3 className="font-semibold text-stone-900">รายการขายในรอบนี้ / Session History</h3>
                  {loadingHistory && <LoadingSpinner size="sm" />}
                </div>
                <div className="flex-1 overflow-y-auto text-left">
                  {sessionTransactions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-stone-300 p-8">
                      <span className="text-4xl mb-2">💰</span>
                      <p className="text-sm">ยังไม่มีรายการขาย</p>
                    </div>
                  ) : (
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-white border-b border-stone-100 shadow-sm z-10">
                        <tr className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                          <th className="px-5 py-3">เลขที่ / Receipt</th>
                          <th className="px-5 py-3">เวลา / Time</th>
                          <th className="px-5 py-3">สมาชิก / Member</th>
                          <th className="px-5 py-3 text-right">ยอดรวม / Total</th>
                          <th className="px-5 py-3 text-center">วิธีชำระ / Payment</th>
                          <th className="px-5 py-3 text-center">สถานะ / Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-50">
                        {sessionTransactions.map((txn) => (
                          <tr key={txn.id} className="hover:bg-stone-50/50 transition-colors">
                            <td className="px-5 py-3 font-mono text-sm font-bold text-stone-900">{txn.receipt_number}</td>
                            <td className="px-5 py-3 text-xs text-stone-500">{new Date(txn.created_at).toLocaleTimeString('th-TH')}</td>
                            <td className="px-5 py-3 text-sm">
                              {txn.member_name ? (
                                <div className="flex flex-col">
                                  <span className="font-medium text-stone-700">{txn.member_name}</span>
                                  <span className="text-[10px] text-emerald-600">+{txn.points_earned} pts</span>
                                </div>
                              ) : (
                                <span className="text-stone-300">-</span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-right font-mono font-bold">{formatCurrency(txn.total)}</td>
                            <td className="px-5 py-3 text-center text-xs uppercase font-medium">{txn.payment_method}</td>
                            <td className="px-5 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <StatusBadge status={txn.status} />
                                {txn.status === 'completed' && (currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                                  <button 
                                    onClick={() => handleVoidTransaction(txn.id)}
                                    className="text-[10px] font-bold text-red-500 hover:text-red-700 underline"
                                  >
                                    VOID
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Cart & Payment */}
        <div className="flex-[2] flex flex-col gap-4 min-w-0">
          {/* Cart Table */}
          <div className={`${CARD} flex-1 flex flex-col min-h-0`}>
            <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-stone-900">รายการสินค้า / Cart</h3>
                <span className="text-xs font-medium text-stone-500 bg-stone-200/50 px-2 py-0.5 rounded-full">{cart.length}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-amber-600 border-amber-200 hover:bg-amber-50"
                onClick={handleHoldBill}
                disabled={cart.length === 0}
              >
                ⏸ พักบิล / Hold
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-stone-300 gap-2">
                  <span className="text-5xl">🛒</span>
                  <p className="text-sm">ตะกร้าว่างเปล่า</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white border-b border-stone-100 shadow-sm z-10">
                    <tr className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                      <th className="px-5 py-3">สินค้า / Product</th>
                      <th className="px-5 py-3 text-center w-32">จำนวน / Qty</th>
                      <th className="px-5 py-3 text-right">ราคา / Price</th>
                      <th className="px-5 py-3 text-right">รวม / Total</th>
                      <th className="px-5 py-3 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {cart.map((item) => (
                      <tr key={item.id} className="hover:bg-stone-50/50 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="font-medium text-stone-900 text-[13.5px]">{item.name_th}</div>
                          <div className="text-[11px] text-stone-400 font-mono mt-0.5">{item.sku}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => updateQty(item.id, item.qty - 1)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-600 transition-colors"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              className="w-12 text-center font-mono font-bold text-[14px] bg-transparent focus:outline-none"
                              value={item.qty}
                              onChange={(e) => updateQty(item.id, parseFloat(e.target.value) || 0)}
                            />
                            <button
                              onClick={() => updateQty(item.id, item.qty + 1)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-600 transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-[13.5px]">
                          {formatCurrency(item.selling_price)}
                        </td>
                        <td className="px-5 py-4 text-right font-mono font-bold text-stone-900 text-[13.5px]">
                          {formatCurrency(item.selling_price * item.qty)}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-stone-300 hover:text-red-500 transition-colors"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right: Summary & Payment */}
        <div className="flex-[2] flex flex-col gap-4 min-w-0">
          {/* Totals Summary */}
          <div className={`${CARD} p-5 space-y-3`}>
            <div className="flex justify-between text-sm text-stone-500">
              <span>รวมสินค้า / Subtotal</span>
              <span className="font-mono tabular-nums">{formatCurrency(totals.subtotalBeforeOrderDiscount)}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-stone-500">
              <span>ส่วนลดท้ายบิล / Order Discount</span>
              <div className="relative w-28">
                <input
                  type="number"
                  className="w-full pl-2 pr-2 py-1 bg-stone-50 border border-stone-200 rounded text-right font-mono text-sm focus:ring-1 focus:ring-emerald-500/20"
                  value={orderDiscount}
                  onChange={(e) => setOrderDiscount(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="h-px bg-stone-100" />
            <div className="flex justify-between text-sm text-stone-400">
              <span>รวมเงินก่อนภาษี / Subtotal (excl. VAT)</span>
              <span className="font-mono tabular-nums">{formatCurrency(totals.subtotalExclVat)}</span>
            </div>
            <div className="flex justify-between text-sm text-stone-400">
              <span>ภาษีมูลค่าเพิ่ม / VAT (7%)</span>
              <span className="font-mono tabular-nums">{formatCurrency(totals.vatAmount)}</span>
            </div>
            <div className="h-px bg-stone-100" />
            <div className="flex justify-between items-end">
              <span className="text-sm font-bold text-stone-900 uppercase tracking-wider">ยอดสุทธิ / Total</span>
              <span className="text-3xl font-black text-emerald-600 font-mono tracking-tighter tabular-nums">
                {formatCurrency(totals.total)}
              </span>
            </div>
          </div>

          {/* Payment Panel */}
          <div className={`${CARD} p-5 flex-1 flex flex-col gap-4 overflow-y-auto`}>
            {/* Member Lookup */}
            <div className="space-y-2 pb-4 border-b border-stone-100">
              <label className="text-xs font-bold text-stone-400 uppercase">สมาชิก / Member</label>
              {!member ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="เบอร์โทรศัพท์..."
                    value={memberPhone}
                    onChange={(e) => setMemberPhone(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchMember()}
                    className="flex-1"
                  />
                  <Button variant="outline" size="sm" onClick={searchMember} loading={searchingMember}>ค้นหา</Button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-emerald-800">{member.name_th}</span>
                    <span className="text-[10px] text-emerald-600 font-medium">{member.tier.toUpperCase()} • ส่วนลด {(member.discount_rate * 100).toFixed(0)}%</span>
                  </div>
                  <button onClick={() => { setMember(null); setMemberPhone(''); }} className="text-emerald-400 hover:text-emerald-600 p-1">✕</button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 shrink-0">
              {(['cash', 'card', 'mixed'] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => {
                    setPaymentMethod(method);
                    if (method === 'card') {
                      setCardAmount(totals.total.toString());
                      setCashTendered('');
                    } else if (method === 'cash') {
                      setCardAmount('');
                      setCashTendered('');
                    }
                  }}
                  className={`py-3 rounded-lg border text-sm font-bold transition-all ${
                    paymentMethod === method 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' 
                      : 'border-stone-200 text-stone-400 hover:bg-stone-50'
                  }`}
                >
                  {method === 'cash' ? '💵 เงินสด' : method === 'card' ? '💳 บัตร' : '🔀 ผสม'}
                </button>
              ))}
            </div>

            <div className="space-y-4 flex-1">
              {(paymentMethod === 'cash' || paymentMethod === 'mixed') && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-400 uppercase">เงินสดที่รับมา / Cash Tendered</label>
                  <Input
                    type="number"
                    className="text-2xl font-mono text-right"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    placeholder="0.00"
                    autoFocus={paymentMethod === 'cash'}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    {[100, 500, 1000].map(amt => (
                      <button
                        key={amt}
                        onClick={() => setCashTendered(amt.toString())}
                        className="py-1.5 bg-stone-50 border border-stone-200 rounded text-xs text-stone-600 hover:bg-stone-100"
                      >
                        {amt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(paymentMethod === 'card' || paymentMethod === 'mixed') && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-400 uppercase">รูดบัตร / Card Amount</label>
                  <Input
                    type="number"
                    className="text-2xl font-mono text-right"
                    value={cardAmount}
                    onChange={(e) => setCardAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}

              <div className="mt-auto pt-6 space-y-4">
                <div className="flex justify-between items-center px-2 py-3 bg-amber-50 rounded-lg border border-amber-100">
                  <span className="text-sm font-bold text-amber-800 uppercase">เงินทอน / Change</span>
                  <span className="text-2xl font-mono font-black text-amber-800">{formatCurrency(changeGiven)}</span>
                </div>

                <Button
                  className="w-full py-6 text-xl rounded-xl shadow-lg"
                  disabled={submitting || cart.length === 0 || (paymentMethod === 'mixed' && (parseFloat(cashTendered || '0') + parseFloat(cardAmount || '0')) < totals.total)}
                  loading={submitting}
                  onClick={handleCheckout}
                >
                  ชำระเงิน / Checkout
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      <Modal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          searchInputRef.current?.focus();
        }}
        title="ใบเสร็จรับเงิน / Receipt"
        maxWidth="max-w-md"
      >
        {lastTransaction && (
          <div className="space-y-6 pt-2">
            <div id="receipt-print" className="bg-white p-6 rounded border border-stone-100 text-stone-900 font-mono text-sm">
              <div className="text-center mb-6">
                <div className="text-xl font-bold tracking-widest uppercase">RECEIPT</div>
                <div className="text-[11px] text-stone-500 mt-1">{session.warehouse_name_th}</div>
              </div>

              <div className="flex justify-between mb-1">
                <span className="text-stone-500">Receipt No:</span>
                <span className="font-bold">{lastTransaction.receipt_number}</span>
              </div>
              <div className="flex justify-between mb-4">
                <span className="text-stone-500">Date/Time:</span>
                <span>{new Date(lastTransaction.created_at).toLocaleString('th-TH')}</span>
              </div>

              <div className="h-px bg-stone-200 mb-4" />

              <div className="space-y-3 mb-6">
                {lastTransaction.lines?.map((line, i) => (
                  <div key={i}>
                    <div className="flex justify-between">
                      <span className="flex-1 truncate mr-2">{line.name_th}</span>
                      <span className="shrink-0">{formatCurrency(line.line_total)}</span>
                    </div>
                    <div className="text-[11px] text-stone-400">
                      {formatQty(line.qty)} x {formatCurrency(line.unit_price)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="h-px bg-stone-200 mb-4" />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-500">Subtotal:</span>
                  <span>{formatCurrency(lastTransaction.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">VAT (7%):</span>
                  <span>{formatCurrency(lastTransaction.vat_amount)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(lastTransaction.total)}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-dashed border-stone-200">
                <div className="flex justify-between">
                  <span className="text-stone-500 uppercase">{lastTransaction.payment_method}</span>
                  <span>{formatCurrency((lastTransaction.cash_tendered ?? 0) + (lastTransaction.card_amount ?? 0))}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>CHANGE:</span>
                  <span>{formatCurrency(lastTransaction.change_given)}</span>
                </div>
              </div>

              <div className="text-center mt-8 text-[11px] text-stone-400 uppercase tracking-widest">
                Thank you
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => window.print()}>พิมพ์ / Print</Button>
              <Button className="flex-1" onClick={() => {
                setIsReceiptModalOpen(false);
                searchInputRef.current?.focus();
              }}>รายการใหม่ / New Sale</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Close Session Modal */}
      <Modal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        title="ปิดรอบการขาย / Close POS Session"
      >
        <div className="space-y-4 pt-2">
          <p className="text-stone-500 text-sm">กรุณาระบุเงินสดคงเหลือในเครื่องเพื่อทำการปิดรอบการขาย</p>
          
          <Input
            label="เงินสดคงเหลือ / Closing Float"
            type="number"
            value={closingFloat}
            onChange={(e) => setClosingFloat(e.target.value)}
            placeholder="0.00"
            autoFocus
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsCloseModalOpen(false)} disabled={closing}>ยกเลิก / Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700" loading={closing} onClick={handleCloseSession}>ยืนยันปิดรอบ / Close Session</Button>
          </div>
        </div>
      </Modal>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-print, #receipt-print * { visibility: visible; }
          #receipt-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 300px; /* Standard thermal printer width */
            border: none;
            box-shadow: none;
          }
        }
      `}</style>
    </div>
  );
}

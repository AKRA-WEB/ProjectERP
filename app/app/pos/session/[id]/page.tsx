'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { get, post, patch } from '@/lib/api-client';
import { formatCurrency, formatQty } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { PosSession, PosProduct, PosTransaction, PosPaymentMethod } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

interface CartItem extends PosProduct {
  qty: number;
}

export default function PosTerminalPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [session, setSession] = useState<PosSession | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PosProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderDiscount, setOrderDiscount] = useState(0);

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

  useEffect(() => {
    fetchSession();
    // Focus search input on mount
    searchInputRef.current?.focus();
  }, [fetchSession]);

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

  // Totals
  const totals = useMemo(() => {
    const subtotalBeforeOrderDiscount = cart.reduce((sum, item) => sum + (item.selling_price * item.qty), 0);
    const total = Math.max(0, subtotalBeforeOrderDiscount - orderDiscount);
    const vatAmount = Math.round(total * 7 / 107 * 100) / 100;
    const subtotalExclVat = total - vatAmount;
    
    return {
      subtotalBeforeOrderDiscount,
      total,
      vatAmount,
      subtotalExclVat
    };
  }, [cart, orderDiscount]);

  const changeGiven = useMemo(() => {
    const tendered = parseFloat(cashTendered || '0') + parseFloat(cardAmount || '0');
    return Math.max(0, tendered - totals.total);
  }, [cashTendered, cardAmount, totals.total]);

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
        discount_amount: orderDiscount,
      });

      // Fetch full transaction details for receipt
      const fullTxn = await get<PosTransaction>(`/api/pos/transactions/${res.id}`);
      setLastTransaction(fullTxn);
      setIsReceiptModalOpen(true);
      
      // Clear cart
      setCart([]);
      setOrderDiscount(0);
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
            <span className="text-xs text-stone-400 font-medium uppercase tracking-wider">แคชเชียร์</span>
            <span className="text-sm font-medium text-stone-700">{session.opened_by_name}</span>
          </div>
        </div>
        <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setIsCloseModalOpen(true)}>
          ปิดรอบ / Close
        </Button>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Left: Search & Cart */}
        <div className="flex-[3] flex flex-col gap-4 min-w-0">
          {/* Search */}
          <div className={`${CARD} p-4 shrink-0`}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔍</span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="ค้นหาสินค้าด้วย ชื่อ, SKU หรือ สแกนบาร์โค้ด..."
                className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchResults.length === 1) {
                    addToCart(searchResults[0]);
                    setSearchQuery('');
                  }
                }}
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <LoadingSpinner size="sm" />
                </div>
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto p-1">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      addToCart(p);
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="flex flex-col p-3 border border-stone-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
                  >
                    <span className="text-sm font-medium text-stone-900 line-clamp-1">{p.name_th}</span>
                    <span className="text-[11px] text-stone-400 font-mono mt-0.5">{p.sku}</span>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-bold text-emerald-600">{formatCurrency(p.selling_price)}</span>
                      <span className={`text-[10px] px-1.5 rounded-full ${p.qty_available > 0 ? 'bg-stone-100 text-stone-600' : 'bg-red-100 text-red-600'}`}>
                        สต็อก: {formatQty(p.qty_available)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cart Table */}
          <div className={`${CARD} flex-1 flex flex-col min-h-0`}>
            <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <h3 className="font-semibold text-stone-900">รายการสินค้า / Cart</h3>
              <span className="text-xs font-medium text-stone-500">{cart.length} รายการ</span>
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
          <div className={`${CARD} p-5 flex-1 flex flex-col gap-4`}>
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

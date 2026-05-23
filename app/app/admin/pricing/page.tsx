'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { 
  Tag, 
  Search, 
  Plus, 
  Upload, 
  List, 
  ArrowLeft, 
  HelpCircle, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  Calendar
} from 'lucide-react';
import { get, post } from '@/lib/api-client';
import { Button, Table, Thead, Tbody, Th, Td, Pagination } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import type { Product, ProductPrice } from '@/types';
import { cn } from '@/lib/utils';

// Simplified ProductSearch component for the price setting form
interface ProductSearchProps {
  onSelect: (product: Product) => void;
  selectedProduct: Product | null;
  onClear: () => void;
}

function ProductSearch({ onSelect, selectedProduct, onClear }: ProductSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedProduct) {
      setQuery(`${selectedProduct.sku} — ${selectedProduct.name_th}`);
    } else {
      setQuery('');
    }
  }, [selectedProduct]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2 || (selectedProduct && query === `${selectedProduct.sku} — ${selectedProduct.name_th}`)) {
      setResults([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await get<{ data: Product[] }>(
          `/api/products?search=${encodeURIComponent(query)}&limit=10`
        );
        const products = Array.isArray(res) 
          ? res 
          : (res && typeof res === 'object' && 'data' in res ? (res as { data: Product[] }).data : []);
        setResults(products);
        setOpen(products.length > 0);
      } catch (err) {
        console.error('Failed to search products:', err);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, selectedProduct]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          type="text"
          className="w-full rounded border border-[#e4e0d6] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#7a5a7e] focus:ring-1 focus:ring-[#7a5a7e] min-h-[38px] pr-8"
          placeholder="ค้นหาสินค้าด้วยชื่อหรือ SKU..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
        />
        {selectedProduct && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResults([]); setOpen(false); onClear(); }}
            className="absolute right-2.5 text-gray-400 hover:text-gray-600 text-sm"
          >
            ✕
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-[#e4e0d6] rounded-md shadow-lg max-h-52 overflow-y-auto">
          {loading && (
            <p className="px-3 py-2 text-xs text-gray-400">กำลังค้นหา...</p>
          )}
          {!loading && results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2.5 text-sm border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors flex flex-col"
              onClick={() => {
                onSelect(p);
                setOpen(false);
              }}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-xs font-semibold text-[#7a5a7e] bg-[#7a5a7e]/5 px-1.5 py-0.5 rounded">{p.sku}</span>
                {p.uom_code && <span className="text-[10px] bg-stone-100 text-stone-600 px-1 rounded">{p.uom_code}</span>}
              </div>
              <span className="text-[#1c1917] mt-1 font-medium">{p.name_th}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PricingAdminPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'bulk'>('list');

  // List tab states
  const [prices, setPrices] = useState<(ProductPrice & { sku: string; name_th: string; name_en: string | null; unit_cost: number })[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<'all' | 'TRD' | 'AKRA'>('all');
  const [tierFilter, setTierFilter] = useState<'all' | 'T0' | 'T1' | 'T2' | 'T3'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Single price form states
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formChannel, setFormChannel] = useState<'TRD' | 'AKRA'>('TRD');
  const [formTier, setFormTier] = useState<'T0' | 'T1' | 'T2' | 'T3'>('T0');
  const [formPrice, setFormPrice] = useState('');
  const [formValidFrom, setFormValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [formValidTo, setFormValidTo] = useState('');
  const [submittingSingle, setSubmittingSingle] = useState(false);

  // Bulk import states
  const [bulkCsv, setBulkCsv] = useState('');
  const [submittingBulk, setSubmittingBulk] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<{
    sku: string;
    channel: string;
    tier: string;
    price: number;
    valid_from: string;
    valid_to: string | null;
    isValid: boolean;
    error?: string;
  }[]>([]);

  // Fetch product prices for the list tab
  const fetchPrices = useCallback(async () => {
    setLoadingList(true);
    try {
      const channelParam = channelFilter !== 'all' ? `&channel=${channelFilter}` : '';
      const tierParam = tierFilter !== 'all' ? `&tier=${tierFilter}` : '';
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
      
      const res = await get<{
        data: (ProductPrice & { sku: string; name_th: string; name_en: string | null; unit_cost: number })[];
        total: number;
        total_pages: number;
      }>(`/api/admin/product-prices?page=${page}&limit=12${channelParam}${tierParam}${searchParam}`);
      
      if (res) {
        setPrices(res.data || []);
        setTotalPages(res.total_pages || 1);
        setTotalItems(res.total || 0);
      }
    } catch (err) {
      console.error('Failed to load prices:', err);
      toast('error', 'เกิดข้อผิดพลาดในการโหลดราคาสินค้า');
    } finally {
      setLoadingList(false);
    }
  }, [page, channelFilter, tierFilter, search, toast]);

  useEffect(() => {
    if (activeTab === 'list') {
      fetchPrices();
    }
  }, [activeTab, page, channelFilter, tierFilter, fetchPrices]);

  // Handle Search Debounce
  useEffect(() => {
    if (activeTab !== 'list') return;
    const t = setTimeout(() => {
      setPage(1);
      fetchPrices();
    }, 400);
    return () => clearTimeout(t);
  }, [search, activeTab, fetchPrices]);

  // Live parser for bulk CSV
  useEffect(() => {
    if (!bulkCsv.trim()) {
      setParsedPreview([]);
      return;
    }

    const lines = bulkCsv.split('\n');
    const parsed = lines.map(line => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 4 || (parts.length === 1 && parts[0] === '')) return null;

      const [sku, channel, tier, priceStr, validFrom, validTo] = parts;
      
      let isValid = true;
      let error = '';

      if (!sku) {
        isValid = false;
        error = 'ระบุ SKU';
      }
      if (channel !== 'TRD' && channel !== 'AKRA') {
        isValid = false;
        error = 'ช่องทางต้องเป็น TRD หรือ AKRA';
      }
      if (tier !== 'T0' && tier !== 'T1' && tier !== 'T2' && tier !== 'T3') {
        isValid = false;
        error = 'ระดับสมาชิกต้องเป็น T0, T1, T2 หรือ T3';
      }
      
      const price = Number(priceStr);
      if (isNaN(price) || price < 0) {
        isValid = false;
        error = 'ราคาต้องเป็นจำนวนตัวเลขและมากกว่าหรือเท่ากับ 0';
      }

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!validFrom || !dateRegex.test(validFrom)) {
        isValid = false;
        error = 'วันที่เริ่มต้น (valid_from) ต้องอยู่ในรูปแบบ YYYY-MM-DD';
      }

      if (validTo && !dateRegex.test(validTo)) {
        isValid = false;
        error = 'วันที่สิ้นสุด (valid_to) ต้องอยู่ในรูปแบบ YYYY-MM-DD';
      }

      if (validFrom && validTo && validTo < validFrom) {
        isValid = false;
        error = 'วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น';
      }

      return {
        sku,
        channel,
        tier,
        price: isNaN(price) ? 0 : price,
        valid_from: validFrom,
        valid_to: validTo || null,
        isValid,
        error
      };
    }).filter(x => x !== null) as typeof parsedPreview;

    setParsedPreview(parsed);
  }, [bulkCsv]);

  // Form Submit: Add Single Price
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      toast('error', 'กรุณาเลือกสินค้า');
      return;
    }
    const priceNum = Number(formPrice);
    if (isNaN(priceNum) || priceNum < 0 || formPrice === '') {
      toast('error', 'กรุณาระบุราคาสินค้าที่ถูกต้อง');
      return;
    }

    if (formValidTo && formValidTo < formValidFrom) {
      toast('error', 'วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น');
      return;
    }

    setSubmittingSingle(true);
    try {
      const res = await post<{ inserted: number }>('/api/admin/product-prices/bulk', {
        rows: [{
          product_id: selectedProduct.id,
          channel: formChannel,
          tier: formTier,
          price: priceNum,
          valid_from: formValidFrom,
          valid_to: formValidTo || null
        }]
      });

      if (res && res.inserted > 0) {
        toast('success', 'บันทึกราคาสินค้าสำเร็จ');
        // Reset form
        setSelectedProduct(null);
        setFormPrice('');
        setFormValidTo('');
        setActiveTab('list');
      }
    } catch (err) {
      const error = err as Error;
      console.error(error);
      toast('error', error.message || 'ล้มเหลวในการบันทึกราคา');
    } finally {
      setSubmittingSingle(false);
    }
  };

  // Bulk Submit
  const handleBulkSubmit = async () => {
    const invalidRows = parsedPreview.filter(r => !r.isValid);
    if (invalidRows.length > 0) {
      toast('error', 'กรุณาแก้ไขแถวที่ระบุข้อผิดพลาดก่อนบันทึก');
      return;
    }

    if (parsedPreview.length === 0) {
      toast('error', 'ไม่มีรายการข้อมูลสำหรับนำเข้า');
      return;
    }

    setSubmittingBulk(true);
    try {
      const res = await post<{ inserted: number }>('/api/admin/product-prices/bulk', {
        rows: parsedPreview.map(r => ({
          sku: r.sku,
          channel: r.channel,
          tier: r.tier,
          price: r.price,
          valid_from: r.valid_from,
          valid_to: r.valid_to
        }))
      });

      if (res) {
        toast('success', `นำเข้าราคาสำเร็จทั้งหมด ${res.inserted} รายการ`);
        setBulkCsv('');
        setActiveTab('list');
      }
    } catch (err) {
      const error = err as Error;
      console.error(error);
      toast('error', error.message || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
    } finally {
      setSubmittingBulk(false);
    }
  };

  const formatMoney = (val: number | string) => {
    return Number(val).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <DirectionalTransition>
      <div className="max-w-[1100px] mx-auto min-h-[calc(100vh-140px)] font-sans px-4 py-8">
        
        {/* Style tweaks */}
        <style dangerouslySetInnerHTML={{ __html: `
          .pricing-tab {
            font-size: 14px;
            font-weight: 500;
            padding: 10px 18px;
            color: #57534e;
            border-bottom: 2px solid transparent;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            background: none;
            border-top: none;
            border-left: none;
            border-right: none;
            cursor: pointer;
          }
          .pricing-tab.active {
            color: #7a5a7e;
            border-bottom-color: #7a5a7e;
          }
          .pricing-tab:hover {
            color: #1c1917;
          }
          .premium-card {
            background: #ffffff;
            border: 1px solid #e4e0d6;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(28,25,23,.03);
          }
        ` }} />

        {/* Back and Title */}
        <div className="mb-8 flex items-center justify-between border-b border-[#e4e0d6] pb-6">
          <div className="flex items-center gap-4">
            <Link 
              href="/app/admin" 
              className="w-9 h-9 rounded-full border border-[#e4e0d6] flex items-center justify-center hover:bg-stone-50 text-[#78716c] hover:text-[#1c1917] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#7a5a7e] font-semibold mb-1">
                <span>ADMIN PANEL</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#7a5a7e]/40" />
                <span>ราคาสินค้า</span>
              </div>
              <h1 className="font-display text-[26px] font-semibold tracking-tight text-[#1c1917] m-0">ตั้งค่าราคาสินค้า (Pricing Engine)</h1>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#e4e0d6] mb-6 gap-2">
          <button 
            onClick={() => { setActiveTab('list'); setPage(1); }} 
            className={cn("pricing-tab", activeTab === 'list' && "active")}
          >
            <span className="flex items-center gap-2">
              <List className="w-4 h-4" />
              รายการราคาสินค้า ({totalItems})
            </span>
          </button>
          <button 
            onClick={() => setActiveTab('create')} 
            className={cn("pricing-tab", activeTab === 'create' && "active")}
          >
            <span className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              ตั้งค่าราคาใหม่
            </span>
          </button>
          <button 
            onClick={() => setActiveTab('bulk')} 
            className={cn("pricing-tab", activeTab === 'bulk' && "active")}
          >
            <span className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              นำเข้าข้อมูลแบบกลุ่ม (CSV)
            </span>
          </button>
        </div>

        {/* Tab 1: Price List */}
        {activeTab === 'list' && (
          <div className="premium-card p-6">
            
            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  placeholder="ค้นหา SKU หรือชื่อสินค้า..."
                  className="pl-9 w-full rounded border border-[#e4e0d6] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#7a5a7e]"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div>
                <select
                  className="w-full rounded border border-[#e4e0d6] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#7a5a7e] min-h-[38px]"
                  value={channelFilter}
                  onChange={(e) => { setChannelFilter(e.target.value as 'all' | 'TRD' | 'AKRA'); setPage(1); }}
                >
                  <option value="all">ช่องทางการขายทั้งหมด (Channels)</option>
                  <option value="TRD">TRD (Traditional Trade)</option>
                  <option value="AKRA">AKRA (Retail/POS)</option>
                </select>
              </div>

              <div>
                <select
                  className="w-full rounded border border-[#e4e0d6] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#7a5a7e] min-h-[38px]"
                  value={tierFilter}
                  onChange={(e) => { setTierFilter(e.target.value as 'all' | 'T0' | 'T1' | 'T2' | 'T3'); setPage(1); }}
                >
                  <option value="all">ระดับสมาชิกทั้งหมด (Tiers)</option>
                  <option value="T0">T0 (ราคาเริ่มต้น/มาตรฐาน)</option>
                  <option value="T1">T1 (สมาชิกระดับ 1)</option>
                  <option value="T2">T2 (สมาชิกระดับ 2)</option>
                  <option value="T3">T3 (สมาชิกระดับ 3)</option>
                </select>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={() => { setSearch(''); setChannelFilter('all'); setTierFilter('all'); setPage(1); }}
                  className="border border-[#e4e0d6] bg-stone-50 hover:bg-stone-100 text-stone-700 font-medium text-xs rounded px-4 min-h-[38px]"
                >
                  ล้างตัวกรอง
                </Button>
              </div>
            </div>

            {/* List Table */}
            {loadingList ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-[#7a5a7e] animate-spin mb-4" />
                <span className="text-sm text-stone-500 font-medium">กำลังโหลดข้อมูลราคาสินค้า...</span>
              </div>
            ) : prices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[#e4e0d6] rounded-md">
                <Tag className="w-12 h-12 text-stone-300 mb-4" />
                <span className="text-sm text-stone-500 font-medium font-sans">ไม่พบข้อมูลราคาสินค้าที่ตั้งค่าไว้</span>
                <span className="text-xs text-stone-400 mt-1 font-sans">{ 'สามารถเพิ่มราคาได้จากแท็บ "ตั้งค่าราคาใหม่"' }</span>
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto rounded border border-[#e4e0d6] mb-4">
                  <Table>
                    <Thead>
                      <tr>
                        <Th className="text-left font-semibold text-xs py-3 px-4 text-stone-600">รหัสสินค้า (SKU)</Th>
                        <Th className="text-left font-semibold text-xs py-3 px-4 text-stone-600">ชื่อสินค้า (Thai)</Th>
                        <Th className="text-center font-semibold text-xs py-3 px-4 text-stone-600">ช่องทางการขาย</Th>
                        <Th className="text-center font-semibold text-xs py-3 px-4 text-stone-600">ระดับสมาชิก</Th>
                        <Th className="text-right font-semibold text-xs py-3 px-4 text-stone-600">ราคาทุน</Th>
                        <Th className="text-right font-semibold text-xs py-3 px-4 text-stone-600">ราคาขายตั้งไว้</Th>
                        <Th className="text-center font-semibold text-xs py-3 px-4 text-stone-600">ช่วงวันที่ใช้งานได้</Th>
                      </tr>
                    </Thead>
                    <Tbody>
                      {prices.map((p) => (
                        <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                          <Td className="py-3 px-4 font-mono text-xs font-semibold text-[#7a5a7e]">{p.sku}</Td>
                          <Td className="py-3 px-4 font-medium text-sm text-stone-900">{p.name_th}</Td>
                          <Td className="py-3 px-4 text-center">
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded font-medium",
                              p.channel === 'AKRA' ? "bg-orange-50 text-orange-700" : "bg-blue-50 text-blue-700"
                            )}>
                              {p.channel}
                            </span>
                          </Td>
                          <Td className="py-3 px-4 text-center font-bold text-stone-700">{p.tier}</Td>
                          <Td className="py-3 px-4 text-right font-mono text-xs text-stone-400">{formatMoney(p.unit_cost)} บาท</Td>
                          <Td className="py-3 px-4 text-right font-mono text-sm font-semibold text-[#1c1917]">{formatMoney(p.price)} บาท</Td>
                          <Td className="py-3 px-4 text-center text-xs text-stone-500 font-medium">
                            <div className="flex items-center justify-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-stone-400" />
                              <span>{p.valid_from}</span>
                              <span className="text-stone-300">→</span>
                              <span>{p.valid_to || 'ไม่มีกำหนด'}</span>
                            </div>
                          </Td>
                        </tr>
                      ))}
                    </Tbody>
                  </Table>
                </div>
                
                {/* Pagination */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-500 font-medium">แสดงทั้งหมด {totalItems} รายการ</span>
                  {totalPages > 1 && (
                    <Pagination
                      currentPage={page}
                      totalPages={totalPages}
                      onPageChange={setPage}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Create Single Price Form */}
        {activeTab === 'create' && (
          <div className="premium-card p-8 max-w-[650px] mx-auto">
            <h2 className="text-lg font-semibold text-[#1c1917] border-b border-[#e4e0d6] pb-3 mb-6">ตั้งราคาสินค้าแบบรายรายการ</h2>
            
            <form onSubmit={handleSingleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">เลือกสินค้า</label>
                <ProductSearch 
                  onSelect={setSelectedProduct} 
                  selectedProduct={selectedProduct}
                  onClear={() => setSelectedProduct(null)}
                />
                {selectedProduct && (
                  <div className="mt-2.5 p-3 bg-stone-50 rounded border border-[#e4e0d6] flex items-center justify-between text-xs text-stone-600 font-mono">
                    <span>ราคาทุนปัจจุบัน (Current Cost):</span>
                    <span className="font-semibold text-stone-900">{formatMoney(selectedProduct.unit_cost)} บาท</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">ช่องทางขาย (Channel)</label>
                  <select
                    className="w-full rounded border border-[#e4e0d6] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#7a5a7e] min-h-[38px]"
                    value={formChannel}
                    onChange={(e) => setFormChannel(e.target.value as 'TRD' | 'AKRA')}
                  >
                    <option value="TRD">TRD (Traditional Trade)</option>
                    <option value="AKRA">AKRA (Retail/POS)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">ระดับราคาสมาชิก (Tier)</label>
                  <select
                    className="w-full rounded border border-[#e4e0d6] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#7a5a7e] min-h-[38px]"
                    value={formTier}
                    onChange={(e) => setFormTier(e.target.value as 'T0' | 'T1' | 'T2' | 'T3')}
                  >
                    <option value="T0">T0 (มาตรฐาน/เริ่มต้น)</option>
                    <option value="T1">T1 (ระดับ 1)</option>
                    <option value="T2">T2 (ระดับ 2)</option>
                    <option value="T3">T3 (ระดับ 3)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">ราคาขาย (Price - THB)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    className="w-full rounded border border-[#e4e0d6] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#7a5a7e]"
                    placeholder="0.00"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                  />
                  <span className="absolute right-3 top-2 text-xs font-semibold text-stone-400">บาท</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">วันที่เริ่มมีผล (Valid From)</label>
                  <input
                    type="date"
                    className="w-full rounded border border-[#e4e0d6] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#7a5a7e]"
                    value={formValidFrom}
                    onChange={(e) => setFormValidFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">วันที่สิ้นสุด (Valid To - ไม่บังคับ)</label>
                  <input
                    type="date"
                    className="w-full rounded border border-[#e4e0d6] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#7a5a7e]"
                    value={formValidTo}
                    onChange={(e) => setFormValidTo(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-[#e4e0d6] justify-end">
                <Button 
                  type="button" 
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2 border border-[#e4e0d6] bg-stone-50 hover:bg-stone-100 rounded text-sm text-[#44403c] transition-colors min-h-[38px]"
                >
                  ยกเลิก
                </Button>
                <Button 
                  type="submit" 
                  disabled={submittingSingle}
                  className="px-5 py-2 bg-[#7a5a7e] hover:bg-[#6b4e6f] text-white font-medium rounded text-sm transition-colors min-h-[38px] flex items-center gap-2"
                >
                  {submittingSingle && <Loader2 className="w-4 h-4 animate-spin" />}
                  บันทึกราคา
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 3: Bulk Import Page */}
        {activeTab === 'bulk' && (
          <div className="space-y-6">
            
            {/* Split screen: Paste form & Instructions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left 2 Columns: Paste area and parsed preview */}
              <div className="lg:col-span-2 space-y-6">
                
                <div className="premium-card p-6">
                  <h3 className="text-base font-semibold text-[#1c1917] mb-4">วางข้อมูล CSV เพื่อนำเข้าราคาสินค้า</h3>
                  
                  <textarea
                    rows={8}
                    className="w-full rounded border border-[#e4e0d6] p-3 text-xs font-mono bg-stone-50 focus:bg-white focus:outline-none focus:border-[#7a5a7e] transition-colors"
                    placeholder="SKU-001,TRD,T0,150.00,2026-05-23,2026-12-31&#10;SKU-001,AKRA,T1,145.00,2026-05-23&#10;SKU-002,TRD,T0,99.50,2026-05-23,2027-01-01"
                    value={bulkCsv}
                    onChange={(e) => setBulkCsv(e.target.value)}
                  />

                  <div className="flex justify-between items-center mt-4">
                    <span className="text-xs text-stone-500 font-medium">ตรวจพบแถวข้อมูล: {parsedPreview.length} รายการ</span>
                    <Button
                      onClick={handleBulkSubmit}
                      disabled={submittingBulk || parsedPreview.length === 0}
                      className="px-5 py-2 bg-[#7a5a7e] hover:bg-[#6b4e6f] text-white font-medium rounded text-sm transition-colors min-h-[38px] flex items-center gap-2"
                    >
                      {submittingBulk && <Loader2 className="w-4 h-4 animate-spin" />}
                      นำเข้าข้อมูลที่ผ่านตรวจสอบ ({parsedPreview.filter(r => r.isValid).length})
                    </Button>
                  </div>
                </div>

                {/* Parsed Preview Table */}
                {parsedPreview.length > 0 && (
                  <div className="premium-card p-6">
                    <h3 className="text-sm font-semibold text-[#1c1917] mb-4">ตรวจสอบความถูกต้องก่อนบันทึก</h3>
                    
                    <div className="overflow-x-auto rounded border border-[#e4e0d6]">
                      <Table>
                        <Thead>
                          <tr>
                            <Th className="text-left font-semibold text-xs py-2 px-3 text-stone-600 w-12">สถานะ</Th>
                            <Th className="text-left font-semibold text-xs py-2 px-3 text-stone-600">SKU</Th>
                            <Th className="text-center font-semibold text-xs py-2 px-3 text-stone-600">ช่องทาง</Th>
                            <Th className="text-center font-semibold text-xs py-2 px-3 text-stone-600">ระดับ</Th>
                            <Th className="text-right font-semibold text-xs py-2 px-3 text-stone-600">ราคาขาย</Th>
                            <Th className="text-center font-semibold text-xs py-2 px-3 text-stone-600">ช่วงวันที่</Th>
                            <Th className="text-left font-semibold text-xs py-2 px-3 text-stone-600">หมายเหตุ</Th>
                          </tr>
                        </Thead>
                        <Tbody>
                          {parsedPreview.map((row, idx) => (
                            <tr key={idx} className={cn("hover:bg-stone-50 text-xs", !row.isValid && "bg-red-50/40")}>
                              <Td className="py-2 px-3 text-center">
                                {row.isValid ? (
                                  <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-500 mx-auto" />
                                )}
                              </Td>
                              <Td className="py-2 px-3 font-mono font-semibold">{row.sku}</Td>
                              <Td className="py-2 px-3 text-center font-medium">{row.channel}</Td>
                              <Td className="py-2 px-3 text-center font-bold">{row.tier}</Td>
                              <Td className="py-2 px-3 text-right font-mono font-medium">{formatMoney(row.price)} บาท</Td>
                              <Td className="py-2 px-3 text-center text-stone-500 font-medium">
                                {row.valid_from} → {row.valid_to || 'ไม่มีกำหนด'}
                              </Td>
                              <Td className="py-2 px-3">
                                {row.isValid ? (
                                  <span className="text-emerald-700 font-medium">พร้อมนำเข้า</span>
                                ) : (
                                  <span className="text-red-700 font-semibold flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {row.error}
                                  </span>
                                )}
                              </Td>
                            </tr>
                          ))}
                        </Tbody>
                      </Table>
                    </div>
                  </div>
                )}

              </div>

              {/* Right Column: Instructions */}
              <div className="premium-card p-6 h-fit space-y-4">
                <h3 className="text-sm font-semibold text-[#1c1917] flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-[#7a5a7e]" />
                  คำแนะนำรูปแบบข้อมูล
                </h3>
                
                <p className="text-xs text-stone-600 leading-relaxed">
                  กรุณาเตรียมไฟล์ข้อมูลในรูปแบบ CSV โดยวางข้อความที่แยกข้อมูลด้วยเครื่องหมายจุลภาค <strong>(,)</strong> และคั่นแต่ละบรรทัดด้วยการขึ้นบรรทัดใหม่
                </p>

                <div className="p-3 bg-stone-50 rounded border border-[#e4e0d6] font-mono text-[10px] text-stone-600 leading-relaxed">
                  <span className="text-stone-400"># รูปแบบคอลัมน์:</span><br />
                  sku, channel, tier, price, valid_from, valid_to
                </div>

                <div className="space-y-2 text-xs text-stone-600">
                  <div className="flex gap-2">
                    <span className="font-semibold text-[#7a5a7e]">1. sku:</span>
                    <span>รหัสสินค้าที่ต้องการตั้งค่าราคา (ต้องมีอยู่จริงในคลัง)</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-[#7a5a7e]">2. channel:</span>
                    <span><strong>TRD</strong> หรือ <strong>AKRA</strong> เท่านั้น</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-[#7a5a7e]">3. tier:</span>
                    <span>ระดับสมาชิก <strong>T0</strong> (ทั่วไป), <strong>T1</strong>, <strong>T2</strong>, <strong>T3</strong></span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-[#7a5a7e]">4. price:</span>
                    <span>ราคาขายเป็นตัวเลข ทศนิยมไม่เกิน 4 ตำแหน่ง (เช่น 150 หรือ 99.50)</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-[#7a5a7e]">5. valid_from:</span>
                    <span>วันที่เริ่มมีผล รูปแบบ YYYY-MM-DD (เช่น 2026-05-23)</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-[#7a5a7e]">6. valid_to:</span>
                    <span>วันที่สิ้นสุดราคา รูปแบบ YYYY-MM-DD (ไม่ต้องใส่ก็ได้)</span>
                  </div>
                </div>

                <div className="border-t border-[#e4e0d6] pt-3 text-[11px] text-stone-500">
                  ⚠️ การนำเข้าที่มี SKU ซ้ำ, ช่องทางซ้ำ, ระดับสมาชิกซ้ำ และวันที่เริ่มซ้ำกัน จะทำการ<strong>อัปเดตราคาเดิม</strong>ให้โดยอัตโนมัติ (Upsert)
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </DirectionalTransition>
  );
}

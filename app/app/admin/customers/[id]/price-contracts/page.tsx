'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Tag,
  ArrowLeft,
  Loader2,
  Calendar,
  Percent,
  Lock
} from 'lucide-react';
import { get, post } from '@/lib/api-client';
import { Button, Table, Thead, Tbody, Th, Td } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import type { Product, CustomerPriceContract, Customer } from '@/types';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

// ProductSearch component for autocomplete
interface ProductSearchProps {
  onSelect: (product: Product | null) => void;
  selectedProduct: Product | null;
  searchPlaceholder: string;
  searchingText: string;
}

function ProductSearch({ onSelect, selectedProduct, searchPlaceholder, searchingText }: ProductSearchProps) {
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
    const timer = setTimeout(async () => {
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
    return () => clearTimeout(timer);
  }, [query, selectedProduct]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          type="text"
          className="w-full rounded border border-[#e4e0d6] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#7a5a7e] focus:ring-1 focus:ring-[#7a5a7e] min-h-[38px] pr-8"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value === '') onSelect(null);
          }}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
        />
        {selectedProduct && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResults([]); setOpen(false); onSelect(null); }}
            className="absolute right-2.5 text-gray-400 hover:text-gray-600 text-sm"
          >
            ✕
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-[#e4e0d6] rounded-md shadow-lg max-h-52 overflow-y-auto">
          {loading && (
            <p className="px-3 py-2 text-xs text-gray-400">{searchingText}</p>
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

export default function CustomerPriceContractsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const toast = useToast();
  const t = useT();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [contracts, setContracts] = useState<(CustomerPriceContract & { product_sku?: string; product_name_th?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [contractMode, setContractMode] = useState<'price' | 'discount'>('price');
  const [priceVal, setPriceVal] = useState('');
  const [discountVal, setDiscountVal] = useState('');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [validTo, setValidTo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchCustomerAndContracts = useCallback(async () => {
    setLoading(true);
    try {
      const [customerRes, contractsRes] = await Promise.all([
        get<Customer>(`/api/customers/${id}`).catch(() => null),
        get<{ data: (CustomerPriceContract & { product_sku?: string; product_name_th?: string })[] }>(
          `/api/admin/customer-price-contracts?customer_id=${id}&limit=100`
        ).catch(() => ({ data: [] }))
      ]);

      if (!customerRes) {
        toast('error', t('price_contract.error_not_found'));
        router.push('/app/customers');
        return;
      }

      setCustomer(customerRes);
      setContracts(contractsRes?.data || []);
    } catch (err) {
      console.error('Failed to load contract details:', err);
      toast('error', t('price_contract.error_load'));
    } finally {
      setLoading(false);
    }
  }, [id, router, toast, t]);

  useEffect(() => {
    fetchCustomerAndContracts();
  }, [fetchCustomerAndContracts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let lockedPrice: number | null = null;
    let discountPct: number | null = null;

    if (contractMode === 'price') {
      const val = Number(priceVal);
      if (isNaN(val) || val < 0 || priceVal === '') {
        toast('error', t('price_contract.error_invalid_price'));
        return;
      }
      lockedPrice = val;
    } else {
      const val = Number(discountVal);
      if (isNaN(val) || val < 0 || val > 100 || discountVal === '') {
        toast('error', t('price_contract.error_invalid_discount'));
        return;
      }
      discountPct = val;
    }

    if (validTo && validTo < validFrom) {
      toast('error', t('price_contract.error_date_range'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await post<{ contract: CustomerPriceContract }>('/api/admin/customer-price-contracts', {
        customer_id: id,
        product_id: selectedProduct?.id || null,
        locked_price: lockedPrice,
        discount_pct: discountPct,
        valid_from: validFrom,
        valid_to: validTo || null
      });

      if (res) {
        toast('success', t('price_contract.success'));
        setSelectedProduct(null);
        setPriceVal('');
        setDiscountVal('');
        setValidTo('');
        fetchCustomerAndContracts();
      }
    } catch (err) {
      const error = err as Error;
      console.error(error);
      toast('error', error.message || t('price_contract.error_save'));
    } finally {
      setSubmitting(false);
    }
  };

  const formatMoney = (val: number | string | null) => {
    if (val === null) return '-';
    return Number(val).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + t('price_contract.money_suffix');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <Loader2 className="w-10 h-10 text-[#7a5a7e] animate-spin mb-4" />
        <span className="text-sm text-stone-500 font-medium">{t('price_contract.loading')}</span>
      </div>
    );
  }

  if (!customer) return null;

  return (
    <DirectionalTransition>
      <div className="max-w-[1000px] mx-auto min-h-[calc(100vh-140px)] font-sans px-4 py-8">

        {/* Style tweaks */}
        <style dangerouslySetInnerHTML={{ __html: `
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
              href={`/app/customers/${id}`}
              className="w-9 h-9 rounded-full border border-[#e4e0d6] flex items-center justify-center hover:bg-stone-50 text-[#78716c] hover:text-[#1c1917] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#7a5a7e] font-semibold mb-1">
                <span>B2B CUSTOMERS</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#7a5a7e]/40" />
                <span>{t('price_contract.breadcrumb')}</span>
              </div>
              <h1 className="font-display text-[26px] font-semibold tracking-tight text-[#1c1917] m-0">
                {t('price_contract.page.title_prefix')} {customer.name_th}
              </h1>
              <p className="text-stone-500 font-mono text-xs mt-1">{t('price_contract.page.customer_code_prefix')} {customer.code}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left 2 Columns: Contract List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="premium-card p-6">
              <h3 className="text-base font-semibold text-[#1c1917] mb-4">{t('price_contract.contracts_title')}</h3>

              {contracts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[#e4e0d6] rounded-md">
                  <Tag className="w-10 h-10 text-stone-300 mb-4" />
                  <span className="text-sm text-stone-500 font-medium">{t('price_contract.no_contracts')}</span>
                  <span className="text-xs text-stone-400 mt-1">{t('price_contract.no_contracts_hint')}</span>
                </div>
              ) : (
                <div className="overflow-x-auto rounded border border-[#e4e0d6]">
                  <Table className="min-w-full divide-y divide-[#e4e0d6]">
                    <Thead>
                      <tr>
                        <Th className="text-left font-semibold text-xs py-2.5 px-3 text-stone-600">{t('price_contract.col.product')}</Th>
                        <Th className="text-center font-semibold text-xs py-2.5 px-3 text-stone-600">{t('price_contract.col.condition')}</Th>
                        <Th className="text-center font-semibold text-xs py-2.5 px-3 text-stone-600">{t('price_contract.col.period')}</Th>
                      </tr>
                    </Thead>
                    <Tbody>
                      {contracts.map((c) => (
                        <tr key={c.id} className="hover:bg-stone-50 transition-colors text-xs">
                          <Td className="py-3 px-3">
                            {c.product_id ? (
                              <div>
                                <span className="font-mono font-semibold text-[#7a5a7e]">{c.product_sku}</span>
                                <div className="text-stone-900 font-medium mt-0.5">{c.product_name_th}</div>
                              </div>
                            ) : (
                              <span className="italic text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                                {t('price_contract.global_contract')}
                              </span>
                            )}
                          </Td>
                          <Td className="py-3 px-3 text-center">
                            {c.locked_price !== null ? (
                              <span className="inline-flex items-center gap-1 bg-[#7a5a7e]/5 text-[#7a5a7e] px-2 py-1 rounded font-semibold font-mono">
                                <Lock className="w-3.5 h-3.5" />
                                {t('price_contract.locked_price_prefix')} {formatMoney(c.locked_price)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded font-semibold font-mono">
                                <Percent className="w-3.5 h-3.5" />
                                {t('price_contract.discount_prefix')} {c.discount_pct}%
                              </span>
                            )}
                          </Td>
                          <Td className="py-3 px-3 text-center text-stone-500 font-medium">
                            <div className="flex items-center justify-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-stone-400" />
                              <span>{c.valid_from}</span>
                              <span>→</span>
                              <span>{c.valid_to || t('price_contract.forever')}</span>
                            </div>
                          </Td>
                        </tr>
                      ))}
                    </Tbody>
                  </Table>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Add Contract Form */}
          <div className="premium-card p-6 h-fit">
            <h3 className="text-base font-semibold text-[#1c1917] border-b border-[#e4e0d6] pb-3 mb-4">{t('price_contract.add_title')}</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                  {t('price_contract.target_product_label')}
                </label>
                <ProductSearch
                  onSelect={setSelectedProduct}
                  selectedProduct={selectedProduct}
                  searchPlaceholder={t('price_contract.search_placeholder')}
                  searchingText={t('price_contract.searching')}
                />
                <span className="text-[10px] text-stone-400 mt-1 block">
                  * {t('price_contract.target_hint')}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                  {t('price_contract.condition_label')}
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-md">
                  <button
                    type="button"
                    className={cn(
                      "py-1.5 text-xs font-medium rounded transition-colors",
                      contractMode === 'price' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
                    )}
                    onClick={() => { setContractMode('price'); setDiscountVal(''); }}
                  >
                    {t('price_contract.locked_price_btn')}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "py-1.5 text-xs font-medium rounded transition-colors",
                      contractMode === 'discount' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
                    )}
                    onClick={() => { setContractMode('discount'); setPriceVal(''); }}
                  >
                    {t('price_contract.discount_btn')}
                  </button>
                </div>
              </div>

              {contractMode === 'price' ? (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                    {t('price_contract.locked_price_label')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      className="w-full rounded border border-[#e4e0d6] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#7a5a7e]"
                      placeholder="0.00"
                      value={priceVal}
                      onChange={(e) => setPriceVal(e.target.value)}
                    />
                    <span className="absolute right-3 top-2 text-xs font-semibold text-stone-400">{t('label.baht')}</span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                    {t('price_contract.discount_label')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-full rounded border border-[#e4e0d6] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#7a5a7e]"
                      placeholder="e.g. 5 or 10"
                      value={discountVal}
                      onChange={(e) => setDiscountVal(e.target.value)}
                    />
                    <span className="absolute right-3 top-2 text-xs font-semibold text-stone-400">%</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                  {t('price_contract.valid_from_label')}
                </label>
                <input
                  type="date"
                  className="w-full rounded border border-[#e4e0d6] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#7a5a7e]"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                  {t('price_contract.valid_to_label')}
                </label>
                <input
                  type="date"
                  className="w-full rounded border border-[#e4e0d6] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#7a5a7e]"
                  value={validTo}
                  onChange={(e) => setValidTo(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full mt-4 py-2.5 bg-[#7a5a7e] hover:bg-[#6b4e6f] text-white font-medium rounded text-sm transition-colors flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('price_contract.submit_btn')}
              </Button>
            </form>
          </div>

        </div>
      </div>
    </DirectionalTransition>
  );
}

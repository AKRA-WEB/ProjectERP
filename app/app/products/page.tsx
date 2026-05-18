'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import { PaginatedResponse, Product } from '@/types';
import ProductFormModal from './ProductFormModal';
import ProductImportModal from '@/components/inventory/ProductImportModal';
import Link from 'next/link';

import { DirectionalTransition } from '@/components/ui/directional-transition';
import { useT, useLanguage, localeName } from '@/lib/i18n';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

export default function ProductsPage() {
  const [data, setData] = useState<PaginatedResponse<Product> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState<Product | undefined>(undefined);
  const t = useT();
  const { lang } = useLanguage();

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (search) params.set('search', search);
      setData(await get<PaginatedResponse<Product>>(`/api/products?${params}`));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  function openEdit(p: Product) {
    setSelected(p);
    setShowForm(true);
  }

  function openNew() {
    setSelected(undefined);
    setShowForm(true);
  }

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12 space-y-5">

        {/* Header */}
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-stone-950 leading-tight mb-1">
              {t('page.products')}
            </h1>
            <p className="text-[13.5px] text-stone-500">
              Products · {loading ? '—' : (data?.total ?? 0).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')} {t('label.total').toLowerCase()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] border border-stone-200 text-stone-700 text-[13px] font-medium hover:bg-stone-50 transition-colors"
            >
              {t('action.import')}
            </button>
            <button
              onClick={openNew}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] bg-stone-950 text-white text-[13px] font-medium shadow-sm hover:bg-stone-800 transition-colors"
            >
              + {t('action.create')}
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2 w-full max-w-[300px] bg-stone-50 border border-stone-200 rounded-[8px] px-3 py-[6px] text-stone-400 text-[13px] focus-within:border-stone-300 focus-within:bg-white transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            placeholder={t('label.search_placeholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 bg-transparent border-0 outline-none text-stone-700 placeholder:text-stone-400 text-[13px]"
          />
        </div>

        {/* Table card */}
        <div className={CARD}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {[
                  { h: t('label.sku'), sm: false },
                  { h: t('label.product'), sm: false },
                  { h: t('label.department'), sm: true },
                  { h: t('label.unit'), sm: true },
                  { h: t('label.price'),   sm: true },
                  { h: t('label.status'),   sm: false },
                  { h: '',        sm: false },
                ].map(({ h, sm }, i) => (
                  <th key={i} className={`text-left py-2.5 px-3.5 text-[11.5px] font-medium tracking-[.04em] uppercase text-stone-400 bg-stone-50 border-y border-stone-200 first:pl-5 last:pr-5 ${sm ? 'hidden lg:table-cell' : ''} ${i === 4 ? 'text-right' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-[13px] text-stone-400">{t('label.loading')}</td></tr>
              ) : data?.data.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-[13px] text-stone-400">{t('label.no_data')}</td></tr>
              ) : data?.data.map((p) => (
                <tr key={p.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60 cursor-default transition-colors group">
                  <td className="py-0 h-11 px-3.5 pl-5">
                    <Link href={`/app/products/${p.id}`} transitionTypes={['nav-forward']} className="font-mono text-[12.5px] font-medium text-emerald-700 hover:underline">
                      {p.sku}
                    </Link>
                  </td>
                  <td className="py-0 h-11 px-3.5">
                    <Link href={`/app/products/${p.id}`} transitionTypes={['nav-forward']} className="font-medium text-stone-900 truncate max-w-[200px] hover:text-emerald-700 block transition-colors">
                      {localeName(p.name_th, p.name_en, lang)}
                    </Link>
                    {lang === 'th' && p.name_en && <div className="text-[11px] text-stone-400 truncate max-w-[200px]">{p.name_en}</div>}
                  </td>
                  <td className="py-0 h-11 px-3.5 text-stone-500 hidden lg:table-cell">{p.category_name ?? '—'}</td>
                  <td className="py-0 h-11 px-3.5 text-stone-500 hidden lg:table-cell">{p.uom_code}</td>
                  <td className="py-0 h-11 px-3.5 text-right font-mono tabular-nums font-medium text-stone-900 hidden lg:table-cell">
                    {formatCurrency(p.unit_cost, lang)}
                  </td>
                  <td className="py-0 h-11 px-3.5">
                    <span className={`inline-flex items-center gap-[5px] px-2 py-[2px] text-[11.5px] font-medium rounded-full border leading-[1.5] before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-current ${p.is_active ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-stone-500 border-stone-200 bg-stone-50'}`}>
                      {p.is_active ? t('status.active') : t('status.inactive')}
                    </span>
                  </td>
                  <td className="py-0 h-11 px-3.5 pr-5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => openEdit(p)} className="text-[12px] text-stone-400 hover:text-emerald-700 transition-colors">
                        {t('action.edit')}
                      </button>
                      <Link href={`/app/products/${p.id}`} transitionTypes={['nav-forward']} className="text-stone-300 hover:text-emerald-600 transition-colors">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between text-[13px] text-stone-500 pt-2">
            <span>{t('label.all')} {page} {t('label.select_placeholder')} {data.total_pages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="h-8 px-3 rounded-[7px] border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none text-[13px]">
                ← {t('action.back')}
              </button>
              <button onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))} disabled={page === data.total_pages}
                className="h-8 px-3 rounded-[7px] border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none text-[13px]">
                {t('action.submit')} →
              </button>
            </div>
          </div>
        )}

        {/* Product form modal */}
        {showForm && (
          <ProductFormModal
            product={selected || null}
            onClose={() => setShowForm(false)}
            onSaved={() => { setShowForm(false); fetchProducts(); }}
          />
        )}

        {/* Product import modal */}
        <ProductImportModal
          open={showImport}
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); fetchProducts(); }}
        />
      </div>
    </DirectionalTransition>
  );
}

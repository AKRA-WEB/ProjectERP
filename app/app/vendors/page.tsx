'use client';

import { useState, useEffect, useCallback } from 'react';
import { get, post, patch } from '@/lib/api-client';
import type { PaginatedResponse } from '@/types';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import { useT, useLanguage, localeName } from '@/lib/i18n';

interface Vendor {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  tax_id: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  payment_terms_days: number;
  is_active: boolean;
}

const emptyForm = { code: '', name_th: '', name_en: '', tax_id: '', contact_name: '', phone: '', email: '', payment_terms_days: '30' };

const AVATAR_COLORS = [
  '#a78bfa', '#fb923c', '#22c55e', '#0ea5e9', '#f43f5e',
  '#f59e0b', '#6366f1', '#14b8a6', '#8b5cf6', '#ec4899',
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

// ---- Vendor Form Modal ----
function VendorModal({
  editing,
  form,
  saving,
  error,
  onClose,
  onSave,
  onChange,
}: {
  editing: Vendor | null;
  form: typeof emptyForm;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: () => void;
  onChange: (key: string, val: string) => void;
}) {
  const t = useT();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const field = (label: string, key: string, type = 'text', disabled = false) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-stone-600">{label}</label>
      <input
        type={type}
        value={form[key as keyof typeof form]}
        onChange={(e) => onChange(key, e.target.value)}
        disabled={disabled}
        className="bg-white border border-stone-200 rounded-[7px] px-3 py-[7px] text-[13px] text-stone-900 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-50 disabled:bg-stone-50"
      />
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(15,23,42,.42)] backdrop-blur-[4px] animate-[fadeIn_.14s_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[14px] shadow-[0_12px_32px_-8px_rgba(15,23,42,.18),0_2px_6px_rgba(15,23,42,.06)] w-[560px] max-w-[calc(100vw-40px)] max-h-[calc(100vh-60px)] flex flex-col overflow-hidden animate-[popIn_.18s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-[22px] py-[18px] pb-[14px] border-b border-stone-100">
          <div>
            <h3 className="text-[17px] font-semibold tracking-tight text-stone-950">
              {editing ? t('action.edit') + t('label.vendor') : t('action.create') + t('label.vendor')}
            </h3>
            <div className="text-[12px] text-stone-400 mt-0.5">{t('label.note')}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-[7px] grid place-items-center text-stone-400 hover:bg-stone-100 hover:text-stone-700">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="px-[22px] py-[18px] overflow-auto flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            {field(t('label.code') + ' *', 'code', 'text', !!editing)}
            {field(t('label.name') + ' (TH) *', 'name_th')}
            {field(t('label.name') + ' (EN) *', 'name_en')}
            {field(t('label.tax_id'), 'tax_id')}
            {field(t('label.employee'), 'contact_name')}
            {field(t('label.phone'), 'phone')}
            {field(t('label.email'), 'email', 'email')}
            {field(t('label.reference'), 'payment_terms_days', 'number')}
          </div>
          {error && <p className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-[7px] px-3 py-2">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-[22px] py-[14px] border-t border-stone-100 bg-stone-50/60">
          <button onClick={onClose} className="h-8 px-3 rounded-[7px] text-[13px] font-medium text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 shadow-[0_1px_0_rgba(15,23,42,.03)]">
            {t('action.cancel')}
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="h-8 px-3 rounded-[7px] text-[13px] font-medium text-white bg-stone-950 hover:bg-stone-800 shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {saving ? t('label.loading') : (editing ? t('action.save') : '+ ' + t('action.create'))}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes popIn  { from { opacity:0; transform:translateY(8px) scale(.98) } to { opacity:1; transform:none } }
      `}</style>
    </div>
  );
}

// ---- Main Page ----
export default function VendorsPage() {
  const [data, setData] = useState<PaginatedResponse<Vendor> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const t = useT();
  const { lang } = useLanguage();

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (search) params.set('search', search);
      setData(await get<PaginatedResponse<Vendor>>(`/api/vendors?${params}`));
    } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  function openNew() {
    setEditing(null); setForm(emptyForm); setError(''); setShowModal(true);
  }

  function openEdit(v: Vendor) {
    setEditing(v);
    setForm({ code: v.code, name_th: v.name_th, name_en: v.name_en ?? '', tax_id: v.tax_id ?? '', contact_name: v.contact_name ?? '', phone: v.phone ?? '', email: v.email ?? '', payment_terms_days: String(v.payment_terms_days) });
    setError(''); setShowModal(true);
  }

  function setF(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleSave() {
    if (!form.code.trim() || !form.name_th.trim() || !form.name_en.trim()) {
      setError(t('error.required')); return;
    }
    setError(''); setSaving(true);
    try {
      const payload = { code: form.code, name_th: form.name_th, name_en: form.name_en, tax_id: form.tax_id || undefined, contact_name: form.contact_name || undefined, phone: form.phone || undefined, email: form.email || undefined, payment_terms_days: parseInt(form.payment_terms_days) || 30 };
      if (editing) { await patch(`/api/vendors/${editing.id}`, payload); }
      else { await post('/api/vendors', payload); }
      setShowModal(false); await fetchVendors();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('error.server'));
    } finally { setSaving(false); }
  }

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12 space-y-5">

        {/* Header */}
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-stone-950 leading-tight mb-1">
              {t('page.vendors')}
            </h1>
            <p className="text-[13.5px] text-stone-500">
              Vendors · {loading ? '—' : (data?.total ?? 0).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')} {t('label.total').toLowerCase()}
            </p>
          </div>
          <div className="flex items-center gap-2">
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
                  { h: t('label.vendor'),    sm: false },
                  { h: t('label.code'),          sm: false },
                  { h: t('label.tax_id'), sm: true },
                  { h: t('action.submit'),         sm: true },
                  { h: t('label.reference'),         sm: true },
                  { h: t('label.status'),          sm: false },
                  { h: '',               sm: false },
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
              ) : data?.data.map((v: Vendor) => {
                const color = avatarColor(v.name_th);
                return (
                  <tr key={v.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60 cursor-default transition-colors">
                    {/* Avatar + Name */}
                    <td className="py-0 h-12 px-3.5 pl-5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-6 h-6 rounded-[6px] shrink-0 grid place-items-center text-[11px] font-semibold"
                          style={{ background: color + '22', color }}
                        >
                          {localeName(v.name_th, v.name_en, lang).slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-medium text-stone-900">{localeName(v.name_th, v.name_en, lang)}</div>
                          {lang === 'th' && v.name_en && <div className="text-[11.5px] text-stone-400">{v.name_en}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-0 h-12 px-3.5 font-mono text-[12.5px] text-stone-600">{v.code}</td>
                    <td className="py-0 h-12 px-3.5 text-stone-500 font-mono text-[12.5px] hidden lg:table-cell">{v.tax_id ?? '—'}</td>
                    <td className="py-0 h-12 px-3.5 hidden lg:table-cell">
                      {v.contact_name && <div className="text-[13px] text-stone-700">{v.contact_name}</div>}
                      {v.phone && <div className="text-[11.5px] text-stone-400">{v.phone}</div>}
                    </td>
                    <td className="py-0 h-12 px-3.5 text-right font-mono text-[12.5px] text-stone-500 hidden lg:table-cell">
                      {v.payment_terms_days} {t('label.date')}
                    </td>
                    <td className="py-0 h-12 px-3.5">
                      <span className={`inline-flex items-center gap-[5px] px-2 py-[2px] text-[11.5px] font-medium rounded-full border leading-[1.5] before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-current ${v.is_active ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-stone-500 border-stone-200 bg-stone-50'}`}>
                        {v.is_active ? t('status.active') : t('status.inactive')}
                      </span>
                    </td>
                    <td className="py-0 h-12 px-3.5 pr-5">
                      <div className="flex items-center gap-3">
                        <button onClick={() => openEdit(v)} className="text-[12px] text-stone-400 hover:text-emerald-700 transition-colors">
                          {t('action.edit')}
                        </button>
                        <Link href={`/app/vendors/${v.id}`} transitionTypes={['nav-forward']} className="text-stone-300 hover:text-emerald-600 transition-colors">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between text-[13px] text-stone-500">
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

        {/* Vendor modal */}
        {showModal && (
          <VendorModal
            editing={editing}
            form={form}
            saving={saving}
            error={error}
            onClose={() => setShowModal(false)}
            onSave={handleSave}
            onChange={setF}
          />
        )}
      </div>
    </DirectionalTransition>
  );
}

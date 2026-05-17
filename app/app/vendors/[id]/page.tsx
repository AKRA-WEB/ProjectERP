'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { get, patch, post, del } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/format';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';

interface CatalogItem {
  id: string;
  product_id: string;
  vendor_sku: string | null;
  unit_price: number;
  lead_days: number;
  is_preferred: boolean;
  product_sku: string;
  product_name_en: string;
}

interface Vendor {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  tax_id: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address_th: string | null;
  payment_terms_days: number;
  is_active: boolean;
  created_at: string;
  catalog: CatalogItem[] | null;
}

interface Product {
  id: string;
  sku: string;
  name_th: string;
  name_en: string;
}

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';
const FIELD_CLS = 'bg-white border border-stone-200 rounded-[7px] px-3 py-[7px] text-[13px] text-stone-900 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-50 disabled:bg-stone-50 w-full';
const LABEL_CLS = 'text-[12px] font-medium text-stone-600 mb-1.5 block';

// ---- Edit Vendor Modal ----
function EditModal({ vendor, onClose, onSaved }: { vendor: Vendor; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name_th: vendor.name_th,
    name_en: vendor.name_en ?? '',
    tax_id: vendor.tax_id ?? '',
    contact_name: vendor.contact_name ?? '',
    phone: vendor.phone ?? '',
    email: vendor.email ?? '',
    address_th: vendor.address_th ?? '',
    payment_terms_days: String(vendor.payment_terms_days),
    is_active: vendor.is_active,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  async function handleSave() {
    setSaving(true); setError('');
    try {
      await patch(`/api/vendors/${vendor.id}`, {
        name_th: form.name_th,
        name_en: form.name_en || undefined,
        tax_id: form.tax_id || null,
        contact_name: form.contact_name || null,
        phone: form.phone || null,
        email: form.email || null,
        address_th: form.address_th || null,
        payment_terms_days: parseInt(form.payment_terms_days) || 30,
        is_active: form.is_active,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(15,23,42,.42)] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-white rounded-[14px] shadow-[0_12px_32px_-8px_rgba(15,23,42,.18),0_2px_6px_rgba(15,23,42,.06)] w-[580px] max-w-[calc(100vw-40px)] max-h-[calc(100vh-60px)] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-[22px] py-[18px] pb-[14px] border-b border-stone-100">
          <h3 className="text-[17px] font-semibold tracking-tight text-stone-950">แก้ไขข้อมูลผู้จำหน่าย</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-[7px] grid place-items-center text-stone-400 hover:bg-stone-100 hover:text-stone-700">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="px-[22px] py-[18px] overflow-auto flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              ['ชื่อ (ไทย) *', 'name_th'],
              ['ชื่อ (อังกฤษ)', 'name_en'],
              ['เลขผู้เสียภาษี', 'tax_id'],
              ['ผู้ติดต่อ', 'contact_name'],
              ['โทรศัพท์', 'phone'],
              ['อีเมล', 'email'],
            ] as [string, string][]).map(([label, key]) => (
              <div key={key}>
                <label className={LABEL_CLS}>{label}</label>
                <input
                  type={key === 'email' ? 'email' : 'text'}
                  value={form[key as keyof typeof form] as string}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className={FIELD_CLS}
                />
              </div>
            ))}
          </div>
          <div>
            <label className={LABEL_CLS}>ที่อยู่</label>
            <textarea
              value={form.address_th}
              onChange={(e) => setForm((f) => ({ ...f, address_th: e.target.value }))}
              rows={2}
              className={`${FIELD_CLS} resize-none`}
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className={LABEL_CLS}>เครดิต (วัน)</label>
              <input type="number" value={form.payment_terms_days}
                onChange={(e) => setForm((f) => ({ ...f, payment_terms_days: e.target.value }))}
                className={FIELD_CLS} />
            </div>
            <label className="flex items-center gap-2 text-[13px] text-stone-600 cursor-pointer mt-5">
              <input type="checkbox" checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="w-3.5 h-3.5 rounded border-stone-300 accent-emerald-600" />
              ใช้งานอยู่
            </label>
          </div>
          {error && <p className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-[7px] px-3 py-2">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-[22px] py-[14px] border-t border-stone-100 bg-stone-50/60">
          <button onClick={onClose} className="h-8 px-3 rounded-[7px] text-[13px] font-medium text-stone-600 bg-white border border-stone-200 hover:bg-stone-50">ยกเลิก</button>
          <button onClick={handleSave} disabled={saving}
            className="h-8 px-3 rounded-[7px] text-[13px] font-medium text-white bg-stone-950 hover:bg-stone-800 disabled:opacity-50">
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Add to Catalog Modal ----
function AddCatalogModal({ vendorId, onClose, onSaved }: { vendorId: string; onClose: () => void; onSaved: () => void }) {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [form, setForm] = useState({ vendor_sku: '', unit_price: '', lead_days: '0', is_preferred: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!search.trim()) { setProducts([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await get<{ data: Product[] }>(`/api/products?search=${encodeURIComponent(search)}&limit=10`);
        setProducts(res.data);
      } catch { setProducts([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  async function handleSave() {
    if (!selected) { setError('เลือกสินค้าก่อน'); return; }
    const price = parseFloat(form.unit_price);
    if (isNaN(price) || price < 0) { setError('ราคาไม่ถูกต้อง'); return; }
    setSaving(true); setError('');
    try {
      await post(`/api/vendors/${vendorId}/products`, {
        product_id: selected.id,
        vendor_sku: form.vendor_sku || null,
        unit_price: price,
        lead_days: parseInt(form.lead_days) || 0,
        is_preferred: form.is_preferred,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(15,23,42,.42)] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-white rounded-[14px] shadow-[0_12px_32px_-8px_rgba(15,23,42,.18)] w-[520px] max-w-[calc(100vw-40px)] max-h-[calc(100vh-60px)] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-[22px] py-[18px] pb-[14px] border-b border-stone-100">
          <h3 className="text-[17px] font-semibold tracking-tight text-stone-950">เพิ่มสินค้าในแคตาล็อก</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-[7px] grid place-items-center text-stone-400 hover:bg-stone-100 hover:text-stone-700">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="px-[22px] py-[18px] overflow-auto flex flex-col gap-4">
          <div>
            <label className={LABEL_CLS}>ค้นหาสินค้า</label>
            <input
              placeholder="พิมพ์ SKU หรือชื่อสินค้า..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
              className={FIELD_CLS}
            />
            {products.length > 0 && !selected && (
              <div className="mt-1 border border-stone-200 rounded-[7px] overflow-hidden max-h-[160px] overflow-y-auto">
                {products.map((p) => (
                  <button key={p.id} onClick={() => { setSelected(p); setProducts([]); setSearch(`${p.sku} — ${p.name_en || p.name_th}`); }}
                    className="w-full text-left px-3 py-2 text-[13px] hover:bg-stone-50 border-b border-stone-50 last:border-0">
                    <span className="font-mono text-[12px] text-stone-500 mr-2">{p.sku}</span>
                    <span className="text-stone-800">{p.name_en || p.name_th}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>รหัสสินค้า (Vendor SKU)</label>
                <input value={form.vendor_sku} onChange={(e) => setForm((f) => ({ ...f, vendor_sku: e.target.value }))} className={FIELD_CLS} placeholder="ไม่บังคับ" />
              </div>
              <div>
                <label className={LABEL_CLS}>ราคาต่อหน่วย (THB) *</label>
                <input type="number" value={form.unit_price} onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))} className={FIELD_CLS} placeholder="0.00" />
              </div>
              <div>
                <label className={LABEL_CLS}>Lead Time (วัน)</label>
                <input type="number" value={form.lead_days} onChange={(e) => setForm((f) => ({ ...f, lead_days: e.target.value }))} className={FIELD_CLS} />
              </div>
              <div className="flex items-center gap-2 mt-5">
                <input type="checkbox" id="preferred" checked={form.is_preferred}
                  onChange={(e) => setForm((f) => ({ ...f, is_preferred: e.target.checked }))}
                  className="w-3.5 h-3.5 rounded border-stone-300 accent-emerald-600" />
                <label htmlFor="preferred" className="text-[13px] text-stone-600 cursor-pointer">ผู้จำหน่ายหลัก</label>
              </div>
            </div>
          )}

          {error && <p className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-[7px] px-3 py-2">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-[22px] py-[14px] border-t border-stone-100 bg-stone-50/60">
          <button onClick={onClose} className="h-8 px-3 rounded-[7px] text-[13px] font-medium text-stone-600 bg-white border border-stone-200 hover:bg-stone-50">ยกเลิก</button>
          <button onClick={handleSave} disabled={saving || !selected}
            className="h-8 px-3 rounded-[7px] text-[13px] font-medium text-white bg-stone-950 hover:bg-stone-800 disabled:opacity-50">
            {saving ? 'กำลังบันทึก...' : '+ เพิ่มสินค้า'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Main Page ----
export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddCatalog, setShowAddCatalog] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchVendor = useCallback(async () => {
    setLoading(true);
    try {
      setVendor(await get<Vendor>(`/api/vendors/${id}`));
    } catch { router.push('/app/vendors'); }
    finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { fetchVendor(); }, [fetchVendor]);

  async function removeCatalogItem(productId: string) {
    setRemovingId(productId);
    try {
      await del(`/api/vendors/${id}/products?product_id=${productId}`);
      await fetchVendor();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally { setRemovingId(null); }
  }

  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto pb-12">
        <div className="text-[13px] text-stone-400 py-16 text-center">กำลังโหลด...</div>
      </div>
    );
  }

  if (!vendor) return null;

  const catalog = vendor.catalog ?? [];
  const AVATAR_COLORS = ['#a78bfa', '#fb923c', '#22c55e', '#0ea5e9', '#f43f5e', '#f59e0b', '#6366f1', '#14b8a6'];
  let h = 0;
  for (let i = 0; i < vendor.name_th.length; i++) h = (h * 31 + vendor.name_th.charCodeAt(i)) & 0xffff;
  const color = AVATAR_COLORS[h % AVATAR_COLORS.length];

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12 space-y-5">

        {/* Back */}
        <Link href="/app/vendors" transitionTypes={['nav-back']} className="inline-flex items-center gap-1.5 text-[13px] text-stone-400 hover:text-stone-700 transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          ผู้จำหน่ายทั้งหมด
        </Link>

        {/* Header card */}
        <div className={`${CARD} p-6`}>
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-12 h-12 rounded-[10px] shrink-0 grid place-items-center text-[18px] font-semibold"
              style={{ background: color + '22', color }}>
              {vendor.name_th.slice(0, 2)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[22px] font-semibold tracking-tight text-stone-950 leading-tight">{vendor.name_th}</h1>
                <span className={`inline-flex items-center gap-[5px] px-2 py-[2px] text-[11.5px] font-medium rounded-full border leading-[1.5] before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-current ${vendor.is_active ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-stone-500 border-stone-200 bg-stone-50'}`}>
                  {vendor.is_active ? 'ใช้งาน' : 'ปิดใช้'}
                </span>
              </div>
              {vendor.name_en && <div className="text-[13.5px] text-stone-400 mt-0.5">{vendor.name_en}</div>}
            </div>

            <button onClick={() => setShowEdit(true)}
              className="h-8 px-3 rounded-[7px] text-[13px] font-medium text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 shadow-[0_1px_0_rgba(15,23,42,.03)] inline-flex items-center gap-1.5 shrink-0">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M9 2L11 4 4.5 10.5H2.5v-2L9 2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              แก้ไข
            </button>
          </div>

          {/* Info grid */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5 border-t border-stone-100">
            {[
              { label: 'รหัส', value: vendor.code, mono: true },
              { label: 'เลขผู้เสียภาษี', value: vendor.tax_id ?? '—', mono: true },
              { label: 'เครดิต', value: `${vendor.payment_terms_days} วัน` },
              { label: 'วันที่เพิ่ม', value: formatDate(vendor.created_at) },
            ].map((item) => (
              <div key={item.label}>
                <div className="text-[11.5px] text-stone-400 mb-1">{item.label}</div>
                <div className={`text-[13.5px] text-stone-800 font-medium ${item.mono ? 'font-mono' : ''}`}>{item.value}</div>
              </div>
            ))}
          </div>

          {(vendor.contact_name || vendor.phone || vendor.email || vendor.address_th) && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-stone-100">
              {vendor.contact_name && (
                <div>
                  <div className="text-[11.5px] text-stone-400 mb-1">ผู้ติดต่อ</div>
                  <div className="text-[13.5px] text-stone-800">{vendor.contact_name}</div>
                </div>
              )}
              {vendor.phone && (
                <div>
                  <div className="text-[11.5px] text-stone-400 mb-1">โทรศัพท์</div>
                  <a href={`tel:${vendor.phone}`} className="text-[13.5px] text-emerald-700 hover:underline">{vendor.phone}</a>
                </div>
              )}
              {vendor.email && (
                <div>
                  <div className="text-[11.5px] text-stone-400 mb-1">อีเมล</div>
                  <a href={`mailto:${vendor.email}`} className="text-[13.5px] text-emerald-700 hover:underline truncate block max-w-[200px]">{vendor.email}</a>
                </div>
              )}
              {vendor.address_th && (
                <div className="col-span-2 lg:col-span-1">
                  <div className="text-[11.5px] text-stone-400 mb-1">ที่อยู่</div>
                  <div className="text-[13px] text-stone-600 leading-relaxed">{vendor.address_th}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Catalog section */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-semibold text-stone-950">แคตาล็อกสินค้า</h2>
            <p className="text-[13px] text-stone-400">{catalog.length} รายการ</p>
          </div>
          <button onClick={() => setShowAddCatalog(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] bg-stone-950 text-white text-[13px] font-medium shadow-sm hover:bg-stone-800 transition-colors">
            + เพิ่มสินค้า
          </button>
        </div>

        <div className={CARD}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {[
                  { h: 'SKU สินค้า',       sm: false },
                  { h: 'ชื่อสินค้า',        sm: false },
                  { h: 'SKU ผู้จำหน่าย',   sm: true },
                  { h: 'ราคาต่อหน่วย',     sm: false },
                  { h: 'Lead Time',         sm: true },
                  { h: 'หลัก',             sm: false },
                  { h: '',                  sm: false },
                ].map(({ h: hdr, sm }, i) => (
                  <th key={i} className={`text-left py-2.5 px-3.5 text-[11.5px] font-medium tracking-[.04em] uppercase text-stone-400 bg-stone-50 border-y border-stone-200 first:pl-5 last:pr-5 ${sm ? 'hidden lg:table-cell' : ''} ${i === 3 ? 'text-right' : ''}`}>
                    {hdr}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {catalog.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-[13px] text-stone-400">ยังไม่มีสินค้าในแคตาล็อก</td></tr>
              ) : catalog.map((item) => (
                <tr key={item.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60 transition-colors">
                  <td className="py-0 h-11 px-3.5 pl-5 font-mono text-[12.5px] font-medium text-stone-700">{item.product_sku}</td>
                  <td className="py-0 h-11 px-3.5 text-stone-700">{item.product_name_en || '—'}</td>
                  <td className="py-0 h-11 px-3.5 font-mono text-[12.5px] text-stone-500 hidden lg:table-cell">{item.vendor_sku ?? '—'}</td>
                  <td className="py-0 h-11 px-3.5 text-right font-mono tabular-nums font-medium text-stone-900">{formatCurrency(item.unit_price)}</td>
                  <td className="py-0 h-11 px-3.5 text-stone-500 hidden lg:table-cell">{item.lead_days} วัน</td>
                  <td className="py-0 h-11 px-3.5">
                    {item.is_preferred ? (
                      <span className="inline-flex items-center gap-[5px] px-2 py-[2px] text-[11.5px] font-medium rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 leading-[1.5] before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-current">
                        หลัก
                      </span>
                    ) : (
                      <span className="text-stone-300 text-[12px]">—</span>
                    )}
                  </td>
                  <td className="py-0 h-11 px-3.5 pr-5">
                    <button
                      onClick={() => removeCatalogItem(item.product_id)}
                      disabled={removingId === item.product_id}
                      className="text-[12px] text-stone-300 hover:text-red-500 transition-colors disabled:opacity-40"
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showEdit && (
          <EditModal vendor={vendor} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); fetchVendor(); }} />
        )}
        {showAddCatalog && (
          <AddCatalogModal vendorId={id} onClose={() => setShowAddCatalog(false)} onSaved={() => { setShowAddCatalog(false); fetchVendor(); }} />
        )}
      </div>
    </DirectionalTransition>
  );
}

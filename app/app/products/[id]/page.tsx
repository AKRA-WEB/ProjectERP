'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { get } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/format';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';

interface WarehouseStock {
  warehouse_id: string;
  warehouse_name: string;
  qty_on_hand: number;
  qty_available: number;
}

interface ProductDetail {
  id: string;
  sku: string;
  name_th: string;
  name_en: string;
  description: string | null;
  unit_cost: number;
  moving_avg_cost?: number;
  reorder_point: number;
  max_stock: number;
  is_active: boolean;
  created_at: string;
  category_name: string | null;
  uom_code: string;
  stock_by_warehouse?: WarehouseStock[];
}

interface VendorLink {
  id: string;
  vendor_id: string;
  vendor_code: string;
  vendor_name_th: string;
  vendor_name_en: string;
  vendor_sku: string | null;
  unit_price: number;
  lead_days: number;
  is_preferred: boolean;
  payment_terms_days: number;
  updated_at: string;
}

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';
const LABEL_CLS = 'text-[12px] font-medium text-stone-600 mb-1.5 block';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [vendors, setVendors] = useState<VendorLink[]>([]);
  const [tab, setTab] = useState<'info' | 'suppliers' | 'stock'>('info');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, v] = await Promise.all([
      get<ProductDetail>(`/api/products/${id}`),
      get<VendorLink[]>(`/api/products/${id}/vendors`),
    ]);
    setProduct(p);
    setVendors(v);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading || !product) return <div className="p-8 text-stone-400 text-sm">กำลังโหลด…</div>;

  return (
    <DirectionalTransition>
      <div className="max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-[12px] text-stone-400 mb-1">
              <Link href="/app/products" transitionTypes={['nav-back']} className="hover:text-stone-700">สินค้า</Link>
              <span>/</span>
              <span className="text-stone-600">{product.sku}</span>
            </div>
            <h1 className="text-2xl font-bold text-stone-900">{product.name_th}</h1>
            {product.name_en && <p className="text-sm text-stone-500 mt-0.5">{product.name_en}</p>}
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-[11.5px] font-medium border ${product.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-stone-100 text-stone-500 border-stone-200'}`}>
              {product.is_active ? 'ใช้งาน' : 'ปิดใช้'}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-stone-200">
          {(['info', 'stock', 'suppliers'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${tab === t ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
            >
              {t === 'info' ? 'ข้อมูลสินค้า' : t === 'stock' ? 'สต็อก' : `ผู้จำหน่าย (${vendors.length})`}
            </button>
          ))}
        </div>

        {tab === 'info' && (
          <div className={`${CARD} p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4`}>
            <div>
              <p className={LABEL_CLS}>รหัสสินค้า / SKU</p>
              <p className="text-[14px] text-stone-900 font-mono">{product.sku}</p>
            </div>
            <div>
              <p className={LABEL_CLS}>หน่วยนับ</p>
              <p className="text-[14px] text-stone-900">{product.uom_code}</p>
            </div>
            <div>
              <p className={LABEL_CLS}>ต้นทุนล่าสุด (ล่าสุด)</p>
              <p className="text-[14px] text-stone-900 font-medium">{formatCurrency(product.unit_cost)}</p>
            </div>
            <div>
              <p className={LABEL_CLS}>ต้นทุนเฉลี่ย (MAC)</p>
              <p className="text-[14px] text-emerald-700 font-bold tabular-nums">
                {formatCurrency(product.moving_avg_cost ?? 0)}
              </p>
            </div>
            <div>
              <p className={LABEL_CLS}>หมวดหมู่</p>
              <p className="text-[14px] text-stone-900">{product.category_name ?? '—'}</p>
            </div>
            <div>
              <p className={LABEL_CLS}>จุด Reorder</p>
              <p className="text-[14px] text-stone-900">{product.reorder_point}</p>
            </div>
            <div>
              <p className={LABEL_CLS}>สต็อกสูงสุด</p>
              <p className="text-[14px] text-stone-900">{product.max_stock}</p>
            </div>
            {product.description && (
              <div className="col-span-2">
                <p className={LABEL_CLS}>คำอธิบาย</p>
                <p className="text-[13px] text-stone-700">{product.description}</p>
              </div>
            )}
            <div className="col-span-2 pt-2 border-t border-stone-100">
              <p className="text-[11px] text-stone-400">สร้างเมื่อ {formatDate(product.created_at)}</p>
            </div>
          </div>
        )}

        {tab === 'stock' && (
          <div className={CARD}>
            {!product.stock_by_warehouse || product.stock_by_warehouse.length === 0 ? (
              <div className="p-8 text-center text-sm text-stone-400">
                ไม่พบข้อมูลสต็อกในทุกคลัง
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead className="border-b border-stone-200 bg-stone-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-stone-600">คลังสินค้า</th>
                    <th className="px-4 py-3 text-right font-medium text-stone-600">ยอดคงเหลือ (OH)</th>
                    <th className="px-4 py-3 text-right font-medium text-stone-600">พร้อมใช้ (AV)</th>
                    <th className="px-4 py-3 text-center font-medium text-stone-600">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {product.stock_by_warehouse.map((s) => {
                    const isLow = s.qty_available <= product.reorder_point;
                    const isOut = s.qty_available <= 0;
                    return (
                      <tr key={s.warehouse_id} className="border-b border-stone-100 hover:bg-stone-50/50">
                        <td className="px-4 py-3 font-medium text-stone-900">{s.warehouse_name || 'คลังหลัก'}</td>
                        <td className="px-4 py-3 text-right font-mono">{Number(s.qty_on_hand).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{Number(s.qty_available).toLocaleString()}</td>
                        <td className="px-4 py-3 text-center">
                          {isOut ? (
                            <span className="px-2 py-[2px] rounded-full bg-red-50 text-red-700 border border-red-200 text-[11px] font-medium">หมด</span>
                          ) : isLow ? (
                            <span className="px-2 py-[2px] rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-medium">ต่ำกว่าจุดสั่งซื้อ</span>
                          ) : (
                            <span className="px-2 py-[2px] rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium">ปกติ</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'suppliers' && (
          <div className={CARD}>

            {vendors.length === 0 ? (
              <div className="p-8 text-center text-sm text-stone-400">
                ยังไม่มีผู้จำหน่ายที่เชื่อมกับสินค้านี้
                <p className="mt-1 text-[12px]">เพิ่มได้จากหน้า <Link href="/app/vendors" transitionTypes={['nav-forward']} className="text-emerald-600 hover:underline">ผู้จำหน่าย</Link></p>
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead className="border-b border-stone-200 bg-stone-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-stone-600">ผู้จำหน่าย</th>
                    <th className="px-4 py-3 text-left font-medium text-stone-600">รหัสสินค้าผู้ขาย</th>
                    <th className="px-4 py-3 text-right font-medium text-stone-600">ราคา/หน่วย</th>
                    <th className="px-4 py-3 text-right font-medium text-stone-600">Lead Days</th>
                    <th className="px-4 py-3 text-center font-medium text-stone-600">หลัก</th>
                    <th className="px-4 py-3 text-left font-medium text-stone-600">อัปเดต</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => (
                    <tr key={v.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                      <td className="px-4 py-3">
                        <Link href={`/app/vendors/${v.vendor_id}`} transitionTypes={['nav-forward']} className="font-medium text-emerald-700 hover:underline">
                          {v.vendor_code}
                        </Link>
                        <p className="text-[12px] text-stone-500">{v.vendor_name_th}</p>
                      </td>
                      <td className="px-4 py-3 text-stone-600 font-mono text-[12px]">{v.vendor_sku ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-stone-900">{formatCurrency(v.unit_price)}</td>
                      <td className="px-4 py-3 text-right text-stone-600">{v.lead_days} วัน</td>
                      <td className="px-4 py-3 text-center">
                        {v.is_preferred && (
                          <span className="px-2 py-[2px] rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium">หลัก</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-stone-400">{formatDate(v.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </DirectionalTransition>
  );
}

'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { formatDate, formatCurrency } from '@/lib/format';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';
const FIELD_CLS = 'bg-white border border-stone-200 rounded-[7px] px-3 py-[6px] text-[13px] text-stone-900 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20';

interface WhtCertificate {
  id: string;
  doc_no: string;
  vendor_id: string;
  payment_id: string;
  wht_rate: number;
  wht_amount: number;
  issued_at: string;
  vendor_name_th: string;
  vendor_name_en: string;
  vendor_code: string;
  vendor_tax_id: string | null;
  payment_number: string;
  issued_by_name: string | null;
}

interface Vendor {
  id: string;
  code: string;
  name_th: string;
}

interface PaginatedResponse<T> {
  data: T[];
}

export default function WhtCertificatesPage() {
  const [certs, setCerts] = useState<WhtCertificate[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(''); // YYYY-MM

  // Fetch Vendors for Filter Dropdown
  useEffect(() => {
    get<PaginatedResponse<Vendor>>('/api/vendors?limit=500')
      .then((res) => setVendors(res.data))
      .catch((err) => console.error('Error fetching vendors:', err));
  }, []);

  const fetchCertificates = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '25',
      });
      if (selectedVendor) queryParams.set('vendor_id', selectedVendor);
      if (selectedMonth) queryParams.set('month', selectedMonth);

      const res = await get<{ wht_certificates: WhtCertificate[]; total: number; total_pages: number }>(
        `/api/ap/wht?${queryParams}`
      );
      setCerts(res.wht_certificates);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      console.error('Error fetching certificates:', err);
    } finally {
      setLoading(false);
    }
  }, [page, selectedVendor, selectedMonth]);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  // Reset page when filters change
  const handleVendorChange = (val: string) => {
    setSelectedVendor(val);
    setPage(1);
  };

  const handleMonthChange = (val: string) => {
    setSelectedMonth(val);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSelectedVendor('');
    setSelectedMonth('');
    setPage(1);
  };

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12 space-y-5">
        {/* Header */}
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-stone-950 leading-tight mb-1">
              หนังสือรับรองการหักภาษี ณ ที่จ่าย / Form 50 Twi
            </h1>
            <p className="text-[13.5px] text-stone-500">
              Withholding Tax Certificates · {loading ? '—' : total.toLocaleString('th-TH')} รายการ
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className={`${CARD} p-4 flex items-center justify-between gap-4 flex-wrap bg-stone-50/40`}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-stone-400 uppercase">ผู้จำหน่าย / Vendor</label>
              <select
                value={selectedVendor}
                onChange={(e) => handleVendorChange(e.target.value)}
                className={`${FIELD_CLS} w-[240px] h-[34px]`}
              >
                <option value="">ทั้งหมด / All Vendors</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code} — {v.name_th}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-stone-400 uppercase">เดือนที่จ่าย / Month</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className={`${FIELD_CLS} h-[34px] w-[180px] font-mono`}
              />
            </div>

            {(selectedVendor || selectedMonth) && (
              <button
                onClick={handleResetFilters}
                className="mt-5 h-[34px] px-3 rounded-[7px] border border-stone-200 bg-white text-[13px] text-stone-600 hover:bg-stone-50 transition-colors shadow-sm"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>

        {/* Certificates Table */}
        <div className={CARD}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {['เลขที่หนังสือรับรอง', 'ผู้รับเงิน / Vendor', 'อ้างอิงใบชำระเงิน', 'วันที่ออก', 'อัตรา WHT', 'ยอดหักภาษี', 'ผู้บันทึก', 'ดาวน์โหลด'].map((h, i) => (
                  <th
                    key={i}
                    className={`text-left py-2.5 px-3.5 text-[11.5px] font-medium tracking-[.04em] uppercase text-stone-600 bg-stone-50 border-b border-y border-stone-200 first:pl-5 last:pr-5 ${
                      [4, 5].includes(i) ? 'text-right' : ''
                    } ${[2, 6].includes(i) ? 'hidden lg:table-cell' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-600">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : certs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-600">
                    ไม่พบรายการหนังสือรับรอง
                  </td>
                </tr>
              ) : (
                certs.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60 cursor-default transition-colors group"
                  >
                    <td className="py-0 h-11 px-3.5 pl-5 font-mono text-[12.5px] text-stone-700 font-medium">
                      {c.doc_no}
                    </td>
                    <td className="py-0 h-11 px-3.5">
                      <div className="font-medium text-stone-900">
                        {c.vendor_name_th || c.vendor_name_en}
                      </div>
                      {c.vendor_tax_id && (
                        <div className="text-[11px] text-stone-400 font-mono mt-0.5">
                          Tax ID: {c.vendor_tax_id}
                        </div>
                      )}
                    </td>
                    <td className="py-0 h-11 px-3.5 font-mono text-[12.5px] text-stone-500 hidden lg:table-cell">
                      <Link href={`/app/ap/payments/${c.payment_id}`} className="hover:text-blue-600 hover:underline">
                        {c.payment_number}
                      </Link>
                    </td>
                    <td className="py-0 h-11 px-3.5 text-stone-500 font-mono text-[12.5px]">
                      {formatDate(c.issued_at)}
                    </td>
                    <td className="py-0 h-11 px-3.5 text-right font-mono tabular-nums text-stone-600 font-medium">
                      {Number(c.wht_rate).toFixed(2)}%
                    </td>
                    <td className="py-0 h-11 px-3.5 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                      {formatCurrency(c.wht_amount)}
                    </td>
                    <td className="py-0 h-11 px-3.5 text-stone-500 hidden lg:table-cell">
                      {c.issued_by_name || '—'}
                    </td>
                    <td className="py-0 h-11 px-3.5 pr-5 text-right">
                      <a
                        href={`/api/ap/wht/${c.id}/form-50-twi.pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-[6px] border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 hover:text-stone-950 transition-colors shadow-sm"
                        title="Download PDF Form 50 Twi"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {certs.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between text-[13px] text-stone-500">
            <span>
              หน้า {page} จาก {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 px-3 rounded-[7px] border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none text-[13px]"
              >
                ← ก่อนหน้า
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 px-3 rounded-[7px] border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none text-[13px]"
              >
                ถัดไป →
              </button>
            </div>
          </div>
        )}
      </div>
    </DirectionalTransition>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { formatDate, formatQty } from '@/lib/format';
import type { PaginatedResponse } from '@/types';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';

interface GRN {
  id: string;
  grn_number: string;
  status: string;
  po_number: string | null;
  io_number?: string | null;
  po_id?: string | null;
  inbound_order_id?: string | null;
  warehouse_code: string;
  warehouse_name: string;
  received_by_name: string;
  received_date: string;
  line_count: number;
  created_at: string;
}

interface GRNDetail extends GRN {
  qc_reviewed_by_name: string | null;
  stocked_by_name: string | null;
  qc_notes: string | null;
  notes: string | null;
  lines: Array<{
    sku: string;
    name_th: string;
    uom_code: string;
    qty_received: string | number;
    qty_accepted: string | number | null;
    qty_rejected: string | number | null;
    lot_number: string | null;
    qc_status: string | null;
  }>;
}

const GRN_STATUSES: Record<string, { label: string; cls: string }> = {
  draft:       { label: 'ร่าง',          cls: 'muted' },
  received:    { label: 'รับแล้ว',       cls: 'info' },
  qc_pending:  { label: 'รอ QC',         cls: 'warn' },
  qc_passed:   { label: 'QC ผ่าน',       cls: 'ok' },
  qc_failed:   { label: 'QC ไม่ผ่าน',    cls: 'danger' },
  verified:    { label: 'ตรวจสอบแล้ว',   cls: 'info' },
  stocked:     { label: 'นำเข้าคลัง',    cls: 'ok' },
};

const TABS = [
  { id: '', label: 'ทั้งหมด' },
  { id: 'draft', label: 'ร่าง' },
  { id: 'received', label: 'รับแล้ว' },
  { id: 'qc_pending', label: 'รอ QC' },
  { id: 'qc_passed', label: 'QC ผ่าน' },
  { id: 'qc_failed', label: 'QC ไม่ผ่าน' },
  { id: 'verified', label: 'ตรวจสอบแล้ว' },
  { id: 'stocked', label: 'นำเข้าคลัง' },
];

const PILL_COLORS: Record<string, string> = {
  ok:     'text-emerald-700 border-emerald-200 bg-emerald-50',
  warn:   'text-amber-700 border-amber-300 bg-amber-50',
  danger: 'text-red-700 border-red-200 bg-red-50',
  info:   'text-blue-700 border-blue-200 bg-blue-50',
  muted:  'text-stone-500 border-stone-200 bg-stone-50',
};

function Pill({ status }: { status: string }) {
  const s = GRN_STATUSES[status] ?? { label: status, cls: 'muted' };
  return (
    <span className={`inline-flex items-center gap-[5px] px-2 py-[2px] text-[11.5px] font-medium rounded-full border leading-[1.5] whitespace-nowrap before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-current ${PILL_COLORS[s.cls]}`}>
      {s.label}
    </span>
  );
}

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';
const BTN_SM = 'h-[26px] px-3 rounded-[6px] text-[12px] font-medium text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 shadow-[0_1px_0_rgba(15,23,42,.03)] inline-flex items-center gap-1.5';

// ---- GRN Detail Modal ----
function GRNDetailModal({ grn, onClose }: { grn: GRNDetail; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(15,23,42,.42)] backdrop-blur-[4px] animate-[fadeIn_.14s_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[14px] shadow-[0_12px_32px_-8px_rgba(15,23,42,.18),0_2px_6px_rgba(15,23,42,.06)] w-[720px] max-w-[calc(100vw-40px)] max-h-[calc(100vh-60px)] flex flex-col overflow-hidden animate-[popIn_.18s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-[22px] py-[18px] pb-[14px] border-b border-stone-100">
          <div>
            <h3 className="flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.01em] text-stone-950">
              <span className="font-mono">{grn.grn_number}</span>
              <Pill status={grn.status} />
            </h3>
            <div className="text-[12px] text-stone-400 mt-0.5">
              {grn.io_number ?? grn.po_number ?? '—'} · {grn.warehouse_name} · {formatDate(grn.received_date)}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-[7px] grid place-items-center text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-[22px] py-[18px] overflow-auto flex flex-col gap-5">
          {/* Info grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { l: grn.inbound_order_id ? 'เลข IO' : 'เลข PO', v: grn.io_number ?? grn.po_number ?? '—' },
              { l: 'คลังสินค้า', v: grn.warehouse_name },
              { l: 'ผู้รับสินค้า', v: grn.received_by_name },
            ].map((s) => (
              <div key={s.l} className="bg-stone-50 border border-stone-200 rounded-[8px] px-3 py-[10px]">
                <div className="text-[11.5px] text-stone-400 mb-1">{s.l}</div>
                <div className="text-[13px] font-medium text-stone-900 truncate">{s.v || '—'}</div>
              </div>
            ))}
          </div>

          {/* Line items */}
          <div>
            <div className="text-[12px] font-semibold tracking-[.04em] uppercase text-stone-400 mb-2">รายการสินค้า</div>
            <div className={CARD}>
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    {['SKU', 'ชื่อสินค้า', 'รับเข้า', 'ผ่าน', 'ตีคืน', 'หน่วย'].map((h, i) => (
                      <th key={h} className={`text-left py-2.5 px-3.5 text-[11.5px] font-medium tracking-[.04em] uppercase text-stone-400 bg-stone-50 border-b border-stone-200 first:pl-5 last:pr-5 ${i >= 2 ? 'text-right' : ''}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grn.lines.map((l, idx) => (
                    <tr key={idx} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                      <td className="py-0 h-10 px-3.5 pl-5 font-mono text-[12.5px] text-stone-700">{l.sku}</td>
                      <td className="py-0 h-10 px-3.5">
                        <div className="truncate max-w-[180px]">{l.name_th}</div>
                        {l.lot_number && <div className="text-[11px] text-stone-400 font-mono">Lot: {l.lot_number}</div>}
                      </td>
                      <td className="py-0 h-10 px-3.5 text-right font-mono tabular-nums">{formatQty(l.qty_received)}</td>
                      <td className="py-0 h-10 px-3.5 text-right font-mono tabular-nums text-emerald-700">{l.qty_accepted != null ? formatQty(l.qty_accepted) : '—'}</td>
                      <td className="py-0 h-10 px-3.5 text-right font-mono tabular-nums text-red-600">{l.qty_rejected != null ? formatQty(l.qty_rejected) : '—'}</td>
                      <td className="py-0 h-10 px-3.5 pr-5 text-right text-stone-400">{l.uom_code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {grn.qc_notes && (
            <div>
              <div className="text-[12px] font-semibold tracking-[.04em] uppercase text-stone-400 mb-1">หมายเหตุ QC</div>
              <p className="text-[13px] text-stone-600 bg-stone-50 rounded-[8px] px-3 py-2.5 border border-stone-200">{grn.qc_notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-[22px] py-[14px] border-t border-stone-100 bg-stone-50/60">
          <button onClick={onClose}
            className="h-8 px-3 rounded-[7px] text-[13px] font-medium text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 shadow-[0_1px_0_rgba(15,23,42,.03)]">
            ปิด
          </button>
          <Link href={`/app/grn/${grn.id}`} transitionTypes={['nav-forward']}
            className="h-8 px-3 rounded-[7px] text-[13px] font-medium text-white bg-stone-950 hover:bg-stone-800 shadow-sm inline-flex items-center gap-1.5">
            ดูรายละเอียดเต็ม →
          </Link>
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
export default function GRNPage() {
  const [data, setData] = useState<PaginatedResponse<GRN> | null>(null);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<GRNDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchGRNs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (tab) params.set('status', tab);
      setData(await get<PaginatedResponse<GRN>>(`/api/grn?${params}`));
    } finally { setLoading(false); }
  }, [page, tab]);

  useEffect(() => { fetchGRNs(); }, [fetchGRNs]);

  async function openModal(g: GRN) {
    setModalLoading(true);
    try {
      const detail = await get<GRNDetail>(`/api/grn/${g.id}`);
      setModal(detail);
    } finally { setModalLoading(false); }
  }

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12 space-y-5">

        {/* Header */}
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-stone-950 leading-tight mb-1">
              ใบรับสินค้า
            </h1>
            <p className="text-[13.5px] text-stone-500">
              Goods Receipt Notes · {loading ? '—' : (data?.total ?? 0).toLocaleString('th-TH')} รายการ
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/app/grn/receiving-queue" transitionTypes={['nav-forward']} className={BTN_SM}>
              รายการรอรับ
            </Link>
            <Link
              href="/app/grn/new"
              transitionTypes={['nav-forward']}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] bg-stone-950 text-white text-[13px] font-medium shadow-sm hover:bg-stone-800 transition-colors"
            >
              + สร้าง GRN
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-stone-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setPage(1); }}
              className={`px-3.5 py-2.5 text-[13.5px] font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? 'text-stone-950 border-stone-950'
                  : 'text-stone-400 border-transparent hover:text-stone-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Table card */}
        <div className={CARD}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {['เลข GRN', 'เอกสารอ้างอิง / Ref.', 'คลังสินค้า', 'ผู้รับ', 'วันที่รับ', 'รายการ', 'สถานะ', ''].map((h, i) => (
                  <th key={i} className={`text-left py-2.5 px-3.5 text-[11.5px] font-medium tracking-[.04em] uppercase text-stone-400 bg-stone-50 border-b border-y border-stone-200 first:pl-5 last:pr-5 ${i === 5 ? 'text-center' : ''} ${[2,3,4,5].includes(i) ? 'hidden lg:table-cell' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center text-[13px] text-stone-400">กำลังโหลด...</td></tr>
              ) : data?.data.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-[13px] text-stone-400">ไม่พบรายการ</td></tr>
              ) : data?.data.map((g) => (
                <tr
                  key={g.id}
                  onClick={() => openModal(g)}
                  className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60 cursor-default transition-colors"
                >
                  <td className="py-0 h-11 px-3.5 pl-5 font-mono text-[12.5px] text-stone-700 font-medium">{g.grn_number}</td>
                  <td className="py-0 h-11 px-3.5 font-mono text-[12.5px] text-blue-600 hidden lg:table-cell">
                    <span onClick={(e) => e.stopPropagation()}>
                      {g.po_id ? (
                        <Link href={`/app/purchase-orders/${g.po_id}`} transitionTypes={['nav-forward']} className="hover:underline">{g.po_number}</Link>
                      ) : g.io_number ? (
                        <Link href={`/app/inbound-orders/${g.inbound_order_id}`} transitionTypes={['nav-forward']} className="hover:underline">{g.io_number}</Link>
                      ) : '—'}
                    </span>
                  </td>
                  <td className="py-0 h-11 px-3.5 text-stone-500 hidden lg:table-cell">{g.warehouse_code}</td>
                  <td className="py-0 h-11 px-3.5 text-stone-500 hidden lg:table-cell">{g.received_by_name}</td>
                  <td className="py-0 h-11 px-3.5 text-stone-500 font-mono text-[12.5px] hidden lg:table-cell">{formatDate(g.received_date)}</td>
                  <td className="py-0 h-11 px-3.5 text-center tabular-nums text-stone-500 hidden lg:table-cell">{g.line_count}</td>
                  <td className="py-0 h-11 px-3.5"><Pill status={g.status} /></td>
                  <td className="py-0 h-11 px-3.5 pr-5 text-stone-300">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between text-[13px] text-stone-500">
            <span>หน้า {page} จาก {data.total_pages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="h-8 px-3 rounded-[7px] border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none text-[13px]">
                ← ก่อนหน้า
              </button>
              <button onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))} disabled={page === data.total_pages}
                className="h-8 px-3 rounded-[7px] border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none text-[13px]">
                ถัดไป →
              </button>
            </div>
          </div>
        )}

        {/* Loading overlay for modal fetch */}
        {modalLoading && (
          <div className="fixed inset-0 z-40 grid place-items-center bg-[rgba(15,23,42,.2)]">
            <div className="text-stone-500 text-[13px]">กำลังโหลด...</div>
          </div>
        )}

        {/* GRN Detail Modal */}
        {modal && <GRNDetailModal grn={modal} onClose={() => setModal(null)} />}
      </div>
    </DirectionalTransition>
  );
}

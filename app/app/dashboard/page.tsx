'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { get } from '@/lib/api-client';
import { formatCurrency, formatQty } from '@/lib/format';
import Link from 'next/link';
import type { Warehouse } from '@/types';

interface KPIData {
  pr: { pending_approval: number; last_30_days: number };
  po: { sent: number; value_30_days: string | number };
  grn: { pending: number; stocked_this_month: number; qc_failed: number };
  rma: { open_rmas: number; in_review: number };
  claims: { open_claims: number; open_claim_value: string | number };
  low_stock: Array<{
    sku: string;
    name_th: string;
    warehouse_code: string;
    qty_available: string | number;
    reorder_point: number;
  }>;
  recent_ledger: Array<{
    sku: string;
    name_th: string;
    warehouse_code: string;
    entry_type: string;
    qty_change: string | number;
    user_name: string | null;
  }>;
  top_received: Array<{
    sku: string;
    name_th: string;
    qty_received: string | number;
    tx_count: string | number;
  }>;
  warehouse_perf: Array<{
    warehouse_name: string;
    warehouse_code: string;
    grn_count: string | number;
    qty_stocked: string | number;
  }>;
}

let _uid = 0;

function Sparkline({ data, color = '#10b981', w = 64, h = 24 }: {
  data: number[]; color?: string; w?: number; h?: number;
}) {
  const [id] = useState(() => `sp-${++_uid}`);
  if (data.length < 2) return null;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - ((v - min) / range) * (h - 4) - 2,
  ]);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${path} L ${w},${h} L 0,${h} Z`;
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const MOCK_30D      = [12,18,15,22,28,24,32,20,25,30,18,22,28,35,30,24,38,42,36,28,32,40,38,44,36,48,42,52,48,55];
const MOCK_30D_PREV = [10,14,12,18,22,20,28,18,22,26,15,20,24,30,28,22,34,38,32,25,28,36,34,40,32,44,38,48,44,50];

function TrendChart({ data, prev, height = 200 }: { data: number[]; prev: number[]; height?: number }) {
  const W = 800, H = height, padL = 40, padR = 16, padT = 16, padB = 28;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const maxV = Math.ceil(Math.max(...data, ...prev) / 10) * 10 + 5;
  const px = (i: number) => padL + (i / (data.length - 1)) * innerW;
  const py = (v: number) => padT + innerH - (v / maxV) * innerH;
  const linePath = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const areaPath = linePath(data) + ` L ${px(data.length - 1)},${padT + innerH} L ${padL},${padT + innerH} Z`;
  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((i / 4) * maxV));
  const xLabelIdx = [0, 9, 19, 29] as const;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" preserveAspectRatio="none">
      <defs>
        <linearGradient id="grn-trend-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity={0.18} />
          <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
        </linearGradient>
      </defs>
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={py(t)} y2={py(t)} stroke="#f1efee" strokeWidth="1" />
          <text x={padL - 8} y={py(t) + 3.5} fontSize="10.5" textAnchor="end" fill="#a8a29e"
                fontFamily="ui-monospace,monospace">{t}</text>
        </g>
      ))}
      <path d={linePath(prev)} fill="none" stroke="#a8a29e" strokeWidth="1.2"
            strokeDasharray="3 3" strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
      <path d={areaPath} fill="url(#grn-trend-grad)" />
      <path d={linePath(data)} fill="none" stroke="#10b981" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={px(data.length - 1)} cy={py(data[data.length - 1])} r="4"
              fill="#10b981" stroke="white" strokeWidth="2" />
      {xLabelIdx.map((li, i) => (
        <text key={i} x={px(li)} y={H - 8} fontSize="10.5" fill="#a8a29e"
              textAnchor={i === 0 ? 'start' : i === xLabelIdx.length - 1 ? 'end' : 'middle'}>
          {30 - li} วัน
        </text>
      ))}
    </svg>
  );
}

const ENTRY_LABELS: Record<string, string> = {
  grn_receipt: 'รับสินค้า', grn_qc_reject: 'ตีคืน QC',
  rma_return: 'รับ RMA', rma_vendor_return: 'คืนผู้ขาย',
  transfer_out: 'โอนออก', transfer_in: 'โอนเข้า',
  cycle_count_adjustment: 'ปรับนับ', po_reversal: 'ยกเลิก PO', manual_adjustment: 'ปรับมือ',
};

const AVATAR_COLORS = [
  '#a78bfa', '#fb923c', '#22c55e', '#0ea5e9', '#f43f5e',
  '#f59e0b', '#6366f1', '#14b8a6', '#8b5cf6', '#ec4899',
];

function avatarColor(name: string | null): string {
  if (!name) return '#94a3b8';
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string | null): string {
  if (!name) return 'ร';
  return name.slice(0, 2);
}

const SPARK = {
  pr:  [8,12,10,15,18,14,12,16,20,18],
  po:  [5, 8, 7,10,12, 9,11,14,12,10],
  grn: [20,24,22,28,32,26,30,34,28,32],
  low: [10,12,14,18,16,20,22,24,22,25],
};

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';
const CARD_H = 'flex items-center justify-between px-5 py-[14px] border-b border-stone-100 gap-3';
const BTN_SM = 'h-[26px] px-3 rounded-[6px] text-[12px] font-medium text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 shadow-[0_1px_0_rgba(15,23,42,.03)] inline-flex items-center';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'สวัสดีตอนเช้า';
  if (h < 17) return 'สวัสดีตอนบ่าย';
  return 'สวัสดีตอนเย็น';
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [kpi, setKpi] = useState<KPIData | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<Warehouse[]>('/api/admin/warehouses').then(setWarehouses).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = warehouseId ? `?warehouse_id=${warehouseId}` : '';
    get<KPIData>(`/api/kpi${qs}`).then(setKpi).finally(() => setLoading(false));
  }, [warehouseId]);

  const d = (v: string | number | undefined | null) =>
    v === undefined || v === null ? '—' : v;

  const userName = (session?.user as { name?: string } | undefined)?.name ?? '';

  const maxQtyStocked = kpi?.warehouse_perf?.length
    ? Math.max(...kpi.warehouse_perf.map((w) => Number(w.qty_stocked) || 0), 1)
    : 1;

  return (
    <div className="max-w-[1440px] mx-auto pb-12 space-y-4">

      {/* Header */}
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-stone-950 leading-tight mb-1">
            {greeting()}{userName ? `, ${userName}` : ''} 👋
          </h1>
          <p className="text-[13.5px] text-stone-500">
            ภาพรวมคลังสินค้า ·{' '}
            {new Date().toLocaleDateString('th-TH', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="h-8 rounded-[7px] border border-stone-200 bg-white px-3 text-[13px] text-stone-700 shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)] focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400"
          >
            <option value="">ทุกคลัง</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.code} — {w.name_th}</option>
            ))}
          </select>
          <Link
            href="/app/purchase-requests/new"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] bg-stone-950 text-white text-[13px] font-medium shadow-sm hover:bg-stone-800 transition-colors"
          >
            + สร้างเอกสาร
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className={`${CARD} overflow-hidden grid grid-cols-2 lg:grid-cols-4`}>
        {/* PR */}
        <div className="p-[22px] border-r border-b lg:border-b-0 border-stone-100 flex flex-col gap-2 relative">
          <div className="text-[12px] text-stone-500 font-medium">PR รอนุมัติ</div>
          <div className="text-[28px] font-semibold tracking-tight text-stone-950 leading-[1.1] tabular-nums">
            {loading ? '—' : d(kpi?.pr?.pending_approval)}
          </div>
          <div className="text-[11.5px] text-stone-400">
            สร้าง 30 วัน: <span className="font-mono">{loading ? '—' : d(kpi?.pr?.last_30_days)}</span>
          </div>
          <div className="absolute right-4 top-[18px] opacity-90 pointer-events-none">
            <Sparkline data={SPARK.pr} color="#94a3b8" />
          </div>
          <Link href="/app/purchase-requests?status=submitted"
                className="text-[11.5px] text-emerald-700 hover:underline mt-auto">
            ดูทั้งหมด →
          </Link>
        </div>

        {/* PO */}
        <div className="p-[22px] border-b lg:border-b-0 lg:border-r border-stone-100 flex flex-col gap-2 relative">
          <div className="text-[12px] text-stone-500 font-medium">PO ส่งแล้ว</div>
          <div className="text-[28px] font-semibold tracking-tight text-stone-950 leading-[1.1] tabular-nums">
            {loading ? '—' : d(kpi?.po?.sent)}
          </div>
          <div className="text-[11.5px] text-stone-400">
            มูลค่า 30 วัน:{' '}
            <span className="font-mono text-[10.5px]">
              {loading ? '—' : (kpi?.po?.value_30_days ? formatCurrency(kpi.po.value_30_days) : '—')}
            </span>
          </div>
          <div className="absolute right-4 top-[18px] opacity-90 pointer-events-none">
            <Sparkline data={SPARK.po} color="#10b981" />
          </div>
          <Link href="/app/purchase-orders?status=sent"
                className="text-[11.5px] text-emerald-700 hover:underline mt-auto">
            ดูทั้งหมด →
          </Link>
        </div>

        {/* GRN */}
        <div className="p-[22px] border-r border-stone-100 flex flex-col gap-2 relative">
          <div className="text-[12px] text-stone-500 font-medium">GRN รอดำเนินการ</div>
          <div className="text-[28px] font-semibold tracking-tight text-stone-950 leading-[1.1] tabular-nums">
            {loading ? '—' : d(kpi?.grn?.pending)}
          </div>
          <div className="text-[11.5px] text-stone-400">
            นำเข้าเดือนนี้: <span className="font-mono">{loading ? '—' : d(kpi?.grn?.stocked_this_month)}</span>
          </div>
          <div className="absolute right-4 top-[18px] opacity-90 pointer-events-none">
            <Sparkline data={SPARK.grn} color="#10b981" />
          </div>
          <Link href="/app/grn" className="text-[11.5px] text-emerald-700 hover:underline mt-auto">
            ดูทั้งหมด →
          </Link>
        </div>

        {/* Low stock */}
        <div className="p-[22px] flex flex-col gap-2 relative">
          <div className="text-[12px] text-stone-500 font-medium">สินค้าใกล้หมด</div>
          <div className="text-[28px] font-semibold tracking-tight text-amber-600 leading-[1.1] tabular-nums">
            {loading ? '—' : d(kpi?.low_stock?.length)}
          </div>
          <div className="text-[11.5px] text-stone-400">ต่ำกว่า reorder point</div>
          <div className="absolute right-4 top-[18px] opacity-90 pointer-events-none">
            <Sparkline data={SPARK.low} color="#d97706" />
          </div>
          <Link href="/app/inventory?low_stock=true"
                className="text-[11.5px] text-emerald-700 hover:underline mt-auto">
            ดูทั้งหมด →
          </Link>
        </div>
      </div>

      {/* Trend chart + Top received products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* GRN Trend Chart */}
        <div className={`${CARD} lg:col-span-2`}>
          <div className={CARD_H}>
            <div>
              <div className="text-[13.5px] font-semibold text-stone-950">แนวโน้มการรับสินค้า</div>
              <div className="text-[12px] text-stone-500 mt-0.5">จำนวน GRN · 30 วันล่าสุด</div>
            </div>
            <div className="flex items-center gap-4 text-[12px] text-stone-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[3px] bg-emerald-500 inline-block" />
                เดือนนี้
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[3px] bg-stone-300 inline-block" />
                เดือนที่แล้ว
              </span>
            </div>
          </div>
          <div className="px-2 pt-2 pb-1">
            <TrendChart data={MOCK_30D} prev={MOCK_30D_PREV} height={200} />
          </div>
          <div className="grid grid-cols-3 border-t border-stone-100">
            {[
              { l: 'รับทั้งหมดเดือนนี้', v: loading ? '—' : String(kpi?.grn?.stocked_this_month ?? '—'), u: ' ครั้ง' },
              { l: 'GRN รอดำเนินการ',    v: loading ? '—' : String(kpi?.grn?.pending ?? '—'),              u: ' รายการ' },
              { l: 'QC ไม่ผ่าน',         v: loading ? '—' : String(kpi?.grn?.qc_failed ?? '—'),            u: ' ครั้ง' },
            ].map((s, i) => (
              <div key={i} className={`px-[18px] py-3.5${i < 2 ? ' border-r border-stone-100' : ''}`}>
                <div className="text-[11.5px] text-stone-400 mb-0.5">{s.l}</div>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-[16px] font-semibold tracking-tight text-stone-950">{s.v}</span>
                  <span className="text-[11.5px] text-stone-400">{s.u}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top received products */}
        <div className={CARD}>
          <div className={CARD_H}>
            <div>
              <div className="text-[13.5px] font-semibold text-stone-950">สินค้ารับมากสุด</div>
              <div className="text-[12px] text-stone-500 mt-0.5">5 อันดับแรก · เดือนนี้</div>
            </div>
            <Link href="/app/inventory/ledger" className={BTN_SM}>ดูทั้งหมด</Link>
          </div>
          <div>
            {loading ? (
              <p className="px-5 py-4 text-[13px] text-stone-400">กำลังโหลด...</p>
            ) : !kpi?.top_received?.length ? (
              <p className="px-5 py-4 text-[13px] text-stone-400">ยังไม่มีข้อมูลเดือนนี้</p>
            ) : kpi.top_received.map((p, i) => (
              <div key={p.sku} className="flex items-start gap-3 px-5 py-3 border-b border-stone-50 last:border-0 hover:bg-stone-50/60 transition-colors">
                <div className="w-[18px] shrink-0 pt-[3px] font-mono text-[11.5px] text-stone-400">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-stone-900 truncate">{p.name_th}</div>
                  <div className="flex items-center gap-1.5 text-[11.5px] text-stone-400 mt-0.5">
                    <span className="font-mono">{p.sku}</span>
                    <span>·</span>
                    <span>รับ {formatQty(p.tx_count)} ครั้ง</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-[13px] font-medium text-stone-950 tabular-nums">
                    {formatQty(p.qty_received)}
                  </div>
                  <div className="text-[11px] text-stone-400 mt-0.5">หน่วย</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Warehouse performance + Claims/RMA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Warehouse performance */}
        <div className={`${CARD} lg:col-span-2`}>
          <div className={CARD_H}>
            <div>
              <div className="text-[13.5px] font-semibold text-stone-950">ผลงานคลังสินค้า</div>
              <div className="text-[12px] text-stone-500 mt-0.5">ปริมาณสินค้านำเข้า · เดือนนี้</div>
            </div>
          </div>
          <div className="px-5 py-4 flex flex-col gap-5">
            {loading ? (
              <p className="text-[13px] text-stone-400">กำลังโหลด...</p>
            ) : !kpi?.warehouse_perf?.length ? (
              <p className="text-[13px] text-stone-400">ไม่มีข้อมูลคลัง</p>
            ) : kpi.warehouse_perf.map((w) => {
              const pct = Math.min(100, (Number(w.qty_stocked) / maxQtyStocked) * 100);
              const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-stone-300';
              return (
                <div key={w.warehouse_code}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-medium text-stone-900">
                      {w.warehouse_name}
                      <span className="ml-1.5 font-mono text-[11px] text-stone-400">{w.warehouse_code}</span>
                    </span>
                    <span className="text-[12px] text-stone-500 tabular-nums font-mono">
                      {formatQty(w.grn_count)} GRN
                    </span>
                  </div>
                  <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor}`}
                         style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-[11.5px] text-stone-400">
                    <span className="font-mono tabular-nums">{formatQty(w.qty_stocked)} หน่วย</span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Claims + RMA side */}
        <div className="flex flex-col gap-4">
          {/* Vendor Claims */}
          <div className={CARD}>
            <div className={CARD_H}>
              <div>
                <div className="text-[13.5px] font-semibold text-stone-950">Vendor Claims</div>
                <div className="text-[12px] text-stone-500 mt-0.5">การเรียกร้องที่เปิดอยู่</div>
              </div>
              <Link href="/app/claims" className={BTN_SM}>ดูทั้งหมด</Link>
            </div>
            <div className="px-5 py-4 flex gap-8">
              <div>
                <div className="text-[12px] text-stone-400 mb-1">จำนวน</div>
                <div className="text-[28px] font-semibold tracking-tight text-stone-950 leading-[1.1] tabular-nums">
                  {loading ? '—' : d(kpi?.claims?.open_claims)}
                </div>
              </div>
              <div>
                <div className="text-[12px] text-stone-400 mb-1">มูลค่าคงค้าง</div>
                <div className="text-[20px] font-semibold tracking-tight text-red-600 leading-[1.1]">
                  {loading ? '—' : (kpi?.claims?.open_claim_value ? formatCurrency(kpi.claims.open_claim_value) : '—')}
                </div>
              </div>
            </div>
          </div>

          {/* RMA */}
          <div className={CARD}>
            <div className={CARD_H}>
              <div>
                <div className="text-[13.5px] font-semibold text-stone-950">Returns (RMA)</div>
                <div className="text-[12px] text-stone-500 mt-0.5">การคืนสินค้าที่เปิดอยู่</div>
              </div>
              <Link href="/app/rma" className={BTN_SM}>ดูทั้งหมด</Link>
            </div>
            <div className="px-5 py-4 flex gap-8">
              <div>
                <div className="text-[12px] text-stone-400 mb-1">เปิดทั้งหมด</div>
                <div className="text-[28px] font-semibold tracking-tight text-stone-950 leading-[1.1] tabular-nums">
                  {loading ? '—' : d(kpi?.rma?.open_rmas)}
                </div>
              </div>
              <div>
                <div className="text-[12px] text-stone-400 mb-1">กำลังพิจารณา</div>
                <div className="text-[22px] font-semibold tracking-tight text-amber-600 leading-[1.1] tabular-nums">
                  {loading ? '—' : d(kpi?.rma?.in_review)}
                </div>
              </div>
            </div>
          </div>

          {/* GRN QC failed */}
          <div className={CARD}>
            <div className={CARD_H}>
              <div>
                <div className="text-[13.5px] font-semibold text-stone-950">GRN QC ไม่ผ่าน</div>
                <div className="text-[12px] text-stone-500 mt-0.5">เดือนนี้</div>
              </div>
              <Link href="/app/grn?status=qc_failed" className={BTN_SM}>ดูรายการ</Link>
            </div>
            <div className="px-5 py-4">
              <div className="text-[12px] text-stone-400 mb-1">จำนวน</div>
              <div className="text-[28px] font-semibold tracking-tight text-red-600 leading-[1.1] tabular-nums">
                {loading ? '—' : d(kpi?.grn?.qc_failed)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Low stock + Activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Low stock */}
        <div className={CARD}>
          <div className={CARD_H}>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold text-stone-950">สต็อกใกล้หมด</span>
                {!loading && kpi && kpi.low_stock.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-[10.5px] font-medium before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-current">
                    {kpi.low_stock.length} รายการ
                  </span>
                )}
              </div>
              <div className="text-[12px] text-stone-500 mt-0.5">ต้องสั่งเพิ่มเร็ว ๆ นี้</div>
            </div>
            <Link href="/app/purchase-requests/new" className={`${BTN_SM} text-stone-950`}>สร้าง PR</Link>
          </div>
          <div>
            {loading ? (
              <p className="px-5 py-4 text-[13px] text-stone-400">กำลังโหลด...</p>
            ) : !kpi?.low_stock?.length ? (
              <p className="px-5 py-4 text-[13px] text-stone-400">ไม่มีสินค้าต่ำกว่า reorder point</p>
            ) : kpi.low_stock.map((s, idx) => {
              const pct = Math.min(100, (Number(s.qty_available) / (s.reorder_point || 1)) * 100);
              return (
                <div key={idx} className="flex items-center gap-3 px-5 py-2.5 border-b border-stone-50 last:border-0 hover:bg-stone-50/60 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-stone-900 truncate">{s.name_th}</div>
                    <div className="flex items-center gap-1.5 text-[11.5px] text-stone-400 mt-0.5 flex-wrap">
                      <span className="font-mono">{s.sku}</span>
                      <span>·</span>
                      <span>เหลือ {formatQty(s.qty_available)} / {formatQty(s.reorder_point)}</span>
                      <span>·</span>
                      <span>{s.warehouse_code}</span>
                    </div>
                  </div>
                  <div className="w-20 shrink-0">
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct < 20 ? 'bg-red-500' : 'bg-amber-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10.5px] text-stone-400 mt-1 font-mono">
                      <span>{formatQty(s.qty_available)}</span>
                      <span>/{formatQty(s.reorder_point)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity feed (recent ledger with avatars) */}
        <div className={CARD}>
          <div className={CARD_H}>
            <div>
              <div className="text-[13.5px] font-semibold text-stone-950">กิจกรรมล่าสุด</div>
              <div className="text-[12px] text-stone-500 mt-0.5">ความเคลื่อนไหวสต็อก</div>
            </div>
            <Link href="/app/inventory/ledger" className={BTN_SM}>ดูทั้งหมด</Link>
          </div>
          <div className="px-5 py-4 flex flex-col gap-4">
            {loading ? (
              <p className="text-[13px] text-stone-400">กำลังโหลด...</p>
            ) : !kpi?.recent_ledger?.length ? (
              <p className="text-[13px] text-stone-400">ยังไม่มีรายการ</p>
            ) : kpi.recent_ledger.map((l, idx) => {
              const isPos = Number(l.qty_change) > 0;
              const color = avatarColor(l.user_name);
              const name = l.user_name ?? 'ระบบ';
              return (
                <div key={idx} className="flex items-start gap-[11px]">
                  <div
                    className="w-7 h-7 rounded-[7px] shrink-0 grid place-items-center text-[11px] font-semibold mt-0.5"
                    style={{ background: color + '22', color }}
                  >
                    {initials(name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] leading-[1.5]">
                      <span className="font-medium text-stone-900">{name}</span>
                      <span className="text-stone-400"> {ENTRY_LABELS[l.entry_type] ?? l.entry_type.replace(/_/g, ' ')} </span>
                      <span
                        className="font-mono text-[12.5px] px-[5px] rounded-[4px]"
                        style={{ color: '#047857', background: '#ecfdf5' }}
                      >
                        {l.sku}
                      </span>
                    </div>
                    <div className="text-[11.5px] text-stone-400 mt-0.5 truncate">
                      {l.name_th} · {l.warehouse_code}
                    </div>
                  </div>
                  <div
                    className="shrink-0 font-mono text-[13px] font-semibold tabular-nums"
                    style={{ color: isPos ? '#047857' : '#b91c1c' }}
                  >
                    {isPos ? '+' : ''}{formatQty(l.qty_change)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

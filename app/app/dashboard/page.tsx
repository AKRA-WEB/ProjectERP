'use client';

import { useState, useEffect } from 'react';
import { ViewTransition } from '@/lib/react-vts';
import { useSession } from 'next-auth/react';
import { get } from '@/lib/api-client';
import { formatCurrency, formatQty, formatDatetime, formatNumber } from '@/lib/format';
import { KpiCard, KpiGrid } from '@/components/ui';
import Link from 'next/link';
import type { Warehouse } from '@/types';
import { useT, useLanguage, localeName } from '@/lib/i18n';

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
  sales?: { pending_so: number; revenue_30d: string | number; revenue_today: string | number };
  pos_today?: { revenue: string | number; tx_count: number };
  top_products?: Array<{
    sku: string;
    name_th: string;
    qty_sold: string | number;
    tx_count: string | number;
  }>;
  recent_activity?: Array<{
    type: string;
    ref: string;
    action: string;
    created_at: string;
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
        <linearGradient id={id} x1="0" x2="0" y2="1">
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
  const t = useT();
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
      {yTicks.map((tick, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={py(tick)} y2={py(tick)} stroke="#f1efee" strokeWidth="1" />
          <text x={padL - 8} y={py(tick) + 3.5} fontSize="10.5" textAnchor="end" fill="#a8a29e"
                fontFamily="ui-monospace,monospace">{tick}</text>
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
          {30 - li} {t('label.date')}
        </text>
      ))}
    </svg>
  );
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

function Greeting() {
  const [greeting, setGreeting] = useState('');
  const t = useT();

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting(t('greeting.morning'));
    else if (h < 17) setGreeting(t('greeting.afternoon'));
    else setGreeting(t('greeting.evening'));
  }, [t]);

  return greeting;
}

interface DashboardPeriod {
  status: string;
}

interface DashboardJournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  entry_type: string;
  total_debit: number;
  status: string;
}

interface DashboardWhtResponse {
  total: number;
}

interface DashboardInvoice {
  outstanding_amount: number | string;
}

interface DashboardApResponse {
  invoices: DashboardInvoice[];
}

function AuditorDashboard() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<{
    periodsCount: number;
    unpostedJeCount: number;
    postedJeCount: number;
    outstandingAp: number;
    whtCertificatesCount: number;
    recentJe: DashboardJournalEntry[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const { lang } = useLanguage();

  useEffect(() => {
    async function fetchAuditorStats() {
      try {
        const periods = await get<DashboardPeriod[]>('/api/accounting/fiscal-periods');
        const activePeriods = periods.filter(p => p.status === 'open').length;
        
        const jeResponse = await get<{ data?: DashboardJournalEntry[] }>('/api/accounting/journal-entries?limit=5');
        const jeList = jeResponse?.data || [];
        
        const whtResponse = await get<DashboardWhtResponse>('/api/ap/wht?limit=1');
        const whtCount = whtResponse?.total ?? 0;

        const apResponse = await get<DashboardApResponse>('/api/ap/invoices?is_paid=false');
        const outstandingAp = apResponse?.invoices?.reduce((sum: number, inv: DashboardInvoice) => sum + Number(inv.outstanding_amount), 0) ?? 0;

        setStats({
          periodsCount: activePeriods,
          unpostedJeCount: jeList.filter((j: DashboardJournalEntry) => j.status === 'draft').length,
          postedJeCount: jeList.filter((j: DashboardJournalEntry) => j.status === 'posted').length,
          outstandingAp,
          whtCertificatesCount: whtCount,
          recentJe: jeList.slice(0, 5),
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchAuditorStats();
  }, []);

  const d = (v: unknown) => v === undefined || v === null ? '—' : String(v);
  const userName = (session?.user as { name?: string } | undefined)?.name ?? '';

  return (
    <ViewTransition default="none" enter="fade-in" exit="fade-out">
      <div className="max-w-[1440px] mx-auto pb-12 space-y-8 animate-fade-in">
        {/* Premium Header Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-stone-900 via-stone-800 to-stone-950 p-6 md:p-8 text-white shadow-md border border-stone-850">
          <div className="absolute right-0 top-0 -mt-4 -mr-4 w-56 h-56 rounded-full bg-stone-800/10 blur-xl pointer-events-none" />
          <div className="absolute left-1/3 bottom-0 -mb-8 w-44 h-44 rounded-full bg-stone-700/5 blur-lg pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-stone-800 text-stone-300 text-[11px] font-semibold tracking-wider uppercase border border-stone-700/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Auditor Portal
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                ยินดีต้อนรับสู่ระบบตรวจสอบบัญชี{userName ? `, ${userName}` : ''} 👋
              </h1>
              <p className="text-stone-300 text-sm max-w-xl font-normal leading-relaxed">
                สิทธิ์การเข้าถึงของคุณคือ <strong className="text-emerald-400">Read-Only (ผู้ตรวจสอบบัญชี)</strong>. 
                คุณสามารถเข้าถึงสมุดรายวันทั่วไป งบแสดงฐานะการเงิน การคำนวณภาษีหัก ณ ที่จ่าย และรายงานอายุหนี้ได้อย่างโปร่งใส
              </p>
            </div>
            <div className="shrink-0 flex flex-col items-start md:items-end justify-center font-mono text-xs text-stone-400 pl-4 md:pl-0 pr-4">
              <span className="text-stone-300 font-semibold">วันเวลาปัจจุบัน / Current Time</span>
              <span>{new Date().toLocaleString(lang === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              <span className="mt-1 text-[10px] text-stone-500 uppercase tracking-widest">Secured Audit Session</span>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "รอบบัญชีที่เปิดอยู่ / Active Periods",
              value: loading ? "..." : d(stats?.periodsCount),
              desc: "จำนวนรอบบัญชีที่กำลังบันทึกรายการ",
              color: "text-emerald-600",
            },
            {
              label: "ยอดเจ้าหนี้ค้างชำระ / Outstanding AP",
              value: loading ? "..." : formatCurrency(stats?.outstandingAp ?? 0, lang),
              desc: "ยอดหนี้สินค้าค้างจ่ายจากใบแจ้งหนี้ AP",
              color: "text-amber-600 font-mono",
            },
            {
              label: "ใบรับรองหัก ณ ที่จ่าย / WHT Certificates",
              value: loading ? "..." : d(stats?.whtCertificatesCount),
              desc: "จำนวนรายการหนังสือรับรอง 50 ทวิ",
              color: "text-blue-600",
            },
            {
              label: "JE ล่าสุดในระบบ / Latest Journal Entries",
              value: loading ? "..." : d(stats?.recentJe?.length),
              desc: "รายการสมุดรายวันทั่วไปที่บันทึกช่วงนี้",
              color: "text-purple-600",
            }
          ].map((k, i) => (
            <div key={i} className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-stone-300 transition-all flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">{k.label}</span>
                <div className={`text-2xl font-bold mt-2 ${k.color}`}>{k.value}</div>
              </div>
              <div className="text-xs text-stone-400 mt-2 font-normal">{k.desc}</div>
            </div>
          ))}
        </div>

        {/* Auditor Quick Links Grid */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            ทางลัดโมดูลการตรวจสอบ / Audit Quick Links
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "สมุดบัญชีแยกประเภท / General Ledger (Audit)",
                desc: "สืบค้นและตรวจสอบรายละเอียดความเคลื่อนไหวของแต่ละผังบัญชี พร้อมตัวกรองเลขที่บัญชีและช่วงเวลาแบบละเอียดสำหรับผู้ตรวจสอบโดยเฉพาะ",
                href: "/app/accounting/audit/ledger",
                icon: "📖",
                tag: "Audit Route",
              },
              {
                title: "งบทดลองตรวจสอบ / Trial Balance (Audit)",
                desc: "แสดงรายการงบทดลองตามช่วงเวลาและรอบบัญชี คำนวณเดบิต/เครดิตและดุลบัญชีแบบเรียลไทม์เพื่อตรวจสอบความถูกต้องของระบบบัญชีคู่",
                href: "/app/accounting/audit/trial-balance",
                icon: "⚖️",
                tag: "Audit Route",
              },
              {
                title: "ผังบัญชี / Chart of Accounts",
                desc: "ดูโครงสร้างและรหัสบัญชีทั้งหมดแยกตามประเภทสินทรัพย์ หนี้สิน ส่วนของเจ้าของ รายได้ และค่าใช้จ่าย พร้อมประเภท normal balance",
                href: "/app/accounting/chart-of-accounts",
                icon: "📊",
                tag: "Bilingual COA",
              },
              {
                title: "สมุดรายวันทั่วไป / Journal Entries",
                desc: "เรียกดูใบสำคัญสมุดรายวัน (JE) ทุกฉบับ ตรวจเช็คสถานะการบันทึก (Posted) การยกเลิก (Void) หรือฉบับร่าง (Draft)",
                href: "/app/accounting/journal-entries",
                icon: "📂",
                tag: "General Journal",
              },
              {
                title: "หนังสือรับรองหัก ณ ที่จ่าย / WHT Certificates",
                desc: "ตรวจสอบรายการภาษีหัก ณ ที่จ่ายตามมาตรา 50 ทวิ ที่ออกให้คู่ค้าเจ้าหนี้ พร้อมปุ่มเรียกดูและพิมพ์เอกสาร PDF ภาษีหัก ณ ที่จ่ายแบบ 2 ภาษา",
                href: "/app/ap/wht",
                icon: "🧾",
                tag: "WHT 50 Twi",
              },
              {
                title: "รายงานอายุเจ้าหนี้ / AP Aging Report",
                desc: "ตรวจสอบภาระหนี้สินคงเหลือของคู่ค้าแยกตามช่วงอายุหนี้ (0-30, 31-60, 61-90, >90 วัน) เพื่อวิเคราะห์ความน่าเชื่อถือทางบัญชี",
                href: "/app/ap/aging",
                icon: "⏳",
                tag: "AP Aging Log",
              }
            ].map((l, i) => (
              <Link key={i} href={l.href} className="group relative block bg-white border border-stone-200 hover:border-stone-400 rounded-2xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="text-3xl shrink-0 p-2.5 rounded-xl bg-stone-50 group-hover:bg-stone-100 transition-colors">
                    {l.icon}
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-[5px] bg-stone-100 text-stone-600 text-[10px] font-semibold uppercase font-mono tracking-wider">
                    {l.tag}
                  </span>
                </div>
                <h3 className="text-base font-bold text-stone-900 mt-4 group-hover:text-stone-950 transition-colors">
                  {l.title}
                </h3>
                <p className="text-xs text-stone-500 mt-2 font-normal leading-relaxed">
                  {l.desc}
                </p>
                <div className="flex items-center gap-1 text-xs font-semibold text-stone-900 mt-4 group-hover:underline">
                  เข้าสู่หน้าตรวจสอบ / Access Portal
                  <svg className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Ledger Postings */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900">บันทึกสมุดรายวันล่าสุด / Recent Journal Entries</h2>
            <p className="text-xs text-stone-500">ตรวจสอบใบสำคัญบัญชีล่าสุดที่ผ่านการบันทึกรายการเข้าระบบ</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 font-semibold uppercase">
                  <th className="py-3 px-2">เลขที่ / JE No.</th>
                  <th className="py-3 px-2">วันที่ / Date</th>
                  <th className="py-3 px-2">ประเภท / Type</th>
                  <th className="py-3 px-2">คำอธิบายรายการ / Description</th>
                  <th className="py-3 px-2 text-right">จำนวนเงินเดบิต / Total Debit</th>
                  <th className="py-3 px-2">สถานะ / Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-6 text-center text-stone-400 italic">กำลังโหลดรายการล่าสุด...</td></tr>
                ) : stats?.recentJe?.length === 0 ? (
                  <tr><td colSpan={6} className="py-6 text-center text-stone-400 italic">ไม่พบรายการสมุดรายวันล่าสุด</td></tr>
                ) : stats?.recentJe?.map((je: DashboardJournalEntry) => (
                  <tr key={je.id} className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors">
                    <td className="py-3 px-2 font-mono font-semibold text-stone-900">
                      <Link href={`/app/accounting/journal-entries/${je.id}`} className="hover:underline text-blue-600">
                        {je.entry_number}
                      </Link>
                    </td>
                    <td className="py-3 px-2 text-stone-600">{new Date(je.entry_date).toLocaleDateString('th-TH')}</td>
                    <td className="py-3 px-2 uppercase font-semibold text-stone-500">{je.entry_type}</td>
                    <td className="py-3 px-2 text-stone-600 max-w-sm truncate">{je.description}</td>
                    <td className="py-3 px-2 text-right font-mono font-semibold text-stone-900">{formatCurrency(je.total_debit)}</td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        je.status === 'posted' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-stone-50 border-stone-200 text-stone-600'
                      }`}>
                        {je.status === 'posted' ? 'Posted' : je.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ViewTransition>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [kpi, setKpi] = useState<KPIData | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const t = useT();
  const { lang } = useLanguage();

  useEffect(() => {
    setIsMounted(true);
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

  if (!isMounted) return null;

  if ((session?.user as { role?: string } | undefined)?.role === 'auditor') {
    return <AuditorDashboard />;
  }

  return (
    <ViewTransition default="none" enter="fade-in" exit="fade-out">
      <div className="max-w-[1440px] mx-auto pb-12 space-y-4">

        {/* Header */}
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-stone-950 leading-tight mb-1">
              <Greeting />{userName ? `, ${userName}` : ''} 👋
            </h1>
            <p className="text-[13.5px] text-stone-500">
              {t('nav.overview')} ·{' '}
              {new Date().toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
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
              <option value="">{t('label.all')}</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.code} — {w.name_th}</option>
              ))}
            </select>
            <Link
              href="/app/purchase-requests/new"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] bg-stone-950 text-white text-[13px] font-medium shadow-sm hover:bg-stone-800 transition-colors"
            >
              + {t('action.create')}
            </Link>
          </div>
        </div>

        {/* KPI Grid */}
        <KpiGrid>
          <KpiCard
            label={t('page.purchase_requests') + ' ' + t('status.pending')}
            value={d(kpi?.pr?.pending_approval)}
            subValue={<>{t('action.create')} 30 {t('label.date')}: <span className="font-mono">{d(kpi?.pr?.last_30_days)}</span></>}
            sparkline={<Sparkline data={SPARK.pr} color="#94a3b8" />}
            href="/app/purchase-requests?status=submitted"
            loading={loading}
          />
          <KpiCard
            label={t('page.purchase_orders') + ' ' + t('status.sent')}
            value={d(kpi?.po?.sent)}
            subValue={<>{t('label.total')} 30 {t('label.date')}: <span className="font-mono text-[10.5px]">{kpi?.po?.value_30_days ? formatCurrency(kpi.po.value_30_days, lang) : '—'}</span></>}
            sparkline={<Sparkline data={SPARK.po} color="#10b981" />}
            href="/app/purchase-orders?status=sent"
            loading={loading}
          />
          <KpiCard
            label={t('page.grn') + ' ' + t('status.pending')}
            value={d(kpi?.grn?.pending)}
            subValue={<>{t('status.received')} {t('label.all')}: <span className="font-mono">{d(kpi?.grn?.stocked_this_month)}</span></>}
            sparkline={<Sparkline data={SPARK.grn} color="#10b981" />}
            href="/app/grn"
            loading={loading}
          />
          <KpiCard
            label={t('page.inventory') + ' ' + t('status.pending')}
            value={d(kpi?.low_stock?.length)}
            subValue="ต่ำกว่า reorder point"
            sparkline={<Sparkline data={SPARK.low} color="#d97706" />}
            href="/app/inventory?low_stock=true"
            loading={loading}
            className="[&_.text-ink]:text-amber-600"
          />
          <KpiCard
            label="SO รอดำเนินการ"
            value={d(kpi?.sales?.pending_so)}
            subValue={<>รายได้ 30 วัน: <span className="font-mono text-[10.5px]">{kpi?.sales?.revenue_30d ? formatCurrency(kpi.sales.revenue_30d, lang) : '—'}</span></>}
            sparkline={<Sparkline data={SPARK.pr} color="#6366f1" />}
            href="/app/sales-orders?status=confirmed"
            loading={loading}
          />
          <KpiCard
            label={t('page.pos_terminal') + ' ' + t('label.date')}
            value={kpi?.pos_today?.revenue ? formatCurrency(kpi.pos_today.revenue, lang) : '—'}
            subValue={<>{t('label.total')}: <span className="font-mono">{d(kpi?.pos_today?.tx_count)}</span></>}
            sparkline={<Sparkline data={SPARK.grn} color="#10b981" />}
            href="/app/pos/sessions"
            loading={loading}
          />
        </KpiGrid>

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
              <Link href="/app/inventory/ledger" className={BTN_SM}>{t('action.view')}{t('label.all')}</Link>
            </div>
            <div>
              {loading ? (
                <p className="px-5 py-4 text-[13px] text-stone-400">{t('label.loading')}</p>
              ) : !kpi?.top_received?.length ? (
                <p className="px-5 py-4 text-[13px] text-stone-400">{t('label.no_data')}</p>
              ) : kpi.top_received.map((p, i) => (
                <div key={p.sku} className="flex items-start gap-3 px-5 py-3 border-b border-stone-50 last:border-0 hover:bg-stone-50/60 transition-colors">
                  <div className="w-[18px] shrink-0 pt-[3px] font-mono text-[11.5px] text-stone-400">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-stone-900 truncate">{localeName(p.name_th, p.name_th, lang)}</div>
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
                    <div className="text-[11px] text-stone-400 mt-0.5">{t('label.unit')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top selling products */}
          <div className={CARD}>
            <div className={CARD_H}>
              <div>
                <div className="text-[13.5px] font-semibold text-stone-950">สินค้าขายดีสุด</div>
                <div className="text-[12px] text-stone-500 mt-0.5">30 วันล่าสุด · จากระบบ POS</div>
              </div>
            </div>
            <div>
              {loading ? (
                <p className="px-5 py-4 text-[13px] text-stone-400">{t('label.loading')}</p>
              ) : !kpi?.top_products?.length ? (
                <p className="px-5 py-4 text-[13px] text-stone-400">{t('label.no_data')}</p>
              ) : kpi.top_products.map((p, i) => (
                <div key={p.sku} className="flex items-center gap-3 px-5 py-3 border-b border-stone-50 last:border-0 hover:bg-stone-50/60 transition-colors">
                  <div className="w-[18px] shrink-0 pt-[3px] font-mono text-[11.5px] text-stone-400">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-stone-900 truncate">{localeName(p.name_th, p.name_th, lang)}</div>
                    <div className="text-[11.5px] text-stone-400 font-mono mt-0.5">{p.sku}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-mono font-medium text-stone-700 tabular-nums">
                      {formatNumber(p.qty_sold, lang)}
                    </div>
                    <div className="text-[11px] text-stone-400 mt-0.5">{Number(p.tx_count)} บิล</div>
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
                <p className="text-[13px] text-stone-400">{t('label.loading')}</p>
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
                      <span className="font-mono tabular-nums">{formatQty(w.qty_stocked)} {t('label.unit')}</span>
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
                <Link href="/app/claims" className={BTN_SM}>{t('action.view')}{t('label.all')}</Link>
              </div>
              <div className="px-5 py-4 flex gap-8">
                <div>
                  <div className="text-[12px] text-stone-400 mb-1">{t('label.qty')}</div>
                  <div className="text-[28px] font-semibold tracking-tight text-stone-950 leading-[1.1] tabular-nums">
                    {loading ? '—' : d(kpi?.claims?.open_claims)}
                  </div>
                </div>
                <div>
                  <div className="text-[12px] text-stone-400 mb-1">มูลค่าคงค้าง</div>
                  <div className="text-[20px] font-semibold tracking-tight text-red-600 leading-[1.1]">
                    {loading ? '—' : (kpi?.claims?.open_claim_value ? formatCurrency(kpi.claims.open_claim_value, lang) : '—')}
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
                <Link href="/app/rma" className={BTN_SM}>{t('action.view')}{t('label.all')}</Link>
              </div>
              <div className="px-5 py-4 flex gap-8">
                <div>
                  <div className="text-[12px] text-stone-400 mb-1">{t('label.all')}</div>
                  <div className="text-[28px] font-semibold tracking-tight text-stone-950 leading-[1.1] tabular-nums">
                    {loading ? '—' : d(kpi?.rma?.open_rmas)}
                  </div>
                </div>
                <div>
                  <div className="text-[12px] text-stone-400 mb-1">{t('status.in_review')}</div>
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
                <Link href="/app/grn?status=qc_failed" className={BTN_SM}>{t('action.view')}</Link>
              </div>
              <div className="px-5 py-4">
                <div className="text-[12px] text-stone-400 mb-1">{t('label.qty')}</div>
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
                      {kpi.low_stock.length} {t('label.total')}
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-stone-500 mt-0.5">ต้องสั่งเพิ่มเร็ว ๆ นี้</div>
              </div>
              <Link href="/app/purchase-requests/new" className={`${BTN_SM} text-stone-950`}>สร้าง PR</Link>
            </div>
            <div>
              {loading ? (
                <p className="px-5 py-4 text-[13px] text-stone-400">{t('label.loading')}</p>
              ) : !kpi?.low_stock?.length ? (
                <p className="px-5 py-4 text-[13px] text-stone-400">ไม่มีสินค้าต่ำกว่า reorder point</p>
              ) : kpi.low_stock.map((s, idx) => {
                const pct = Math.min(100, (Number(s.qty_available) / (s.reorder_point || 1)) * 100);
                return (
                  <div key={idx} className="flex items-center gap-3 px-5 py-2.5 border-b border-stone-50 last:border-0 hover:bg-stone-50/60 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-stone-900 truncate">{localeName(s.name_th, s.name_th, lang)}</div>
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

          {/* Activity feed (recent activity cross-module) */}
          <div className={CARD}>
            <div className={CARD_H}>
              <div>
                <div className="text-[13.5px] font-semibold text-stone-950">กิจกรรมล่าสุด</div>
                <div className="text-[12px] text-stone-500 mt-0.5">ความเคลื่อนไหวล่าสุดในระบบ</div>
              </div>
            </div>
            <div className="px-5 py-4 flex flex-col gap-4">
              {loading ? (
                <p className="text-[13px] text-stone-400">{t('label.loading')}</p>
              ) : !kpi?.recent_activity?.length ? (
                <p className="text-[13px] text-stone-400">{t('label.no_data')}</p>
              ) : kpi.recent_activity.map((l, idx) => {
                const color = l.type === 'grn' ? '#10b981' : l.type === 'so' ? '#6366f1' : '#f59e0b';
                const typeLabel = l.type === 'grn' ? 'GRN' : l.type === 'so' ? 'SO' : l.type.toUpperCase();
                return (
                  <div key={idx} className="flex items-start gap-[11px]">
                    <div
                      className="w-7 h-7 rounded-[7px] shrink-0 grid place-items-center text-[10px] font-bold mt-0.5"
                      style={{ background: color + '22', color }}
                    >
                      {typeLabel}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] leading-[1.5]">
                        <span className="font-medium text-stone-900">{l.ref}</span>
                        <span className="text-stone-500 text-[12.5px]"> {l.action} </span>
                      </div>
                      <div className="text-[11.5px] text-stone-400 mt-0.5 font-mono">
                        {formatDatetime(l.created_at, lang)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </ViewTransition>
  );
}

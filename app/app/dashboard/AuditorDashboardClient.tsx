'use client';

import { useState, useEffect } from 'react';
import { ViewTransition } from '@/lib/react-vts';
import { useSession } from 'next-auth/react';
import { get } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n';
import type { AuditorDashboardData } from '@/lib/queries/dashboard';

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

interface Props {
  initialData: AuditorDashboardData | null;
  session: { user?: unknown } | null;
}

export function AuditorDashboardClient({ initialData, session: serverSession }: Props) {
  const { data: clientSession } = useSession();
  const activeSession = clientSession ?? serverSession;

  const [stats, setStats] = useState<AuditorDashboardData | null>(initialData);
  const [loading, setLoading] = useState(initialData === null);
  const { lang } = useLanguage();

  useEffect(() => {
    if (initialData !== null) return;
    async function fetchAuditorStats() {
      try {
        const [periods, jeResponse, whtResponse, apResponse] = await Promise.all([
          get<DashboardPeriod[]>('/api/accounting/fiscal-periods'),
          get<{ data?: DashboardJournalEntry[] }>('/api/accounting/journal-entries?limit=5'),
          get<DashboardWhtResponse>('/api/ap/wht?limit=1'),
          get<DashboardApResponse>('/api/ap/invoices?is_paid=false'),
        ]);

        const activePeriods = periods.filter((p: DashboardPeriod) => p.status === 'open').length;
        const jeList = jeResponse?.data || [];
        const whtCount = whtResponse?.total ?? 0;
        const outstandingAp = apResponse?.invoices?.reduce(
          (sum: number, inv: DashboardInvoice) => sum + Number(inv.outstanding_amount), 0
        ) ?? 0;

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
  }, [initialData]);

  const d = (v: unknown) => v === undefined || v === null ? '—' : String(v);
  const userName = (activeSession?.user as { name?: string } | undefined)?.name ?? '';

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

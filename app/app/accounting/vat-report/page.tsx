'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { get, post } from '@/lib/api-client';
import { formatDate, formatCurrency } from '@/lib/format';
import { Button, Table, Thead, Tbody, Th, Td } from '@/components/ui';
import { FileText, Download, Lock, RefreshCw, Calendar } from 'lucide-react';
import { DirectionalTransition } from '@/components/ui/directional-transition';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

interface VATLine {
  invoice_number?: string;
  doc_number?: string;
  tax_point_date: string;
  vendor_name?: string;
  customer_name?: string;
  vendor_tax_id?: string;
  customer_tax_id?: string;
  base_amount: number | string;
  vat_amount: number | string;
  channel?: string;
}

export default function VATReportPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === 'admin';

  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [tab, setTab] = useState<'purchase' | 'sales'>('purchase');
  const [data, setData] = useState<VATLine[]>([]);
  const [totalBase, setTotalBase] = useState(0);
  const [totalVat, setTotalVat] = useState(0);
  const [isFinalized, setIsFinalized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = tab === 'purchase' ? '/api/accounting/vat/purchase' : '/api/accounting/vat/sales';
      const res = await get<{ data: VATLine[]; total_base: number; total_vat: number; is_finalized: boolean }>(
        `${endpoint}?year=${year}&month=${month}`
      );
      setData(res.data);
      setTotalBase(res.total_base);
      setTotalVat(res.total_vat);
      setIsFinalized(res.is_finalized);
    } catch (err) {
      console.error('Failed to fetch VAT report:', err);
    } finally {
      setLoading(false);
    }
  }, [year, month, tab]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleFinalize = async () => {
    if (!isAdmin) return;
    const confirmMessage = tab === 'purchase' 
      ? `คุณแน่ใจหรือไม่ที่จะล็อก "ภาษีซื้อ" ประจำรอบ ${month}/${year}? เมื่อล็อกแล้วจะไม่สามารถย้อนกลับหรือแก้ไขได้`
      : `คุณแน่ใจหรือไม่ที่จะล็อก "ภาษีขาย" ประจำรอบ ${month}/${year}? เมื่อล็อกแล้วจะไม่สามารถย้อนกลับหรือแก้ไขได้`;
    
    if (!confirm(confirmMessage)) return;

    setLocking(true);
    try {
      await post('/api/accounting/vat/finalize', { year, month, type: tab });
      alert('ล็อกรายงานและสร้างบันทึกประวัติสำเร็จเรียบร้อยแล้ว');
      fetchReport();
    } catch (err: unknown) {
      alert((err as Error).message || 'เกิดข้อผิดพลาดในการล็อกรายงาน');
    } finally {
      setLocking(false);
    }
  };

  const handleExportCSV = () => {
    if (data.length === 0) return;
    
    // Add UTF-8 BOM so Excel opens Thai characters correctly
    let csvContent = '\uFEFF';
    
    // Header row
    const headers = ['ลำดับ', 'วันที่', 'เลขที่ใบกำกับ/ใบเสร็จ', 'ชื่อผู้ซื้อ/ผู้ขาย', 'เลขประจำตัวผู้เสียภาษี', 'มูลค่าสินค้า (ฐานภาษี)', 'ภาษีมูลค่าเพิ่ม 7%'];
    csvContent += headers.join(',') + '\n';
    
    // Data rows
    data.forEach((item, index) => {
      const taxPointDate = formatDate(item.tax_point_date);
      const docNo = item.invoice_number || item.doc_number || '';
      const name = item.vendor_name || item.customer_name || '';
      const taxId = item.vendor_tax_id || item.customer_tax_id || '—';
      const base = Number(item.base_amount).toFixed(2);
      const vat = Number(item.vat_amount).toFixed(2);
      
      const row = [
        index + 1,
        `"${taxPointDate.replace(/"/g, '""')}"`,
        `"${docNo.replace(/"/g, '""')}"`,
        `"${name.replace(/"/g, '""')}"`,
        `"${taxId.replace(/"/g, '""')}"`,
        base,
        vat
      ];
      csvContent += row.join(',') + '\n';
    });
    
    // Blob & download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const fileName = `vat_report_${tab}_${year}_${month.toString().padStart(2, '0')}.csv`;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <DirectionalTransition>
      <div className="max-w-6xl mx-auto pb-12 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
              <FileText className="w-6 h-6 text-stone-900" />
              <span>รายงานภาษีมูลค่าเพิ่ม / VAT Report</span>
            </h1>
            <p className="text-sm text-stone-500">รายงานภาษีซื้อและภาษีขายประจำเดือน เพื่อยื่นสรรพากร (ภ.พ.30)</p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchReport}
              disabled={loading}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>รีเฟรช / Refresh</span>
            </Button>
          </div>
        </div>

        {/* Filters Card */}
        <div className={`${CARD} p-6`}>
          <div className="flex flex-wrap items-end gap-6">
            <div className="flex-1 min-w-[200px] grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide">
                  เดือน / Month
                </label>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-[7px] border border-stone-200 text-[13px] bg-white focus:outline-none focus:ring-1 focus:ring-stone-900 focus:border-stone-900"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2026, i).toLocaleString('th-TH', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide">
                  ปี (ค.ศ.) / Year
                </label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-[7px] border border-stone-200 text-[13px] bg-white focus:outline-none focus:ring-1 focus:ring-stone-900 focus:border-stone-900"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant={tab === 'purchase' ? 'primary' : 'outline'}
                onClick={() => setTab('purchase')}
                className="h-10 text-[13px] font-medium"
              >
                ภาษีซื้อ / Purchase VAT
              </Button>
              <Button
                variant={tab === 'sales' ? 'primary' : 'outline'}
                onClick={() => setTab('sales')}
                className="h-10 text-[13px] font-medium"
              >
                ภาษีขาย / Sales VAT
              </Button>
            </div>
          </div>
        </div>

        {/* Warning / Lock Notice Banner */}
        {isFinalized ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-[10px] text-sm text-emerald-800 leading-relaxed flex items-start gap-3">
            <Lock className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-emerald-900">ปิดบัญชีและล็อกรายงานแล้ว (LOCKED & FINALIZED):</span>{' '}
              รายงานรอบภาษีนี้ได้ถูกส่งตรวจอนุมัติและล็อกประวัติไว้แล้ว ข้อมูลในตารางโหลดโดยตรงจาก Snapshot
              และจะไม่เปลี่ยนแปลงตามธุรกรรมภายหลัง เพื่อให้ตรงกับเอกสารที่ยื่นส่งกรมสรรพากรจริง
            </div>
          </div>
        ) : (
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-[10px] text-sm text-stone-600 leading-relaxed flex items-start gap-3">
            <Calendar className="w-5 h-5 text-stone-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-stone-800">ช่วงเวลาดึงข้อมูลแบบไดนามิก (LIVE RUN):</span>{' '}
              ตารางนี้กำลังแสดงข้อมูลจริง ณ ปัจจุบัน เมื่อตรวจสอบความถูกต้องเรียบร้อยแล้ว ผู้ดูแลระบบ (Admin)
              สามารถคลิกที่ปุ่ม &quot;ล็อกรายงาน / Finalize&quot; เพื่อตรึงบันทึกสำหรับยื่น ภ.พ.30
            </div>
          </div>
        )}

        {/* Table Card */}
        <div className={CARD}>
          <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/50 flex flex-wrap justify-between items-center gap-4">
            <h2 className="text-[13px] font-bold text-stone-400 uppercase tracking-wider">
              {tab === 'purchase' ? 'ภาษีซื้อ' : 'ภาษีขาย'} ({data.length} รายการ)
            </h2>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={data.length === 0}
                className="flex items-center gap-1.5 text-xs h-8"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ส่งออก CSV / Export</span>
              </Button>

              {isAdmin && !isFinalized && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFinalize}
                  disabled={data.length === 0 || locking}
                  className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50/30 h-8"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>ล็อกรายงาน / Finalize</span>
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <Thead>
                <tr>
                  <Th className="w-16">ลำดับ</Th>
                  <Th>วันที่ / Date</Th>
                  <Th>เลขที่ใบกำกับภาษี / Doc No.</Th>
                  <Th>{tab === 'purchase' ? 'ผู้จำหน่าย / Vendor' : 'ลูกค้า / Customer'}</Th>
                  <Th>เลขประจำตัวผู้เสียภาษี / Tax ID</Th>
                  <Th className="text-right">มูลค่าสินค้า / Base</Th>
                  <Th className="text-right">ภาษีมูลค่าเพิ่ม / VAT 7%</Th>
                </tr>
              </Thead>
              <Tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-stone-400">
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-stone-400 italic">
                      ไม่พบข้อมูลรายงานภาษีในรอบเวลาที่เลือก
                    </td>
                  </tr>
                ) : (
                  <>
                    {data.map((item, index) => (
                      <tr key={index} className="hover:bg-stone-50/60 transition-colors">
                        <Td className="text-stone-400 font-mono">{index + 1}</Td>
                        <Td>{formatDate(item.tax_point_date)}</Td>
                        <Td className="font-mono font-bold text-stone-900">
                          {item.invoice_number || item.doc_number}
                        </Td>
                        <Td className="font-medium text-stone-800">
                          {item.vendor_name || item.customer_name}
                        </Td>
                        <Td className="font-mono text-stone-500">
                          {item.vendor_tax_id || item.customer_tax_id || '—'}
                        </Td>
                        <Td className="text-right font-mono tabular-nums text-stone-900">
                          {formatCurrency(item.base_amount)}
                        </Td>
                        <Td className="text-right font-mono tabular-nums text-emerald-700 font-medium">
                          {formatCurrency(item.vat_amount)}
                        </Td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="bg-stone-50 border-t-2 border-stone-200 font-semibold">
                      <Td colSpan={5} className="text-right text-stone-900 font-bold">
                        ยอดรวมทั้งสิ้น / TOTALS
                      </Td>
                      <Td className="text-right font-mono tabular-nums text-stone-900 font-bold">
                        {formatCurrency(totalBase)}
                      </Td>
                      <Td className="text-right font-mono tabular-nums text-emerald-800 font-bold">
                        {formatCurrency(totalVat)}
                      </Td>
                    </tr>
                  </>
                )}
              </Tbody>
            </Table>
          </div>
        </div>
      </div>
    </DirectionalTransition>
  );
}

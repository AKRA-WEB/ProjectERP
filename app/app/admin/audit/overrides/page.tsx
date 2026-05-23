'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { Table, Thead, Tbody, Th, Td, Button, Select, Input, Pagination, Badge, Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui';
import { useLanguage } from '@/lib/i18n';
import { formatDatetime } from '@/lib/utils';
import { DirectionalTransition } from '@/components/ui/directional-transition';

interface OverrideLog {
  id: string;
  user_id: string;
  user_name_th: string | null;
  user_name_en: string;
  user_email: string;
  action: string;
  target_table: string;
  target_id: string;
  reason_code: string;
  original_value: unknown;
  override_value: unknown;
  created_at: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

interface Authorizer {
  id: string;
  name_th: string;
  name_en: string;
  email: string;
  role: string;
}

export default function OverridesAuditPage() {
  const { lang } = useLanguage();
  const [data, setData] = useState<PaginatedResponse<OverrideLog> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [authorizers, setAuthorizers] = useState<Authorizer[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Expandable detail view modal state
  const [activeLog, setActiveLog] = useState<OverrideLog | null>(null);

  // Load active managers for the filter
  useEffect(() => {
    get<Authorizer[]>('/api/auth/active-authorizers')
      .then(setAuthorizers)
      .catch(console.error);
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
      });
      if (selectedUserId) params.set('user_id', selectedUserId);
      if (selectedAction) params.set('action', selectedAction);
      if (selectedTable) params.set('target_table', selectedTable);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const res = await get<PaginatedResponse<OverrideLog>>(`/api/admin/override-audit?${params}`);
      setData(res);
    } catch (err) {
      console.error('Failed to load override logs', err);
    } finally {
      setLoading(false);
    }
  }, [page, selectedUserId, selectedAction, selectedTable, fromDate, toDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleResetFilters = () => {
    setSelectedUserId('');
    setSelectedAction('');
    setSelectedTable('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const getReasonLabel = (code: string) => {
    const labels: Record<string, { th: string; en: string }> = {
      PRICE_MATCH: { th: 'ปรับราคาตามคู่แข่ง', en: 'Price Match' },
      PROMOTION: { th: 'โปรโมชันพิเศษ', en: 'Special Promotion' },
      CUSTOMER_SATISFACTION: { th: 'ความพึงพอใจลูกค้า', en: 'Customer Satisfaction' },
      FEFO_VIOLATION: { th: 'ข้ามลำดับสินค้า FEFO', en: 'FEFO Violation' },
      EXCESS_CREDIT: { th: 'วงเงินเครดิตเกินกำหนด', en: 'Excess Credit' },
      REPACK_LOSS: { th: 'การสูญเสียบรรจุใหม่', en: 'Repack Yield Loss' },
      OTHER: { th: 'เหตุผลอื่นๆ', en: 'Other Reason' },
    };
    const row = labels[code];
    if (!row) return code;
    return lang === 'th' ? row.th : row.en;
  };

  const formatJSON = (val: unknown) => {
    if (!val) return '—';
    try {
      const obj = typeof val === 'string' ? JSON.parse(val) : val;
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(val);
    }
  };

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {lang === 'th' ? 'บันทึกประวัติการอนุมัติสิทธิ์' : 'Supervisor Overrides Audit Log'}
          </h1>
          <p className="text-sm text-gray-500">
            {lang === 'th'
              ? 'ประวัติเหตุการณ์ที่ได้รับอนุมัติข้ามขั้นตอนพิเศษโดยผู้จัดการหรือแอดมิน'
              : 'Audit history of special actions authorized in-app using supervisor PINs.'}
          </p>
        </div>

        {/* Filters Panel */}
        <div className="mb-6 p-5 bg-white rounded-xl border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            {lang === 'th' ? 'ตัวกรองประวัติ / Filter Logs' : 'Filter Logs'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Filter by Supervisor */}
            <Select
              label={lang === 'th' ? 'ผู้อนุมัติ' : 'Authorizer'}
              value={selectedUserId}
              onChange={(e) => { setSelectedUserId(e.target.value); setPage(1); }}
              options={[
                { value: '', label: lang === 'th' ? 'แสดงทั้งหมด' : 'Show All' },
                ...authorizers.map((a) => ({
                  value: a.id,
                  label: `${a.name_en} (${a.role.toUpperCase()})`,
                })),
              ]}
            />

            {/* Filter by Action */}
            <Select
              label={lang === 'th' ? 'ประเภทการอนุมัติ' : 'Action Type'}
              value={selectedAction}
              onChange={(e) => { setSelectedAction(e.target.value); setPage(1); }}
              options={[
                { value: '', label: lang === 'th' ? 'แสดงทั้งหมด' : 'Show All' },
                { value: 'below_min_price', label: lang === 'th' ? 'ขายต่ำกว่าราคาขั้นต่ำ' : 'Below Min Price' },
                { value: 'fefo_violation', label: lang === 'th' ? 'ข้ามลำดับสินค้า FEFO' : 'FEFO Violation' },
                { value: 'credit_limit', label: lang === 'th' ? 'อนุมัติวงเงินเครดิตเกิน' : 'Credit Limit Override' },
                { value: 'repack_loss', label: lang === 'th' ? 'การสูญเสียใน Repack' : 'Repack Yield Loss' },
              ]}
            />

            {/* Filter by Table */}
            <Input
              label={lang === 'th' ? 'ตารางฐานข้อมูล' : 'Target Table'}
              placeholder="e.g. sales_orders"
              value={selectedTable}
              onChange={(e) => { setSelectedTable(e.target.value); setPage(1); }}
            />

            {/* Date From */}
            <Input
              label={lang === 'th' ? 'จากวันที่' : 'From Date'}
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            />

            {/* Date To */}
            <Input
              label={lang === 'th' ? 'ถึงวันที่' : 'To Date'}
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-50">
            <Button variant="secondary" onClick={handleResetFilters}>
              {lang === 'th' ? 'ล้างตัวกรอง' : 'Clear Filters'}
            </Button>
            <Button variant="primary" onClick={fetchLogs}>
              {lang === 'th' ? 'ค้นหา' : 'Search'}
            </Button>
          </div>
        </div>

        {/* Results Table */}
        <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          <Table>
            <Thead>
              <tr>
                <Th>{lang === 'th' ? 'วันเวลาที่อนุมัติ' : 'Date & Time'}</Th>
                <Th>{lang === 'th' ? 'ผู้อนุมัติ' : 'Authorized By'}</Th>
                <Th>{lang === 'th' ? 'การกระทำที่ข้ามขั้นตอน' : 'Overridden Action'}</Th>
                <Th>{lang === 'th' ? 'เหตุผล' : 'Reason'}</Th>
                <Th>{lang === 'th' ? 'แหล่งข้อมูล' : 'Resource Context'}</Th>
                <Th className="text-right"></Th>
              </tr>
            </Thead>
            <Tbody>
              {loading ? (
                <tr>
                  <Td colSpan={6}>
                    <div className="py-12 text-center text-gray-500 font-sans">
                      {lang === 'th' ? 'กำลังโหลดบันทึก...' : 'Loading audit logs...'}
                    </div>
                  </Td>
                </tr>
              ) : data?.data.length === 0 ? (
                <tr>
                  <Td colSpan={6}>
                    <div className="py-12 text-center text-gray-400 italic font-sans">
                      {lang === 'th' ? 'ไม่พบประวัติการอนุมัติข้ามขั้นตอนตามตัวกรองนี้' : 'No override logs found matching criteria.'}
                    </div>
                  </Td>
                </tr>
              ) : (
                data?.data.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <Td className="font-mono text-[13px] text-gray-600">
                      {formatDatetime(log.created_at, lang)}
                    </Td>
                    <Td>
                      <div className="text-sm font-medium text-gray-900">
                        {lang === 'th' && log.user_name_th ? log.user_name_th : log.user_name_en}
                      </div>
                      <div className="text-xs text-gray-400 font-mono">{log.user_email}</div>
                    </Td>
                    <Td>
                      <Badge variant={log.action.includes('price') ? 'red' : log.action.includes('fefo') ? 'yellow' : 'blue'}>
                        {log.action}
                      </Badge>
                    </Td>
                    <Td className="text-sm font-medium text-gray-700">
                      {getReasonLabel(log.reason_code)}
                    </Td>
                    <Td>
                      <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded-[4px]">
                        {log.target_table}
                      </span>
                      <div className="text-[11px] text-gray-400 font-mono mt-1 overflow-hidden overflow-ellipsis max-w-[200px] whitespace-nowrap">
                        {log.target_id}
                      </div>
                    </Td>
                    <Td className="text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setActiveLog(log)}
                      >
                        {lang === 'th' ? 'เปรียบเทียบข้อมูล' : 'View Details'}
                      </Button>
                    </Td>
                  </tr>
                ))
              )}
            </Tbody>
          </Table>

          {data && data.total_pages > 1 && (
            <div className="p-4 border-t border-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {lang === 'th'
                  ? `แสดง ${data.data.length} จากทั้งหมด ${data.total} รายการ`
                  : `Showing ${data.data.length} of ${data.total} logs`}
              </span>
              <Pagination
                currentPage={page}
                totalPages={data.total_pages}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </div>
      </div>

      {/* JSON Comparison Detail Modal */}
      {activeLog && (
        <Modal
          isOpen={!!activeLog}
          onClose={() => setActiveLog(null)}
          size="lg"
        >
          <ModalHeader onClose={() => setActiveLog(null)}>
            {lang === 'th' ? 'เปรียบเทียบข้อมูลการข้ามสิทธิ์' : 'Override Value Comparison Details'}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs font-sans bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div>
                  <span className="font-bold text-gray-500 uppercase block mb-1">
                    {lang === 'th' ? 'วันเวลา' : 'Timestamp'}
                  </span>
                  <span className="text-gray-900 font-mono">
                    {formatDatetime(activeLog.created_at, lang)}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-gray-500 uppercase block mb-1">
                    {lang === 'th' ? 'ผู้อนุมัติ' : 'Authorizer'}
                  </span>
                  <span className="text-gray-900 font-medium">
                    {activeLog.user_name_en} ({activeLog.user_email})
                  </span>
                </div>
              </div>

              {/* Side by side JSON Diff Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original Value Panel */}
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-600 mb-1">
                    {lang === 'th' ? 'มูลค่า/ข้อมูลดั้งเดิม (Original Value)' : 'Original Value'}
                  </span>
                  <pre className="flex-1 min-h-[250px] p-4 bg-gray-900 text-green-400 font-mono text-xs rounded-xl overflow-auto border border-gray-800 leading-relaxed">
                    {formatJSON(activeLog.original_value)}
                  </pre>
                </div>

                {/* Overridden Value Panel */}
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-red-600 mb-1">
                    {lang === 'th' ? 'ข้อมูลอนุมัติพิเศษ (Override Value)' : 'Override Value'}
                  </span>
                  <pre className="flex-1 min-h-[250px] p-4 bg-gray-900 text-red-400 font-mono text-xs rounded-xl overflow-auto border border-gray-800 leading-relaxed">
                    {formatJSON(activeLog.override_value)}
                  </pre>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="primary" onClick={() => setActiveLog(null)}>
              {lang === 'th' ? 'ปิด' : 'Close'}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </DirectionalTransition>
  );
}

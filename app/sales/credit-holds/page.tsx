'use client';

import { useEffect, useState, useCallback } from 'react';
import { get, post, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui';
import { OverridePinModal } from '@/components/auth/OverridePinModal';
import { formatCurrency } from '@/lib/utils';

interface Customer {
  id: string;
  code: string;
  name_th: string;
  credit_limit: number;
  on_hold: boolean;
}

interface CreditStatus {
  on_hold: boolean;
  outstanding: number;
  credit_limit: number;
  max_aging_days: number;
  reason?: string;
}

interface HoldRow {
  customer: Customer;
  status: CreditStatus;
}

export default function CreditHoldsPage() {
  const [rows, setRows] = useState<HoldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [releasing, setReleasing] = useState<string | null>(null);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const fetchHolds = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await get<{ data: Customer[] }>('/api/customers?on_hold=true&limit=100');
      const customers = res.data ?? [];
      const enriched = await Promise.all(
        customers.map(async (c) => {
          const s = await get<{ status: CreditStatus }>(`/api/customers/${c.id}/credit-status`);
          return { customer: c, status: s.status };
        })
      );
      setRows(enriched);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'โหลดข้อมูลล้มเหลว');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHolds(); }, [fetchHolds]);

  function openRelease(customer: Customer) {
    setSelectedCustomer(customer);
    setPinModalOpen(true);
  }

  async function handleRelease(token: string, reasonCode: string) {
    if (!selectedCustomer) return;
    setReleasing(selectedCustomer.id);
    setPinModalOpen(false);
    try {
      await post(`/api/customers/${selectedCustomer.id}/credit-release`, {
        override_token: token,
        released_reason: reasonCode,
      });
      await fetchHolds();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'ปลดล็อกเครดิตล้มเหลว');
    } finally {
      setReleasing(null);
      setSelectedCustomer(null);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ลูกค้าอยู่ภายใต้ Credit Hold</h1>
          <p className="text-sm text-gray-500 mt-1">Customers on Credit Hold</p>
        </div>
        <Button variant="secondary" onClick={fetchHolds} disabled={loading}>
          รีเฟรช
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">กำลังโหลด...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400">ไม่มีลูกค้าที่อยู่ภายใต้ Credit Hold</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">รหัส / ชื่อลูกค้า</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">ยอดค้างชำระ</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">วงเงินเครดิต</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">อายุหนี้สูงสุด (วัน)</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(({ customer, status }) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{customer.code}</div>
                    <div className="text-gray-500">{customer.name_th}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-red-600 font-medium">
                    {formatCurrency(status.outstanding)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatCurrency(status.credit_limit)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={status.max_aging_days >= 1 ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                      {status.max_aging_days} วัน
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => openRelease(customer)}
                      disabled={releasing === customer.id}
                    >
                      {releasing === customer.id ? 'กำลังปลดล็อก...' : 'ปลดล็อก (Override)'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OverridePinModal
        isOpen={pinModalOpen}
        action="credit_release"
        onSuccess={handleRelease}
        onClose={() => { setPinModalOpen(false); setSelectedCustomer(null); }}
      />
    </div>
  );
}

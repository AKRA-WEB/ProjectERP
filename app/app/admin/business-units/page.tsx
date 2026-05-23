'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, Thead, Tbody, Th, Td, Badge, Card, CardHeader, CardBody } from '@/components/ui';
import { get } from '@/lib/api-client';
import { useLanguage } from '@/lib/i18n';
import { formatDate } from '@/lib/utils';
import type { BusinessUnit } from '@/types';

export default function AdminBusinessUnitsPage() {
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { lang } = useLanguage();

  const fetchBusinessUnits = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await get<BusinessUnit[]>('/api/admin/business-units');
      setBusinessUnits(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดข้อมูลหน่วยธุรกิจไม่สำเร็จ / Failed to load business units');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBusinessUnits();
  }, [fetchBusinessUnits]);

  if (loading) {
    return (
      <div className="py-16 text-center text-gray-500 font-medium">
        {lang === 'en' ? 'Loading business units...' : 'กำลังโหลดข้อมูลหน่วยธุรกิจ...'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {lang === 'en' ? 'Business Units' : 'หน่วยธุรกิจ (Business Units)'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {lang === 'en' 
            ? 'Manage and view partitioned business units' 
            : 'ดูและจัดการการแบ่งขอบเขตหน่วยธุรกิจ (TRD Bakermart / Akra Wholesale)'}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              {lang === 'en' ? 'All Business Units' : 'หน่วยธุรกิจทั้งหมด'}
            </h2>
            <Badge variant="blue">
              {businessUnits.length} {lang === 'en' ? 'Units' : 'หน่วย'}
            </Badge>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-hidden rounded-b-lg border-t border-gray-200 dark:border-gray-700">
            <Table>
              <Thead>
                <tr>
                  <Th>{lang === 'en' ? 'Code' : 'รหัส'}</Th>
                  <Th>{lang === 'en' ? 'Name (TH)' : 'ชื่อภาษาไทย'}</Th>
                  <Th>{lang === 'en' ? 'Name (EN)' : 'ชื่อภาษาอังกฤษ'}</Th>
                  <Th>{lang === 'en' ? 'Created At' : 'วันที่สร้าง'}</Th>
                </tr>
              </Thead>
              <Tbody>
                {businessUnits.length === 0 ? (
                  <tr>
                    <Td colSpan={4} className="text-center text-gray-500 py-8 dark:text-gray-400">
                      {lang === 'en' ? 'No business units found' : 'ไม่พบข้อมูลหน่วยธุรกิจ'}
                    </Td>
                  </tr>
                ) : (
                  businessUnits.map((bu) => (
                    <tr key={bu.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                      <Td>
                        <code className="font-mono text-sm font-bold bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-indigo-600 dark:text-indigo-400">
                          {bu.code}
                        </code>
                      </Td>
                      <Td className="font-medium text-gray-900 dark:text-white">
                        {bu.name_th}
                      </Td>
                      <Td className="text-gray-600 dark:text-gray-300">
                        {bu.name_en}
                      </Td>
                      <Td className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                        {formatDate(bu.created_at, lang)}
                      </Td>
                    </tr>
                  ))
                )}
              </Tbody>
            </Table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

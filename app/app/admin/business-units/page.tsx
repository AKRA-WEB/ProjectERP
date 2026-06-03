'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, Thead, Tbody, Th, Td, Badge, Card, CardHeader, CardBody } from '@/components/ui';
import { get } from '@/lib/api-client';
import { useT } from '@/lib/i18n';
import { formatDate } from '@/lib/utils';
import type { BusinessUnit } from '@/types';

export default function AdminBusinessUnitsPage() {
  const t = useT();
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchBusinessUnits = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await get<BusinessUnit[]>('/api/admin/business-units');
      setBusinessUnits(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('business_unit.load_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchBusinessUnits();
  }, [fetchBusinessUnits]);

  if (loading) {
    return (
      <div className="py-16 text-center text-gray-500 font-medium">
        {t('msg.loading_data')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('business_unit.page.title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('business_unit.page.subtitle')}
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
              {t('business_unit.all_units')}
            </h2>
            <Badge variant="blue">
              {businessUnits.length} {t('business_unit.units_suffix')}
            </Badge>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-hidden rounded-b-lg border-t border-gray-200 dark:border-gray-700">
            <Table>
              <Thead>
                <tr>
                  <Th>{t('business_unit.col.code')}</Th>
                  <Th>{t('business_unit.col.name_th')}</Th>
                  <Th>{t('business_unit.col.name_en')}</Th>
                  <Th>{t('business_unit.col.created_at')}</Th>
                </tr>
              </Thead>
              <Tbody>
                {businessUnits.length === 0 ? (
                  <tr>
                    <Td colSpan={4} className="text-center text-gray-500 py-8 dark:text-gray-400">
                      {t('business_unit.no_data')}
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
                        {formatDate(bu.created_at)}
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

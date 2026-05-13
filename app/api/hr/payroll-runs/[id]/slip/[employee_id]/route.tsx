import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { queryOne } from '@/lib/db/client';
import { apiError } from '@/lib/api-response';
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { SessionUser } from '@/lib/authz';
import React from 'react';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10 },
  title: { fontSize: 16, marginBottom: 12, textAlign: 'center' },
  section: { marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  label: { color: '#555' },
  divider: { borderBottom: 1, borderColor: '#ddd', marginVertical: 6 },
  total: { fontSize: 12 },
});

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string; employee_id: string }> }
) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  const { id, employee_id } = await params;

  // Staff can only get own slip
  if (u.role === 'staff' && u.id !== employee_id) return apiError('Forbidden', 403);

  const line = await queryOne<{
    employee_name_th: string; employee_name_en: string; employee_id_code: string | null;
    base_salary: string; allowances: string; ot_pay: string;
    absence_deduction: string; gross_pay: string; sso_employee: string;
    income_tax: string; net_pay: string;
  }>(`
    SELECT pl.*, u.name_th AS employee_name_th, u.name_en AS employee_name_en, u.employee_id AS employee_id_code
    FROM payroll_lines pl
    JOIN users u ON u.id = pl.employee_id
    WHERE pl.run_id = $1 AND pl.employee_id = $2
  `, [id, employee_id]);
  if (!line) return apiError('Not found', 404);

  const run = await queryOne<{ run_number: string; period_month: number; period_year: number }>(
    `SELECT run_number, period_month, period_year FROM payroll_runs WHERE id = $1`, [id]
  );
  if (!run) return apiError('Not found', 404);

  const allowances: { name_th: string; amount: number }[] = JSON.parse(line.allowances || '[]');

  const SlipDoc = () => (
    <Document>
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.title}>ใบเงินเดือน / Payslip</Text>
          <Text style={{ textAlign: 'center', marginBottom: 12, color: '#666' }}>
            {`${run.period_month}/${run.period_year}  •  ${run.run_number}`}
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.row}><Text style={styles.label}>พนักงาน / Employee</Text><Text>{line.employee_name_th || line.employee_name_en}</Text></View>
          {line.employee_id_code && <View style={styles.row}><Text style={styles.label}>รหัสพนักงาน</Text><Text>{line.employee_id_code}</Text></View>}
        </View>

        <View style={styles.divider} />
        <Text style={{ marginBottom: 4 }}>รายได้ / Earnings</Text>
        <View style={styles.row}><Text>เงินเดือน</Text><Text>{Number(line.base_salary).toFixed(2)}</Text></View>
        {allowances.map((a, i) => <View key={i} style={styles.row}><Text>{a.name_th}</Text><Text>{a.amount.toFixed(2)}</Text></View>)}
        {Number(line.ot_pay) > 0 && <View style={styles.row}><Text>ค่าล่วงเวลา (OT)</Text><Text>{Number(line.ot_pay).toFixed(2)}</Text></View>}
        {Number(line.absence_deduction) > 0 && <View style={styles.row}><Text style={{ color: 'red' }}>หักขาด</Text><Text style={{ color: 'red' }}>-{Number(line.absence_deduction).toFixed(2)}</Text></View>}
        <View style={[styles.row, { marginTop: 4 }]}><Text>รายได้รวม</Text><Text>{Number(line.gross_pay).toFixed(2)}</Text></View>

        <View style={styles.divider} />
        <Text style={{ marginBottom: 4 }}>รายหัก / Deductions</Text>
        <View style={styles.row}><Text>ประกันสังคม (5%)</Text><Text>-{Number(line.sso_employee).toFixed(2)}</Text></View>
        <View style={styles.row}><Text>ภาษีหัก ณ ที่จ่าย</Text><Text>-{Number(line.income_tax).toFixed(2)}</Text></View>

        <View style={styles.divider} />
        <View style={[styles.row, styles.total]}>
          <Text>เงินเดือนสุทธิ / Net Pay</Text>
          <Text>{Number(line.net_pay).toFixed(2)} THB</Text>
        </View>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(<SlipDoc />);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="slip-${(line.employee_name_en || line.employee_name_th).replace(/\s+/g, '_')}-${run.period_year}-${String(run.period_month).padStart(2,'0')}.pdf"`,
    },
  });
}

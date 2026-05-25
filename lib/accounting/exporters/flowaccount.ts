import type { ExportRow } from './types';

function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/"/g, '""');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str}"`;
  }
  return str;
}

export function exportFlowAccount(rows: ExportRow[]): { filename: string; mime: string; buffer: Buffer } {
  // FlowAccount Journal Entry template format
  const headers = ['Voucher_Number', 'Voucher_Date', 'Description', 'Account_Code', 'Account_Name', 'Debit_Amount', 'Credit_Amount'];
  
  const csvLines = [headers.join(',')];
  
  for (const r of rows) {
    const line = [
      escapeCsvValue(r.entry_number),
      escapeCsvValue(new Date(r.entry_date).toISOString().split('T')[0]),
      escapeCsvValue(r.entry_description),
      escapeCsvValue(r.account_code),
      escapeCsvValue(r.account_name_th),
      Number(r.debit_amount) > 0 ? Number(r.debit_amount).toFixed(2) : '0.00',
      Number(r.credit_amount) > 0 ? Number(r.credit_amount).toFixed(2) : '0.00',
    ];
    csvLines.push(line.join(','));
  }
  
  // UTF-8 BOM
  const bom = Buffer.from('\uFEFF', 'utf-8');
  const csvContent = bom.toString() + csvLines.join('\r\n');
  const buffer = Buffer.from(csvContent, 'utf-8');
  
  return {
    filename: `FlowAccount_GL_${new Date().toISOString().split('T')[0]}.csv`,
    mime: 'text/csv; charset=utf-8',
    buffer,
  };
}

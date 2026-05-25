import type { ExportRow } from './types';

function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/"/g, '""');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str}"`;
  }
  return str;
}

export function exportExpress(rows: ExportRow[]): { filename: string; mime: string; buffer: Buffer } {
  // Express GL Voucher import format
  const headers = ['Voucher_No', 'Voucher_Date', 'Description', 'Account_Code', 'Debit', 'Credit', 'Line_Description'];
  
  const csvLines = [headers.join(',')];
  
  for (const r of rows) {
    const line = [
      escapeCsvValue(r.entry_number),
      escapeCsvValue(new Date(r.entry_date).toLocaleDateString('th-TH')),
      escapeCsvValue(r.entry_description),
      escapeCsvValue(r.account_code),
      Number(r.debit_amount) > 0 ? Number(r.debit_amount).toFixed(2) : '0.00',
      Number(r.credit_amount) > 0 ? Number(r.credit_amount).toFixed(2) : '0.00',
      escapeCsvValue(r.line_description || r.entry_description),
    ];
    csvLines.push(line.join(','));
  }
  
  // Use UTF-8 with BOM for Excel compatibility in Thai
  const bom = Buffer.from('\uFEFF', 'utf-8');
  const csvContent = bom.toString() + csvLines.join('\r\n');
  const buffer = Buffer.from(csvContent, 'utf-8');
  
  return {
    filename: `Express_GL_${new Date().toISOString().split('T')[0]}.csv`,
    mime: 'text/csv; charset=utf-8',
    buffer,
  };
}

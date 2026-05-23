import { createHash } from 'crypto';
import type { PoolClient } from 'pg';
import { query } from '@/lib/db/client';

/**
 * Calculates a simple Mod-16 checksum for a hex string.
 */
function calculateChecksum(str: string): string {
  let sum = 0;
  for (let i = 0; i < str.length; i++) {
    sum += parseInt(str[i], 16);
  }
  return (sum % 16).toString(16);
}

/**
 * Generates a deterministic barcode for an invoice version.
 * SHA-256(invoiceNumber + ':' + versionNo) → hex with checksum digit appended.
 */
export function generateInvoiceBarcode(invoiceNumber: string, versionNo: number): string {
  const input = `${invoiceNumber}:${versionNo}`;
  const hash = createHash('sha256').update(input).digest('hex');
  const checkDigit = calculateChecksum(hash);
  return `${hash}${checkDigit}`;
}

/**
 * Verifies an invoice barcode and returns the invoice ID and version number.
 * Only returns a match if the barcode is the CURRENT active barcode for that invoice.
 */
export async function verifyInvoiceBarcode(barcode: string): Promise<{ invoice_id: string; version_no: number } | null> {
  // 1. Basic format/checksum check
  if (barcode.length < 65) return null;
  const data = barcode.slice(0, -1);
  const check = barcode.slice(-1);
  if (calculateChecksum(data) !== check) return null;

  // 2. Lookup in database
  const res = await query<{ invoice_id: string; version_no: number }>(
    `SELECT invoice_id, version_no FROM invoice_versions WHERE barcode = $1`,
    [barcode]
  );
  if (res.length === 0) return null;

  // 3. Ensure it's the latest version
  const latest = await query<{ current_barcode: string }>(
    `SELECT current_barcode FROM sales_invoices WHERE id = $1`,
    [res[0].invoice_id]
  );
  
  if (latest.length === 0 || latest[0].current_barcode !== barcode) {
    return null; // Stale or invalid
  }

  return res[0];
}

/**
 * Bumps the invoice version, records the change summary, and generates a new barcode.
 * MUST be called inside a transaction.
 */
export async function bumpInvoiceVersion(
  client: PoolClient, 
  invoiceId: string, 
  userId: string, 
  changeSummary: object
): Promise<{ version_no: number; barcode: string }> {
  // 1. Get current state and lock the row
  const res = await client.query(
    `SELECT si_number, current_version FROM sales_invoices WHERE id = $1 FOR UPDATE`,
    [invoiceId]
  );
  if (res.rowCount === 0) throw new Error('Invoice not found');
  
  const { si_number, current_version } = res.rows[0];
  const nextVer = (current_version || 1) + 1;
  
  // 2. Generate new barcode
  const barcode = generateInvoiceBarcode(si_number, nextVer);
  
  // 3. Insert into history
  await client.query(
    `INSERT INTO invoice_versions (invoice_id, version_no, barcode, change_summary, created_by)
     VALUES ($1, $2, $3, $4::jsonb, $5)`,
    [invoiceId, nextVer, barcode, JSON.stringify(changeSummary), userId]
  );
  
  // 4. Update parent record
  await client.query(
    `UPDATE sales_invoices SET current_version = $1, current_barcode = $2, updated_at = NOW() WHERE id = $3`,
    [nextVer, barcode, invoiceId]
  );
  
  return { version_no: nextVer, barcode };
}

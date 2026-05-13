import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import * as dns from 'dns';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dns.setDefaultResultOrder('ipv4first');
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

interface VendorRow {
  code: string;
  name_th: string;
}

function readExcel(filePath: string): VendorRow[] {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

  return raw
    .slice(1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any[]) => r[0] && r[1])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any[]) => ({
      code:    String(r[0]).trim(),
      name_th: String(r[1]).trim(),
    }));
}

async function main() {
  const filePath = path.resolve(__dirname, '../data/imports/Vendor.xlsx');
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  console.log('Reading Excel...');
  const rows = readExcel(filePath);
  console.log(`  ${rows.length} vendors found`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let inserted = 0;
    let updated = 0;

    for (const row of rows) {
      const res = await client.query<{ id: string; created_at: string; updated_at: string }>(
        `INSERT INTO vendors (code, name_th, name_en)
         VALUES ($1, $2, $2)
         ON CONFLICT (code) DO UPDATE SET
           name_th    = EXCLUDED.name_th,
           updated_at = NOW()
         RETURNING id, created_at, updated_at`,
        [row.code, row.name_th]
      );

      const r = res.rows[0];
      if (r.created_at === r.updated_at) inserted++; else updated++;
    }

    await client.query('COMMIT');
    console.log(`\nDone. Inserted: ${inserted} | Updated: ${updated} | Total: ${rows.length}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
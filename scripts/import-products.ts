import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import * as dns from 'dns';
import { Pool, PoolClient } from 'pg';
import * as dotenv from 'dotenv';

dns.setDefaultResultOrder('ipv4first');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

interface ExcelRow {
  sku: string;
  name_th: string;
  name_en: string;
  category: string;
  unit: string;
}

function readExcel(filePath: string): ExcelRow[] {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

  return raw
    .slice(1)
    .filter((r: any[]) => r[0] && r[1])
    .map((r: any[]) => ({
      sku: String(r[0]).trim(),
      name_th: String(r[1]).trim(),
      name_en: r[2] ? String(r[2]).trim() : String(r[1]).trim(),
      category: r[3] ? String(r[3]).trim() : 'ไม่ระบุหมวดหมู่',
      unit: r[4] ? String(r[4]).trim() : 'ชิ้น',
    }));
}

async function upsertUOMs(client: PoolClient, units: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const unit of units) {
    const code = unit.substring(0, 20);
    const res = await client.query<{ id: string }>(
      `INSERT INTO units_of_measure (code, name_th, name_en)
       VALUES ($1, $2, $2)
       ON CONFLICT (code) DO UPDATE SET name_th = EXCLUDED.name_th
       RETURNING id`,
      [code, unit]
    );
    map.set(unit, res.rows[0].id);
  }
  return map;
}

async function upsertCategories(client: PoolClient, categories: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const cat of categories) {
    const code = cat.replace(/[^฀-๿a-zA-Z0-9]/g, '').substring(0, 50) || `CAT_${map.size}`;
    const res = await client.query<{ id: string }>(
      `INSERT INTO product_categories (code, name_th, name_en)
       VALUES ($1, $2, $2)
       ON CONFLICT (code) DO UPDATE SET name_th = EXCLUDED.name_th
       RETURNING id`,
      [code, cat]
    );
    map.set(cat, res.rows[0].id);
  }
  return map;
}

async function main() {
  const filePath = path.resolve(__dirname, '../data/imports/all_product.xlsx');
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  console.log('Reading Excel...');
  const rows = readExcel(filePath);
  console.log(`  ${rows.length} products found`);

  const uniqueUnits = [...new Set(rows.map((r) => r.unit))];
  const uniqueCategories = [...new Set(rows.map((r) => r.category))];
  console.log(`  ${uniqueUnits.length} unique UOMs`);
  console.log(`  ${uniqueCategories.length} unique categories`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Upserting UOMs...');
    const uomMap = await upsertUOMs(client, uniqueUnits);

    console.log('Upserting categories...');
    const catMap = await upsertCategories(client, uniqueCategories);

    console.log('Upserting products...');
    let inserted = 0;
    let updated = 0;

    for (const row of rows) {
      const uomId = uomMap.get(row.unit);
      const catId = catMap.get(row.category);

      if (!uomId) { console.warn(`  SKIP: UOM not found for "${row.unit}" (sku: ${row.sku})`); continue; }

      const res = await client.query<{ id: string; created_at: string; updated_at: string }>(
        `INSERT INTO products (sku, name_th, name_en, category_id, uom_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (sku) DO UPDATE SET
           name_th = EXCLUDED.name_th,
           name_en = EXCLUDED.name_en,
           category_id = EXCLUDED.category_id,
           uom_id = EXCLUDED.uom_id,
           updated_at = NOW()
         RETURNING id, created_at, updated_at`,
        [row.sku, row.name_th, row.name_en, catId ?? null, uomId]
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

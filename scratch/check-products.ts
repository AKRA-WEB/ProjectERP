import { query } from '../lib/db/client';

async function main() {
  const warehouses = await query('SELECT id, code, name_th FROM warehouses');
  console.log('--- WAREHOUSES ---', warehouses);

  for (const w of warehouses as any[]) {
    const countRes = await query(
      `SELECT COUNT(*) FROM products p 
       JOIN stock_balances sb ON sb.product_id = p.id 
       WHERE p.is_active = true AND sb.warehouse_id = $1`,
      [w.id]
    );
    console.log(`Warehouse ${w.code} (${w.name_th}) product count:`, countRes);
  }
}

main().catch(console.error);

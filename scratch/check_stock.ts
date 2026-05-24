import { query } from '../lib/db/client';

async function main() {
  try {
    console.log("=== STOCK BALANCES FOR WH-06 & WH-07 ===");
    const balances = await query(`
      SELECT sb.warehouse_id, w.code as warehouse_code, sb.product_id, p.sku, sb.qty_on_hand, sb.qty_reserved
      FROM stock_balances sb
      JOIN warehouses w ON sb.warehouse_id = w.id
      JOIN products p ON sb.product_id = p.id
      WHERE w.code IN ('WH-06', 'WH-07', 'C1', 'C2')
    `);
    console.log(JSON.stringify(balances, null, 2));

    console.log("\n=== ALL STOCK BALANCES ===");
    const allBalances = await query(`
      SELECT w.code as warehouse_code, COUNT(*), SUM(qty_on_hand) as total_qty
      FROM stock_balances sb
      JOIN warehouses w ON sb.warehouse_id = w.id
      GROUP BY w.code
    `);
    console.log(JSON.stringify(allBalances, null, 2));
  } catch (error) {
    console.error("Error querying database:", error);
  }
}

main();

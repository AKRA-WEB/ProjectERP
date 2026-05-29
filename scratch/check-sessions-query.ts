import { query } from '../lib/db/client';

async function main() {
  console.log('--- CALLING BACKEND LOGIC ---');
  const total = await query('SELECT COUNT(*) FROM pos_sessions s WHERE s.status = \'open\'');
  const sessions = await query(`
    SELECT s.*, 
            w.name_th AS warehouse_name_th, w.name_en AS warehouse_name_en,
            u_open.name_en AS opened_by_name,
            ps.name_th AS shift_name_th, ps.name_en AS shift_name_en,
            (SELECT COUNT(*) FROM pos_transactions t WHERE t.session_id = s.id) AS transaction_count,
            (SELECT COALESCE(SUM(total), 0) FROM pos_transactions t WHERE t.session_id = s.id AND t.status = 'completed') AS total_sales
     FROM pos_sessions s
     JOIN warehouses w ON w.id = s.warehouse_id
     JOIN users u_open ON u_open.id = s.opened_by
     LEFT JOIN pos_shifts ps ON ps.id = s.shift_id
     WHERE s.status = 'open'
     ORDER BY s.opened_at DESC
  `);
  
  console.log('Total open count:', total);
  console.log('Sessions:', sessions);
}

main().catch(console.error);

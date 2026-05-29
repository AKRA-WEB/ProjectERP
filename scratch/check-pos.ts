import { query } from '../lib/db/client';

async function main() {
  const users = await query('SELECT id, email, role FROM users');
  const assignments = await query(`
    SELECT u.email, w.code, w.name_th
    FROM user_warehouse_assignments uwa
    JOIN users u ON u.id = uwa.user_id
    JOIN warehouses w ON w.id = uwa.warehouse_id
  `);
  
  console.log('--- USER WAREHOUSE ASSIGNMENTS ---');
  console.log('Users:', users);
  console.log('Assignments:', assignments);
}

main().catch(console.error);

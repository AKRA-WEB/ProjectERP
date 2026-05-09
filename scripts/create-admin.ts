import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@wms.local';
  const password = process.env.ADMIN_PASSWORD ?? 'admin1234';
  const nameEn = 'System Admin';
  const nameTh = 'ผู้ดูแลระบบ';

  const hash = await bcrypt.hash(password, 12);

  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, name_en, name_th, role)
     VALUES ($1, $2, $3, $4, 'admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = $2, role = 'admin'
     RETURNING id, email, role`,
    [email, hash, nameEn, nameTh]
  );

  console.log('Admin user ready:', rows[0]);
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });

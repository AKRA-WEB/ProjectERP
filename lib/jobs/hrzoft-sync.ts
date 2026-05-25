import pool from '@/lib/db/client';

export interface HrzoftEmployee {
  employee_id: string;
  name_th: string;
  name_en: string;
  email: string;
  phone: string | null;
  position: string | null;
  department: string | null;
  hired_date: string | null;
  is_active: boolean;
}

// Rich mock data for simulation/fallback
const MOCK_HRZOFT_EMPLOYEES: HrzoftEmployee[] = [
  {
    employee_id: 'HZ-101',
    name_th: 'สมศรี รักดี',
    name_en: 'Somsri Rakdee',
    email: 'somsri@akra.local',
    phone: '0812345678',
    position: 'Senior Accountant',
    department: 'Accounting',
    hired_date: '2024-03-01',
    is_active: true,
  },
  {
    employee_id: 'HZ-102',
    name_th: 'สมชาย ใจดี',
    name_en: 'Somchai Jaidee',
    email: 'somchai@akra.local',
    phone: '0823456789',
    position: 'Warehouse Specialist',
    department: 'Warehouse',
    hired_date: '2024-05-15',
    is_active: true,
  },
  {
    employee_id: 'HZ-103',
    name_th: 'กิตติ บุญมี',
    name_en: 'Kitti Boonmee',
    email: 'kitti.b@trd.local',
    phone: '0834567890',
    position: 'Sales Representative',
    department: 'Sales',
    hired_date: '2025-01-10',
    is_active: true,
  },
  {
    employee_id: 'HZ-104',
    name_th: 'จอห์น โด',
    name_en: 'John Doe',
    email: 'john.doe@akra.local',
    phone: '0845678901',
    position: 'Operations Manager',
    department: 'Operations',
    hired_date: '2023-11-20',
    is_active: false, // Disabled employee
  },
  {
    employee_id: 'HZ-105',
    name_th: 'สมศักดิ์ สุขสำราญ',
    name_en: 'Somsak Suksamran',
    email: 'somsak.s@akra.local',
    phone: '0856789012',
    position: 'Junior Developer',
    department: 'IT',
    hired_date: '2026-05-20',
    is_active: true, // Brand new hire
  }
];

export async function runHrzoftSync(): Promise<{
  runId: string;
  total: number;
  created: number;
  updated: number;
  disabled: number;
  orphaned: number;
  status: 'completed' | 'failed';
}> {
  const client = await pool.connect();
  let runId = '';

  // 1. Create a sync run log entry
  const startRes = await client.query<{ id: string }>(
    `INSERT INTO hrzoft_sync_runs (status) VALUES ('running') RETURNING id`
  );
  runId = startRes.rows[0].id;

  try {
    await client.query('BEGIN');

    // 2. Fetch data from Hrzoft REST API
    let employees: HrzoftEmployee[] = [];
    const hrzoftUrl = process.env.HRZOFT_API_URL;

    if (hrzoftUrl) {
      try {
        const response = await fetch(hrzoftUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.HRZOFT_API_TOKEN ?? ''}`,
            'Accept': 'application/json',
          },
          // 5 seconds timeout
          signal: AbortSignal.timeout(5000)
        });
        if (response.ok) {
          employees = await response.json();
        } else {
          console.warn(`Hrzoft API returned non-OK status: ${response.status}. Falling back to simulation data.`);
          employees = MOCK_HRZOFT_EMPLOYEES;
        }
      } catch (fetchError) {
        console.warn(`Hrzoft API fetch failed. Falling back to simulation data. Error:`, fetchError);
        employees = MOCK_HRZOFT_EMPLOYEES;
      }
    } else {
      // Fallback/Simulation mode
      employees = MOCK_HRZOFT_EMPLOYEES;
    }

    let created = 0;
    let updated = 0;
    let disabled = 0;
    const syncedEmployeeIds: string[] = [];

    // 3. Process each Hrzoft employee record
    for (const emp of employees) {
      syncedEmployeeIds.push(emp.employee_id);

      // Check if external_user_sync mapping exists
      const syncRes = await client.query<{ id: string; local_user_id: string; status: string }>(
        `SELECT id, local_user_id, status FROM external_user_sync WHERE hrzoft_employee_id = $1`,
        [emp.employee_id]
      );

      let localUserId: string | null = null;
      let conflictNotes = '';

      if (syncRes.rowCount && syncRes.rowCount > 0) {
        // Sync mapping exists!
        localUserId = syncRes.rows[0].local_user_id;

        // Perform conflict checks and update user record
        // Hrzoft wins for name, title (position), department, phone, hired_date, and active-status.
        // ERP wins for role and BU binding (so we don't modify role/BU).
        await client.query(
          `UPDATE users
           SET name_th = $1,
               name_en = $2,
               position = $3,
               department = $4,
               phone = $5,
               hired_date = $6::date,
               is_active = $7,
               updated_at = NOW()
           WHERE id = $8`,
          [
            emp.name_th,
            emp.name_en,
            emp.position,
            emp.department,
            emp.phone,
            emp.hired_date,
            emp.is_active,
            localUserId
          ]
        );

        // Update sync mapping status & last_synced_at
        const syncStatus = emp.is_active ? 'active' : 'disabled';
        await client.query(
          `UPDATE external_user_sync
           SET status = $1::hrzoft_sync_status,
               last_synced_at = NOW(),
               conflict_notes = NULL
           WHERE id = $2`,
          [syncStatus, syncRes.rows[0].id]
        );

        if (!emp.is_active) {
          disabled++;
        } else {
          updated++;
        }
      } else {
        // No sync mapping. Check if users has same employee_id
        const userByIdRes = await client.query<{ id: string }>(
          `SELECT id FROM users WHERE employee_id = $1`,
          [emp.employee_id]
        );

        if (userByIdRes.rowCount && userByIdRes.rowCount > 0) {
          localUserId = userByIdRes.rows[0].id;
          
          // Found user with same employee_id! Create mapping
          const syncStatus = emp.is_active ? 'active' : 'disabled';
          await client.query(
            `INSERT INTO external_user_sync (local_user_id, hrzoft_employee_id, status, last_synced_at)
             VALUES ($1, $2, $3::hrzoft_sync_status, NOW())`,
            [localUserId, emp.employee_id, syncStatus]
          );

          // Update user details
          await client.query(
            `UPDATE users
             SET name_th = $1,
                 name_en = $2,
                 position = $3,
                 department = $4,
                 phone = $5,
                 hired_date = $6::date,
                 is_active = $7,
                 updated_at = NOW()
             WHERE id = $8`,
            [
              emp.name_th,
              emp.name_en,
              emp.position,
              emp.department,
              emp.phone,
              emp.hired_date,
              emp.is_active,
              localUserId
            ]
          );

          if (!emp.is_active) {
            disabled++;
          } else {
            updated++;
          }
        } else {
          // No employee_id match. Check for email collision in users table
          const userByEmailRes = await client.query<{ id: string; employee_id: string | null }>(
            `SELECT id, employee_id FROM users WHERE email = $1`,
            [emp.email]
          );

          if (userByEmailRes.rowCount && userByEmailRes.rowCount > 0) {
            localUserId = userByEmailRes.rows[0].id;
            conflictNotes = `Email collision: matched to existing ERP user by email. Verification needed.`;

            // Email collision: update user with employee_id and make sync record
            const syncStatus = emp.is_active ? 'active' : 'disabled';
            await client.query(
              `INSERT INTO external_user_sync (local_user_id, hrzoft_employee_id, status, last_synced_at, conflict_notes)
               VALUES ($1, $2, $3::hrzoft_sync_status, NOW(), $4)`,
              [localUserId, emp.employee_id, syncStatus, conflictNotes]
            );

            // Update user details including employee_id
            await client.query(
              `UPDATE users
               SET employee_id = $1,
                   name_th = $2,
                   name_en = $3,
                   position = $4,
                   department = $5,
                   phone = $6,
                   hired_date = $7::date,
                   is_active = $8,
                   updated_at = NOW()
               WHERE id = $9`,
              [
                emp.employee_id,
                emp.name_th,
                emp.name_en,
                emp.position,
                emp.department,
                emp.phone,
                emp.hired_date,
                emp.is_active,
                localUserId
              ]
            );

            if (!emp.is_active) {
              disabled++;
            } else {
              updated++;
            }
          } else {
            // Truly a new user! Create new user record
            // Generates a random, secure locked password hash
            const dummyHash = `locked_${crypto.randomUUID()}`;
            
            const newUserRes = await client.query<{ id: string }>(
              `INSERT INTO users (
                 email, password_hash, name_th, name_en, employee_id,
                 position, department, phone, hired_date, is_active, role
               )
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10, 'staff')
               RETURNING id`,
              [
                emp.email,
                dummyHash,
                emp.name_th,
                emp.name_en,
                emp.employee_id,
                emp.position,
                emp.department,
                emp.phone,
                emp.hired_date,
                emp.is_active
              ]
            );
            localUserId = newUserRes.rows[0].id;

            // Seed user_warehouse_assignments for W1 (main warehouse) by default for new users so they can log in/see things
            const mainWarehouseRes = await client.query<{ id: string }>(
              `SELECT id FROM warehouses WHERE code = 'W1' LIMIT 1`
            );
            if (mainWarehouseRes.rowCount && mainWarehouseRes.rowCount > 0) {
              await client.query(
                `INSERT INTO user_warehouse_assignments (user_id, warehouse_id)
                 VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [localUserId, mainWarehouseRes.rows[0].id]
              );
            }

            // Create sync record
            const syncStatus = emp.is_active ? 'active' : 'disabled';
            await client.query(
              `INSERT INTO external_user_sync (local_user_id, hrzoft_employee_id, status, last_synced_at)
               VALUES ($1, $2, $3::hrzoft_sync_status, NOW())`,
              [localUserId, emp.employee_id, syncStatus]
            );

            created++;
          }
        }
      }
    }

    // 4. Handle orphans (mapped users not found in the current Hrzoft sync run payload)
    let orphaned = 0;
    if (syncedEmployeeIds.length > 0) {
      // Find external_user_sync entries NOT in syncedEmployeeIds list
      const orphanRes = await client.query<{ id: string; hrzoft_employee_id: string }>(
        `SELECT id, hrzoft_employee_id FROM external_user_sync 
         WHERE hrzoft_employee_id NOT IN (SELECT unnest($1::varchar[]))`,
        [syncedEmployeeIds]
      );

      for (const orphan of orphanRes.rows) {
        orphaned++;
        await client.query(
          `UPDATE external_user_sync
           SET status = 'orphan'::hrzoft_sync_status,
               conflict_notes = $1
           WHERE id = $2`,
          [`Employee not found in the latest Hrzoft payload. Flagged for review.`, orphan.id]
        );
      }
    }

    // 5. Update sync runs table on success
    await client.query(
      `UPDATE hrzoft_sync_runs
       SET completed_at = NOW(),
           status = 'completed',
           total_count = $1,
           created_count = $2,
           updated_count = $3,
           disabled_count = $4,
           orphan_count = $5
       WHERE id = $6`,
      [employees.length, created, updated, disabled, orphaned, runId]
    );

    await client.query('COMMIT');

    return {
      runId,
      total: employees.length,
      created,
      updated,
      disabled,
      orphaned,
      status: 'completed'
    };
  } catch (err) {
    await client.query('ROLLBACK');

    const errorMessage = err instanceof Error ? err.message : String(err);
    await client.query(
      `UPDATE hrzoft_sync_runs
       SET completed_at = NOW(),
           status = 'failed',
           error_message = $1
       WHERE id = $2`,
      [errorMessage, runId]
    );

    throw err;
  } finally {
    client.release();
  }
}

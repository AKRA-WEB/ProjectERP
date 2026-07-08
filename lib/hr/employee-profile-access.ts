import type { SessionUser } from '@/lib/authz';
import { buildWarehouseScopeClause } from '@/lib/authz';
import { queryOne } from '@/lib/db/client';

export function canAccessProfile(actor: SessionUser, targetId: string): boolean {
  if (actor.role === 'admin') return true;
  if (actor.role === 'manager') return true; // warehouse scope enforced by isEmployeeInScope
  return actor.id === targetId;
}

export function canSeeSalary(actor: SessionUser): boolean {
  return actor.role === 'admin';
}

/**
 * Returns true if the actor can access the given employee.
 * Admin: always. Staff: self only. Manager: employee must share a warehouse assignment.
 */
export async function isEmployeeInScope(actor: SessionUser, employeeId: string): Promise<boolean> {
  if (actor.role === 'admin') return true;
  if (actor.role === 'staff') return actor.id === employeeId;

  const scope = buildWarehouseScopeClause(actor, 'uwa.warehouse_id', 2);
  if (!scope) return true;
  if (scope.clause === 'FALSE') return false;

  const row = await queryOne(
    `SELECT u.id FROM users u
     WHERE u.id = $1
       AND EXISTS (
         SELECT 1 FROM user_warehouse_assignments uwa
         WHERE uwa.user_id = u.id AND ${scope.clause}
       )`,
    [employeeId, ...scope.params]
  );
  return !!row;
}

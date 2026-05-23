import { type SessionUser, type UserRole } from '@/types';
export type { SessionUser, UserRole };

/** Returns true if user has the permission, or if user is admin (bypass). */
export function hasPermission(user: SessionUser, permission: string): boolean {
  if (user.role === 'admin') return true;
  return (user.permissions ?? []).includes(permission);
}

/** Throws 403 if user lacks the permission. */
export function assertPermission(user: SessionUser, permission: string): void {
  if (!hasPermission(user, permission)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
}

/** Throws 403 if user is not admin and warehouseId is not in their assigned list. */

export function assertWarehouseAccess(user: SessionUser, warehouseId: string): void {
  if (user.role === 'admin') return;
  if (!user.assignedWarehouseIds.includes(warehouseId)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
}

/** Throws 403 if user role is not in the allowed roles array. */
export function assertRole(user: SessionUser, allowedRoles: UserRole[]): void {
  if (!allowedRoles.includes(user.role)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
}

/**
 * Returns a SQL clause + params for warehouse scoping.
 * Admin: no restriction (returns null). Staff/Manager: restricts to assigned warehouses.
 * Usage: buildWarehouseScopeClause(user, 'alias.column', paramIndex)
 */
export function buildWarehouseScopeClause(
  user: SessionUser,
  columnExpr: string,
  paramOffset: number
): { clause: string; params: unknown[] } | null {
  if (user.role === 'admin') return null;

  const hasBU = !!user.businessUnitId;
  const hasWH = user.assignedWarehouseIds && user.assignedWarehouseIds.length > 0;

  if (!hasBU && !hasWH) {
    return { clause: 'FALSE', params: [] };
  }

  if (hasBU && hasWH) {
    return {
      clause: `${columnExpr} = ANY($${paramOffset}::uuid[]) AND ${columnExpr} IN (SELECT id FROM warehouses WHERE business_unit_id = $${paramOffset + 1})`,
      params: [user.assignedWarehouseIds, user.businessUnitId],
    };
  }

  if (hasBU) {
    return {
      clause: `${columnExpr} IN (SELECT id FROM warehouses WHERE business_unit_id = $${paramOffset})`,
      params: [user.businessUnitId],
    };
  }

  return {
    clause: `${columnExpr} = ANY($${paramOffset}::uuid[])`,
    params: [user.assignedWarehouseIds],
  };
}

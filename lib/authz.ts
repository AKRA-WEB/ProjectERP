export type UserRole = 'admin' | 'manager' | 'staff';

export interface SessionUser {
  id: string;
  role: UserRole;
  assignedWarehouseIds: string[];
}

/** Throws 403 if user is not admin and warehouseId is not in their assignments. */
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
  if (user.assignedWarehouseIds.length === 0) {
    return { clause: 'FALSE', params: [] };
  }
  return {
    clause: `${columnExpr} = ANY($${paramOffset}::uuid[])`,
    params: [user.assignedWarehouseIds],
  };
}

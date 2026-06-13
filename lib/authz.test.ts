import { describe, expect, it } from 'vitest';
import {
  assertRole,
  assertWarehouseAccess,
  buildWarehouseScopeClause,
  hasPermission,
  type SessionUser,
} from './authz';

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'user-1',
    role: 'staff',
    assignedWarehouseIds: [],
    permissions: [],
    businessUnitId: null,
    ...overrides,
  };
}

describe('hasPermission', () => {
  it('allows admin users regardless of explicit permissions', () => {
    expect(hasPermission(user({ role: 'admin', permissions: [] }), 'inventory.read')).toBe(true);
  });

  it('requires a matching permission for non-admin users', () => {
    const scopedUser = user({ permissions: ['inventory.read'] });

    expect(hasPermission(scopedUser, 'inventory.read')).toBe(true);
    expect(hasPermission(scopedUser, 'inventory.write')).toBe(false);
  });
});

describe('assertRole', () => {
  it('throws a 403 error when the user role is not allowed', () => {
    expect(() => assertRole(user({ role: 'staff' }), ['admin', 'manager'])).toThrowError('Forbidden');

    try {
      assertRole(user({ role: 'staff' }), ['admin']);
      throw new Error('Expected assertRole to throw');
    } catch (error) {
      expect((error as { status?: number }).status).toBe(403);
    }
  });

  it('does not throw when the user role is allowed', () => {
    expect(() => assertRole(user({ role: 'manager' }), ['manager', 'admin'])).not.toThrow();
  });
});

describe('assertWarehouseAccess', () => {
  it('allows admin users to access any warehouse', () => {
    expect(() => assertWarehouseAccess(user({ role: 'admin' }), 'warehouse-99')).not.toThrow();
  });

  it('throws 403 when a non-admin user is not assigned to the warehouse', () => {
    try {
      assertWarehouseAccess(user({ assignedWarehouseIds: ['warehouse-1'] }), 'warehouse-2');
      throw new Error('Expected assertWarehouseAccess to throw');
    } catch (error) {
      expect((error as { status?: number }).status).toBe(403);
    }
  });
});

describe('buildWarehouseScopeClause', () => {
  it('returns null for admin users so route handlers apply no warehouse restriction', () => {
    expect(buildWarehouseScopeClause(user({ role: 'admin' }), 'w.id', 3)).toBeNull();
  });

  it('returns a deny-all clause when a non-admin user has no BU and no warehouse assignments', () => {
    expect(buildWarehouseScopeClause(user(), 'w.id', 1)).toEqual({ clause: 'FALSE', params: [] });
  });

  it('scopes by assigned warehouses with the provided parameter offset', () => {
    expect(
      buildWarehouseScopeClause(
        user({ assignedWarehouseIds: ['warehouse-1', 'warehouse-2'] }),
        'w.id',
        4
      )
    ).toEqual({
      clause: 'w.id = ANY($4::uuid[])',
      params: [['warehouse-1', 'warehouse-2']],
    });
  });

  it('scopes by business unit when the user has a BU but no warehouse assignments', () => {
    expect(
      buildWarehouseScopeClause(user({ businessUnitId: 'bu-1' }), 'warehouses.id', 2)
    ).toEqual({
      clause: 'warehouses.id IN (SELECT id FROM warehouses WHERE business_unit_id = $2)',
      params: ['bu-1'],
    });
  });

  it('combines warehouse assignments and BU scope using adjacent parameter offsets', () => {
    expect(
      buildWarehouseScopeClause(
        user({ assignedWarehouseIds: ['warehouse-1'], businessUnitId: 'bu-1' }),
        'w.id',
        7
      )
    ).toEqual({
      clause:
        'w.id = ANY($7::uuid[]) AND w.id IN (SELECT id FROM warehouses WHERE business_unit_id = $8)',
      params: [['warehouse-1'], 'bu-1'],
    });
  });
});

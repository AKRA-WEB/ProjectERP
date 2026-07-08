import { describe, expect, it, vi, beforeEach } from 'vitest';
import { canAccessProfile, canSeeSalary, isEmployeeInScope } from './employee-profile-access';
import type { SessionUser } from '@/lib/authz';

vi.mock('@/lib/db/client', () => ({
  default: {},
  queryOne: vi.fn(),
  query: vi.fn(),
}));

import { queryOne } from '@/lib/db/client';
const mockQueryOne = queryOne as ReturnType<typeof vi.fn>;

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'user-self',
    role: 'staff',
    assignedWarehouseIds: [],
    permissions: [],
    businessUnitId: null,
    ...overrides,
  };
}

describe('canAccessProfile', () => {
  it('staff can access own profile', () => {
    expect(canAccessProfile(user({ id: 'u1' }), 'u1')).toBe(true);
  });

  it('staff cannot access another employee profile', () => {
    expect(canAccessProfile(user({ id: 'u1' }), 'u2')).toBe(false);
  });

  it('manager can access any employee (SQL scope enforced separately)', () => {
    expect(canAccessProfile(user({ role: 'manager' }), 'any-employee')).toBe(true);
  });

  it('admin can access any employee', () => {
    expect(canAccessProfile(user({ role: 'admin' }), 'any-employee')).toBe(true);
  });
});

describe('canSeeSalary', () => {
  it('staff cannot see salary', () => {
    expect(canSeeSalary(user({ role: 'staff' }))).toBe(false);
  });

  it('manager cannot see salary', () => {
    expect(canSeeSalary(user({ role: 'manager' }))).toBe(false);
  });

  it('admin can see salary', () => {
    expect(canSeeSalary(user({ role: 'admin' }))).toBe(true);
  });
});

describe('isEmployeeInScope', () => {
  beforeEach(() => { mockQueryOne.mockReset(); });

  it('admin always returns true without DB call', async () => {
    const result = await isEmployeeInScope(user({ role: 'admin' }), 'any-id');
    expect(result).toBe(true);
    expect(mockQueryOne).not.toHaveBeenCalled();
  });

  it('staff own id returns true without DB call', async () => {
    const result = await isEmployeeInScope(user({ id: 'u1', role: 'staff' }), 'u1');
    expect(result).toBe(true);
    expect(mockQueryOne).not.toHaveBeenCalled();
  });

  it('staff other id returns false without DB call', async () => {
    const result = await isEmployeeInScope(user({ id: 'u1', role: 'staff' }), 'u2');
    expect(result).toBe(false);
    expect(mockQueryOne).not.toHaveBeenCalled();
  });

  it('manager with no warehouses returns false without DB call', async () => {
    // No assignedWarehouseIds and no businessUnitId → scope.clause = 'FALSE'
    const result = await isEmployeeInScope(
      user({ role: 'manager', assignedWarehouseIds: [], businessUnitId: null }),
      'emp-id'
    );
    expect(result).toBe(false);
    expect(mockQueryOne).not.toHaveBeenCalled();
  });

  it('manager in-scope employee returns true when DB finds row', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'emp-id' });
    const result = await isEmployeeInScope(
      user({ role: 'manager', assignedWarehouseIds: ['wh-1'], businessUnitId: null }),
      'emp-id'
    );
    expect(result).toBe(true);
    expect(mockQueryOne).toHaveBeenCalledOnce();
  });

  it('manager out-of-scope employee returns false when DB finds no row', async () => {
    mockQueryOne.mockResolvedValueOnce(null);
    const result = await isEmployeeInScope(
      user({ role: 'manager', assignedWarehouseIds: ['wh-1'], businessUnitId: null }),
      'other-emp'
    );
    expect(result).toBe(false);
    expect(mockQueryOne).toHaveBeenCalledOnce();
  });
});

import { describe, expect, it } from 'vitest';
import { resolveAttendanceReview, resolveAttendanceApproval } from './attendance-adjustments';
import type { AttendanceAdjReq } from './attendance-adjustments';

const request: AttendanceAdjReq = {
  id: 'req-1',
  employee_id: 'emp-1',
  work_date: '2026-06-01',
  requested_clock_in: '2026-06-01T08:05:00Z',
  requested_clock_out: '2026-06-01T17:00:00Z',
  requested_status: 'present',
  requested_ot_hours: 0,
  reason: 'Forgot to clock in',
};

const existingRecord = { id: 'att-1' };
const managerId = 'manager-99';

describe('resolveAttendanceReview — approve with existing record', () => {
  it('returns update action with requested fields', () => {
    const result = resolveAttendanceReview('approve', managerId, request, existingRecord);
    expect(result).not.toBeNull();
    expect(result?.action).toBe('update');
    expect(result?.data.employee_id).toBe('emp-1');
    expect(result?.data.clock_in).toBe('2026-06-01T08:05:00Z');
  });
});

describe('resolveAttendanceReview — approve without existing record', () => {
  it('returns create action when no attendance record exists', () => {
    const result = resolveAttendanceReview('approve', managerId, request, null);
    expect(result?.action).toBe('create');
    expect(result?.data.work_date).toBe('2026-06-01');
  });
});

describe('resolveAttendanceReview — reject', () => {
  it('returns null without mutating attendance', () => {
    const result = resolveAttendanceReview('reject', managerId, request, existingRecord);
    expect(result).toBeNull();
  });
});

describe('resolveAttendanceApproval — self-approval guard', () => {
  it('throws when actor is the same as the request employee', () => {
    expect(() =>
      resolveAttendanceApproval('emp-1', request, existingRecord)
    ).toThrow('Self-approval is not allowed');
  });

  it('throws for staff trying to self-approve', () => {
    expect(() =>
      resolveAttendanceApproval(request.employee_id, request, null)
    ).toThrow();
  });
});

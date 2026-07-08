export interface AttendanceAdjReq {
  id: string;
  employee_id: string;
  work_date: string;
  requested_clock_in: string | null;
  requested_clock_out: string | null;
  requested_status: string | null;
  requested_ot_hours: number | null;
  reason: string;
}

export interface AttendanceRecordMutation {
  action: 'create' | 'update';
  data: {
    employee_id: string;
    work_date: string;
    clock_in: string | null;
    clock_out: string | null;
    status: string | null;
    ot_hours: number | null;
    note: string;
  };
}

export function resolveAttendanceApproval(
  actorId: string,
  request: AttendanceAdjReq,
  existingRecord: { id: string } | null
): AttendanceRecordMutation {
  if (actorId === request.employee_id) {
    throw new Error('Self-approval is not allowed');
  }

  return {
    action: existingRecord ? 'update' : 'create',
    data: {
      employee_id: request.employee_id,
      work_date: request.work_date,
      clock_in: request.requested_clock_in,
      clock_out: request.requested_clock_out,
      status: request.requested_status,
      ot_hours: request.requested_ot_hours,
      note: request.reason,
    },
  };
}

export function resolveAttendanceReview(
  action: 'approve' | 'reject',
  actorId: string,
  request: AttendanceAdjReq,
  existingRecord: { id: string } | null
): AttendanceRecordMutation | null {
  if (action === 'reject') return null;
  return resolveAttendanceApproval(actorId, request, existingRecord);
}

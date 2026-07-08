export interface LeaveBalanceState {
  days_entitled: number;
  days_used: number;
}

export interface AdjustmentResult {
  before: number;
  after: number;
}

export function computeLeaveAdjustment(
  kind: 'entitlement' | 'used_correction',
  state: LeaveBalanceState,
  delta: number,
  reason: string
): AdjustmentResult {
  if (!reason.trim()) throw new Error('Reason is required');

  const before = kind === 'entitlement' ? state.days_entitled : state.days_used;
  const after = before + delta;

  if (after < 0) {
    throw new Error(`Balance after adjustment cannot be negative (would be ${after})`);
  }

  if (kind === 'used_correction') {
    const newRemaining = state.days_entitled - after;
    if (newRemaining < 0) {
      throw new Error('Used days cannot exceed entitlement after adjustment');
    }
  }

  return { before, after };
}

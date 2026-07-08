BEGIN;

-- Add data-integrity constraints missed in 073

ALTER TABLE leave_balance_adjustments
  ADD CONSTRAINT chk_leave_balance_adjustments_balance_after_non_negative
    CHECK (balance_after >= 0);

ALTER TABLE attendance_adjustment_requests
  ADD CONSTRAINT chk_att_adj_requested_status
    CHECK (requested_status IS NULL OR requested_status IN ('present','absent','late','half_day','holiday')),
  ADD CONSTRAINT chk_att_adj_ot_hours_non_negative
    CHECK (requested_ot_hours IS NULL OR requested_ot_hours >= 0);

COMMIT;

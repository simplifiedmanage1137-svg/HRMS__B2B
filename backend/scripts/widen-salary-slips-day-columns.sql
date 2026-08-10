-- present_days/half_days/absent_days/total_working_days were INTEGER, but half-day
-- attendance legitimately produces fractional day counts (e.g. 9 full + 1 half-day = 9.5
-- present days) — paid_leave_days/unpaid_leave_days were already NUMERIC for the same
-- reason, this just brings the other four in line. Widening an integer column to numeric
-- is safe and non-destructive; existing whole-number values convert with no data loss.
ALTER TABLE salary_slips
  ALTER COLUMN present_days TYPE NUMERIC(6,2),
  ALTER COLUMN half_days TYPE NUMERIC(6,2),
  ALTER COLUMN absent_days TYPE NUMERIC(6,2),
  ALTER COLUMN total_working_days TYPE NUMERIC(6,2);

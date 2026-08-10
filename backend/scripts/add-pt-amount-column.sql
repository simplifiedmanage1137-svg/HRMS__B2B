-- Mirrors employees.pf_amount: nullable, per-employee PT amount.
-- NULL = not explicitly set, salary calculation treats it as ₹0 (no PT deduction applied
-- until an admin explicitly configures it via the PF/PT tab).
-- 0 is a valid, explicit "PT-exempt" value and must not be treated as missing.
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS pt_amount NUMERIC(10, 2);

COMMENT ON COLUMN employees.pt_amount IS 'Per-employee PT amount in INR. NULL = not configured, treated as ₹0 (no automatic default). 0 is a valid explicit value (PT-exempt).';

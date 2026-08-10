-- Professional Tax: a genuinely new, separate deduction from PT (pt_amount).
-- NULL = not configured (treated as "0" in salary calc, NOT the ₹200 PT default —
-- there is no prior hardcoded value for this field, so the safe default is 0).
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS professional_tax_amount NUMERIC(10, 2);

COMMENT ON COLUMN employees.professional_tax_amount IS 'Per-employee Professional Tax deduction in INR, separate from pt_amount. NULL = not configured, defaults to 0 in salary calculation. 0 is a valid explicit value.';

-- Permanent payroll exclusion flag (e.g. test accounts). Excluded employees are
-- filtered out server-side in generateBulkSalarySlips — never relies on frontend state alone.
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS exclude_from_payroll BOOLEAN DEFAULT false;

COMMENT ON COLUMN employees.exclude_from_payroll IS 'When true, this employee is permanently excluded from payroll generation (e.g. test/demo accounts).';

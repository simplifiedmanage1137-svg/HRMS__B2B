-- Run this in Supabase SQL editor

-- 1. Create the salary_deductions table
CREATE TABLE IF NOT EXISTS salary_deductions (
  id             SERIAL PRIMARY KEY,
  employee_id    VARCHAR(20) NOT NULL,
  amount         NUMERIC(10,2) NOT NULL,
  reason         TEXT NOT NULL,
  deduction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  month          INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year           INTEGER NOT NULL,
  created_by     VARCHAR(100),
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add index for fast lookups by employee + month/year
CREATE INDEX IF NOT EXISTS idx_sal_ded_emp_month_year
  ON salary_deductions (employee_id, month, year);

-- 3. Add custom_deduction column to salary_slips (stores total of all custom deductions baked in at generation time)
ALTER TABLE salary_slips
  ADD COLUMN IF NOT EXISTS custom_deduction NUMERIC(10,2) DEFAULT 0;

-- 4. RLS policies for salary_deductions
--    (Table was created with RLS enabled — add these policies next)

-- Only the service role (backend) can do anything. No direct client access.
-- All reads/writes go through the Express API which uses the service_role key.

-- Allow backend (service role) full access — this is automatic with service_role key.
-- These policies guard against accidental direct anon/authenticated access:

-- Block all direct access for anon users
CREATE POLICY "No anon access" ON salary_deductions
  FOR ALL TO anon USING (false);

-- Authenticated users can only read their own deductions
CREATE POLICY "Employee reads own deductions" ON salary_deductions
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid()::text);

-- Only service_role (backend) can insert/update/delete — no policy needed,
-- service_role bypasses RLS automatically.

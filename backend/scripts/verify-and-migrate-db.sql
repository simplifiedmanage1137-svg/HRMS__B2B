-- ============================================================
-- HRMS DATABASE VERIFICATION & SAFE MIGRATION SCRIPT
-- Run this in Supabase SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS / DO blocks)
-- ============================================================


-- ============================================================
-- 1. EMPLOYEES TABLE — verify and add missing columns
-- ============================================================

-- role column (added by add-role-column.sql — verify it exists)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'employee'
  CHECK (role IN ('admin', 'manager', 'employee'));

-- Backfill nulls
UPDATE employees SET role = 'employee' WHERE role IS NULL OR role = '';

-- Other columns used by the app that may be missing
ALTER TABLE employees ADD COLUMN IF NOT EXISTS middle_name         VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone              VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS city               VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS state              VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pincode            VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS blood_group        VARCHAR(10);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact  VARCHAR(50);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_policy    TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS in_hand_salary     NUMERIC DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS gross_salary       NUMERIC DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account_name  VARCHAR(200);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS account_number     VARCHAR(50);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ifsc_code          VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS branch_name        VARCHAR(200);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pan_number         VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS aadhar_number      VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS joining_month_count INTEGER DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS can_apply_leave    BOOLEAN DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS reporting_manager  VARCHAR(200);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS shift_timing       VARCHAR(100) DEFAULT '9:00 AM - 6:00 PM';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_type    VARCHAR(50)  DEFAULT 'Full Time';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_active          BOOLEAN DEFAULT true;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ  DEFAULT now();
ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_image      TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS appointment_letter TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS offer_letter       TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_document  TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS aadhar_card        TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pan_card           TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_proof         TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS education_certificates TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS experience_certificates TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS relieving_letter   TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_slip        TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS resume             TEXT;


-- ============================================================
-- 2. TEAMS TABLE — create if not exists
-- ============================================================

CREATE TABLE IF NOT EXISTS teams (
    id           BIGSERIAL PRIMARY KEY,
    team_name    VARCHAR(100) NOT NULL UNIQUE,
    description  TEXT,
    manager_id   VARCHAR(50)  NOT NULL,
    status       VARCHAR(10)  NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'inactive')),
    login_time   TIME,
    shift_timing VARCHAR(50),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);


-- ============================================================
-- 3. TEAM MEMBERS TABLE — create if not exists
-- ============================================================

CREATE TABLE IF NOT EXISTS team_members (
    id          BIGSERIAL PRIMARY KEY,
    team_id     BIGINT      NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (employee_id)
);


-- ============================================================
-- 4. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_teams_manager_id        ON teams(manager_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id    ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_employee   ON team_members(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_role          ON employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_is_active     ON employees(is_active);


-- ============================================================
-- 5. VERIFICATION REPORT
-- ============================================================

SELECT
  'employees'    AS table_name,
  COUNT(*)       AS total_rows,
  COUNT(*) FILTER (WHERE role = 'admin')    AS admins,
  COUNT(*) FILTER (WHERE role = 'manager')  AS managers,
  COUNT(*) FILTER (WHERE role = 'employee') AS employees,
  COUNT(*) FILTER (WHERE is_active = true)  AS active
FROM employees

UNION ALL

SELECT
  'teams'        AS table_name,
  COUNT(*)       AS total_rows,
  NULL, NULL, NULL,
  COUNT(*) FILTER (WHERE status = 'active') AS active
FROM teams

UNION ALL

SELECT
  'team_members' AS table_name,
  COUNT(*)       AS total_rows,
  NULL, NULL, NULL, NULL
FROM team_members;


-- ============================================================
-- 6. COLUMN CHECK — confirm all key columns exist in employees
-- ============================================================

SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'employees'
  AND column_name IN (
    'id','employee_id','first_name','last_name','middle_name',
    'email','phone','role','is_active','joining_date','dob',
    'department','designation','reporting_manager',
    'employment_type','shift_timing','in_hand_salary','gross_salary',
    'blood_group','address','city','state','pincode',
    'emergency_contact','pan_number','aadhar_number',
    'bank_account_name','account_number','ifsc_code','branch_name',
    'joining_month_count','can_apply_leave',
    'profile_image','password','created_at','updated_at'
  )
ORDER BY column_name;


-- ============================================================
-- 7. COLUMN CHECK — confirm teams and team_members columns
-- ============================================================

SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name IN ('teams', 'team_members')
ORDER BY table_name, column_name;

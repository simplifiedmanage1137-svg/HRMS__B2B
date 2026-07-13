-- Run in Supabase SQL Editor

-- Profile completion flag
ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE;

-- Contact / personal fields
ALTER TABLE employees ADD COLUMN IF NOT EXISTS personal_email            VARCHAR(255);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS blood_group               VARCHAR(10);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address                   TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS city                      VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS state                     VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pincode                   VARCHAR(10);

-- Bank details
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account_name        VARCHAR(255);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS account_number           VARCHAR(50);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ifsc_code                VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS branch_name              VARCHAR(255);

-- Tax / identity
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pan_number               VARCHAR(10);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS aadhar_number            VARCHAR(12);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS uan                      VARCHAR(20);

-- Emergency contact
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_name       VARCHAR(255);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_relation   VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact            VARCHAR(20);

-- Admin-controlled toggle: when TRUE, that employee is required to fill the profile form
ALTER TABLE employees ADD COLUMN IF NOT EXISTS require_profile_completion BOOLEAN DEFAULT FALSE;

-- Mark existing employees as already complete so they don't see the onboarding screen
UPDATE employees SET profile_completed = TRUE WHERE profile_completed IS NULL OR profile_completed = FALSE;
-- Existing employees don't need to fill the form (toggle stays OFF by default)

-- Adds LinkedIn Profile URL storage for employees and onboarding submissions.
-- Run this once in the Supabase SQL editor.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE employee_onboarding_submissions ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

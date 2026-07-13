-- Run in Supabase SQL Editor

ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS personal_email    VARCHAR(255);

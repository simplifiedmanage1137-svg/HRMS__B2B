-- Migration: Add role column to employees table
-- Run this in your Supabase SQL editor

-- Step 1: Add role column with default 'employee'
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'employee'
CHECK (role IN ('admin', 'manager', 'employee'));

-- Step 2: Backfill all existing employees
UPDATE employees SET role = 'employee' WHERE role IS NULL OR role = '';

-- Step 3: Verify
SELECT role, COUNT(*) FROM employees GROUP BY role;

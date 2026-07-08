-- Migration: add 'missing' to attendance status constraint
-- Run this in Supabase SQL Editor (Database > SQL Editor)

ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;

ALTER TABLE attendance ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('present', 'absent', 'half_day', 'working', 'on_leave', 'missing'));

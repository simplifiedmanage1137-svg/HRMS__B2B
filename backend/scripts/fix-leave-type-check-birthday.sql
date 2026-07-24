-- Fix: "leaves_leave_type_check" constraint is missing 'Birthday', so applying
-- Birthday leave fails with "Failed to apply leave" (constraint violation).
-- Run this once in the Supabase SQL editor.

ALTER TABLE leaves DROP CONSTRAINT IF EXISTS leaves_leave_type_check;

ALTER TABLE leaves ADD CONSTRAINT leaves_leave_type_check
  CHECK (leave_type IN (
    'Annual', 'Sick', 'Personal', 'Maternity', 'Paternity',
    'Bereavement', 'Unpaid', 'Comp-Off', 'Birthday'
  ));

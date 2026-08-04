ALTER TABLE employees
ADD COLUMN IF NOT EXISTS "isFlexibleShift" boolean DEFAULT false;

COMMENT ON COLUMN employees."isFlexibleShift" IS 'When true, attendance ignores shift timing and late-mark logic and uses total working hours only.';

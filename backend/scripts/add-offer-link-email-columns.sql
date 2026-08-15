-- ============================================================================
-- New feature: send the generated offer/onboarding link directly to the
-- candidate's email (with optional CC), instead of only copy/paste sharing.
--
-- Purely additive — no existing column/table touched, safe to run any time.
-- ============================================================================

ALTER TABLE employee_offer_links ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE employee_offer_links ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;
ALTER TABLE employee_offer_links ADD COLUMN IF NOT EXISTS emailed_cc TEXT;

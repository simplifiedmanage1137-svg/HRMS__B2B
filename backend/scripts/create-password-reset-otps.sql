-- ============================================================================
-- New Forgot Password flow: email + 4-digit OTP, replacing the old DOB/phone
-- identity-verification flow entirely.
--
-- One row per employee (UNIQUE employee_id) — requesting a new OTP overwrites
-- the previous row (upsert), so only the most recently sent OTP is ever valid,
-- and a successful verification DELETEs the row (immediate invalidation).
-- The OTP itself is never stored in plain text — only its bcrypt hash.
-- ============================================================================

CREATE TABLE IF NOT EXISTS password_reset_otps (
  id           SERIAL PRIMARY KEY,
  employee_id  VARCHAR(50) NOT NULL UNIQUE,
  otp_hash     TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

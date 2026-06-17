-- ============================================================
-- MANAGER SETTINGS TABLE
-- Stores login time and working days per manager
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS manager_settings (
    id           BIGSERIAL PRIMARY KEY,
    manager_id   VARCHAR(50) NOT NULL UNIQUE,
    login_time   TIME        NOT NULL DEFAULT '09:00:00',
    working_days TEXT[]      NOT NULL DEFAULT ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'],
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manager_settings_manager_id ON manager_settings(manager_id);

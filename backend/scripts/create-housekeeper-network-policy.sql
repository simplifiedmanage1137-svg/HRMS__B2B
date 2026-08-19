-- ============================================================================
-- Housekeeper IP-allowlist access control.
--
-- Restricts the "housekeeper" role to logging in / clocking in-out only from
-- allowlisted IPs/CIDRs (e.g. office networks). No other role is affected —
-- see backend/utils/housekeeperNetworkGate.js (isPureHousekeeper).
--
-- Single-tenant app (no organization_id anywhere else in this schema — see
-- backend/config/supabase.js), so housekeeper_network_policy is a singleton
-- row (id = 1) rather than per-org.
--
-- This app's backend always talks to Supabase via the service-role key
-- (backend/config/supabase.js) and the frontend never calls Supabase
-- directly — every other table in this schema relies on Express-layer auth
-- (verifyToken / isAdmin) rather than RLS, so these tables follow the same
-- convention: access control lives in backend/routes/housekeeperNetworkRoutes.js
-- (isAdmin-gated), not in Postgres policies.
--
-- Safe to run more than once (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT
-- EXISTS throughout) — run once in the Supabase SQL editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS housekeeper_allowlisted_networks (
  id           SERIAL PRIMARY KEY,
  label        VARCHAR(120) NOT NULL,
  cidr         VARCHAR(64) NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_by   VARCHAR(50),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS housekeeper_network_policy (
  id                       SMALLINT PRIMARY KEY DEFAULT 1,
  restriction_enabled      BOOLEAN NOT NULL DEFAULT false,
  monitor_only             BOOLEAN NOT NULL DEFAULT true,
  emergency_override_until TIMESTAMPTZ,
  updated_by               VARCHAR(50),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT housekeeper_network_policy_singleton CHECK (id = 1)
);

-- Seed the singleton policy row with safe rollout defaults (disabled + monitor-only)
-- if it doesn't exist yet.
INSERT INTO housekeeper_network_policy (id, restriction_enabled, monitor_only)
VALUES (1, false, true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS housekeeper_access_audit (
  id          BIGSERIAL PRIMARY KEY,
  user_id     VARCHAR(50),
  event_type  VARCHAR(50) NOT NULL, -- ip_blocked | ip_blocked_monitor | policy_updated | network_added | network_updated | network_removed | override_started | override_stopped | spike_alert
  ip          VARCHAR(64),
  user_agent  TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_housekeeper_access_audit_event_created
  ON housekeeper_access_audit (event_type, created_at DESC);

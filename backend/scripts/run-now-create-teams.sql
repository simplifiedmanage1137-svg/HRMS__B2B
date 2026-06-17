-- Run this in Supabase Dashboard → SQL Editor → New Query → Run

CREATE TABLE IF NOT EXISTS teams (
    id           BIGSERIAL PRIMARY KEY,
    team_name    VARCHAR(100) NOT NULL UNIQUE,
    description  TEXT,
    manager_id   VARCHAR(50)  NOT NULL,
    status       VARCHAR(10)  NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    login_time   TIME,
    shift_timing VARCHAR(50),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
    id          BIGSERIAL PRIMARY KEY,
    team_id     BIGINT      NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (employee_id)
);

CREATE INDEX IF NOT EXISTS idx_teams_manager_id      ON teams(manager_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id  ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_employee ON team_members(employee_id);

-- Verify
SELECT 'teams created' AS status, COUNT(*) AS rows FROM teams
UNION ALL
SELECT 'team_members created', COUNT(*) FROM team_members;

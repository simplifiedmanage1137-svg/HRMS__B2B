-- Teams module migration
-- Run in Supabase SQL editor

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    id            BIGSERIAL PRIMARY KEY,
    team_name     VARCHAR(100) NOT NULL UNIQUE,
    description   TEXT,
    manager_id    VARCHAR(50) NOT NULL,  -- references employees.employee_id
    status        VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    -- future policy columns (nullable, added later)
    login_time    TIME,
    shift_timing  VARCHAR(50),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
    id          BIGSERIAL PRIMARY KEY,
    team_id     BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) NOT NULL,   -- references employees.employee_id
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (employee_id)               -- employee belongs to only one team
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_teams_manager_id  ON teams(manager_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);

-- Verify
SELECT 'teams' AS tbl, count(*) FROM teams
UNION ALL
SELECT 'team_members', count(*) FROM team_members;

-- Adds the dashboard "Post / Poll / Praise" composer feed support.
-- Run this once in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS dashboard_posts (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id            TEXT NOT NULL,
  author_name            TEXT NOT NULL,
  post_type              TEXT NOT NULL DEFAULT 'post',   -- 'post' | 'poll' | 'praise'
  content                TEXT NOT NULL,
  poll_options           JSONB DEFAULT '[]',             -- array of strings, only for post_type='poll'
  praised_employee_id    TEXT,                           -- only for post_type='praise'
  praised_employee_name  TEXT,
  mentioned_employees    JSONB DEFAULT '[]',
  liked_by               JSONB DEFAULT '[]',
  created_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dashboard_posts_created_at ON dashboard_posts (created_at DESC);

CREATE TABLE IF NOT EXISTS post_comments (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id                UUID NOT NULL REFERENCES dashboard_posts(id) ON DELETE CASCADE,
  commenter_employee_id  TEXT NOT NULL,
  commenter_name         TEXT NOT NULL,
  comment                TEXT NOT NULL,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments (post_id);

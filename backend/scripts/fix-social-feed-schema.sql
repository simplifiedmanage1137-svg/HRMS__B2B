-- Consolidated, safe-to-rerun fix for the social feed schema. Run this once in
-- the Supabase SQL editor — it brings dashboard_posts/post_comments/post_follows
-- fully up to date no matter which of the earlier migration files were or
-- weren't already applied (diagnostics showed post_comments was missing and
-- dashboard_posts was missing image_url/media_urls/category).

CREATE TABLE IF NOT EXISTS dashboard_posts (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id            TEXT NOT NULL,
  author_name            TEXT NOT NULL,
  post_type              TEXT NOT NULL DEFAULT 'post',
  content                TEXT NOT NULL,
  poll_options           JSONB DEFAULT '[]',
  praised_employee_id    TEXT,
  praised_employee_name  TEXT,
  mentioned_employees    JSONB DEFAULT '[]',
  liked_by               JSONB DEFAULT '[]',
  created_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dashboard_posts_created_at ON dashboard_posts (created_at DESC);

ALTER TABLE dashboard_posts ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE dashboard_posts ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT '[]';
ALTER TABLE dashboard_posts ADD COLUMN IF NOT EXISTS category TEXT;

CREATE TABLE IF NOT EXISTS post_comments (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id                UUID NOT NULL REFERENCES dashboard_posts(id) ON DELETE CASCADE,
  commenter_employee_id  TEXT NOT NULL,
  commenter_name         TEXT NOT NULL,
  comment                TEXT NOT NULL,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments (post_id);
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_post_comments_parent ON post_comments (parent_comment_id);

CREATE TABLE IF NOT EXISTS post_follows (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_employee_id   TEXT NOT NULL,
  followed_employee_id   TEXT NOT NULL,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uniq_follow UNIQUE (follower_employee_id, followed_employee_id)
);
CREATE INDEX IF NOT EXISTS idx_post_follows_follower ON post_follows (follower_employee_id);

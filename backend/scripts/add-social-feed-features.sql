-- Adds gallery/category support to dashboard posts and a lightweight follow system
-- for the "All Posts" social feed drawer. Run this once in the Supabase SQL editor.

ALTER TABLE dashboard_posts ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT '[]'; -- [{ url, type: 'image' }]
ALTER TABLE dashboard_posts ADD COLUMN IF NOT EXISTS category TEXT; -- 'Achievement' | 'Promotion' | 'Office Event' | 'Certification' | 'Team Outing' | 'Project Launch' | null

CREATE TABLE IF NOT EXISTS post_follows (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_employee_id   TEXT NOT NULL,
  followed_employee_id   TEXT NOT NULL,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uniq_follow UNIQUE (follower_employee_id, followed_employee_id)
);
CREATE INDEX IF NOT EXISTS idx_post_follows_follower ON post_follows (follower_employee_id);

-- Note: reactions (like/love/clap) reuse the existing `liked_by` JSONB column on
-- dashboard_posts — no schema change needed, it now stores [{employee_id, type}]
-- objects instead of plain employee_id strings (old rows with plain strings are
-- still read correctly and treated as a 'like').
-- Note: "profile photo updated" auto-posts reuse the existing dashboard_posts
-- table with post_type = 'profile_update' — no schema change needed.

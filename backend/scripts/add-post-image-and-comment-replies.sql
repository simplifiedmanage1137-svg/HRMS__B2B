-- Adds photo support to dashboard posts and reply-threading to post comments.
-- Run this once in the Supabase SQL editor.

ALTER TABLE dashboard_posts ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_post_comments_parent ON post_comments (parent_comment_id);

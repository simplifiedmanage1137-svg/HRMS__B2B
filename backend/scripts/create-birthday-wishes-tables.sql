-- Adds birthday/anniversary wish + comment support for the Dashboard "Celebrations" widget.
-- Run this once in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS birthday_wishes (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_employee_id  TEXT NOT NULL,
  recipient_name         TEXT NOT NULL,
  sender_employee_id     TEXT NOT NULL,
  sender_name            TEXT NOT NULL,
  event_type             TEXT NOT NULL DEFAULT 'birthday',   -- 'birthday' | 'anniversary'
  event_date             DATE NOT NULL DEFAULT CURRENT_DATE,
  message                TEXT NOT NULL,
  liked_by               JSONB DEFAULT '[]',
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uniq_wish_per_sender_per_day
    UNIQUE (recipient_employee_id, sender_employee_id, event_date, event_type)
);
CREATE INDEX IF NOT EXISTS idx_wishes_recipient_date ON birthday_wishes (recipient_employee_id, event_date, event_type);

CREATE TABLE IF NOT EXISTS wish_comments (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wish_id                UUID NOT NULL REFERENCES birthday_wishes(id) ON DELETE CASCADE,
  commenter_employee_id  TEXT NOT NULL,
  commenter_name         TEXT NOT NULL,
  comment                TEXT NOT NULL,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wish_comments_wish_id ON wish_comments (wish_id);

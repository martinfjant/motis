-- When the protocol was closed (normally when "Avsluta mötet" was clicked).
-- ISO 8601 UTC; NULL while the meeting is still going on.
ALTER TABLE protocols ADD COLUMN closed_at TEXT;

-- Changes made after closing. One row per editing session (from clicking
-- "Redigera protokollet" until done); edited_at is the session's last save.
-- user_name is a snapshot so the record survives the account being removed.
CREATE TABLE protocol_edits (
  id TEXT PRIMARY KEY,
  protocol_id TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  edited_at TEXT NOT NULL
);
CREATE INDEX protocol_edits_protocol ON protocol_edits (protocol_id, edited_at);

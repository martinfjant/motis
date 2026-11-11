-- Board members without an account: they can be marked present and chosen
-- (e.g. as chair) in protocols, but cannot log in. When someone registers
-- with the same email, an admin links them up (see linkUnregistered).
CREATE TABLE board_unregistered_members (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX board_unregistered_members_board ON board_unregistered_members (board_id);
CREATE UNIQUE INDEX board_unregistered_members_email
  ON board_unregistered_members (board_id, email) WHERE email != '';

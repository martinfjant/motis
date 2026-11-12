-- Emails "sent" in development, where nothing leaves the machine; shown at
-- /utkorg. In production mail goes through the provider and nothing is
-- stored here. created_at is ISO 8601 UTC.
CREATE TABLE outbox (
  id TEXT PRIMARY KEY,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  text TEXT NOT NULL,
  html TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX outbox_created ON outbox (created_at);

-- One-time links sent by email: confirming an address ('verify'), resetting
-- a password ('reset') and reviewing a protocol ('review'). Only a hash of
-- the token is stored, so the database alone can't be used to follow a link.
-- subject_id is what the link is about (a user id, a review id), email the
-- address it was sent to. Times are ISO 8601 UTC.
CREATE TABLE email_tokens (
  token_hash TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify', 'reset', 'review')),
  subject_id TEXT NOT NULL,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX email_tokens_subject ON email_tokens (purpose, subject_id);

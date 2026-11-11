-- Login attempts within the rate-limit window, one row per key per attempt.
-- key is "email:<address>" or "ip:<address>"; attempt_id ties the two rows of
-- one attempt together so they can be removed together.
CREATE TABLE login_attempts (
  attempt_id TEXT NOT NULL,
  key TEXT NOT NULL,
  attempted_at TEXT NOT NULL
);
CREATE INDEX login_attempts_key ON login_attempts (key, attempted_at);

-- Justering: a closed protocol is sent to its justerare, one row per
-- justerare per round. Sending again starts a new round; only the latest
-- round counts. content_hash is a fingerprint of the protocol as sent, so
-- an approval is known to be of exactly that content. member is the
-- justerare's MemberRef ("user:<id>" or "unregistered:<id>"); name and
-- email are as they were when sent. sent_by_name is a snapshot, like
-- protocol_edits. Times are ISO 8601 UTC. The emailed link is a 'review'
-- token in email_tokens with this row's id as subject.
CREATE TABLE protocol_reviews (
  id TEXT PRIMARY KEY,
  protocol_id TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  member TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  comment TEXT NOT NULL DEFAULT '',
  decided_at TEXT,
  sent_at TEXT NOT NULL,
  sent_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  sent_by_name TEXT NOT NULL
);
CREATE INDEX protocol_reviews_protocol ON protocol_reviews (protocol_id, round);

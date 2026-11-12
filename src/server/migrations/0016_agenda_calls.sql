-- Each time a kallelse (the agenda, by email) was sent to the board: when,
-- by whom (a snapshot, like protocol_edits) and to whom, as JSON
-- [{"name": "...", "email": "..."}]. ISO 8601 UTC.
CREATE TABLE agenda_calls (
  id TEXT PRIMARY KEY,
  agenda_id TEXT NOT NULL REFERENCES agendas(id) ON DELETE CASCADE,
  sent_at TEXT NOT NULL,
  sent_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  sent_by_name TEXT NOT NULL,
  recipients TEXT NOT NULL
);
CREATE INDEX agenda_calls_agenda ON agenda_calls (agenda_id, sent_at);

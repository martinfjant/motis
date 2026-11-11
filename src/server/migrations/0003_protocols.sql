-- "slug" was a random share id all along; name it for what it is.
ALTER TABLE agendas RENAME COLUMN slug TO share_id;

-- The minutes of a meeting. Created from an agenda (which stays untouched),
-- at most one per agenda. share_id is its own random public link.
CREATE TABLE protocols (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  agenda_id TEXT UNIQUE REFERENCES agendas(id) ON DELETE SET NULL,
  share_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  meeting_at TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX protocols_board ON protocols (board_id, meeting_at);

-- Same shape as agenda_items plus what was recorded at the meeting.
-- value: JSON, see ProtocolValue in src/server/items.ts.
CREATE TABLE protocol_items (
  id TEXT PRIMARY KEY,
  protocol_id TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('toggle', 'attendance', 'person', 'decision', 'text')),
  description TEXT NOT NULL DEFAULT '',
  config TEXT NOT NULL DEFAULT '{}',
  value TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX protocol_items_protocol ON protocol_items (protocol_id, position);

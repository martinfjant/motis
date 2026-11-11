-- Reusable agenda templates, owned by a board.
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- type: toggle | attendance | person | decision | text
-- config: JSON, e.g. {"extraNames": ["Revisor Lisa"]} for attendance items.
CREATE TABLE template_items (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('toggle', 'attendance', 'person', 'decision', 'text')),
  description TEXT NOT NULL DEFAULT '',
  config TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX template_items_template ON template_items (template_id, position);

-- A meeting agenda (dagordning). slug is the unguessable public share id.
CREATE TABLE agendas (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  meeting_at TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX agendas_board ON agendas (board_id, meeting_at);

CREATE TABLE agenda_items (
  id TEXT PRIMARY KEY,
  agenda_id TEXT NOT NULL REFERENCES agendas(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('toggle', 'attendance', 'person', 'decision', 'text')),
  description TEXT NOT NULL DEFAULT '',
  config TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX agenda_items_agenda ON agenda_items (agenda_id, position);

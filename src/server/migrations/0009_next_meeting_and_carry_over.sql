-- Adds the 'next_meeting' item type (the date of the next meeting, decided at
-- this one) and lets agenda points remember which protocol point they were
-- carried over from (tabled or marked for follow-up). SQLite cannot alter a
-- CHECK constraint, so the item tables are rebuilt as in 0004.

CREATE TABLE template_items_new (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('open', 'close', 'toggle', 'attendance', 'person', 'decision', 'text', 'next_meeting')),
  description TEXT NOT NULL DEFAULT '',
  config TEXT NOT NULL DEFAULT '{}'
);
INSERT INTO template_items_new (id, template_id, position, title, type, description, config)
  SELECT id, template_id, position, title, type, description, config FROM template_items;
DROP TABLE template_items;
ALTER TABLE template_items_new RENAME TO template_items;
CREATE INDEX template_items_template ON template_items (template_id, position);

-- source_item_id: the protocol point this was carried over from, if any.
-- Deliberately no foreign key: it is only used to avoid carrying the same
-- point twice, and must survive the protocol table being rebuilt.
CREATE TABLE agenda_items_new (
  id TEXT PRIMARY KEY,
  agenda_id TEXT NOT NULL REFERENCES agendas(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('open', 'close', 'toggle', 'attendance', 'person', 'decision', 'text', 'next_meeting')),
  description TEXT NOT NULL DEFAULT '',
  config TEXT NOT NULL DEFAULT '{}',
  source_item_id TEXT
);
INSERT INTO agenda_items_new (id, agenda_id, position, title, type, description, config)
  SELECT id, agenda_id, position, title, type, description, config FROM agenda_items;
DROP TABLE agenda_items;
ALTER TABLE agenda_items_new RENAME TO agenda_items;
CREATE INDEX agenda_items_agenda ON agenda_items (agenda_id, position);
CREATE INDEX agenda_items_source ON agenda_items (source_item_id);

CREATE TABLE protocol_items_new (
  id TEXT PRIMARY KEY,
  protocol_id TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('open', 'close', 'toggle', 'attendance', 'person', 'decision', 'text', 'next_meeting')),
  description TEXT NOT NULL DEFAULT '',
  config TEXT NOT NULL DEFAULT '{}',
  value TEXT NOT NULL DEFAULT '{}'
);
INSERT INTO protocol_items_new (id, protocol_id, position, title, type, description, config, value)
  SELECT id, protocol_id, position, title, type, description, config, value FROM protocol_items;
DROP TABLE protocol_items;
ALTER TABLE protocol_items_new RENAME TO protocol_items;
CREATE INDEX protocol_items_protocol ON protocol_items (protocol_id, position);

-- The default "Nästa möte" point becomes the new type. Closed protocols are
-- records of what was written and keep their free text.
UPDATE template_items SET type = 'next_meeting' WHERE type = 'text' AND title = 'Nästa möte';
UPDATE agenda_items SET type = 'next_meeting' WHERE type = 'text' AND title = 'Nästa möte';
UPDATE protocol_items SET type = 'next_meeting'
  WHERE type = 'text' AND title = 'Nästa möte'
    AND protocol_id IN (SELECT id FROM protocols WHERE closed_at IS NULL);

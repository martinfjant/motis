-- Adds the 'reviewers' item type ("Val av justerare"): one or two justerare,
-- chosen among those present, with a reference to the member so their email
-- address can be found. config: {"reviewerCount": 1 | 2}. SQLite cannot
-- alter a CHECK constraint, so the item tables are rebuilt as in 0009.

CREATE TABLE template_items_new (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('open', 'close', 'toggle', 'attendance', 'person', 'decision', 'text', 'next_meeting', 'reviewers')),
  description TEXT NOT NULL DEFAULT '',
  config TEXT NOT NULL DEFAULT '{}'
);
INSERT INTO template_items_new (id, template_id, position, title, type, description, config)
  SELECT id, template_id, position, title, type, description, config FROM template_items;
DROP TABLE template_items;
ALTER TABLE template_items_new RENAME TO template_items;
CREATE INDEX template_items_template ON template_items (template_id, position);

CREATE TABLE agenda_items_new (
  id TEXT PRIMARY KEY,
  agenda_id TEXT NOT NULL REFERENCES agendas(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('open', 'close', 'toggle', 'attendance', 'person', 'decision', 'text', 'next_meeting', 'reviewers')),
  description TEXT NOT NULL DEFAULT '',
  config TEXT NOT NULL DEFAULT '{}',
  source_item_id TEXT
);
INSERT INTO agenda_items_new (id, agenda_id, position, title, type, description, config, source_item_id)
  SELECT id, agenda_id, position, title, type, description, config, source_item_id FROM agenda_items;
DROP TABLE agenda_items;
ALTER TABLE agenda_items_new RENAME TO agenda_items;
CREATE INDEX agenda_items_agenda ON agenda_items (agenda_id, position);
CREATE INDEX agenda_items_source ON agenda_items (source_item_id);

CREATE TABLE protocol_items_new (
  id TEXT PRIMARY KEY,
  protocol_id TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('open', 'close', 'toggle', 'attendance', 'person', 'decision', 'text', 'next_meeting', 'reviewers')),
  description TEXT NOT NULL DEFAULT '',
  config TEXT NOT NULL DEFAULT '{}',
  value TEXT NOT NULL DEFAULT '{}'
);
INSERT INTO protocol_items_new (id, protocol_id, position, title, type, description, config, value)
  SELECT id, protocol_id, position, title, type, description, config, value FROM protocol_items;
DROP TABLE protocol_items;
ALTER TABLE protocol_items_new RENAME TO protocol_items;
CREATE INDEX protocol_items_protocol ON protocol_items (protocol_id, position);

-- "Val av justerare" in templates and in agendas not yet started becomes the
-- new type, with two justerare. Protocols keep what was recorded.
UPDATE template_items SET type = 'reviewers', config = '{"reviewerCount":2}'
  WHERE type = 'person' AND lower(trim(title)) = 'val av justerare';
UPDATE agenda_items SET type = 'reviewers', config = '{"reviewerCount":2}'
  WHERE type = 'person' AND lower(trim(title)) = 'val av justerare'
    AND agenda_id NOT IN (SELECT agenda_id FROM protocols WHERE agenda_id IS NOT NULL);

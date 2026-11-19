-- A board's logo and banner picture, chosen in its settings. Each is the
-- key of a file in file storage (see src/server/files), e.g.
-- "bilder/<sha256>.webp", or NULL when not chosen. The logo is kept twice:
-- WebP for pages, PNG for the PDF.
ALTER TABLE boards ADD COLUMN logo_key TEXT;
ALTER TABLE boards ADD COLUMN logo_pdf_key TEXT;
ALTER TABLE boards ADD COLUMN banner_key TEXT;

-- Files attached to a point ("Bilaga 1", "Bilaga 2"…) of an agenda or a
-- protocol: item_kind says which, item_id is the agenda_items or
-- protocol_items row. A protocol gets copies of its agenda's rows when the
-- meeting starts, pointing at the same stored file. They are numbered per
-- meeting in point order, then by position within the point; the number
-- isn't stored. storage_key is the file in file storage
-- ("bilagor/<sha256>"), kept as long as a row points at it. name is the
-- file name as uploaded; created_by_name a snapshot, like protocol_edits.
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  item_kind TEXT NOT NULL CHECK (item_kind IN ('agenda', 'protocol')),
  item_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by_name TEXT NOT NULL
);
CREATE INDEX attachments_item ON attachments (item_kind, item_id, position);
CREATE INDEX attachments_storage_key ON attachments (storage_key);

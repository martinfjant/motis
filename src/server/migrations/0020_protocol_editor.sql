-- Who is writing an ongoing meeting's protocol: one browser tab at a time
-- (editor_session, a random id the tab makes), so two people can't
-- overwrite each other. Everyone else watches. editor_name is a snapshot
-- to show the others; editor_seen_at (ISO 8601 UTC) is when the tab last
-- checked in, so a tab that was closed stops holding the protocol.
ALTER TABLE protocols ADD COLUMN editor_session TEXT;
ALTER TABLE protocols ADD COLUMN editor_user_id TEXT;
ALTER TABLE protocols ADD COLUMN editor_name TEXT;
ALTER TABLE protocols ADD COLUMN editor_seen_at TEXT;

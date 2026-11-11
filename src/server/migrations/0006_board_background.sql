-- The board's background pattern: an id from src/patterns.ts, where
-- 'standard' is the default background in styles.css.
ALTER TABLE boards ADD COLUMN background TEXT NOT NULL DEFAULT 'standard';

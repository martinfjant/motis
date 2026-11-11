-- A member's title on a particular board, e.g. "Ordförande" or "Kassör".
-- Per board, since the same person can hold different posts in different BRFs.
ALTER TABLE board_memberships ADD COLUMN title TEXT NOT NULL DEFAULT '';

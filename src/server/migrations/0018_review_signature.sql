-- The justerare's drawn signature, given when approving: a PNG as a data
-- URL ("data:image/png;base64,…"), checked by the server. NULL while
-- pending or declined, and for approvals from before signatures existed.
ALTER TABLE protocol_reviews ADD COLUMN signature TEXT;

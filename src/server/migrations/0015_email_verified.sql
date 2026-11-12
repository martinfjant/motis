-- When the user confirmed that the email address is theirs, by following
-- the link sent to it (or by resetting their password through it). NULL
-- while unconfirmed; changing the address makes it NULL again. ISO 8601 UTC.
ALTER TABLE users ADD COLUMN email_verified_at TEXT;

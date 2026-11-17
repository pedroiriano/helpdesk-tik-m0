-- RM0-01. Canonical account columns, including earlier installations patched outside the ledger.
ALTER TABLE identity.subjects ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE identity.subjects ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE identity.subjects ADD COLUMN IF NOT EXISTS password_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS subjects_normalized_email_unique ON identity.subjects(lower(btrim(email))) WHERE nullif(btrim(email),'') IS NOT NULL;
-- Preserve legacy identity; proof of the password is required before adaptive rehash.
UPDATE identity.subjects SET password_hash='legacy-sha256$'||password_hash WHERE password_hash ~ '^[a-f0-9]{64}$';
GRANT SELECT, INSERT, UPDATE ON identity.subjects TO helpdesk_m1;
CREATE TABLE identity.security_version (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), version integer NOT NULL CHECK(version=1));
INSERT INTO identity.security_version VALUES(true,1);
GRANT SELECT ON identity.security_version TO helpdesk_m1;

CREATE TABLE notify_audit.sink_challenges (
 subject_id uuid NOT NULL,
 org_id uuid NOT NULL,
 digest bytea NOT NULL CHECK(octet_length(digest)=32),
 expires_at timestamptz NOT NULL,
 PRIMARY KEY(subject_id,org_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON notify_audit.sink_challenges TO helpdesk_m9;

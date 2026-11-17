-- RM0-01. Historical unscoped media remains owned by its principal until reviewed.
ALTER TABLE knowledge.media ADD COLUMN org_id uuid;
ALTER TABLE knowledge.media ADD COLUMN upload_lease_until timestamptz;
-- Previous uploads defaulted to PUBLIC without an approval workflow. Retain
-- every blob and reference while requiring an authorized publication review.
UPDATE knowledge.media SET visibility='PRIVATE' WHERE org_id IS NULL;
CREATE INDEX media_scope_org ON knowledge.media(org_id,id);
CREATE TABLE knowledge.media_approvals (
 id uuid PRIMARY KEY,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 source_id uuid NOT NULL,
 source_owner text NOT NULL CHECK(source_owner IN ('M3','M8')),
 source_version bigint NOT NULL,
 source_sha text NOT NULL,
 copy_id uuid NOT NULL REFERENCES knowledge.media(id),
 copy_version bigint NOT NULL,
 copy_sha text NOT NULL,
 target_id uuid NOT NULL REFERENCES knowledge.content(id),
 target_audience text NOT NULL,
 org_id uuid NOT NULL,
 approved_by uuid NOT NULL,
 reason text NOT NULL,
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE ON knowledge.media_approvals TO helpdesk_m8;
REVOKE ALL ON knowledge.media_approvals FROM PUBLIC;
CREATE TABLE knowledge.security_version (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), version integer NOT NULL CHECK(version=1));
INSERT INTO knowledge.security_version VALUES(true,1);
GRANT SELECT ON knowledge.security_version TO helpdesk_m8;

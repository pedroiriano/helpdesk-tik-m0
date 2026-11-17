-- M0-03 additive identity metadata; historical migrations remain unchanged.
ALTER TABLE identity.subjects ADD COLUMN display_name text NOT NULL DEFAULT 'Identitas';
ALTER TABLE identity.subjects ADD COLUMN role_code text NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE identity.subjects ADD COLUMN lab_fixture boolean NOT NULL DEFAULT false;
ALTER TABLE identity.memberships ADD COLUMN grant_ceiling text[] NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX membership_binding_unique ON identity.memberships(subject_id,org_id,team_id) NULLS NOT DISTINCT;
CREATE TABLE identity.domain_version(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),version integer NOT NULL CHECK(version>0));
INSERT INTO identity.domain_version VALUES(true,3);
GRANT SELECT ON identity.domain_version TO helpdesk_m1;
REVOKE ALL ON identity.domain_version FROM PUBLIC;

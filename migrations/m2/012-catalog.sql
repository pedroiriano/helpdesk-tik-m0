-- Applied before M0-03 activates consumers. No rewriting historical form/policy versions.
ALTER TABLE catalog.categories ADD COLUMN owner_org_id uuid NOT NULL;
REVOKE UPDATE ON catalog.service_forms,catalog.policies FROM helpdesk_m2;
CREATE INDEX ON catalog.services(owner_org_id,id);
CREATE TABLE catalog.domain_version(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),version integer NOT NULL CHECK(version>0));
INSERT INTO catalog.domain_version VALUES(true,3);
GRANT SELECT ON catalog.domain_version TO helpdesk_m2;
REVOKE ALL ON catalog.domain_version FROM PUBLIC;

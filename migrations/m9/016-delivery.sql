-- M0-04 audit sink readiness.
CREATE TABLE notify_audit.domain_version(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),version integer NOT NULL CHECK(version=4));
INSERT INTO notify_audit.domain_version VALUES(true,4);
GRANT SELECT ON notify_audit.domain_version TO helpdesk_m9;
REVOKE ALL ON notify_audit.domain_version FROM PUBLIC;

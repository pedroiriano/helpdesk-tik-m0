ALTER TABLE identity.organizations ADD COLUMN reporting_visible boolean NOT NULL DEFAULT false;
ALTER TABLE identity.organizations ADD COLUMN reporting_reference boolean NOT NULL DEFAULT false;
CREATE TABLE identity.divisions (
    id uuid PRIMARY KEY,
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
    organization_id uuid NOT NULL REFERENCES identity.organizations(id),
    name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
    active boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX divisions_name_per_org ON identity.divisions(organization_id, lower(name));
CREATE INDEX divisions_by_org ON identity.divisions(organization_id, id);
GRANT SELECT, INSERT, UPDATE ON identity.divisions TO helpdesk_m1;
ALTER TABLE identity.divisions ADD CONSTRAINT division_identity_per_org UNIQUE (id, organization_id);
ALTER TABLE identity.teams ADD COLUMN division_id uuid;
ALTER TABLE identity.teams ADD CONSTRAINT team_division_in_same_org
    FOREIGN KEY (division_id, org_id) REFERENCES identity.divisions (id, organization_id);
